import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RendererDialogRenderer } from '../../runtime/adapters/renderer/RendererDialogRenderer';
import type { DialogChoiceState } from '../../types/gameState';

type TestDialog = { active: boolean; text?: string; choice?: DialogChoiceState | null };

function setup(dialog: TestDialog) {
  document.body.innerHTML = '';
  const parent = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 196;
  // jsdom does not lay elements out, so stub the display metrics the overlay reads.
  for (const [prop, value] of [['offsetWidth', 256], ['offsetHeight', 392], ['offsetLeft', 0], ['offsetTop', 0]] as const) {
    Object.defineProperty(canvas, prop, { value, configurable: true });
  }
  parent.appendChild(canvas);
  document.body.appendChild(parent);

  const ctx = { canvas } as unknown as CanvasRenderingContext2D;
  const gameState = { getDialog: () => dialog };
  const palette = { getColor: () => '#ffffff' };
  const renderer = new RendererDialogRenderer(gameState, palette);
  // The dialog box anchors to the bottom of the gameplay viewport.
  renderer.setViewportOffset(20);
  return { renderer, ctx, parent };
}

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
      // 8px font * (displayHeight / 196 internal height).
      expect(fontPx).toBeCloseTo(8 * (displayHeight / 196), 3);
      expect(fontPx).toBeGreaterThan(0);
    }
  });

  it('reports reveal as complete (no canvas typewriter)', () => {
    const { renderer } = setup({ active: true, text: 'Hi', choice: null });
    expect(renderer.isRevealComplete()).toBe(true);
    expect(() => renderer.skipReveal()).not.toThrow();
    expect(renderer.pickChoiceFromPointer()).toBeNull();
  });
});
