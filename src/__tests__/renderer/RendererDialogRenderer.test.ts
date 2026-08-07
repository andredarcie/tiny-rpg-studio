import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RendererDialogRenderer } from '../../runtime/adapters/renderer/RendererDialogRenderer';
import { GameConfig } from '../../config/GameConfig';
import type { DialogChoiceState } from '../../types/gameState';

type TestDialog = {
  active: boolean;
  text?: string;
  page?: number;
  maxPages?: number;
  choice?: DialogChoiceState | null;
};

function setup(dialog: TestDialog, displayHeight = 392, requestRedraw?: () => void) {
  document.body.innerHTML = '';
  const parent = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 196;
  // jsdom does not lay elements out, so stub the display metrics the overlay reads.
  const metrics = [
    ['offsetWidth', displayHeight * (128 / 196)],
    ['offsetHeight', displayHeight],
    ['offsetLeft', 0],
    ['offsetTop', 0],
  ] as const;
  for (const [prop, value] of metrics) {
    Object.defineProperty(canvas, prop, { value, configurable: true });
  }
  parent.appendChild(canvas);
  document.body.appendChild(parent);

  const ctx = { canvas } as unknown as CanvasRenderingContext2D;
  const gameState = { getDialog: () => dialog };
  const palette = { getColor: () => '#ffffff' };
  const renderer = new RendererDialogRenderer(gameState, palette, requestRedraw ?? null);
  // The dialog box anchors to the bottom of the gameplay viewport.
  renderer.setViewportOffset(20);
  return { renderer, ctx, parent };
}

/**
 * jsdom performs no layout, so text measuring always returns 0 and nothing ever
 * wraps. This emulates the monospace pixel font the engine uses — every glyph
 * advances exactly one font-size — inside a text column of the given display
 * width. The column width is an absolute pixel value rather than something
 * derived from the font, so a font that stopped scaling with the canvas would
 * change how many characters fit and be caught by the tests below.
 */
function installFakeTextLayout(columnWidthPx: number): () => void {
  const proto = HTMLElement.prototype;
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(proto, 'offsetWidth');
  const originalClientWidth = Object.getOwnPropertyDescriptor(proto, 'clientWidth');

  Object.defineProperty(proto, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const fontPx = parseFloat(this.style.fontSize) || 0;
      return this.textContent.length * fontPx;
    },
  });
  Object.defineProperty(proto, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('game-dialog-text') ? columnWidthPx : 0;
    },
  });

  return () => {
    if (originalOffsetWidth) Object.defineProperty(proto, 'offsetWidth', originalOffsetWidth);
    if (originalClientWidth) Object.defineProperty(proto, 'clientWidth', originalClientWidth);
  };
}

/** Line height the renderer falls back to when the stylesheet is absent. */
const lineHeightFor = (fontPx: number) => fontPx * 1.3;
const linesInBox = (text: HTMLElement, fontPx: number) =>
  parseFloat(text.style.height) / lineHeightFor(fontPx);

const makeChoice = (selectedIndex = 0): DialogChoiceState => ({
  phase: 'prompt',
  selectedIndex,
  options: [
    { key: 'yes', label: 'Yes', text: 'Great', rewardVariableId: null },
    { key: 'no', label: 'No', text: '', rewardVariableId: null },
  ],
});

