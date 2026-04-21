
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TinyRPGApplication } from '../main';
import { TextResources } from '../runtime/adapters/TextResources'; // Import TextResources
import { ShareUtils } from '../runtime/infra/share/ShareUtils';
import { setTinyRpgApi, type TinyRpgApi } from '../runtime/infra/TinyRpgApi';

type BindResetGameEngine = Parameters<typeof TinyRPGApplication.bindResetButton>[0];
type TouchPadGameEngine = Parameters<typeof TinyRPGApplication.bindTouchPad>[0];
type SharedLoadGameEngine = Parameters<typeof TinyRPGApplication.loadSharedGameIfAvailable>[0];

// Mock GameEngine
class MockGameEngine {
  resetGame = vi.fn();
  // Add other methods if bindResetButton eventually calls them
}

class MockTouchGameEngine {
  tryMove = vi.fn();
  gameState = {
    getDialog: vi.fn(() => ({ active: false, page: 1, maxPages: 1 })),
    setDialogPage: vi.fn(),
  };
  closeDialog = vi.fn();
  renderer = { draw: vi.fn() };
}

class MockSharedLoadEngine {
  importGameData = vi.fn();
}

function asBindResetGameEngine(engine: MockGameEngine): BindResetGameEngine {
  return engine as unknown as BindResetGameEngine;
}

function asTouchPadGameEngine(engine: MockTouchGameEngine): TouchPadGameEngine {
  return engine as unknown as TouchPadGameEngine;
}

function asSharedLoadGameEngine(engine: MockSharedLoadEngine): SharedLoadGameEngine {
  return engine as unknown as SharedLoadGameEngine;
}

const createTabMarkup = () => {
  document.body.innerHTML = `
    <button class="tab-button active" data-tab="editor" aria-selected="true">Editor</button>
    <button class="tab-button" data-tab="game" aria-selected="false">Game</button>
    <section id="tab-editor" class="tab-content active"></section>
    <section id="tab-game" class="tab-content"></section>
  `;
};

describe('TinyRPGApplication.setupTabs', () => {
  afterEach(() => {
    setTinyRpgApi(null);
  });

  beforeEach(() => {
    createTabMarkup();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dispatches tab activation with detail.initial for user switches', () => {
    let detail: { initial?: boolean } | null = null;

    document.addEventListener('game-tab-activated', (ev) => {
      const event = ev as CustomEvent<{ initial?: boolean }>;
      detail = event.detail;
    });

    TinyRPGApplication.setupTabs();

    const gameButton = document.querySelector<HTMLButtonElement>(
      '.tab-button[data-tab="game"]',
    );

    expect(gameButton).not.toBeNull();

    gameButton?.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
    );
    gameButton?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(detail).not.toBeNull();
    expect((detail as unknown as { initial?: boolean }).initial).toBe(false);
  });

  it('applies initial editor mode and dispatches initial editor activation', () => {
    let detail: { initial?: boolean } | null = null;
    document.addEventListener('editor-tab-activated', (ev) => {
      detail = (ev as CustomEvent<{ initial?: boolean }>).detail;
    });

    TinyRPGApplication.setupTabs();

    expect(document.body.classList.contains('editor-mode')).toBe(true);
    expect(document.body.classList.contains('game-mode')).toBe(false);
    expect(detail).not.toBeNull();
    expect((detail as unknown as { initial?: boolean }).initial).toBe(true);
  });

  it('activates editor tab and calls TinyRpgApi methods on switch', () => {
    createTabMarkup();
    const editorButton = document.querySelectorAll<HTMLButtonElement>('.tab-button')[0];
    const gameButton = document.querySelectorAll<HTMLButtonElement>('.tab-button')[1];
    editorButton.classList.remove('active');
    editorButton.setAttribute('aria-selected', 'false');
    gameButton.classList.add('active');
    gameButton.setAttribute('aria-selected', 'true');
    document.getElementById('tab-editor')?.classList.remove('active');
    document.getElementById('tab-game')?.classList.add('active');

    const api: TinyRpgApi = {
      exportGameData: vi.fn(() => ({ title: 'x' })),
      importGameData: vi.fn(),
      getState: vi.fn(),
      draw: vi.fn(),
      resetGame: vi.fn(),
      updateTile: vi.fn(),
      setMapTile: vi.fn(),
      getTiles: vi.fn(),
      getTileMap: vi.fn(),
      getTilePresetNames: vi.fn(() => []),
      getVariables: vi.fn(),
      setVariableDefault: vi.fn(),
      addSprite: vi.fn(),
      getSprites: vi.fn(),
      resetNPCs: vi.fn(),
      renderAll: vi.fn(),
    };
    setTinyRpgApi(api);

    TinyRPGApplication.setupTabs();
    editorButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(api.resetNPCs).toHaveBeenCalledTimes(1);
    expect(api.draw).toHaveBeenCalledTimes(1);
    expect(api.renderAll).toHaveBeenCalledTimes(1);
    expect(api.importGameData).toHaveBeenCalledWith({ title: 'x' });
    expect(document.getElementById('tab-editor')?.classList.contains('active')).toBe(true);
  });

  it('does nothing on editor activation when TinyRpgApi is unavailable', () => {
    setTinyRpgApi(null);
    TinyRPGApplication.setupTabs();
    const gameButton = document.querySelector<HTMLButtonElement>('.tab-button[data-tab="game"]');
    const editorButton = document.querySelector<HTMLButtonElement>('.tab-button[data-tab="editor"]');
    gameButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    editorButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(document.body.classList.contains('editor-mode')).toBe(true);
  });

  it('ignores unrelated key on tab keydown', () => {
    TinyRPGApplication.setupTabs();
    const gameButton = document.querySelector<HTMLButtonElement>('.tab-button[data-tab="game"]');
    gameButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(gameButton?.classList.contains('active')).toBe(false);
  });
});

