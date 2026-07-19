import type { TileEffectPaintContext } from '../types';

const REFLECTION_ALPHA = 0.2;

/** Mirror a sprite leftward across a tile's right edge. */
export function paintReflectionRight(
    ctx: CanvasRenderingContext2D,
    host: TileEffectPaintContext['host'],
    sprite: (string | null)[][],
    sourcePx: number,
    sourcePy: number,
    step: number,
    targetPx: number,
    targetPy: number,
    size: number
): void {
    if (sprite.length === 0) return;

    const spriteWidth = sprite.reduce((width, row) => Math.max(width, row.length), 0) * step;
    if (spriteWidth === 0) return;
    const reflectionAxis = targetPx + size;
    const reflectedPx = reflectionAxis * 2 - (sourcePx + spriteWidth);
    const reflectedSprite = sprite.map((row) => [...row].reverse());

    ctx.save();
    ctx.beginPath();
    ctx.rect(targetPx, targetPy, size, size);
    ctx.clip();
    ctx.globalAlpha *= REFLECTION_ALPHA;
    host.drawPixelGrid(ctx, reflectedSprite, reflectedPx, sourcePy, step);
    ctx.restore();
}
