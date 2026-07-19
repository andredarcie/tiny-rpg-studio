import { colorLuminance } from '../colorUtils';
import type { TileEffectPaintContext } from '../types';

const SPARKLE_ALPHA = 0.88;
const SPARKLE_LUMA = 0.72;
const WAVE_PERIOD_MS = 900;

function getSparkleAlpha(
    x: number,
    y: number,
    width: number,
    height: number,
    timeMs: number
): number {
    const nx = width <= 1 ? 0 : (x / (width - 1)) * 2 - 1;
    const ny = height <= 1 ? 0 : (y / (height - 1)) * 2 - 1;
    const edge = Math.min(1, Math.sqrt(nx * nx + ny * ny));
    const meniscus = 0.82 + edge * 0.28;
    const time = timeMs / WAVE_PERIOD_MS;
    const wave = 0.94 + 0.06 * Math.sin(x * 0.9 + y * 0.45 + time * Math.PI * 2);
    return Math.max(0.16, Math.min(0.95, SPARKLE_ALPHA * meniscus * wave));
}

/** Paint bright source pixels as animated sparkles. */
export function paintSparkle({
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
            if (host.isEmptyPixel(color) || colorLuminance(color as string) < SPARKLE_LUMA) continue;

            ctx.save();
            ctx.globalAlpha = getSparkleAlpha(x, y, width, height, timeMs);
            ctx.fillStyle = color as string;
            ctx.fillRect(px + x * step, py + y * step, step, step);
            ctx.restore();
        }
    }
}
