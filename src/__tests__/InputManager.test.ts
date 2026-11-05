import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '../config/GameConfig';
import { InputManager } from '../runtime/adapters/InputManager';

type GameEngineStub = {
  handleGameplayLook?: (deltaRadians: number) => boolean;
  handleGameplayDirection?: (direction: 'left' | 'right' | 'up' | 'down') => boolean;
  gameState: {
    playing?: boolean;
    getDialog: () => { active: boolean; page: number; maxPages: number };
    setDialogPage: (page: number) => void;
  };
  canvas?: HTMLCanvasElement;
  isDestroyed?: boolean;
  renderer: { draw: () => void; isRoomTransitionActive?: () => boolean };
  tryMove: (dx: number, dy: number) => void;
  closeDialog: () => void;
  advanceDialog: () => void;
  isEditorModeActive?: () => boolean;
  isGameOver?: () => boolean;
  handleGameOverInteraction?: () => void;
  isIntroVisible?: () => boolean;
  dismissIntroScreen?: () => void;
  isLevelUpCelebrationActive?: () => boolean;
  isLevelUpOverlayActive?: () => boolean;
  isPickupOverlayActive?: () => boolean;
  dismissPickupOverlay?: () => void;
  chooseLevelUpSkill?: (index: number) => void;
  moveLevelUpCursor?: (delta: number) => void;
  draw?: () => void;
  confirmLevelUpSelection?: () => void;
  pickLevelUpChoiceFromPointer?: (x: number, y: number) => number | null | undefined;
};

it('routes logical input through the presentation and cancels it on blur', () => {
  const root = document.createElement('div'); document.body.append(root);
  const handleGameplayDirection = vi.fn(() => true);
  const engine = createEngine({ handleGameplayDirection });
  const input = new InputManager(engine, root);
  try {
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(handleGameplayDirection).toHaveBeenCalledWith('left');
    expect(engine.tryMove).not.toHaveBeenCalled();
    globalThis.dispatchEvent(new Event('blur'));
    expect(root.querySelector('.is-pressed')).toBeNull();
  } finally { input.destroy(); root.remove(); }
});

const createEngine = (overrides: Partial<GameEngineStub> = {}): GameEngineStub => {
  return {
    gameState: {
      playing: true,
      getDialog: () => ({ active: false, page: 1, maxPages: 2 }),
      setDialogPage: vi.fn(),
      ...(overrides.gameState || {}),
    },
    renderer: { draw: vi.fn(), ...(overrides.renderer || {}) },
    canvas: document.createElement('canvas'),
    tryMove: vi.fn(),
    closeDialog: vi.fn(),
    advanceDialog: vi.fn(),
    isGameOver: () => false,
    handleGameOverInteraction: vi.fn(),
    isIntroVisible: () => false,
    dismissIntroScreen: vi.fn(),
    isLevelUpOverlayActive: () => false,
    isLevelUpCelebrationActive: () => false,
    isPickupOverlayActive: () => false,
    dismissPickupOverlay: vi.fn(),
    chooseLevelUpSkill: vi.fn(),
    moveLevelUpCursor: vi.fn(),
    draw: vi.fn(),
    confirmLevelUpSelection: vi.fn(),
    pickLevelUpChoiceFromPointer: vi.fn(),
    ...overrides,
  };
};

it('isolates embedded keyboard input to its root', () => {
  const first = createEngine(); const second = createEngine();
  const a = document.createElement('div'); const b = document.createElement('div'); document.body.append(a, b);
  const one = new InputManager(first, a); const two = new InputManager(second, b);
  try {
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(first.tryMove).toHaveBeenCalledOnce();
    expect(second.tryMove).not.toHaveBeenCalled();
  } finally { one.destroy(); two.destroy(); a.remove(); b.remove(); }
});

const createKeyEvent = (
  key: string,
  target?: HTMLElement,
  options: { code?: string; repeat?: boolean } = {},
) =>
  ({
    key,
    code: options.code ?? '',
    repeat: options.repeat ?? false,
    target,
    preventDefault: vi.fn(),
  }) as unknown as KeyboardEvent;

