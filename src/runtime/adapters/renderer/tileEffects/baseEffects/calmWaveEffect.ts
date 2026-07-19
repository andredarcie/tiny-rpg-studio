import { colorLuminance } from '../colorUtils';
import type { TileEffectPaintContext } from '../types';

/** Paint a slow, low-amplitude translucent wave. */
export function paintCalmWave({
    ctx,
    host,
    pixels,
    px,
    py,
    step,
    timeMs,
}: TileEffectPaintContext): void {
    const height = pixels.length;
    const width = pixels[0]?.length ?? 0;
    const time = timeMs / 1800;

    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            const color = row[x];
            if (host.isEmptyPixel(color)) continue;

            const luma = colorLuminance(color as string);
            const baseAlpha = 0.36 + (0.6 - 0.36) * luma;
            const wave = 1 + 0.025 * Math.sin(x * 0.55 + y * 0.25 + time * Math.PI * 2);
            ctx.save();
            ctx.globalAlpha = Math.max(0.16, Math.min(0.95, baseAlpha * wave));
            ctx.fillStyle = color as string;
            ctx.fillRect(px + x * step, py + y * step, step, step);
            ctx.restore();
        }
    }
}
