import { colorLuminance } from '../colorUtils';
import type { TileEffectPaintContext } from '../types';

const BODY_ALPHA_MIN = 0.32;
const BODY_ALPHA_MAX = 0.62;
const BRIGHT_PIXEL_LUMA = 0.72;
const WAVE_PERIOD_MS = 900;

function getSurfaceAlpha(
    x: number,
    y: number,
    width: number,
    height: number,
    timeMs: number,
    alpha: number
): number {
    const nx = width <= 1 ? 0 : (x / (width - 1)) * 2 - 1;
    const ny = height <= 1 ? 0 : (y / (height - 1)) * 2 - 1;
    const edge = Math.min(1, Math.sqrt(nx * nx + ny * ny));
    const meniscus = 0.82 + edge * 0.28;
    const time = timeMs / WAVE_PERIOD_MS;
    const wave = 0.94 + 0.06 * Math.sin(x * 0.9 + y * 0.45 + time * Math.PI * 2);
    return Math.max(0.16, Math.min(0.95, alpha * meniscus * wave));
}

/** Paint a translucent animated surface while leaving bright pixels for another pass. */
export function paintTranslucentWave({
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

    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            const color = row[x];
            if (host.isEmptyPixel(color)) continue;

            const luma = colorLuminance(color as string);
            if (luma >= BRIGHT_PIXEL_LUMA) continue;

            const alpha = BODY_ALPHA_MIN + (BODY_ALPHA_MAX - BODY_ALPHA_MIN) * luma;
            ctx.save();
            ctx.globalAlpha = getSurfaceAlpha(x, y, width, height, timeMs, alpha);
            ctx.fillStyle = color as string;
            ctx.fillRect(px + x * step, py + y * step, step, step);
            ctx.restore();
        }
    }
}
