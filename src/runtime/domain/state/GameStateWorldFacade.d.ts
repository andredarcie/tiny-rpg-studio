import type { GameState } from '../GameState';
import type { StateWorldManager } from './StateWorldManager';
import type { RoomDefinition } from '../../../types/gameState';
import type { TileMap } from '../definitions/tileTypes';
declare class GameStateWorldFacade {
    gameState: GameState;
    worldManager: StateWorldManager;
    constructor(gameState: GameState, worldManager: StateWorldManager);
    createEmptyRoom(size: number, index?: number, cols?: number): RoomDefinition;
    createWorldRooms(rows: number, cols: number, size: number): RoomDefinition[];
    createEmptyTileMap(size: number): TileMap;
    normalizeRooms(rooms: unknown, totalRooms: number, cols: number): RoomDefinition[];
    normalizeTileMaps(source: unknown, totalRooms: number): TileMap[];
}
export { GameStateWorldFacade };
