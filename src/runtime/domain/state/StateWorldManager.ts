
import type { GameDefinition, RoomDefinition } from '../../../types/gameState';
import type { TileMap } from '../definitions/tileTypes';

class StateWorldManager {
    game: GameDefinition;
    defaultRoomSize: number;

    constructor(game: GameDefinition, defaultRoomSize = 8) {
        this.game = game;
        this.defaultRoomSize = defaultRoomSize;
    }

    setGame(game: GameDefinition) {
        this.game = game;
    }

    get roomSize() {
        return this.game.roomSize;
    }

    static createEmptyRoom(size: number, index = 0, cols = 1): RoomDefinition {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
            size,
            bg: 0,
            tiles: Array.from({ length: size }, () => Array(size).fill(0) as number[]),
            walls: Array.from({ length: size }, () => Array(size).fill(false) as boolean[]),
            worldX: col,
            worldY: row
        };
    }

    createEmptyRoom(size = this.roomSize, index = 0, cols = 1): RoomDefinition {
        return StateWorldManager.createEmptyRoom(size, index, cols);
    }

    static createWorldRooms(rows: number, cols: number, size: number): RoomDefinition[] {
        return Array.from({ length: rows * cols }, (_, index) =>
            StateWorldManager.createEmptyRoom(size, index, cols)
        );
    }

    createWorldRooms(rows: number, cols: number, size = this.roomSize): RoomDefinition[] {
        return StateWorldManager.createWorldRooms(rows, cols, size);
    }

    static createEmptyTileMap(size: number): TileMap {
        return {
            ground: Array.from({ length: size }, () => Array(size).fill(null) as (string | number | null)[]),
            overlay: Array.from({ length: size }, () => Array(size).fill(null) as (string | number | null)[])
        };
    }

    createEmptyTileMap(size = this.roomSize): TileMap {
        return StateWorldManager.createEmptyTileMap(size);
    }

    normalizeRooms(rooms: Partial<RoomDefinition>[] | null | undefined, totalRooms: number, cols: number): RoomDefinition[] {
        const size = this.roomSize;
        const filled: RoomDefinition[] = Array.from({ length: totalRooms }, (_, index) =>
            StateWorldManager.createEmptyRoom(size, index, cols)
        );
        if (!Array.isArray(rooms)) return filled;

        rooms.forEach((room, index) => {
            if (index >= filled.length) return;
            const target = filled[index];
            target.bg = typeof room.bg === "number" ? room.bg : target.bg;
            target.tiles = Array.isArray(room.tiles)
                ? room.tiles.map((row, y) =>
                    Array.from({ length: size }, (_, x) => {
                        const value = row[x];
                        return Number.isFinite(value) ? value : target.tiles[y][x];
                    }))
                : target.tiles;
            target.walls = Array.isArray(room.walls)
                ? room.walls.map((row, _y) =>
                    Array.from({ length: size }, (_, x) => Boolean(row[x])))
                : target.walls;
        });

        return filled;
    }

    normalizeTileMaps(source: unknown, totalRooms: number): TileMap[] {
        const size = this.roomSize;
        const emptyMaps = Array.from({ length: totalRooms }, () => StateWorldManager.createEmptyTileMap(size));
        if (!source) return emptyMaps;

        const assignMap = (target: TileMap, map: Partial<TileMap>) => {
            target.ground = Array.from({ length: size }, (_, y) =>
                Array.from({ length: size }, (_, x) => map.ground?.[y]?.[x] ?? null)
            );
            target.overlay = Array.from({ length: size }, (_, y) =>
                Array.from({ length: size }, (_, x) => map.overlay?.[y]?.[x] ?? null)
            );
        };

        if (Array.isArray(source)) {
            source.forEach((map: Partial<TileMap>, index: number) => {
                if (index >= emptyMaps.length) return;
                if (map.ground || map.overlay) {
                    assignMap(emptyMaps[index], map);
                }
            });
            return emptyMaps;
        }

        const singleMap = source as Partial<TileMap>;
        if (singleMap.ground || singleMap.overlay) {
            assignMap(emptyMaps[0], singleMap);
        }
        return emptyMaps;
    }

    clampRoomIndex(value: number | string | null | undefined): number {
        const rooms = this.game.rooms;
        const max = Math.max(0, rooms.length - 1);
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(max, Math.floor(numeric)));
    }

    clampCoordinate(value: number | string | null | undefined): number {
        const size = this.roomSize;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(size - 1, Math.floor(numeric)));
    }

    getWorldRows(): number {
        return this.game.world.rows || 1;
    }

    getWorldCols(): number {
        return this.game.world.cols || 1;
    }

    getRoomCoords(index: number): { row: number; col: number } {
        const cols = this.getWorldCols();
        const row = Math.floor(index / cols);
        const col = index % cols;
        return { row, col };
    }

    getRoomIndex(row: number, col: number): number | null {
        const rows = this.getWorldRows();
        const cols = this.getWorldCols();
        if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
        return row * cols + col;
    }
}

export { StateWorldManager };