describe('TinyRPGApplication.bindResetButton', () => {
  let mockGameEngine: MockGameEngine;
  let resetButton: HTMLButtonElement | null;
  let originalOpen: typeof window.open;
  let originalLocation: Location;

  beforeEach(() => {
    mockGameEngine = new MockGameEngine();
    document.body.innerHTML = `
      <button id="btn-reset"></button>
    `;
    resetButton = document.getElementById('btn-reset') as HTMLButtonElement;

    // Mock TextResources.get
    vi.spyOn(TextResources, 'get').mockImplementation((key: string | null | undefined) => {
      if (key === 'buttons.newGame') return 'New Game';
      if (key === 'aria.newGame') return 'Start a new game';
      if (key === 'buttons.reset') return 'Reset';
      if (key === 'aria.reset') return 'Reset the current game';
      return '';
    });

    // Mock window.open
    originalOpen = globalThis.open;
    globalThis.open = vi.fn(() => null) as unknown as typeof window.open; // Mock window.open to return null

    // Mock globalThis.location
    originalLocation = globalThis.location;
    // Need to mock the location to test getBaseUrl in editor mode
    // @ts-expect-error test replaces window.location in jsdom
    delete globalThis.location;
    globalThis.location = {
      origin: 'http://localhost',
      pathname: '/some/path',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    } as unknown as Location;

    // Call bindResetButton to set up event listeners
    TinyRPGApplication.bindResetButton(asBindResetGameEngine(mockGameEngine));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks(); // Restore all mocks after each test
    globalThis.open = originalOpen; // Restore original window.open
    globalThis.location = originalLocation; // Restore original window.location
  });

  it('should call gameEngine.resetGame when clicked in game mode', () => {
    document.body.classList.remove('editor-mode'); // Ensure game mode
    resetButton?.click();
    expect(mockGameEngine.resetGame).toHaveBeenCalledTimes(1);
    expect(globalThis.open).not.toHaveBeenCalled();
  });

  it('should open a new tab/window when clicked in editor mode', () => {
    document.body.classList.add('editor-mode'); // Ensure editor mode
    resetButton?.click();
    expect(mockGameEngine.resetGame).not.toHaveBeenCalled();
    expect(globalThis.open).toHaveBeenCalledWith('http://localhost/some/path', '_blank', 'noopener');
  });

  it('should update button text and aria-label when game-tab-activated is dispatched', () => {
    document.body.classList.add('editor-mode'); // Start in editor mode
    // Initially, it should be "New Game"
    expect(resetButton?.textContent).toBe('New Game');
    expect(resetButton?.getAttribute('aria-label')).toBe('Start a new game');

    document.body.classList.remove('editor-mode'); // Switch to game mode via event
    document.dispatchEvent(new CustomEvent('game-tab-activated'));

    expect(resetButton?.textContent).toBe('Reset');
    expect(resetButton?.getAttribute('aria-label')).toBe('Reset the current game');
  });

  it('should update button text and aria-label when editor-tab-activated is dispatched', () => {
    document.body.classList.remove('editor-mode'); // Start in game mode
    // Initially, it should be "Reset"
    expect(resetButton?.textContent).toBe('Reset');
    expect(resetButton?.getAttribute('aria-label')).toBe('Reset the current game');

    document.body.classList.add('editor-mode'); // Switch to editor mode via event
    document.dispatchEvent(new CustomEvent('editor-tab-activated'));

    expect(resetButton?.textContent).toBe('New Game');
    expect(resetButton?.getAttribute('aria-label')).toBe('Start a new game');
  });

  it('should update button text and aria-label when language-changed is dispatched', () => {
    vi.spyOn(TextResources, 'get').mockImplementation((key: string | null | undefined) => {
      if (key === 'buttons.newGame') return 'Novo Jogo';
      if (key === 'aria.newGame') return 'Iniciar novo jogo';
      if (key === 'buttons.reset') return 'Reiniciar';
      if (key === 'aria.reset') return 'Reiniciar jogo atual';
      return '';
    });
    // Dispatch event to trigger update
    document.dispatchEvent(new CustomEvent('language-changed'));

    // Check if the button text and aria-label are updated with new language values
    expect(resetButton?.textContent).toBe('Novo Jogo');
    expect(resetButton?.getAttribute('aria-label')).toBe('Iniciar novo jogo');

    document.body.classList.remove('editor-mode'); // Switch to game mode
    document.dispatchEvent(new CustomEvent('language-changed'));
    expect(resetButton?.textContent).toBe('Reiniciar');
    expect(resetButton?.getAttribute('aria-label')).toBe('Reiniciar jogo atual');
  });

  it('should prevent default and stop propagation when in editor mode', () => {
    document.body.classList.add('editor-mode');

    const preventDefaultSpy = vi.spyOn(Event.prototype, 'preventDefault');
    const stopImmediatePropagationSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');

    resetButton?.click(); // This dispatches a MouseEvent

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopImmediatePropagationSpy).toHaveBeenCalled();
  });

  it('returns early when reset button is missing', () => {
    document.body.innerHTML = '';
    expect(() =>
      TinyRPGApplication.bindResetButton(asBindResetGameEngine(mockGameEngine)),
    ).not.toThrow();
  });

  it('uses popup path when window.open returns a window handle', () => {
    const popupHandle = {} as Window;
    globalThis.open = vi.fn(() => popupHandle) as unknown as typeof window.open;
    document.body.classList.add('editor-mode');

    resetButton?.click();

    expect(globalThis.open).toHaveBeenCalledWith(
      'http://localhost/some/path',
      '_blank',
      'noopener',
    );
    expect(document.querySelector('a')).toBeNull();
  });

  it('handles missing global location by opening blank target url in editor mode', () => {
    // @ts-expect-error test replaces window.location in jsdom
    delete globalThis.location;
    document.body.classList.add('editor-mode');

    resetButton?.click();

    expect(globalThis.open).toHaveBeenCalledWith('', '_blank', 'noopener');
  });
});

