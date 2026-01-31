import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../runtime/adapters/InputManager';

type GameEngineStub = {
  gameState: {
    getDialog: () => { active: boolean; page: number; maxPages: number };
    setDialogPage: (page: number) => void;
  };
  renderer: { draw: () => void };
  tryMove: (dx: number, dy: number) => void;
  closeDialog: () => void;
  isGameOver?: () => boolean;
  handleGameOverInteraction?: () => void;
  isIntroVisible?: () => boolean;
  dismissIntroScreen?: () => void;
  isLevelUpOverlayActive?: () => boolean;
  isPickupOverlayActive?: () => boolean;
  dismissPickupOverlay?: () => void;
  chooseLevelUpSkill?: (index: number) => void;
  moveLevelUpCursor?: (delta: number) => void;
  draw?: () => void;
  confirmLevelUpSelection?: () => void;
  pickLevelUpChoiceFromPointer?: (x: number, y: number) => number | null | undefined;
};

const createEngine = (overrides: Partial<GameEngineStub> = {}): GameEngineStub => {
  return {
    gameState: {
      getDialog: () => ({ active: false, page: 1, maxPages: 2 }),
      setDialogPage: vi.fn(),
      ...(overrides.gameState || {}),
    },
    renderer: { draw: vi.fn(), ...(overrides.renderer || {}) },
    tryMove: vi.fn(),
    closeDialog: vi.fn(),
    isGameOver: () => false,
    handleGameOverInteraction: vi.fn(),
    isIntroVisible: () => false,
    dismissIntroScreen: vi.fn(),
    isLevelUpOverlayActive: () => false,
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

const createKeyEvent = (key: string, target?: HTMLElement) =>
  ({
    key,
    target,
    preventDefault: vi.fn(),
  }) as unknown as KeyboardEvent;

const createTouchEvent = (x: number, y: number) => {
  const touch = { clientX: x, clientY: y };
  const touchList = [touch];
  (touchList as unknown as { item: (index: number) => typeof touch | null }).item = (index: number) => touchList[index] || null;
  return {
    changedTouches: touchList,
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

  it('handleKeyDown delegates game-over flow', () => {
    const engine = createEngine({ isGameOver: () => true });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(ev.preventDefault).toHaveBeenCalled();
    expect(engine.handleGameOverInteraction).toHaveBeenCalled();
  });

  it('handleKeyDown advances dialog pages', () => {
    const engine = createEngine({
      gameState: {
        getDialog: () => ({ active: true, page: 1, maxPages: 2 }),
        setDialogPage: vi.fn(),
      },
    });
    const manager = new InputManager(engine);
    const ev = createKeyEvent('z');

    manager.handleKeyDown(ev);

    expect(engine.gameState.setDialogPage).toHaveBeenCalledWith(2);
    expect(engine.renderer.draw).toHaveBeenCalled();
  });

  it('handleKeyDown triggers movement for game keys', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine();
    const manager = new InputManager(engine);
    const ev = createKeyEvent('ArrowLeft');

    manager.handleKeyDown(ev);

    expect(engine.tryMove).toHaveBeenCalledWith(-1, 0);
  });

  it('handleTouchStart tracks initial touch', () => {
    document.body.classList.add('game-mode');
    const engine = createEngine();
    const manager = new InputManager(engine);

    manager.handleTouchStart(createTouchEvent(10, 20));

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
      x: 0,
      y: 0,
      time: Date.now(),
      prevented: false,
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
      x: 0,
      y: 0,
      time: 900,
      prevented: false,
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
});
