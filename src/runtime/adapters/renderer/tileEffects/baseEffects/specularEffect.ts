import type { TileEffectPaintContext } from '../types';

const SPECULAR_COLOR = 'rgba(255, 255, 255, 0.75)';
const WAVE_PERIOD_MS = 900;

/** Paint small moving highlights over opaque source pixels. */
export function paintSpecular({
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

            const specular = Math.sin(x * 1.7 + y * 0.5 - time * Math.PI * 2.3 + worldPhase);
            if (specular <= 0.82 || (x * 3 + y * 5 + Math.floor(time * 4)) % 5 !== 0) continue;

            ctx.globalAlpha = 0.5 + (specular - 0.82) * 1.2;
            ctx.fillStyle = SPECULAR_COLOR;
            const fleck = Math.max(1, Math.floor(step * 0.35));
            const inset = Math.max(0, Math.floor((step - fleck) * 0.35));
            ctx.fillRect(px + x * step + inset, py + y * step + inset, fleck, fleck);
        }
    }

    ctx.restore();
}
