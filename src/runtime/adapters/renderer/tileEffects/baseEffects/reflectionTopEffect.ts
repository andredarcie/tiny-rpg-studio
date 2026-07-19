import type { TileEffectPaintContext } from '../types';

const REFLECTION_ALPHA = 0.2;

/** Mirror a sprite downward across a tile's top edge. */
export function paintReflectionTop(
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

    const spriteHeight = sprite.length * step;
    const reflectedPy = targetPy * 2 - (sourcePy + spriteHeight);

    ctx.save();
    ctx.beginPath();
    ctx.rect(targetPx, targetPy, size, size);
    ctx.clip();
    ctx.globalAlpha *= REFLECTION_ALPHA;
    host.drawPixelGrid(ctx, [...sprite].reverse(), sourcePx, reflectedPy, step);
    ctx.restore();
}