const createTouchEvent = (
  x: number,
  y: number,
  options: { identifier?: number; target?: EventTarget | null } = {},
) => {
  const touch = { clientX: x, clientY: y, identifier: options.identifier ?? 1 };
  const touchList = [touch];
  (touchList as unknown as { item: (index: number) => typeof touch | null }).item = (index: number) => touchList[index] || null;
  return {
    changedTouches: touchList,
    target: options.target,
    preventDefault: vi.fn(),
  } as unknown as TouchEvent;
};

const createMouseEvent = (x: number, y: number) =>
  ({
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
  }) as unknown as MouseEvent;

describe('InputManager', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('isGameModeActive checks the body class', () => {
    const engine = createEngine();
    const manager = new InputManager(engine);

    expect(manager.isGameModeActive()).toBe(false);
    document.body.classList.add('game-mode');
    expect(manager.isGameModeActive()).toBe(true);
  });

  it('setupEventListeners wires document events', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const engine = createEngine();

    new InputManager(engine);

    const events = addSpy.mock.calls.map((call) => call[0]);
    expect(events).toContain('keydown');
    expect(events).toContain('touchstart');
    expect(events).toContain('touchmove');
    expect(events).toContain('touchend');
    expect(events).toContain('click');
    addSpy.mockRestore();
  });

  it('handleKeyDown ignores all input in editor mode', () => {
    const engine = createEngine({
      isEditorModeActive: () => true,
      isGameOver: () => true,
    });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(ev.preventDefault).not.toHaveBeenCalled();
    expect(engine.handleGameOverInteraction).not.toHaveBeenCalled();
    expect(engine.dismissIntroScreen).not.toHaveBeenCalled();
  });

  // Regression: the original bug was a keystroke in the editor dismissing the
  // intro overlay, which resumed gameplay and started the YouTube soundtrack.
  it('handleKeyDown does not dismiss the intro (nor start music) in editor mode', () => {
    const engine = createEngine({
      isEditorModeActive: () => true,
      isIntroVisible: () => true,
    });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(engine.dismissIntroScreen).not.toHaveBeenCalled();
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it('handleKeyDown does not swallow keystrokes typed into editor fields', () => {
    const engine = createEngine({
      isEditorModeActive: () => true,
      isIntroVisible: () => true,
    });
    const manager = new InputManager(engine);
    const input = document.createElement('input');
    const ev = createKeyEvent('a', input);

    manager.handleKeyDown(ev);

    // Input must reach the field normally instead of being intercepted.
    expect(ev.preventDefault).not.toHaveBeenCalled();
    expect(engine.dismissIntroScreen).not.toHaveBeenCalled();
  });

  it('handleKeyDown still dismisses the intro when playing (not editing)', () => {
    const engine = createEngine({
      isEditorModeActive: () => false,
      isIntroVisible: () => true,
    });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(engine.dismissIntroScreen).toHaveBeenCalled();
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('handleKeyDown delegates game-over flow', () => {
    const engine = createEngine({ isGameOver: () => true });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(ev.preventDefault).toHaveBeenCalled();
    expect(engine.handleGameOverInteraction).toHaveBeenCalled();
  });

  it('handleKeyDown advances dialog via the engine', () => {
    const engine = createEngine({
      gameState: {
        getDialog: () => ({ active: true, page: 1, maxPages: 2 }),
        setDialogPage: vi.fn(),
      },
    });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(engine.advanceDialog).toHaveBeenCalled();
  });

  it('handleKeyDown triggers movement for game keys', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine();
    const manager = new InputManager(engine);
    const ev = createKeyEvent('ArrowLeft');

    manager.handleKeyDown(ev);

    expect(engine.tryMove).toHaveBeenCalledWith(-1, 0);
  });

  it('handleTouchStart advances dialog via the engine on tap', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine({
      gameState: {
        getDialog: () => ({ active: true, page: 1, maxPages: 2 }),
        setDialogPage: vi.fn(),
      },
    });
    const manager = new InputManager(engine);
    const ev = createTouchEvent(10, 20);

    manager.handleTouchStart(ev);

    expect(ev.preventDefault).toHaveBeenCalled();
    expect(engine.advanceDialog).toHaveBeenCalled();
  });

  it('handleTouchStart tracks initial touch', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine();
    const manager = new InputManager(engine);

    manager.handleTouchStart(createTouchEvent(10, 20, { target: engine.canvas }));

    const touchStart = (manager as unknown as { touchStart: unknown }).touchStart as {
      x: number;
      y: number;
    };
    expect(touchStart.x).toBe(10);
    expect(touchStart.y).toBe(20);
  });

  it('handleTouchMove prevents scrolling after a swipe threshold', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine();
    const manager = new InputManager(engine);
    (manager as unknown as { touchStart: unknown }).touchStart = {
      identifier: 1,
      x: 0,
      y: 0,
      time: Date.now(),
      prevented: false,
      direction: null,
    };

    const ev = createTouchEvent(20, 0);
    manager.handleTouchMove(ev);

    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('handleTouchEnd triggers swipe movement', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    document.body.classList.add('game-mode');
    const engine = createEngine();
    const manager = new InputManager(engine);
    (manager as unknown as { touchStart: unknown }).touchStart = {
      identifier: 1,
      x: 0,
      y: 0,
      time: 900,
      prevented: false,
      direction: null,
    };

    const ev = createTouchEvent(50, 0);
    manager.handleTouchEnd(ev);

    expect(engine.tryMove).toHaveBeenCalledWith(1, 0);
    vi.useRealTimers();
  });

  it('handleClick selects a level-up option when active', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine({ isLevelUpOverlayActive: () => true });
    const manager = new InputManager(engine);
    const spy = vi.spyOn(manager, 'chooseLevelUpByPointer');

    manager.handleClick(createMouseEvent(12, 34));

    expect(spy).toHaveBeenCalledWith(12, 34);
  });

  it('handleLevelUpKey supports number and navigation keys', () => {
    const engine = createEngine();
    const manager = new InputManager(engine);

    manager.handleLevelUpKey(createKeyEvent('1'));
    manager.handleLevelUpKey(createKeyEvent('arrowup'));
    manager.handleLevelUpKey(createKeyEvent('enter'));

    expect(engine.chooseLevelUpSkill).toHaveBeenCalledWith(0);
    expect(engine.moveLevelUpCursor).toHaveBeenCalledWith(-1);
    expect(engine.draw).toHaveBeenCalled();
    expect(engine.confirmLevelUpSelection).toHaveBeenCalled();
  });

  it('chooseLevelUpByPointer selects a level-up skill', () => {
    const engine = createEngine({
      pickLevelUpChoiceFromPointer: () => 2,
    });
    const manager = new InputManager(engine);

    manager.chooseLevelUpByPointer(5, 6);

    expect(engine.chooseLevelUpSkill).toHaveBeenCalledWith(2);
  });

  it('setupEditorInputs wires paint callbacks', () => {
    const engine = createEngine();
    const manager = new InputManager(engine);
    const canvas = document.createElement('canvas');
    const paint = vi.fn();

    manager.setupEditorInputs(canvas, paint);
    canvas.dispatchEvent(new MouseEvent('mousedown'));
    canvas.dispatchEvent(new MouseEvent('mousemove'));
    document.dispatchEvent(new MouseEvent('mouseup'));
    canvas.dispatchEvent(new MouseEvent('mousemove'));

    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('setupTileEditorInputs wires paint callbacks', () => {
    const engine = createEngine();
    const manager = new InputManager(engine);
    const canvas = document.createElement('canvas');
    const paint = vi.fn();

    manager.setupTileEditorInputs(canvas, paint);
    canvas.dispatchEvent(new MouseEvent('mousedown'));
    canvas.dispatchEvent(new MouseEvent('mousemove'));
    document.dispatchEvent(new MouseEvent('mouseup'));
    canvas.dispatchEvent(new MouseEvent('mousemove'));

    expect(paint).toHaveBeenCalledTimes(2);
  });

  describe('held movement cadence', () => {
    const installAnimationFrames = () => {
      const callbacks: FrameRequestCallback[] = [];
      const cancelled: number[] = [];
      vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }));
      vi.stubGlobal('cancelAnimationFrame', vi.fn((handle: number) => cancelled.push(handle)));
      return {
        runNext: (timestamp: number) => {
          const callback = callbacks.shift();
          if (!callback) throw new Error('No animation frame was scheduled');
          callback(timestamp);
        },
        callbacks,
        cancelled,
      };
    };

    it('moves immediately, repeats at the configured cadence, and stops on keyup', () => {
      document.body.classList.add('game-mode');
      vi.spyOn(performance, 'now').mockReturnValue(100);
      const frames = installAnimationFrames();
      const engine = createEngine();
      const manager = new InputManager(engine);

      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD' }));
      expect(engine.tryMove).toHaveBeenCalledTimes(1);
      expect(engine.tryMove).toHaveBeenLastCalledWith(1, 0);

      frames.runNext(100 + GameConfig.input.heldMoveIntervalMs - 1);
      expect(engine.tryMove).toHaveBeenCalledTimes(1);
      frames.runNext(100 + GameConfig.input.heldMoveIntervalMs);
      expect(engine.tryMove).toHaveBeenCalledTimes(2);

      manager.handleKeyUp(createKeyEvent('d', undefined, { code: 'KeyD' }));
      expect(frames.cancelled.length).toBeGreaterThanOrEqual(1);
      expect((manager as unknown as { heldDirections: Map<string, unknown> }).heldDirections.size).toBe(0);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('ignores native repeats and does not double-step for a same-direction alias', () => {
      document.body.classList.add('game-mode');
      vi.spyOn(performance, 'now').mockReturnValue(100);
      installAnimationFrames();
      const engine = createEngine();
      const manager = new InputManager(engine);

      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD' }));
      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD', repeat: true }));
      manager.handleKeyDown(createKeyEvent('ArrowRight', undefined, { code: 'ArrowRight' }));

      expect(engine.tryMove).toHaveBeenCalledTimes(1);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('uses latest-direction priority and resumes the previous held key on release', () => {
      document.body.classList.add('game-mode');
      vi.spyOn(performance, 'now').mockReturnValue(100);
      installAnimationFrames();
      const engine = createEngine();
      const manager = new InputManager(engine);

      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD' }));
      manager.handleKeyDown(createKeyEvent('w', undefined, { code: 'KeyW' }));
      manager.handleKeyUp(createKeyEvent('w', undefined, { code: 'KeyW' }));

      expect(engine.tryMove).toHaveBeenNthCalledWith(1, 1, 0);
      expect(engine.tryMove).toHaveBeenNthCalledWith(2, 0, -1);
      expect(engine.tryMove).toHaveBeenNthCalledWith(3, 1, 0);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('cancels rather than advancing a dialog opened by the immediate move', () => {
      document.body.classList.add('game-mode');
      vi.spyOn(performance, 'now').mockReturnValue(100);
      const frames = installAnimationFrames();
      let dialogActive = false;
      const engine = createEngine({
        gameState: {
          playing: true,
          getDialog: () => ({ active: dialogActive, page: 1, maxPages: 2 }),
          setDialogPage: vi.fn(),
        },
        tryMove: vi.fn(() => { dialogActive = true; }),
      });
      const manager = new InputManager(engine);

      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD' }));

      expect(engine.tryMove).toHaveBeenCalledTimes(1);
      expect(engine.advanceDialog).not.toHaveBeenCalled();
      expect(frames.callbacks).toHaveLength(0);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('keeps the held direction active while a room transition temporarily pauses gameplay', () => {
      document.body.classList.add('game-mode');
      vi.spyOn(performance, 'now').mockReturnValue(100);
      const frames = installAnimationFrames();
      let transitionActive = false;
      const gameState = {
        playing: true,
        getDialog: () => ({ active: false, page: 1, maxPages: 2 }),
        setDialogPage: vi.fn(),
      };
      const tryMove = vi.fn(() => {
        if (tryMove.mock.calls.length === 1) {
          transitionActive = true;
          gameState.playing = false;
        }
      });
      const engine = createEngine({
        gameState,
        renderer: {
          draw: vi.fn(),
          isRoomTransitionActive: () => transitionActive,
        },
        tryMove,
      });
      const manager = new InputManager(engine);

      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD' }));
      expect(engine.tryMove).toHaveBeenCalledTimes(1);
      expect((manager as unknown as { heldDirections: Map<string, unknown> }).heldDirections.size).toBe(1);

      frames.runNext(100 + GameConfig.input.heldMoveIntervalMs);
      expect(engine.tryMove).toHaveBeenCalledTimes(2);
      transitionActive = false;
      gameState.playing = true;
      frames.runNext(100 + GameConfig.input.heldMoveIntervalMs * 2);

      expect(engine.tryMove).toHaveBeenCalledTimes(3);
      expect(engine.tryMove).toHaveBeenLastCalledWith(1, 0);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('cancels held input when an editable field receives focus', () => {
      document.body.classList.add('game-mode');
      vi.spyOn(performance, 'now').mockReturnValue(100);
      const frames = installAnimationFrames();
      const engine = createEngine();
      const manager = new InputManager(engine);
      manager.handleKeyDown(createKeyEvent('d', undefined, { code: 'KeyD' }));
      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(frames.cancelled.length).toBeGreaterThanOrEqual(1);
      expect((manager as unknown as { heldDirections: Map<string, unknown> }).heldDirections.size).toBe(0);
      manager.destroy();
      vi.unstubAllGlobals();
    });
  });

  describe('D-pad holds', () => {
    const setup = (engine = createEngine()) => {
      document.body.classList.add('game-mode');
      document.body.insertAdjacentHTML('beforeend', `
        <div class="game-touch-pad">
          <button class="pad-button" data-direction="left"></button>
        </div>
      `);
      const manager = new InputManager(engine);
      const button = document.querySelector<HTMLButtonElement>('.pad-button[data-direction="left"]');
      if (!button) throw new Error('D-pad button missing');
      return { engine, manager, button };
    };

    it('starts on pointerdown, stays pressed across pointerleave, and stops on pointerup', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 7));
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      const { engine, manager, button } = setup();

      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
      button.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
      expect(engine.tryMove).toHaveBeenCalledWith(-1, 0);
      expect(button.classList.contains('is-pressed')).toBe(true);

      button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
      expect(button.classList.contains('is-pressed')).toBe(false);
      expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('advances an already-open dialog once without starting a hold', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 7));
      const engine = createEngine({
        gameState: {
          playing: true,
          getDialog: () => ({ active: true, page: 1, maxPages: 2 }),
          setDialogPage: vi.fn(),
        },
      });
      const { manager, button } = setup(engine);

      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));

      expect(engine.advanceDialog).toHaveBeenCalledTimes(1);
      expect(engine.tryMove).not.toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('ignores non-primary pointer buttons', () => {
      const { engine, manager, button } = setup();

      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 2 }));

      expect(engine.tryMove).not.toHaveBeenCalled();
      manager.destroy();
    });
  });

  describe('held canvas gestures', () => {
    it('moves on threshold crossing and supports a quick swipe completed at touchend', () => {
      document.body.classList.add('game-mode');
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      const engine = createEngine();
      const manager = new InputManager(engine);
      const canvas = engine.canvas as HTMLCanvasElement;

      manager.handleTouchStart(createTouchEvent(0, 0, { target: canvas, identifier: 4 }));
      manager.handleTouchMove(createTouchEvent(30, 0, { target: canvas, identifier: 4 }));
      manager.handleTouchEnd(createTouchEvent(30, 0, { target: canvas, identifier: 4 }));
      expect(engine.tryMove).toHaveBeenCalledTimes(1);

      manager.handleTouchStart(createTouchEvent(0, 0, { target: canvas, identifier: 5 }));
      manager.handleTouchEnd(createTouchEvent(0, 40, { target: canvas, identifier: 5 }));
      expect(engine.tryMove).toHaveBeenLastCalledWith(0, 1);
      expect(engine.tryMove).toHaveBeenCalledTimes(2);
      manager.destroy();
      vi.unstubAllGlobals();
    });

    it('does not turn a gesture starting outside the canvas into movement', () => {
      document.body.classList.add('game-mode');
      const engine = createEngine();
      const manager = new InputManager(engine);
      const chat = document.createElement('div');

      manager.handleTouchStart(createTouchEvent(0, 0, { target: chat, identifier: 2 }));
      manager.handleTouchMove(createTouchEvent(50, 0, { target: chat, identifier: 2 }));
      manager.handleTouchEnd(createTouchEvent(50, 0, { target: chat, identifier: 2 }));

      expect(engine.tryMove).not.toHaveBeenCalled();
      manager.destroy();
    });

    it('ignores unrelated touch identifiers and cancels the tracked identifier cleanly', () => {
      document.body.classList.add('game-mode');
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      const engine = createEngine();
      const manager = new InputManager(engine);
      const canvas = engine.canvas as HTMLCanvasElement;

      manager.handleTouchStart(createTouchEvent(0, 0, { target: canvas, identifier: 8 }));
      manager.handleTouchMove(createTouchEvent(50, 0, { target: canvas, identifier: 9 }));
      expect(engine.tryMove).not.toHaveBeenCalled();
      manager.handleTouchMove(createTouchEvent(50, 0, { target: canvas, identifier: 8 }));
      expect(engine.tryMove).toHaveBeenCalledTimes(1);
      manager.handleTouchCancel(createTouchEvent(50, 0, { target: canvas, identifier: 8 }));
      expect(cancelAnimationFrame).toHaveBeenCalled();
      manager.destroy();
      vi.unstubAllGlobals();
    });
  });

  it('destroy removes runtime listeners and prevents later document movement', () => {
    document.body.classList.add('game-mode');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const engine = createEngine();
    const manager = new InputManager(engine);

    manager.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'd',
      code: 'KeyD',
      bubbles: true,
      cancelable: true,
    }));

    expect(engine.tryMove).not.toHaveBeenCalled();
    expect(removeSpy.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      'keydown',
      'keyup',
      'touchcancel',
      'visibilitychange',
      'editor-tab-activated',
    ]));
    removeSpy.mockRestore();
  });

  describe('Mobile arrow button dialog bug', () => {
    it('handleTouchStart should NOT advance dialog when tryMove just activated it in the same event cycle', () => {
      // Simulates the race condition on mobile:
      // 1. Arrow button touchstart fires → tryMove() → NPC collision → dialog becomes active (page 1)
      // 2. document touchstart fires (InputManager) → sees dialog active → advances to page 2
      // Expected: first dialog page should remain visible (setDialogPage must NOT be called)

      let dialogActive = false;
      const setDialogPage = vi.fn();

      const engine = createEngine({
        gameState: {
          getDialog: () =>
            dialogActive
              ? { active: true, page: 1, maxPages: 2 }
              : { active: false, page: 1, maxPages: 2 },
          setDialogPage,
        },
        tryMove: vi.fn(() => {
          // Simulates NPC collision inside tryMove activating the dialog
          dialogActive = true;
        }),
      });

      document.body.classList.add('game-mode');
      const manager = new InputManager(engine);

      // Step 1: arrow button handler calls tryMove (activates dialog)
      engine.tryMove(0, 1);

      // Step 2: document touchstart handler fires for the same event,
      // with target being the pad button (as happens in the real browser)
      const padButton = document.createElement('button');
      padButton.className = 'pad-button';
      padButton.dataset.direction = 'down';
      document.body.appendChild(padButton);

      const touchEv = {
        ...createTouchEvent(100, 100),
        target: padButton,
      } as unknown as TouchEvent;
      manager.handleTouchStart(touchEv);

      padButton.remove();

      // The first dialog page must not have been advanced/skipped
      expect(engine.advanceDialog).not.toHaveBeenCalled();
      expect(setDialogPage).not.toHaveBeenCalled();
    });
  });
});


