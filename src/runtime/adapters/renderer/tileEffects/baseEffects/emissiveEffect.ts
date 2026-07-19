import type { TileEffectPaintContext } from '../types';
import { createProceduralField } from './proceduralField';

const CREST_COLOR = '#ffe066';
const VEIN_COLOR = 'rgba(255, 200, 60, 0.55)';

/** Add emissive crests and veins derived from an animated height field. */
export function paintEmissive(context: TileEffectPaintContext): void {
    const surface = createProceduralField(context);
    if (!surface) return;

    const { ctx, host, pixels, px, py, step } = context;
    const { values, width, height } = surface;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            if (host.isEmptyPixel(row[x])) continue;
            const fieldHeight = values[y][x];
            const heightRight = values[y][Math.min(width - 1, x + 1)];
            const heightDown = values[Math.min(height - 1, y + 1)][x];

            if (fieldHeight > 0.5) {
                ctx.globalAlpha = Math.min(0.45, 0.12 + (fieldHeight - 0.5) * 0.4);
                ctx.fillStyle = CREST_COLOR;
                ctx.fillRect(px + x * step, py + y * step, step, step);
            }

            const slope = Math.abs(fieldHeight - heightRight) + Math.abs(fieldHeight - heightDown);
            if (slope > 0.55 && fieldHeight > -0.1) {
                ctx.globalAlpha = Math.min(0.55, 0.15 + slope * 0.25);
                ctx.fillStyle = VEIN_COLOR;
                const veinHeight = Math.max(1, Math.floor(step * 0.35));
                ctx.fillRect(
                    px + x * step,
                    py + y * step + Math.floor((step - veinHeight) * 0.5),
                    step,
                    veinHeight
                );
            }
        }
    }

    ctx.restore();
}
