import type { TileEffectPaintContext } from '../types';

/** Add a muted green-brown tint over the content behind a tile. */
export function paintMurkyTint({ ctx, px, py, size }: TileEffectPaintContext): void {
    ctx.save();
    ctx.fillStyle = 'rgba(65, 100, 70, 0.22)';
    ctx.fillRect(px, py, size, size);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(155, 145, 80, 0.12)';
    ctx.fillRect(px, py, size, size);
    ctx.restore();
}
