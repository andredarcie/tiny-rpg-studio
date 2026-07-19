import type { TileEffectPaintContext } from '../types';

const FLOW_SPEED = 1.85;

export type ProceduralField = {
    width: number;
    height: number;
    time: number;
    values: number[][];
};

/** Build a multi-octave flowing field with values roughly in [-1.4, 1.4]. */
export function buildHeightField(width: number, height: number, time: number): number[][] {
    const field: number[][] = [];
    for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
            const value =
                Math.sin(x * 0.95 + y * 0.4 + time * 2.1) +
                0.55 * Math.sin(x * 0.35 - y * 0.95 + time * 1.45) +
                0.4 * Math.sin((x + y) * 0.75 - time * 2.6);
            row.push(value);
        }
        field.push(row);
    }
    return field;
}

/** Derive a procedural field directly from a standard tile paint context. */
export function createProceduralField(context: TileEffectPaintContext): ProceduralField | null {
    const height = context.pixels.length;
    const width = context.pixels[0]?.length ?? 0;
    if (height === 0 || width === 0) return null;

    const time = (context.timeMs / 1000) * FLOW_SPEED;
    return {
        width,
        height,
        time,
        values: buildHeightField(width, height, time),
    };
}
