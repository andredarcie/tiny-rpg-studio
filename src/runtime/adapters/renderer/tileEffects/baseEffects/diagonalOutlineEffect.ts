import type { TileEffectPaintContext } from '../types';

const DIAGONAL_NEIGHBORS = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
] as const;

/** Draw an outer outline only in diagonal neighboring cells. */
export function paintDiagonalOutline({
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
        for (let x = 0; x < width; x++) {
            if (host.isEmptyPixel(pixels[y][x])) continue;
            for (const [dx, dy] of DIAGONAL_NEIGHBORS) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (!host.isEmptyPixel(pixels[ny][nx])) continue;
                ctx.fillRect(px + nx * step, py + ny * step, step, step);
            }
        }
    }
}