describe('TinyRPGApplication.loadSharedGameIfAvailable', () => {
  let engine: MockSharedLoadEngine;

  beforeEach(() => {
    engine = new MockSharedLoadEngine();
    vi.spyOn(ShareUtils, 'extractGameDataFromLocation').mockReturnValue(null);
    vi.spyOn(ShareUtils, 'decode').mockReturnValue(null);
    delete (globalThis as Record<string, unknown>).__TINY_RPG_SHARED_CODE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).__TINY_RPG_SHARED_CODE;
  });

  it('imports data extracted from location hash and skips inline decode', () => {
    vi.spyOn(ShareUtils, 'extractGameDataFromLocation').mockReturnValue({ title: 'From Hash' });

    TinyRPGApplication.loadSharedGameIfAvailable(asSharedLoadGameEngine(engine));

    expect(engine.importGameData).toHaveBeenCalledWith({ title: 'From Hash' });
    expect(ShareUtils.decode).not.toHaveBeenCalled();
  });

  it('imports decoded inline shared code when no hash data is available', () => {
    (globalThis as Record<string, unknown>).__TINY_RPG_SHARED_CODE = 'abc123';
    vi.spyOn(ShareUtils, 'decode').mockReturnValue({ title: 'Inline' });

    TinyRPGApplication.loadSharedGameIfAvailable(asSharedLoadGameEngine(engine));

    expect(ShareUtils.decode).toHaveBeenCalledWith('abc123');
    expect(engine.importGameData).toHaveBeenCalledWith({ title: 'Inline' });
  });

  it('warns when inline shared code decode throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis as Record<string, unknown>).__TINY_RPG_SHARED_CODE = 'bad';
    vi.spyOn(ShareUtils, 'decode').mockImplementation(() => {
      throw new Error('decode fail');
    });

    TinyRPGApplication.loadSharedGameIfAvailable(asSharedLoadGameEngine(engine));

    expect(warnSpy).toHaveBeenCalled();
    expect(engine.importGameData).not.toHaveBeenCalled();
  });
});

