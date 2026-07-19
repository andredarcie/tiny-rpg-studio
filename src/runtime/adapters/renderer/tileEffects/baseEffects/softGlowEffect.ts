import type { TileEffectPaintContext } from '../types';

/** Paint a wide, low-opacity warm glow below a tile. */
export function paintSoftGlow({ ctx, px, py, size }: TileEffectPaintContext): void {
    const inset = Math.max(0, Math.floor(size * 0.18));
    const blur = Math.max(2, Math.floor(size * 0.58));
    const extent = Math.max(1, size - inset * 2);

    ctx.save();
    ctx.shadowColor = 'rgba(255, 110, 30, 0.24)';
    ctx.shadowBlur = blur;
    ctx.fillStyle = 'rgba(255, 175, 65, 0.2)';
    ctx.fillRect(px + inset, py + inset, extent, extent);
    ctx.restore();

    const coreInset = inset + Math.max(1, Math.floor(size * 0.1));
    const coreExtent = Math.max(1, size - coreInset * 2);
    ctx.save();
    ctx.shadowColor = 'rgba(255, 225, 135, 0.12)';
    ctx.shadowBlur = Math.max(2, Math.floor(blur * 0.5));
    ctx.fillStyle = 'rgba(255, 225, 135, 0.12)';
    ctx.fillRect(px + coreInset, py + coreInset, coreExtent, coreExtent);
    ctx.restore();
}
