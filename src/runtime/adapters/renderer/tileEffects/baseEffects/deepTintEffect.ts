import type { TileEffectPaintContext } from '../types';

/** Add a dark blue tint over the content behind a tile. */
export function paintDeepTint({ ctx, px, py, size }: TileEffectPaintContext): void {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 45, 120, 0.28)';
    ctx.fillRect(px, py, size, size);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(45, 110, 190, 0.14)';
    ctx.fillRect(px, py, size, size);
    ctx.restore();
}
