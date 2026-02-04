import type { TileDefinition } from '../../domain/definitions/tileTypes';

type TilePixels = (string | null)[][];

type TileManagerApi = {
    getTile: (tileId: string | number) => TileDefinition | null;
    getTilePixels?: (tile: TileDefinition, frameOverride?: number | null) => TilePixels | null;
};

class RendererCanvasHelper {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tileManager: TileManagerApi | null;

    constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, tileManager: TileManagerApi | null) {
        this.canvas = canvas;
        this.ctx = context;
        this.tileManager = tileManager;
    }

    getTilePixelSize() {
        return Math.floor(this.canvas.width / 8);
    }

    drawSprite(ctx: CanvasRenderingContext2D, sprite: (string | null)[][], px: number, py: number, step: number) {
        for (let y = 0; y < sprite.length; y++) {
            const row = sprite[y];
            for (let x = 0; x < row.length; x++) {
                const col = row[x];
                if (!col) continue;
                ctx.fillStyle = col;
                ctx.fillRect(px + x * step, py + y * step, step, step);
            }
        }
    }

    resolveTilePixels(tile: TileDefinition | null, frameOverride: number | null = null) {
        if (this.tileManager?.getTilePixels && tile) {
            return this.tileManager.getTilePixels(tile, frameOverride);
        }
        if (Array.isArray(tile?.frames) && tile.frames.length) {
            return tile.frames[0];
        }
        return Array.isArray(tile?.pixels) ? tile.pixels : null;
    }

    drawCustomTile(tileId: string | number, px: number, py: number, size: number, frameOverride: number | null = null) {
        if (!this.tileManager) return;
        const tile = this.tileManager.getTile(tileId);
        if (!tile) return;
        const pixels = this.resolveTilePixels(tile, frameOverride);
        if (!pixels) return;

        const step = Math.max(1, Math.floor(size / 8));
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const col = pixels[y]?.[x];
                if (!col || col === 'transparent') continue;
                this.ctx.fillStyle = col;
                this.ctx.fillRect(px + x * step, py + y * step, step, step);
            }
        }
    }

    drawTileOnCanvas(canvas: HTMLCanvasElement, tile: TileDefinition | null, frameOverride: number | null = null) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pixels = this.resolveTilePixels(tile, frameOverride);
        if (!pixels) return;

        const step = Math.max(1, Math.floor(canvas.width / 8));
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const col = pixels[y]?.[x];
                if (!col || col === 'transparent') continue;
                ctx.fillStyle = col;
                ctx.fillRect(x * step, y * step, step, step);
            }
        }
    }

    drawTilePreview(
        tileId: string | number,
        px: number,
        py: number,
        size: number,
        ctx: CanvasRenderingContext2D = this.ctx,
        frameOverride: number | null = null
    ) {
        if (!this.tileManager) return;
        const tile = this.tileManager.getTile(tileId);
        if (!tile) return;
        const pixels = this.resolveTilePixels(tile, frameOverride);
        if (!pixels) return;

        const step = Math.max(1, Math.floor(size / 8));
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const col = pixels[y]?.[x];
                if (!col || col === 'transparent') continue;
                ctx.fillStyle = col;
                ctx.fillRect(px + x * step, py + y * step, step, step);
            }
        }
    }
}

export { RendererCanvasHelper };
