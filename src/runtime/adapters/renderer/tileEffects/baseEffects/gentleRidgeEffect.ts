import type { TileEffectPaintContext } from '../types';
import { createProceduralField } from './proceduralField';

/** Paint broad, low-contrast ridges and troughs from an animated height field. */
export function paintGentleRidge(context: TileEffectPaintContext): void {
    const surface = createProceduralField(context);
    if (!surface) return;

    const { ctx, host, pixels, px, py, step } = context;
    const { values, width, height } = surface;
    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            if (host.isEmptyPixel(row[x])) continue;

            const fieldHeight = values[y][x];
            const heightDown = values[Math.min(height - 1, y + 1)][x];
            const slopeY = fieldHeight - heightDown;
            if (fieldHeight > 0.35 && slopeY > 0.15) {
                ctx.save();
                ctx.globalAlpha = Math.min(0.95, 0.32 + slopeY * 0.2);
                ctx.fillStyle = 'rgba(255, 225, 145, 0.52)';
                ctx.fillRect(
                    px + x * step,
                    py + y * step,
                    step,
                    Math.max(1, Math.floor(step * 0.58))
                );
                ctx.restore();
            }

            if (fieldHeight < -0.35 && slopeY < -0.15) {
                ctx.save();
                ctx.globalAlpha = Math.min(0.5, 0.14 + Math.abs(slopeY) * 0.1);
                ctx.fillStyle = 'rgba(125, 40, 15, 0.14)';
                ctx.fillRect(
                    px + x * step,
                    py + y * step + Math.floor(step * 0.4),
                    step,
                    Math.max(1, Math.ceil(step * 0.6))
                );
                ctx.restore();
            }
        }
    }
}
