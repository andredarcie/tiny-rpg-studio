import type { TileId } from '../../domain/definitions/tileTypes';

type RoomState = {
    bg: number;
    tiles: number[][];
    walls: boolean[][];
};

type RendererGameState = {
    getCurrentRoom: () => RoomState;
    getPlayer: () => { roomIndex?: number | null };
};

type TileMapState = {
    ground: (TileId | null)[][];
    overlay: (TileId | null)[][];
};

type TileManagerApi = {
    getTileMap: (roomIndex: number) => TileMapState | null;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

type CanvasHelperApi = {
    getTilePixelSize: () => number;
    drawCustomTile: (tileId: TileId, px: number, py: number, size: number) => void;
};

class RendererTileRenderer {
    gameState: RendererGameState;
    tileManager: TileManagerApi;
    paletteManager: PaletteManagerApi;
    canvasHelper: CanvasHelperApi;

    constructor(gameState: RendererGameState, tileManager: TileManagerApi, paletteManager: PaletteManagerApi, canvasHelper: CanvasHelperApi) {
        this.gameState = gameState;
        this.tileManager = tileManager;
        this.paletteManager = paletteManager;
        this.canvasHelper = canvasHelper;
    }

    clearCanvas(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }) {
        const room = this.gameState.getCurrentRoom();
        const bgColor = this.paletteManager.getColor(room.bg);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawBackground(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }) {
        const room = this.gameState.getCurrentRoom();
        const bgColor = this.paletteManager.getColor(room.bg);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawTiles(ctx: CanvasRenderingContext2D, _canvas: { width: number; height: number }) {
        const room = this.gameState.getCurrentRoom();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const player = this.gameState.getPlayer() ?? { roomIndex: 0 };
        const tileMap = this.tileManager.getTileMap(player.roomIndex ?? 0);
        const groundMap = tileMap?.ground || [];
        const overlayMap = tileMap?.overlay || [];

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const groundId = groundMap[y]?.[x];
                if (groundId !== null && groundId !== undefined) {
                    this.canvasHelper.drawCustomTile(groundId, x * tileSize, y * tileSize, tileSize);
                } else {
                    const colIdx = room.tiles[y][x];
                    ctx.fillStyle = this.paletteManager.getColor(colIdx);
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }

                const overlayId = overlayMap[y]?.[x];
                if (overlayId !== null && overlayId !== undefined) {
                    this.canvasHelper.drawCustomTile(overlayId, x * tileSize, y * tileSize, tileSize);
                }
            }
        }
    }

    drawWalls(ctx: CanvasRenderingContext2D) {
        const room = this.gameState.getCurrentRoom();
        const tileSize = this.canvasHelper.getTilePixelSize();

        ctx.fillStyle = this.paletteManager.getColor(1);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                if (room.walls[y][x]) {
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }
            }
        }
    }
}

export { RendererTileRenderer };
