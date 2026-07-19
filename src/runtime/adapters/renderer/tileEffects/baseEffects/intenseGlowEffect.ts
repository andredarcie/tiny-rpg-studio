import type { TileEffectPaintContext } from '../types';

/** Paint a compact, high-intensity warm glow below a tile. */
export function paintIntenseGlow({ ctx, px, py, size }: TileEffectPaintContext): void {
    const inset = Math.max(0, Math.floor(size * 0.06));
    const blur = Math.max(2, Math.floor(size * 0.32));
    const extent = Math.max(1, size - inset * 2);

    ctx.save();
    ctx.shadowColor = 'rgba(255, 45, 0, 0.62)';
    ctx.shadowBlur = blur;
    ctx.fillStyle = 'rgba(255, 145, 20, 0.48)';
    ctx.fillRect(px + inset, py + inset, extent, extent);
    ctx.restore();

    const coreInset = inset + Math.max(1, Math.floor(size * 0.1));
    const coreExtent = Math.max(1, size - coreInset * 2);
    ctx.save();
    ctx.shadowColor = 'rgba(255, 245, 170, 0.34)';
    ctx.shadowBlur = Math.max(2, Math.floor(blur * 0.5));
    ctx.fillStyle = 'rgba(255, 245, 170, 0.34)';
    ctx.fillRect(px + coreInset, py + coreInset, coreExtent, coreExtent);
    ctx.restore();
}
