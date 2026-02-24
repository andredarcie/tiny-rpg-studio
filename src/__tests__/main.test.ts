/* eslint-disable */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TinyRPGApplication } from '../main';
import { TextResources } from '../runtime/adapters/TextResources'; // Import TextResources

// Mock GameEngine
class MockGameEngine {
  resetGame = vi.fn();
  // Add other methods if bindResetButton eventually calls them
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
    expect((detail as { initial?: boolean } | null)?.initial).toBe(false);
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
    // @ts-ignore
    delete globalThis.location;
    globalThis.location = {
      origin: 'http://localhost',
      pathname: '/some/path',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    } as unknown as Location;

    // Call bindResetButton to set up event listeners
    TinyRPGApplication.bindResetButton(mockGameEngine as any);
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
});



