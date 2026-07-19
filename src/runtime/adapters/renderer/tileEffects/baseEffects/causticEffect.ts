import type { TileEffectPaintContext } from '../types';

const CAUSTIC_COLOR = 'rgba(200, 245, 255, 0.5)';
const WAVE_PERIOD_MS = 900;

/** Paint animated crossing light bands over opaque source pixels. */
export function paintCaustic({
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
    const time = timeMs / WAVE_PERIOD_MS;
    const worldPhase = (px * 0.07 + py * 0.11) * 0.01;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            if (host.isEmptyPixel(row[x])) continue;

            const caustic =
                Math.sin(x * 1.1 - y * 0.7 + time * Math.PI * 2 + worldPhase) *
                Math.sin(x * 0.35 + y * 1.3 + time * Math.PI * 1.4 + worldPhase * 1.3);
            if (caustic <= 0.55) continue;

            ctx.globalAlpha = 0.22 + (caustic - 0.55) * 0.85;
            ctx.fillStyle = CAUSTIC_COLOR;
            ctx.fillRect(px + x * step, py + y * step, step, step);
        }
    }

    ctx.restore();
}
