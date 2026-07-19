import { describe, expect, it, vi } from 'vitest';
import { paintCalmWave } from '../../runtime/adapters/renderer/tileEffects/baseEffects/calmWaveEffect';
import { paintChoppyWave } from '../../runtime/adapters/renderer/tileEffects/baseEffects/choppyWaveEffect';
import { paintDeepTint } from '../../runtime/adapters/renderer/tileEffects/baseEffects/deepTintEffect';
import { paintDiagonalOutline } from '../../runtime/adapters/renderer/tileEffects/baseEffects/diagonalOutlineEffect';
import { paintGentleRidge } from '../../runtime/adapters/renderer/tileEffects/baseEffects/gentleRidgeEffect';
import { paintInnerOutline } from '../../runtime/adapters/renderer/tileEffects/baseEffects/innerOutlineEffect';
import { paintIntenseGlow } from '../../runtime/adapters/renderer/tileEffects/baseEffects/intenseGlowEffect';
import { paintMurkyTint } from '../../runtime/adapters/renderer/tileEffects/baseEffects/murkyTintEffect';
import { paintReflectionBottom } from '../../runtime/adapters/renderer/tileEffects/baseEffects/reflectionBottomEffect';
import { paintReflectionLeft } from '../../runtime/adapters/renderer/tileEffects/baseEffects/reflectionLeftEffect';
import { paintReflectionRight } from '../../runtime/adapters/renderer/tileEffects/baseEffects/reflectionRightEffect';
import { paintSharpRidge } from '../../runtime/adapters/renderer/tileEffects/baseEffects/sharpRidgeEffect';
import { paintSoftGlow } from '../../runtime/adapters/renderer/tileEffects/baseEffects/softGlowEffect';
import type {
  TileEffectHost,
  TileEffectPaintContext,
  TileEffectPainter,
} from '../../runtime/adapters/renderer/tileEffects/types';

type TestContext = CanvasRenderingContext2D & {
  fillRect: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
};

function makeCanvasContext(): TestContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as TestContext;
}

function makeHost(): TileEffectHost {
  return {
    isEmptyPixel: (color) => color === null || color === undefined,
    isSpriteOutlineEnabled: () => true,
    getSpriteOutlineColor: () => '#000000',
    drawPixelGrid: vi.fn(),
  };
}

function makePaintContext(
  ctx = makeCanvasContext(),
  pixels: (string | null)[][] = [
    ['#29ADFF', '#29ADFF'],
    ['#29ADFF', '#29ADFF'],
  ]
): TileEffectPaintContext {
  return {
    ctx,
    host: makeHost(),
    pixels,
    px: 4,
    py: 6,
    step: 8,
    size: 16,
    timeMs: 225,
  };
}

describe('standalone base effects', () => {
  it('reflects a sprite upward across a target tile bottom edge', () => {
    const ctx = makeCanvasContext();
    const host = makeHost();
    const sprite = [['#top'], ['#bottom']];

    paintReflectionBottom(ctx, host, sprite, 12, 48, 2, 12, 32, 16);

    expect(ctx.rect).toHaveBeenCalledWith(12, 32, 16, 16);
    expect(host.drawPixelGrid).toHaveBeenCalledWith(
      ctx,
      [['#bottom'], ['#top']],
      12,
      44,
      2
    );
    expect(ctx.globalAlpha).toBe(0.2);
  });

  it('reflects sprites horizontally across target tile edges', () => {
    const leftCtx = makeCanvasContext();
    const leftHost = makeHost();
    const rightCtx = makeCanvasContext();
    const rightHost = makeHost();
    const sprite = [['#left', '#right']];

    paintReflectionLeft(leftCtx, leftHost, sprite, 28, 20, 2, 32, 20, 16);
    paintReflectionRight(rightCtx, rightHost, sprite, 48, 20, 2, 32, 20, 16);

    expect(leftHost.drawPixelGrid).toHaveBeenCalledWith(
      leftCtx,
      [['#right', '#left']],
      32,
      20,
      2
    );
    expect(rightHost.drawPixelGrid).toHaveBeenCalledWith(
      rightCtx,
      [['#right', '#left']],
      44,
      20,
      2
    );
  });

  it('provides independently composable deep and murky tint passes', () => {
    const ctx = makeCanvasContext();
    const context = makePaintContext(ctx);
    const painters: TileEffectPainter[] = [paintDeepTint, paintMurkyTint];

    painters.forEach((paintEffect) => paintEffect(context));

    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    expect(ctx.fillRect).toHaveBeenCalledWith(4, 6, 16, 16);
    expect(ctx.globalCompositeOperation).toBe('soft-light');
  });

  it('provides independently composable soft and intense glow passes', () => {
    const ctx = makeCanvasContext();
    const context = makePaintContext(ctx);
    const painters: TileEffectPainter[] = [paintSoftGlow, paintIntenseGlow];

    painters.forEach((paintEffect) => paintEffect(context));

    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    expect(ctx.shadowBlur).toBeGreaterThan(0);
  });

  it('provides independently composable diagonal and inner outline passes', () => {
    const ctx = makeCanvasContext();
    const pixels = [
      [null, null, null],
      [null, '#29ADFF', null],
      [null, null, null],
    ];
    const context = makePaintContext(ctx, pixels);

    paintDiagonalOutline(context);
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);

    ctx.fillRect.mockClear();
    paintInnerOutline(context);
    expect(ctx.fillRect).toHaveBeenCalledOnce();
    expect(ctx.fillRect).toHaveBeenCalledWith(12, 14, 8, 8);
  });

  it('provides independent calm and choppy wave passes with different motion', () => {
    const ctx = makeCanvasContext();
    const alphas: number[] = [];
    Object.defineProperty(ctx, 'globalAlpha', {
      configurable: true,
      get: () => alphas.at(-1) ?? 1,
      set: (value: number) => alphas.push(value),
    });
    const context = makePaintContext(ctx);

    paintCalmWave(context);
    const calmAlphas = [...alphas];
    alphas.length = 0;
    paintChoppyWave(context);

    expect(ctx.fillRect).toHaveBeenCalledTimes(8);
    expect(alphas).not.toEqual(calmAlphas);
  });

  it('provides independent gentle and sharp ridge passes', () => {
    const pixels = Array.from({ length: 8 }, () => Array<string | null>(8).fill('#FF004D'));
    const gentleCtx = makeCanvasContext();
    const sharpCtx = makeCanvasContext();
    const gentleContext = {
      ...makePaintContext(gentleCtx, pixels),
      size: 64,
      timeMs: 0,
    };
    const sharpContext = {
      ...makePaintContext(sharpCtx, pixels),
      size: 64,
      timeMs: 0,
    };

    paintGentleRidge(gentleContext);
    paintSharpRidge(sharpContext);

    expect(gentleCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    expect(sharpCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    expect(gentleCtx.fillRect.mock.calls).not.toEqual(sharpCtx.fillRect.mock.calls);
  });
});