describe('TinyRPGApplication.bindTouchPad', () => {
  let engine: MockTouchGameEngine;

  beforeEach(() => {
    engine = new MockTouchGameEngine();
    document.body.innerHTML = `
      <div id="mobile-touch-pad"></div>
      <button id="touch-controls-toggle"></button>
      <button id="touch-controls-hide"></button>
      <div class="game-touch-pad">
        <button class="pad-button" data-direction="left"></button>
        <button class="pad-button" data-direction="up"></button>
      </div>
    `;
    vi.spyOn(TextResources, 'get').mockImplementation((key: string | null | undefined) => {
      if (key === 'touchControls.show') return 'Show Controls';
      if (key === 'touchControls.hide') return 'Hide Controls';
      return '';
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns early when required touch pad elements are missing', () => {
    document.body.innerHTML = `<button id="touch-controls-toggle"></button>`;
    expect(() => TinyRPGApplication.bindTouchPad(asTouchPadGameEngine(engine))).not.toThrow();
  });

  it('moves player on touchstart using direction map', () => {
    TinyRPGApplication.bindTouchPad(asTouchPadGameEngine(engine));
    const leftButton = document.querySelector<HTMLButtonElement>('.pad-button[data-direction="left"]');
    leftButton?.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    expect(engine.tryMove).toHaveBeenCalledWith(-1, 0);
  });

  it('shows and hides touch controls via toggle and hide buttons', () => {
    TinyRPGApplication.bindTouchPad(asTouchPadGameEngine(engine));
    const toggle = document.getElementById('touch-controls-toggle') as HTMLButtonElement;
    const hide = document.getElementById('touch-controls-hide') as HTMLButtonElement;
    const pad = document.getElementById('mobile-touch-pad') as HTMLElement;

    toggle.click();
    expect(document.body.classList.contains('touch-controls-visible')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(pad.getAttribute('aria-hidden')).toBe('false');
    expect(hide.hidden).toBe(false);

    hide.click();
    expect(document.body.classList.contains('touch-controls-visible')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(hide.hidden).toBe(true);
  });

  it('updates labels on language-changed and hides controls on editor-tab-activated', () => {
    TinyRPGApplication.bindTouchPad(asTouchPadGameEngine(engine));
    const toggle = document.getElementById('touch-controls-toggle') as HTMLButtonElement;
    const hide = document.getElementById('touch-controls-hide') as HTMLButtonElement;

    document.body.classList.add('touch-controls-visible');
    vi.spyOn(TextResources, 'get').mockImplementation((key: string | null | undefined) => {
      if (key === 'touchControls.show') return 'Mostrar';
      if (key === 'touchControls.hide') return 'Ocultar';
      return '';
    });

    document.dispatchEvent(new CustomEvent('language-changed'));
    expect(hide.textContent).toBe('Ocultar');

    document.dispatchEvent(new CustomEvent('editor-tab-activated'));
    expect(document.body.classList.contains('touch-controls-visible')).toBe(false);
    expect(toggle.textContent).toBe('Mostrar');
  });

  it('ignores touch buttons without data-direction', () => {
    document.body.innerHTML = `
      <div id="mobile-touch-pad"></div>
      <button id="touch-controls-toggle"></button>
      <button id="touch-controls-hide"></button>
      <div class="game-touch-pad">
        <button class="pad-button"></button>
      </div>
    `;
    TinyRPGApplication.bindTouchPad(asTouchPadGameEngine(engine));
    const button = document.querySelector<HTMLButtonElement>('.pad-button');

    button?.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));

    expect(engine.tryMove).not.toHaveBeenCalled();
  });
});

describe('TinyRPGApplication.bindFullscreenButton', () => {
  let originalMatchMedia: typeof globalThis.matchMedia | undefined;
  let fullscreenElementValue: Element | null;
  let desktopMatches = true;
  let gameContainer: HTMLElement;
  let requestFullscreenSpy: ReturnType<typeof vi.fn>;
  let exitFullscreenSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = `<div id="game-container"></div>`;
    document.body.classList.add('game-mode');
    gameContainer = document.getElementById('game-container') as HTMLElement;
    requestFullscreenSpy = vi.fn(async () => {
      fullscreenElementValue = gameContainer;
    });
    exitFullscreenSpy = vi.fn(async () => {
      fullscreenElementValue = null;
    });
    fullscreenElementValue = null;

    Object.defineProperty(gameContainer, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenSpy,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreenSpy,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElementValue,
    });

    originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = vi.fn(() => ({
      matches: desktopMatches,
      media: '(hover: hover) and (pointer: fine)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof globalThis.matchMedia;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    vi.restoreAllMocks();
    if (originalMatchMedia) {
      globalThis.matchMedia = originalMatchMedia;
    } else {
      // @ts-expect-error test cleanup for optional global
      delete globalThis.matchMedia;
    }
  });

  it('shows the button on desktop game mode and toggles fullscreen', async () => {
    TinyRPGApplication.bindFullscreenButton();
    const button = document.getElementById('game-fullscreen-toggle') as HTMLButtonElement;

    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Enter fullscreen');
    expect(button.dataset.state).toBe('enter');

    button.click();
    await Promise.resolve();
    expect(requestFullscreenSpy).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('fullscreenchange'));
    expect(button.getAttribute('aria-label')).toBe('Exit fullscreen');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.dataset.state).toBe('exit');

    button.click();
    await Promise.resolve();
    expect(exitFullscreenSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the button hidden outside desktop game mode', () => {
    desktopMatches = false;
    TinyRPGApplication.bindFullscreenButton();
    const button = document.getElementById('game-fullscreen-toggle') as HTMLButtonElement;

    expect(button.hidden).toBe(true);

    document.body.classList.remove('game-mode');
    document.body.classList.add('editor-mode');
    desktopMatches = true;
    document.dispatchEvent(new CustomEvent('game-tab-activated'));
    expect(button.hidden).toBe(true);
  });

  it('exits fullscreen when switching back to editor', async () => {
    TinyRPGApplication.bindFullscreenButton();
    const button = document.getElementById('game-fullscreen-toggle') as HTMLButtonElement;

    button.click();
    await Promise.resolve();
    document.dispatchEvent(new Event('fullscreenchange'));

    document.body.classList.remove('game-mode');
    document.body.classList.add('editor-mode');
    document.dispatchEvent(new CustomEvent('editor-tab-activated'));
    await Promise.resolve();

    expect(exitFullscreenSpy).toHaveBeenCalledTimes(1);
    expect(button.hidden).toBe(true);
  });
});

describe('TinyRPGApplication.bindLanguageSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = `<select id="language-select"><option value="en-US">EN</option><option value="pt-BR">PT</option></select>`;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns early when language select is missing', () => {
    document.body.innerHTML = '';
    expect(() => TinyRPGApplication.bindLanguageSelector()).not.toThrow();
  });

  it('syncs initial locale and applies locale on change', () => {
    const select = document.getElementById('language-select') as HTMLSelectElement;
    vi.spyOn(TextResources, 'getLocale').mockReturnValue('en-US' as unknown as ReturnType<typeof TextResources.getLocale>);
    const setLocaleSpy = vi.spyOn(TextResources, 'setLocale').mockReturnValue(true as unknown as ReturnType<typeof TextResources.setLocale>);

    TinyRPGApplication.bindLanguageSelector();
    expect(select.value).toBe('en-US');

    select.value = 'pt-BR';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(setLocaleSpy).toHaveBeenCalledWith('pt-BR');
  });

  it('re-syncs select when setLocale returns false or empty value is selected', () => {
    const select = document.getElementById('language-select') as HTMLSelectElement;
    vi.spyOn(TextResources, 'getLocale').mockReturnValue('en-US' as unknown as ReturnType<typeof TextResources.getLocale>);
    const setLocaleSpy = vi.spyOn(TextResources, 'setLocale').mockReturnValue(false as unknown as ReturnType<typeof TextResources.setLocale>);

    TinyRPGApplication.bindLanguageSelector();

    select.value = 'pt-BR';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(setLocaleSpy).toHaveBeenCalledWith('pt-BR');
    expect(select.value).toBe('en-US');

    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(setLocaleSpy).toHaveBeenCalledTimes(1);

    vi.spyOn(TextResources, 'getLocale').mockReturnValue('pt-BR' as unknown as ReturnType<typeof TextResources.getLocale>);
    document.dispatchEvent(new CustomEvent('language-changed'));
    expect(select.value).toBe('pt-BR');
  });
});

