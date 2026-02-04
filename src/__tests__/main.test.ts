import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TinyRPGApplication } from '../main';

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