describe('presentation mouse and mobile look', () => {
  beforeEach(() => { document.body.className = 'game-mode'; });
  afterEach(() => { document.body.innerHTML = ''; document.body.className = ''; vi.restoreAllMocks(); });

  it('routes mouse movement only from the game canvas, resets on exit and blur, and removes listeners', () => {
    const look = vi.fn(() => true);
    const engine = createEngine({ handleGameplayLook: look });
    const canvas = engine.canvas; if (!canvas) throw Error('Missing canvas');
    canvas.width = 400; document.body.append(canvas);
    const input = new InputManager(engine);
    const move = (x: number, target: HTMLElement = canvas) => target.dispatchEvent(new MouseEvent('mousemove', { clientX: x, bubbles: true }));
    try {
      move(100); move(200);
      expect(look).toHaveBeenLastCalledWith(Math.PI / 4);
      look.mockClear(); move(250, document.body); expect(look).not.toHaveBeenCalled();
      move(300); expect(look).toHaveBeenLastCalledWith(0);
      canvas.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      move(200); expect(look).toHaveBeenLastCalledWith(0);
      globalThis.dispatchEvent(new Event('blur')); move(100); expect(look).toHaveBeenLastCalledWith(0);
      engine.gameState.getDialog = () => ({ active: true, page: 1, maxPages: 1 });
      look.mockClear(); move(150); expect(look).not.toHaveBeenCalled();
      input.destroy(); move(250); expect(look).not.toHaveBeenCalled();
      expect(engine.tryMove).not.toHaveBeenCalled();
    } finally { input.destroy(); }
  });

  it('uses incremental mobile drag for look without starting swipe movement or rotating on touch release', () => {
    const look = vi.fn(() => true);
    const engine = createEngine({ handleGameplayLook: look });
    if (!engine.canvas) throw Error('Missing canvas');
    engine.canvas.width = 400;
    const input = new InputManager(engine);
    const touch = (x: number, identifier = 1) => createTouchEvent(x, 100, { target: engine.canvas, identifier });
    try {
      const start = touch(100); input.handleTouchStart(start);
      expect(start.preventDefault).toHaveBeenCalled(); expect(look).toHaveBeenLastCalledWith(0);
      input.handleTouchMove(touch(200)); expect(look).toHaveBeenLastCalledWith(Math.PI / 4);
      input.handleTouchMove(touch(250)); expect(look).toHaveBeenLastCalledWith(Math.PI / 8);
      look.mockClear(); input.handleTouchMove(touch(350, 2)); expect(look).not.toHaveBeenCalled();
      input.handleTouchEnd(touch(300)); expect(look).not.toHaveBeenCalled();
      expect(engine.tryMove).not.toHaveBeenCalled(); expect(input.isMovementHeld()).toBe(false);
      input.handleTouchStart(touch(50)); input.handleTouchCancel(touch(50));
      look.mockClear(); input.handleTouchMove(touch(200)); expect(look).not.toHaveBeenCalled();
    } finally { input.destroy(); }
  });
});


