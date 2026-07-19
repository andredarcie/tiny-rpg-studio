import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomTileEffectEditorController } from '../../editor/modules/CustomTileEffectEditorController';

function setup() {
  document.body.innerHTML = `
    <button id="custom-effect-open">Open</button>
    <div id="custom-effect-modal" hidden>
      <button id="custom-effect-close"></button>
      <div id="custom-effect-saved"></div>
      <div id="custom-effect-catalog"></div>
      <canvas id="custom-effect-preview" width="192" height="192"></canvas>
      <input id="custom-effect-name">
      <div id="custom-effect-selected"></div>
      <p id="custom-effect-status"></p>
      <button id="custom-effect-cancel"></button>
      <button id="custom-effect-save"></button>
    </div>`;
  const createCustomTileEffect = vi.fn(() => ({ ok: true as const }));
  const game = {
    customTileEffects: [] as Array<{
      id: `custom:${string}`;
      name: string;
      baseEffectIds: Array<'glow' | 'sparkle'>;
    }>,
  };
  const deleteCustomTileEffect = vi.fn((id: `custom:${string}`) => {
    const exists = game.customTileEffects.some((definition) => definition.id === id);
    game.customTileEffects = game.customTileEffects.filter((definition) => definition.id !== id);
    return exists;
  });
  const manager = {
    gameEngine: {
      createCustomTileEffect,
      deleteCustomTileEffect,
      getGame: vi.fn(() => game),
      tileManager: { getTile: vi.fn(() => ({ id: 0, pixels: [['#0f0']] })) },
      renderer: { drawCustomTileEffectPreview: vi.fn() },
    },
    renderAll: vi.fn(),
    updateJSON: vi.fn(),
    history: { pushCurrentState: vi.fn() },
  };
  const controller = new CustomTileEffectEditorController();
  controller.init(manager as never, {
    customTileEffectOpen: document.querySelector('#custom-effect-open'),
    customTileEffectModal: document.querySelector('#custom-effect-modal'),
  });
  return { controller, manager, game, createCustomTileEffect, deleteCustomTileEffect };
}

describe('CustomTileEffectEditorController', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('opens a reset draft, preserves visible order, and previews after edits', () => {
    const { controller, manager } = setup();
    (document.querySelector('#custom-effect-open') as HTMLButtonElement).click();
    expect(document.querySelector('#custom-effect-modal')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelectorAll('[data-base-effect-id]')).toHaveLength(25);
    expect(document.querySelector('[data-base-effect-id="reflection-top"]')).not.toBeNull();
    expect(manager.gameEngine.renderer.drawCustomTileEffectPreview).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement), expect.objectContaining({ id: 0 }), [], 0, 0,
    );

    (document.querySelector('[data-base-effect-id="glow"]') as HTMLButtonElement).click();
    (document.querySelector('[data-base-effect-id="sparkle"]') as HTMLButtonElement).click();
    (document.querySelector('[data-remove-base-effect-id="glow"]') as HTMLButtonElement).click();
    (document.querySelector('[data-base-effect-id="glow"]') as HTMLButtonElement).click();
    expect(Array.from(document.querySelectorAll('#custom-effect-selected span')).map((el) => el.textContent)).toEqual([
      '1. Sparkle', '2. Glow',
    ]);
    expect(manager.gameEngine.renderer.drawCustomTileEffectPreview).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement), expect.anything(), ['sparkle', 'glow'], 0, 0,
    );
    controller.close();
  });

  it('animates tile frames and effect time while open, then cancels on close', () => {
    let animationCallback: FrameRequestCallback | null = null;
    const request = vi.fn((callback: FrameRequestCallback) => {
      animationCallback = callback;
      return 7;
    });
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const { controller, manager } = setup();

    controller.open();
    const now = performance.now();
    const callback = animationCallback as FrameRequestCallback | null;
    callback?.(now + 640);
    expect(manager.gameEngine.renderer.drawCustomTileEffectPreview).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement), expect.anything(), [], 2, 640,
    );

    controller.close();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('deletes a saved effect and records the project mutation once', () => {
    const { controller, manager, game, deleteCustomTileEffect } = setup();
    game.customTileEffects = [{ id: 'custom:0', name: 'Mistake', baseEffectIds: ['glow'] }];
    controller.open();
    expect(document.querySelector('[data-delete-custom-effect-id="custom:0"]')?.textContent).toBe('Delete');

    (document.querySelector('[data-delete-custom-effect-id="custom:0"]') as HTMLButtonElement).click();
    expect(deleteCustomTileEffect).toHaveBeenCalledWith('custom:0');
    expect(game.customTileEffects).toEqual([]);
    expect(manager.renderAll).toHaveBeenCalledTimes(1);
    expect(manager.updateJSON).toHaveBeenCalledTimes(1);
    expect(manager.history.pushCurrentState).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-delete-custom-effect-id]')).toBeNull();
    controller.close();
  });

  it('keeps validation errors open and saves with one render/JSON/history update', () => {
    const { controller, manager, createCustomTileEffect } = setup();
    controller.open();
    createCustomTileEffect.mockReturnValueOnce({ ok: false, error: 'empty-name' } as never);
    controller.save();
    expect(document.querySelector('#custom-effect-status')?.textContent).toContain('name');
    expect(document.querySelector('#custom-effect-modal')?.hasAttribute('hidden')).toBe(false);

    (document.querySelector('#custom-effect-name') as HTMLInputElement).value = 'Magic';
    (document.querySelector('[data-base-effect-id="glow"]') as HTMLButtonElement).click();
    controller.save();
    expect(createCustomTileEffect).toHaveBeenLastCalledWith('Magic', ['glow']);
    expect(manager.renderAll).toHaveBeenCalledTimes(1);
    expect(manager.updateJSON).toHaveBeenCalledTimes(1);
    expect(manager.history.pushCurrentState).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#custom-effect-modal')?.hasAttribute('hidden')).toBe(true);
  });

  it('discards through backdrop and Escape without creating data', () => {
    const { controller, createCustomTileEffect } = setup();
    controller.open();
    document.querySelector('#custom-effect-modal')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(createCustomTileEffect).not.toHaveBeenCalled();
    controller.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('#custom-effect-modal')?.hasAttribute('hidden')).toBe(true);
    expect(createCustomTileEffect).not.toHaveBeenCalled();
  });
});
