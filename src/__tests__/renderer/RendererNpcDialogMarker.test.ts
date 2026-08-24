import { describe, expect, it, vi } from 'vitest';
import { drawLockMarker } from '../../runtime/adapters/renderer/RendererNpcDialogMarker';

type CtxMock = Pick<CanvasRenderingContext2D, 'fillRect'> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
};

function createCtx(): CtxMock {
  return {
    fillRect: vi.fn(),
    fillStyle: '',
  };
}

describe('drawLockMarker', () => {
  it('draws a palette-backed pixel lock scaled to the tile size', () => {
    const ctx = createCtx();
    const paletteManager = { getColor: vi.fn(() => '#C2C3C7') };

    drawLockMarker(ctx as unknown as CanvasRenderingContext2D, paletteManager, 16, 32, 16);

    expect(paletteManager.getColor).toHaveBeenCalledWith(6);
    expect(ctx.fillStyle).toBe('#C2C3C7');
    expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 30, 34, 4, 2);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(2, 28, 36, 8, 6);

    drawLockMarker(ctx as unknown as CanvasRenderingContext2D, paletteManager, 16, 32, 8);

    expect(ctx.fillRect).toHaveBeenNthCalledWith(3, 23, 33, 2, 1);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(4, 22, 34, 4, 3);
  });
});
