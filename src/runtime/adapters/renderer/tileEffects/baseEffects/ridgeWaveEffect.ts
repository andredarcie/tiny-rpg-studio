import type { TileEffectPaintContext } from '../types';
import { createProceduralField } from './proceduralField';

const RIDGE_COLOR = 'rgba(255, 250, 200, 0.9)';
const HIGHLIGHT_COLOR = 'rgba(255, 220, 100, 0.6)';
const SHADOW_COLOR = 'rgba(120, 30, 10, 0.22)';

/** Paint bright ridges and dark troughs from an animated height field. */
export function paintRidgeWave(context: TileEffectPaintContext): void {
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

            if (fieldHeight > 0.55 && slopeY > 0.25) {
                ctx.save();
                ctx.globalAlpha = Math.min(
                    0.95,
                    0.35 + slopeY * 0.7 + (fieldHeight - 0.55) * 0.5
                );
                ctx.fillStyle = RIDGE_COLOR;
                const band = Math.max(1, Math.floor(step * 0.4));
                ctx.fillRect(px + x * step, py + y * step, step, band);
                ctx.globalAlpha *= 0.55;
                ctx.fillStyle = HIGHLIGHT_COLOR;
                ctx.fillRect(
                    px + x * step,
                    py + y * step + band,
                    step,
                    Math.max(1, step - band)
                );
                ctx.restore();
            }

            if (fieldHeight < -0.25 && slopeY < -0.2) {
                ctx.save();
                ctx.globalAlpha = Math.min(0.28, 0.1 + Math.abs(slopeY) * 0.22);
                ctx.fillStyle = SHADOW_COLOR;
                ctx.fillRect(
                    px + x * step,
                    py + y * step + Math.floor(step * 0.35),
                    step,
                    Math.max(1, Math.ceil(step * 0.65))
                );
                ctx.restore();
            }
        }
    }
}
