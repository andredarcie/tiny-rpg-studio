import { mixColors, modulateColor } from '../colorUtils';
import type { TileEffectPaintContext } from '../types';
import { createProceduralField } from './proceduralField';

const TROUGH_COLOR = '#8b2808';
const CREST_COLOR = '#ffe066';

/** Paint source pixels with animated height-field lighting. */
export function paintHeightFieldBody(context: TileEffectPaintContext): void {
    const surface = createProceduralField(context);
    if (!surface) return;

    const { ctx, host, pixels, px, py, step } = context;
    const { values, width, height } = surface;
    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            const sourceColor = row[x];
            if (host.isEmptyPixel(sourceColor)) continue;

            const fieldHeight = values[y][x];
            const heightDown = values[Math.min(height - 1, y + 1)][x];
            const heightRight = values[y][Math.min(width - 1, x + 1)];
            const slopeY = fieldHeight - heightDown;
            const slopeX = fieldHeight - heightRight;
            const light = Math.max(
                0.92,
                1.08 + fieldHeight * 0.28 + slopeY * 0.32 + slopeX * 0.14
            );

            let color = modulateColor(sourceColor as string, light);
            if (fieldHeight < -0.45) {
                color = mixColors(
                    color,
                    TROUGH_COLOR,
                    Math.min(0.32, (-fieldHeight - 0.45) * 0.45)
                );
            }
            if (fieldHeight > 0.25) {
                color = mixColors(
                    color,
                    CREST_COLOR,
                    Math.min(0.65, (fieldHeight - 0.25) * 0.95)
                );
            }

            ctx.fillStyle = color;
            ctx.fillRect(px + x * step, py + y * step, step, step);
        }
    }
}