describe('canvas mouse capture', () => {
  beforeEach(() => { document.body.className = 'game-mode'; });
  afterEach(() => { document.body.innerHTML = ''; document.body.className = ''; vi.restoreAllMocks(); });

  const setupCapture = () => {
    const look = vi.fn<(deltaRadians: number) => boolean>(() => true);
    const engine = createEngine({ handleGameplayLook: look });
    const canvas = engine.canvas; if (!canvas) throw Error('Missing canvas');
    canvas.width = 400; document.body.append(canvas);
    let captured: Element | null = null;
    const descriptor = Object.getOwnPropertyDescriptor(document, 'pointerLockElement');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => captured });
    const setCapture = (element: Element | null) => {
      captured = element; document.dispatchEvent(new Event('pointerlockchange'));
    };
    const exitDescriptor = Object.getOwnPropertyDescriptor(document, 'exitPointerLock');
    const release = vi.fn(() => setCapture(null));
    Object.defineProperty(document, 'exitPointerLock', { configurable: true, value: release });
    const request = vi.fn(() => { setCapture(canvas); return Promise.resolve(); });
    Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: request });
    const input = new InputManager(engine);
    const move = (dx: number) => {
      const event = new MouseEvent('mousemove', { clientX: 100, bubbles: true });
      Object.defineProperty(event, 'movementX', { value: dx }); canvas.dispatchEvent(event);
    };
    const cleanup = () => {
      input.destroy();
      if (descriptor) Object.defineProperty(document, 'pointerLockElement', descriptor);
      else Reflect.deleteProperty(document, 'pointerLockElement');
      if (exitDescriptor) Object.defineProperty(document, 'exitPointerLock', exitDescriptor);
      else Reflect.deleteProperty(document, 'exitPointerLock');
    };
    return { engine, input, canvas, look, request, release, move, setCapture, cleanup };
  };

  it('captures on click and rotates using relative motion beyond the canvas until Escape releases it', async () => {
    const view = setupCapture();
    try {
      view.move(200); expect(view.look).not.toHaveBeenCalled();
      view.canvas.click(); await Promise.resolve();
      expect(view.request).toHaveBeenCalledOnce(); expect(document.pointerLockElement).toBe(view.canvas);
      view.move(800); expect(view.look).toHaveBeenLastCalledWith(2 * Math.PI);
      view.move(0); expect(view.look).toHaveBeenLastCalledWith(0);
      view.move(-200); expect(view.look).toHaveBeenLastCalledWith(-Math.PI / 2);
      view.setCapture(null); view.look.mockClear();
      view.move(200); expect(view.look).not.toHaveBeenCalled();
      view.canvas.click(); await Promise.resolve(); expect(view.request).toHaveBeenCalledTimes(2);
      globalThis.dispatchEvent(new Event('blur')); expect(document.pointerLockElement).toBeNull();
    } finally { view.cleanup(); }
  });

  it('does not capture while disabled or blocked, releases on disabling and cleanup, and leaves other canvases alone', async () => {
    const view = setupCapture();
    try {
      view.look.mockReturnValue(false); view.canvas.click(); expect(view.request).not.toHaveBeenCalled();
      view.look.mockReturnValue(true);
      const dialog = view.engine.gameState.getDialog;
      view.engine.gameState.getDialog = () => ({ active: true, page: 1, maxPages: 1 });
      view.canvas.click(); expect(view.request).not.toHaveBeenCalled();
      view.engine.gameState.getDialog = dialog;
      view.canvas.click(); await Promise.resolve();
      view.look.mockReturnValue(false); view.move(20); expect(document.pointerLockElement).toBeNull();
      view.look.mockReturnValue(true); view.canvas.click(); await Promise.resolve();
      view.input.destroy(); expect(document.pointerLockElement).toBeNull();
      view.release.mockClear(); view.setCapture(document.createElement('canvas'));
      view.input.cancelHeldMovement(); expect(view.release).not.toHaveBeenCalled();
      view.request.mockClear(); view.canvas.click(); expect(view.request).not.toHaveBeenCalled();
    } finally { view.cleanup(); }
  });

  it('keeps capture through a paused dialog, stops held movement, and resumes looking after closing it', async () => {
    const view = setupCapture();
    try {
      view.canvas.click(); await Promise.resolve();
      view.input.beginHeldDirection('test', 'up');
      view.engine.gameState.playing = false;
      let active = true;
      view.engine.gameState.getDialog = () => ({ active, page: 1, maxPages: 1 });
      view.look.mockClear(); view.engine.tryMove = vi.fn();
      view.move(100);
      expect(view.look.mock.calls.every(([delta]) => delta === 0)).toBe(true);
      expect(document.pointerLockElement).toBe(view.canvas);
      view.input.beginHeldDirection('test', 'up');
      expect(view.input.isMovementHeld()).toBe(false);
      expect(view.engine.tryMove).not.toHaveBeenCalled();
      view.input.handleKeyDown(createKeyEvent('Enter', view.canvas));
      expect(view.engine.advanceDialog).toHaveBeenCalledOnce();
      expect(document.pointerLockElement).toBe(view.canvas);
      view.canvas.click(); expect(view.engine.advanceDialog).toHaveBeenCalledTimes(2);
      expect(document.pointerLockElement).toBe(view.canvas); expect(view.release).not.toHaveBeenCalled();
      active = false; view.engine.gameState.playing = true;
      view.move(100); expect(view.look).toHaveBeenLastCalledWith(Math.PI / 4);
      expect(view.request).toHaveBeenCalledOnce();
    } finally { view.cleanup(); }
  });

  it('still releases capture on blur, editor entry, or removal during a dialog', async () => {
    for (const action of ['blur', 'editor', 'remove'] as const) {
      const view = setupCapture();
      try {
        view.canvas.click(); await Promise.resolve();
        view.engine.gameState.playing = false;
        view.engine.gameState.getDialog = () => ({ active: true, page: 1, maxPages: 1 });
        if (action === 'blur') globalThis.dispatchEvent(new Event('blur'));
        if (action === 'editor') document.dispatchEvent(new Event('editor-tab-activated'));
        if (action === 'remove') view.input.cancelHeldMovement();
        expect(document.pointerLockElement).toBeNull();
      } finally { view.cleanup(); }
    }
  });

  it('handles rejected or synchronous lock failures and releases a lock granted after destruction', async () => {
    const view = setupCapture();
    try {
      view.request.mockRejectedValueOnce(Error('Lock denied'));
      view.canvas.click(); await Promise.resolve(); await Promise.resolve();
      expect(document.pointerLockElement).toBeNull();
      view.request.mockImplementationOnce(() => { throw Error('Not supported'); });
      expect(() => view.canvas.click()).not.toThrow();
      let grant!: () => void;
      view.request.mockImplementationOnce(() => new Promise<void>(resolve => { grant = resolve; }));
      view.canvas.click(); view.input.destroy(); view.setCapture(view.canvas); grant();
      await Promise.resolve(); expect(document.pointerLockElement).toBeNull();
    } finally { view.cleanup(); }
  });
});
