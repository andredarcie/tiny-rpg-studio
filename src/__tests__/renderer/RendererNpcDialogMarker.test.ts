import { describe, expect, it, vi } from 'vitest';
import { LockMarkerMatrix, drawLockMarker } from '../../runtime/adapters/renderer/RendererNpcDialogMarker';

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
  it('draws the 8x8 palette-backed lock matrix scaled to the tile size', () => {
    const ctx = createCtx();
    const paletteManager = { getColor: vi.fn(() => '#C2C3C7') };

    drawLockMarker(ctx as unknown as CanvasRenderingContext2D, paletteManager, 16, 32, 16);

    expect(paletteManager.getColor).toHaveBeenCalledWith(6);
    expect(ctx.fillStyle).toBe('#C2C3C7');
    expect(ctx.fillRect).toHaveBeenCalledTimes(14);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 30, 34, 2, 2);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(14, 34, 40, 2, 2);

    drawLockMarker(ctx as unknown as CanvasRenderingContext2D, paletteManager, 16, 32, 8);

    expect(ctx.fillRect).toHaveBeenCalledTimes(28);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(15, 23, 33, 1, 1);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(28, 25, 36, 1, 1);
  });

  it('defines the lock marker as an 8x8 pixel matrix', () => {
    expect(LockMarkerMatrix).toHaveLength(8);
    LockMarkerMatrix.forEach((row) => expect(row).toHaveLength(8));
  });
});
