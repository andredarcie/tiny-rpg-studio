import type { TileEffectPaintContext } from '../types';

const GLOW_OUTER = 'rgba(255, 90, 0, 0.4)';
const GLOW_INNER = 'rgba(255, 180, 40, 0.32)';
const GLOW_CORE = 'rgba(255, 240, 120, 0.2)';
const GLOW_BLUR_FACTOR = 0.42;
const GLOW_INSET_FACTOR = 0.12;

/** Paint a warm blurred glow below a tile. */
export function paintGlow({ ctx, px, py, size }: TileEffectPaintContext): void {
    const inset = Math.max(0, Math.floor(size * GLOW_INSET_FACTOR));
    const blur = Math.max(3, Math.floor(size * GLOW_BLUR_FACTOR));
    const width = Math.max(1, size - inset * 2);
    const height = Math.max(1, size - inset * 2);

    ctx.save();
    ctx.shadowColor = GLOW_OUTER;
    ctx.shadowBlur = blur;
    ctx.fillStyle = GLOW_INNER;
    ctx.fillRect(px + inset, py + inset, width, height);
    ctx.restore();

    const coreInset = inset + Math.max(1, Math.floor(size * 0.12));
    const coreWidth = Math.max(1, size - coreInset * 2);
    const coreHeight = Math.max(1, size - coreInset * 2);
    ctx.save();
    ctx.shadowColor = GLOW_CORE;
    ctx.shadowBlur = Math.max(2, Math.floor(blur * 0.55));
    ctx.fillStyle = GLOW_CORE;
    ctx.fillRect(px + coreInset, py + coreInset, coreWidth, coreHeight);
    ctx.restore();
}