describe('RendererDialogRenderer (HTML overlay)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the message text into an HTML box', () => {
    const { renderer, ctx } = setup({ active: true, text: 'Hello there', choice: null });
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    const box = document.querySelector('.game-dialog-box');
    expect(box).not.toBeNull();
    expect(box?.textContent).toContain('Hello there');
  });

  it('hides the overlay when the dialog is inactive', () => {
    const dialog: TestDialog = { active: true, text: 'Hi', choice: null };
    const { renderer, ctx } = setup(dialog);
    renderer.drawDialog(ctx, { width: 128, height: 160 });
    expect((document.querySelector('.game-dialog-overlay') as HTMLElement).style.display).toBe('block');

    dialog.active = false;
    renderer.drawDialog(ctx, { width: 128, height: 160 });
    expect((document.querySelector('.game-dialog-overlay') as HTMLElement).style.display).toBe('none');
  });

  it('renders Yes/No buttons with the selected one marked', () => {
    const { renderer, ctx } = setup({ active: true, text: 'Accept?', choice: makeChoice(1) });
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    const buttons = Array.from(document.querySelectorAll('.game-dialog-button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe('Yes');
    expect(buttons[1].textContent).toBe('No');
    // Only the selected button (index 1) carries the selected modifier.
    expect(buttons[0].classList.contains('game-dialog-button--selected')).toBe(false);
    expect(buttons[1].classList.contains('game-dialog-button--selected')).toBe(true);
  });

  it('hides the buttons once a branch message is shown', () => {
    const choice = makeChoice(0);
    const dialog: TestDialog = { active: true, text: 'Accept?', choice };
    const { renderer, ctx } = setup(dialog);
    renderer.drawDialog(ctx, { width: 128, height: 160 });
    expect((document.querySelector('.game-dialog-buttons') as HTMLElement).style.display).toBe('flex');

    choice.phase = 'branch';
    dialog.text = 'Great';
    renderer.drawDialog(ctx, { width: 128, height: 160 });
    expect((document.querySelector('.game-dialog-buttons') as HTMLElement).style.display).toBe('none');
  });

  it('invokes the choice handler when an option button is clicked', () => {
    const { renderer, ctx } = setup({ active: true, text: 'Accept?', choice: makeChoice(0) });
    const handler = vi.fn();
    renderer.setChoiceHandler(handler);
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    const noButton = document.querySelectorAll('.game-dialog-button')[1] as HTMLElement;
    noButton.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledWith(1);
  });

  it('scales the font size proportionally to the canvas display size', () => {
    // canvas is 128x196 internal, displayed at 256x392 -> ratio 2 -> font 8 * 2 = 16px.
    const { renderer, ctx } = setup({ active: true, text: 'Hi', choice: null });
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    const container = document.querySelector('.game-dialog') as HTMLElement;
    expect(container.style.fontSize).toBe('16px');
  });

  it('scales every dialog element with the canvas, in step with the HUD font', () => {
    const { renderer, ctx } = setup({ active: true, text: 'Accept?', choice: makeChoice() });
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    // Canvas is 128x196 internal shown at 256x392 -> ratio 2 -> the 8px HUD font
    // renders at 16px, and the dialog must match it rather than stay at a fixed
    // UI size (which is what made it huge on phones and tiny on desktops).
    for (const selector of ['.game-dialog-box', '.game-dialog-text', '.game-dialog-buttons', '.game-dialog-button']) {
      const el = document.querySelector(selector) as HTMLElement;
      expect(el.style.fontSize).toBe('16px');
    }
  });

  it('stops growing the font once it reaches the configured ceiling', () => {
    const ceiling = GameConfig.dialog.maxFontSize;
    // A display this large would otherwise ask for a font far past the ceiling.
    const displayHeight = (ceiling / 8) * 196 * 3;
    const { renderer, ctx } = setup({ active: true, text: 'Hi', choice: makeChoice() }, displayHeight);
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    for (const selector of ['.game-dialog', '.game-dialog-box', '.game-dialog-text', '.game-dialog-button']) {
      const el = document.querySelector(selector) as HTMLElement;
      expect(parseFloat(el.style.fontSize)).toBe(ceiling);
    }
  });

  it('leaves the font untouched while it is still under the ceiling', () => {
    // Ratio 2 asks for 16px, well below the ceiling, so nothing is clamped.
    const { renderer, ctx } = setup({ active: true, text: 'Hi', choice: null });
    renderer.drawDialog(ctx, { width: 128, height: 160 });

    const text = document.querySelector('.game-dialog-text') as HTMLElement;
    expect(parseFloat(text.style.fontSize)).toBe(16);
    expect(16).toBeLessThan(GameConfig.dialog.maxFontSize);
  });

  it('always keeps a positive, proportional font size across canvas sizes', () => {
    for (const displayHeight of [196, 300, 392, 588, 800]) {
      document.body.innerHTML = '';
      const parent = document.createElement('div');
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 196;
      Object.defineProperty(canvas, 'offsetWidth', { value: displayHeight * (128 / 196), configurable: true });
      Object.defineProperty(canvas, 'offsetHeight', { value: displayHeight, configurable: true });
      Object.defineProperty(canvas, 'offsetLeft', { value: 0, configurable: true });
      Object.defineProperty(canvas, 'offsetTop', { value: 0, configurable: true });
      parent.appendChild(canvas);
      document.body.appendChild(parent);
      const ctx = { canvas } as unknown as CanvasRenderingContext2D;
      const renderer = new RendererDialogRenderer({ getDialog: () => ({ active: true, text: 'Hi', choice: null }) }, { getColor: () => '#fff' });
      renderer.drawDialog(ctx, { width: 128, height: 160 });

      const container = document.querySelector('.game-dialog') as HTMLElement;
      const fontPx = parseFloat(container.style.fontSize);
      // 8px font * (displayHeight / 196 internal height), held at the ceiling.
      const expected = Math.min(GameConfig.dialog.maxFontSize, 8 * (displayHeight / 196));
      expect(fontPx).toBeCloseTo(expected, 3);
      expect(fontPx).toBeGreaterThan(0);
    }
  });

  it('reports reveal as complete (no canvas typewriter)', () => {
    const { renderer } = setup({ active: true, text: 'Hi', choice: null });
    expect(renderer.isRevealComplete()).toBe(true);
    expect(() => renderer.skipReveal()).not.toThrow();
    expect(renderer.pickChoiceFromPointer()).toBeNull();
  });

  describe('pagination and box height', () => {
    // Ten characters per line: the column is 10 glyphs wide at any font size.
    const TEN_PER_LINE = (fontPx: number) => 10 * fontPx;
    const WORD = 'ABCDEFGHIJ';

    it('paginates a message the same way at every canvas size', () => {
      // The text column scales with the canvas exactly as the real box does, so
      // the same message must break into the same pages on a phone and a desktop.
      const message = Array.from({ length: 9 }, () => WORD).join(' ');
      const results = [196, 392, 588].map((displayHeight) => {
        const ratio = displayHeight / 196;
        const restore = installFakeTextLayout(TEN_PER_LINE(8 * ratio));
        try {
          const dialog: TestDialog = { active: true, text: message, choice: null };
          const { renderer, ctx } = setup(dialog, displayHeight);
          renderer.drawDialog(ctx, { width: 128, height: 160 });
          const text = document.querySelector('.game-dialog-text') as HTMLElement;
          return { pages: dialog.maxPages, lines: linesInBox(text, 8 * ratio) };
        } finally {
          restore();
        }
      });

      expect(results[0].pages).toBe(3);
      expect(new Set(results.map((r) => r.pages)).size).toBe(1);
      expect(new Set(results.map((r) => Math.round(r.lines))).size).toBe(1);
    });

    it('never puts more than the configured number of lines on a page', () => {
      const restore = installFakeTextLayout(TEN_PER_LINE(16));
      try {
        const message = Array.from({ length: 12 }, () => WORD).join(' ');
        const dialog: TestDialog = { active: true, text: message, choice: null };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });

        const text = document.querySelector('.game-dialog-text') as HTMLElement;
        expect(linesInBox(text, 16)).toBeCloseTo(GameConfig.dialog.maxLines, 5);
      } finally {
        restore();
      }
    });

    it('shrinks the box for a short message instead of reserving empty space', () => {
      const restore = installFakeTextLayout(TEN_PER_LINE(16));
      try {
        const heights = ['HI', Array.from({ length: 4 }, () => WORD).join(' ')].map((message) => {
          const { renderer, ctx } = setup({ active: true, text: message, choice: null });
          renderer.drawDialog(ctx, { width: 128, height: 160 });
          const text = document.querySelector('.game-dialog-text') as HTMLElement;
          return linesInBox(text, 16);
        });

        expect(heights[0]).toBeCloseTo(1, 5);
        expect(heights[1]).toBeCloseTo(4, 5);
      } finally {
        restore();
      }
    });

    it('keeps the box height fixed while the player advances through pages', () => {
      const restore = installFakeTextLayout(TEN_PER_LINE(16));
      try {
        // Five lines paginate as [4, 1]: sizing per page would shrink the box
        // mid-conversation, which is the jitter this guards against.
        const dialog: TestDialog = {
          active: true,
          text: Array.from({ length: 5 }, () => WORD).join(' '),
          choice: null,
        };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });
        const text = document.querySelector('.game-dialog-text') as HTMLElement;

        expect(dialog.maxPages).toBe(2);
        const firstPageHeight = text.style.height;

        dialog.page = 2;
        renderer.drawDialog(ctx, { width: 128, height: 160 });
        expect(text.style.height).toBe(firstPageHeight);
        expect(linesInBox(text, 16)).toBeCloseTo(4, 5);
      } finally {
        restore();
      }
    });

    it('never ends a message on a page with nothing to read', () => {
      const restore = installFakeTextLayout(TEN_PER_LINE(16));
      try {
        // Four sentences typed on their own lines, with the trailing newline a
        // textarea leaves behind. The blank line used to be paginated like real
        // content and became an empty box the player had to click through.
        const dialog: TestDialog = {
          active: true,
          text: `${'Eu guardo segredos antigos.\n'.repeat(4)}\n`,
          choice: null,
        };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });
        const text = document.querySelector('.game-dialog-text') as HTMLElement;

        const visited: string[] = [];
        for (let page = 1; page <= (dialog.maxPages ?? 1); page++) {
          dialog.page = page;
          renderer.drawDialog(ctx, { width: 128, height: 160 });
          visited.push(text.textContent);
        }

        expect(visited).toHaveLength(dialog.maxPages ?? 0);
        for (const page of visited) {
          expect(page.trim()).not.toBe('');
        }
      } finally {
        restore();
      }
    });

    it('drops blank lines at the edges of a page instead of padding the box', () => {
      const restore = installFakeTextLayout(TEN_PER_LINE(16));
      try {
        const dialog: TestDialog = { active: true, text: '\n\nHELLO\n\n\n', choice: null };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });

        const text = document.querySelector('.game-dialog-text') as HTMLElement;
        expect(dialog.maxPages).toBe(1);
        expect(text.textContent).toBe('HELLO');
        expect(linesInBox(text, 16)).toBeCloseTo(1, 5);
      } finally {
        restore();
      }
    });

    it('gives the typewriter a box that already has its final height', () => {
      const restore = installFakeTextLayout(TEN_PER_LINE(16));
      try {
        const dialog: TestDialog = {
          active: true,
          text: Array.from({ length: 4 }, () => WORD).join(' '),
          choice: null,
        };
        const { renderer, ctx } = setup(dialog, 392, () => {});
        renderer.drawDialog(ctx, { width: 128, height: 160 });

        const text = document.querySelector('.game-dialog-text') as HTMLElement;
        // Nothing has been revealed yet, but the box is already four lines tall,
        // so it does not grow line by line as the text types out.
        expect(text.textContent).toBe('');
        expect(linesInBox(text, 16)).toBeCloseTo(4, 5);
      } finally {
        restore();
      }
    });
  });

  describe('manual page breaks', () => {
    it('starts a new page at a backslash', () => {
      const restore = installFakeTextLayout(10 * 16);
      try {
        const dialog: TestDialog = { active: true, text: 'ONE\\TWO', choice: null };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });

        expect(dialog.maxPages).toBe(2);
        expect(document.querySelector('.game-dialog-text')?.textContent).toBe('ONE');

        dialog.page = 2;
        renderer.drawDialog(ctx, { width: 128, height: 160 });
        expect(document.querySelector('.game-dialog-text')?.textContent).toBe('TWO');
      } finally {
        restore();
      }
    });

    it('treats a doubled backslash as a literal one', () => {
      const restore = installFakeTextLayout(10 * 16);
      try {
        const dialog: TestDialog = { active: true, text: 'ONE\\\\TWO', choice: null };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });

        expect(dialog.maxPages).toBe(1);
        expect(document.querySelector('.game-dialog-text')?.textContent).toBe('ONE\\TWO');
      } finally {
        restore();
      }
    });

    it('ignores a stray break instead of showing a blank page', () => {
      const restore = installFakeTextLayout(10 * 16);
      try {
        const dialog: TestDialog = { active: true, text: '\\ONE\\', choice: null };
        const { renderer, ctx } = setup(dialog);
        renderer.drawDialog(ctx, { width: 128, height: 160 });

        expect(dialog.maxPages).toBe(1);
        expect(document.querySelector('.game-dialog-text')?.textContent).toBe('ONE');
      } finally {
        restore();
      }
    });
  });
});
