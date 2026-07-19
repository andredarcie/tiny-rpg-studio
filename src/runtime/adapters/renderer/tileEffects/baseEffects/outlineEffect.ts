import type { TileEffectPaintContext } from '../types';

/** Draw the configured sprite outline around an effect's opaque pixels. */
export function paintTileEffectOutline({
    ctx,
    host,
    pixels,
    px,
    py,
    step,
}: TileEffectPaintContext): void {
    if (!host.isSpriteOutlineEnabled()) return;

    const height = pixels.length;
    const width = pixels[0]?.length ?? 0;
    ctx.fillStyle = host.getSpriteOutlineColor();

    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < row.length; x++) {
            if (host.isEmptyPixel(row[x])) continue;
            for (const [dx, dy] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ] as const) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (!host.isEmptyPixel(pixels[ny][nx])) continue;
                ctx.fillRect(px + nx * step, py + ny * step, step, step);
            }
        }
    }
}
