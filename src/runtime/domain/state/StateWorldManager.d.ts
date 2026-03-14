import type { GameDefinition, RoomDefinition } from '../../../types/gameState';
import type { TileMap } from '../definitions/tileTypes';
declare class StateWorldManager {
    game: GameDefinition;
    defaultRoomSize: number;
    constructor(game: GameDefinition, defaultRoomSize?: number);
    setGame(game: GameDefinition): void;
    get roomSize(): number;
    static createEmptyRoom(size: number, index?: number, cols?: number): RoomDefinition;
    createEmptyRoom(size?: number, index?: number, cols?: number): RoomDefinition;
    static createWorldRooms(rows: number, cols: number, size: number): RoomDefinition[];
    createWorldRooms(rows: number, cols: number, size?: number): RoomDefinition[];
    static createEmptyTileMap(size: number): TileMap;
    createEmptyTileMap(size?: number): TileMap;
    normalizeRooms(rooms: Partial<RoomDefinition>[] | null | undefined, totalRooms: number, cols: number): RoomDefinition[];
    normalizeTileMaps(source: unknown, totalRooms: number): TileMap[];
    clampRoomIndex(value: number | string | null | undefined): number;
    clampCoordinate(value: number | string | null | undefined): number;
    getWorldRows(): number;
    getWorldCols(): number;
    getRoomCoords(index: number): {
        row: number;
        col: number;
    };
    getRoomIndex(row: number, col: number): number | null;
}
export { StateWorldManager };
