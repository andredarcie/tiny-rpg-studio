import type { TileEffectPaintContext } from '../types';

const REFLECTION_ALPHA = 0.2;

/** Mirror a sprite upward across a tile's bottom edge. */
export function paintReflectionBottom(
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
    const reflectionAxis = targetPy + size;
    const reflectedPy = reflectionAxis * 2 - (sourcePy + spriteHeight);

    ctx.save();
    ctx.beginPath();
    ctx.rect(targetPx, targetPy, size, size);
    ctx.clip();
    ctx.globalAlpha *= REFLECTION_ALPHA;
    host.drawPixelGrid(ctx, [...sprite].reverse(), sourcePx, reflectedPy, step);
    ctx.restore();
}
