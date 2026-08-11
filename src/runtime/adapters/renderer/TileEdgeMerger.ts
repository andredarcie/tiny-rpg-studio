import type { TileDefinition, TileId, TileMapLayer } from '../../domain/definitions/tileTypes';

const TILE_ART_SIZE = 8;
const MERGE_DEPTH = 2;

type TileMapLayers = {
    ground: TileMapLayer;
    overlay: TileMapLayer;
};

type TileEdgeMergerOptions = {
    ctx: CanvasRenderingContext2D;
    tileMap: TileMapLayers;
    getTile: (tileId: TileId) => TileDefinition | null;
    getTilePixels?: (tile: TileDefinition) => (string | null)[][] | null;
    tileSize: number;
    roomSize?: number;
};

type CellInfo = {
    identity: string;
    isValid: boolean;
    mergeablePixels: boolean[][];
    hasMergeablePixels: boolean;
};

function getCellInfo(
    tileMap: TileMapLayers,
    getTile: (tileId: TileId) => TileDefinition | null,
    getTilePixels: ((tile: TileDefinition) => (string | null)[][] | null) | undefined,
    x: number,
    y: number
): CellInfo {
    const groundId = tileMap.ground[y]?.[x] ?? null;
    const overlayId = tileMap.overlay[y]?.[x] ?? null;
    const ids = [groundId, overlayId].filter((id): id is TileId => id !== null);
    const tiles = ids.map((id) => getTile(id));
    const isValid = ids.length > 0 && tiles.every((tile) => tile !== null);
    const resolvedTiles = tiles.filter((tile): tile is TileDefinition => tile !== null);
    const mergeablePixels = Array.from({ length: TILE_ART_SIZE }, (_, pixelY) =>
        Array.from({ length: TILE_ART_SIZE }, (_, pixelX) => {
            let mergeable = false;
            for (const tile of resolvedTiles) {
                const pixels = getTilePixels?.(tile) ?? tile.frames?.[0] ?? tile.pixels;
                const pixel = pixels?.[pixelY]?.[pixelX];
                if (!pixels || (pixel !== null && pixel !== undefined && pixel !== 'transparent')) {
                    mergeable = tile.mergeEdges === true;
                }
            }
            return mergeable;
        })
    );
    return {
        identity: JSON.stringify([
            groundId === null ? null : String(groundId),
            overlayId === null ? null : String(overlayId),
        ]),
        isValid,
        mergeablePixels,
        hasMergeablePixels: isValid && mergeablePixels.some((row) => row.some(Boolean)),
    };
}

function copyPixelBlock(
    source: Uint8ClampedArray,
    output: Uint8ClampedArray,
    width: number,
    pixelStep: number,
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
): void {
    for (let y = 0; y < pixelStep; y++) {
        for (let x = 0; x < pixelStep; x++) {
            const sourceIndex = ((sourceY + y) * width + sourceX + x) * 4;
            const targetIndex = ((targetY + y) * width + targetX + x) * 4;
            output[targetIndex] = source[sourceIndex];
            output[targetIndex + 1] = source[sourceIndex + 1];
            output[targetIndex + 2] = source[sourceIndex + 2];
            output[targetIndex + 3] = source[sourceIndex + 3];
        }
    }
}

function shouldMerge(first: CellInfo, second: CellInfo): boolean {
    return first.isValid && second.isValid &&
        (first.hasMergeablePixels || second.hasMergeablePixels) && first.identity !== second.identity;
}

function applyTileEdgeMerging({
    ctx,
    tileMap,
    getTile,
    getTilePixels,
    tileSize,
    roomSize = 8,
}: TileEdgeMergerOptions): boolean {
    if (
        tileSize <= 0 || tileSize % TILE_ART_SIZE !== 0 ||
        typeof ctx.getImageData !== 'function' || typeof ctx.putImageData !== 'function'
    ) {
        return false;
    }

    const pixelStep = tileSize / TILE_ART_SIZE;
    const transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    const originX = Math.round(transform?.e ?? 0);
    const originY = Math.round(transform?.f ?? 0);
    const width = tileSize * roomSize;
    const height = tileSize * roomSize;
    let imageData: ImageData;
    try {
        imageData = ctx.getImageData(originX, originY, width, height);
    } catch {
        return false;
    }

    const source = new Uint8ClampedArray(imageData.data);
    const output = new Uint8ClampedArray(source);
    const cells = Array.from({ length: roomSize }, (_, y) =>
        Array.from({ length: roomSize }, (_, x) => getCellInfo(tileMap, getTile, getTilePixels, x, y))
    );

    for (let y = 0; y < roomSize; y++) {
        for (let x = 0; x < roomSize - 1; x++) {
            if (!shouldMerge(cells[y][x], cells[y][x + 1])) continue;
            const seamX = (x + 1) * tileSize;
            for (let along = 0; along < TILE_ART_SIZE; along++) {
                for (let depth = 0; depth < MERGE_DEPTH; depth++) {
                    if ((along + depth) % 2 !== 0) continue;
                    const pixelY = y * tileSize + along * pixelStep;
                    const leftX = seamX - (depth + 1) * pixelStep;
                    const rightX = seamX + depth * pixelStep;
                    if (cells[y][x + 1].mergeablePixels[along][depth]) {
                        copyPixelBlock(source, output, width, pixelStep, rightX, pixelY, leftX, pixelY);
                    }
                    if (cells[y][x].mergeablePixels[along][TILE_ART_SIZE - depth - 1]) {
                        copyPixelBlock(source, output, width, pixelStep, leftX, pixelY, rightX, pixelY);
                    }
                }
            }
        }
    }

    for (let y = 0; y < roomSize - 1; y++) {
        for (let x = 0; x < roomSize; x++) {
            if (!shouldMerge(cells[y][x], cells[y + 1][x])) continue;
            const seamY = (y + 1) * tileSize;
            for (let along = 0; along < TILE_ART_SIZE; along++) {
                for (let depth = 0; depth < MERGE_DEPTH; depth++) {
                    if ((along + depth) % 2 !== 0) continue;
                    const pixelX = x * tileSize + along * pixelStep;
                    const topY = seamY - (depth + 1) * pixelStep;
                    const bottomY = seamY + depth * pixelStep;
                    if (cells[y + 1][x].mergeablePixels[depth][along]) {
                        copyPixelBlock(source, output, width, pixelStep, pixelX, bottomY, pixelX, topY);
                    }
                    if (cells[y][x].mergeablePixels[TILE_ART_SIZE - depth - 1][along]) {
                        copyPixelBlock(source, output, width, pixelStep, pixelX, topY, pixelX, bottomY);
                    }
                }
            }
        }
    }

    imageData.data.set(output);
    ctx.putImageData(imageData, originX, originY);
    return true;
}

export { applyTileEdgeMerging };
export type { TileEdgeMergerOptions };