describe('TinyRPGApplication.setupResponsiveCanvas', () => {
  let originalRaf: typeof globalThis.requestAnimationFrame;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-container"></div>
      <canvas id="game-canvas"></canvas>
    `;
    originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as unknown as typeof globalThis.requestAnimationFrame;

    const container = document.getElementById('game-container') as HTMLElement;
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }),
    });

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    canvas.width = 200;
    canvas.height = 100;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.requestAnimationFrame = originalRaf;
    vi.restoreAllMocks();
  });

  it('returns early when canvas or container is missing', () => {
    document.body.innerHTML = '<div id="game-container"></div>';
    expect(() => TinyRPGApplication.setupResponsiveCanvas()).not.toThrow();
  });

  it('sizes canvas and re-schedules on resize and game-tab-activated', () => {
    TinyRPGApplication.setupResponsiveCanvas();
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    expect(canvas.style.width).toBe('360px');
    expect(canvas.style.height).toBe('180px');

    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new CustomEvent('game-tab-activated'));

    expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
  });
});

describe('TinyRPGApplication.setupTabs extra branches', () => {
  afterEach(() => {
    setTinyRpgApi(null);
    document.body.innerHTML = '';
  });

  it('dispatches initial game activation when game tab starts active', () => {
    document.body.innerHTML = `
      <button class="tab-button" data-tab="editor" aria-selected="false">Editor</button>
      <button class="tab-button active" data-tab="game" aria-selected="true">Game</button>
      <section id="tab-editor" class="tab-content"></section>
      <section id="tab-game" class="tab-content active"></section>
    `;
    let detail: { initial?: boolean } | null = null;
    document.addEventListener('game-tab-activated', (ev) => {
      detail = (ev as CustomEvent<{ initial?: boolean }>).detail;
    });

    TinyRPGApplication.setupTabs();

    expect(document.body.classList.contains('game-mode')).toBe(true);
    expect((detail as unknown as { initial?: boolean }).initial).toBe(true);
  });

  it('ignores pointerdown on already-active tab', () => {
    createTabMarkup();
    TinyRPGApplication.setupTabs();
    const editorButton = document.querySelector<HTMLButtonElement>('.tab-button[data-tab="editor"]');

    editorButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(document.body.classList.contains('editor-mode')).toBe(true);
    expect(document.querySelectorAll('.tab-button.active')).toHaveLength(1);
  });
});



