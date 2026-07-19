import type { TileEffectPaintContext } from '../types';

const CARDINAL_NEIGHBORS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
] as const;

/** Draw an outline inside opaque edge pixels. */
export function paintInnerOutline({
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
            const isEdge = CARDINAL_NEIGHBORS.some(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                return (
                    nx < 0 ||
                    ny < 0 ||
                    nx >= width ||
                    ny >= height ||
                    host.isEmptyPixel(pixels[ny][nx])
                );
            });
            if (isEdge) ctx.fillRect(px + x * step, py + y * step, step, step);
        }
    }
}
