import type { TileEffectPaintContext } from '../types';
import { createProceduralField } from './proceduralField';

const EMBER_COLOR = 'rgba(255, 230, 140, 0.85)';

/** Scatter small drifting embers over high areas of an animated field. */
export function paintEmbers(context: TileEffectPaintContext): void {
    const surface = createProceduralField(context);
    if (!surface) return;

    const { ctx, px, py, step } = context;
    const { values, width, height, time } = surface;
    const phase = Math.floor(time * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const hash = (x * 13 + y * 29 + phase * 7) % 11;
            if (hash !== 0 && hash !== 3) continue;
            if (values[y][x] < 0.15) continue;

            const ember = Math.max(1, Math.floor(step * 0.22));
            const drift = (phase + x + y) % Math.max(1, step - ember);
            ctx.globalAlpha = 0.55 + (hash === 0 ? 0.25 : 0);
            ctx.fillStyle = EMBER_COLOR;
            ctx.fillRect(
                px + x * step + drift,
                py + y * step + (Math.floor(drift * 0.5) % Math.max(1, step - ember)),
                ember,
                ember
            );
        }
    }

    ctx.restore();
}
