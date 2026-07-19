import type { TileEffectPaintContext } from '../types';

const DEPTH_TINT = 'rgba(30, 110, 200, 0.14)';
const SOFT_LIGHT_TINT = 'rgba(90, 170, 230, 0.18)';

/** Add a cool translucent tint over the content behind a tile. */
export function paintCoolTint({ ctx, px, py, size }: TileEffectPaintContext): void {
    ctx.save();
    ctx.fillStyle = DEPTH_TINT;
    ctx.fillRect(px, py, size, size);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = SOFT_LIGHT_TINT;
    ctx.fillRect(px, py, size, size);
    ctx.restore();
}
