import type { GameDefinition, RoomDefinition, VariableDefinition } from '../../../types/gameState';
import type { StateWorldManager } from './StateWorldManager';
import type { StateObjectManager, ObjectEntry } from './StateObjectManager';
import type { StateVariableManager } from './StateVariableManager';
type StateDataManagerOptions = {
    game: GameDefinition;
    worldManager: StateWorldManager;
    objectManager: StateObjectManager;
    variableManager: StateVariableManager;
};
type ImportData = {
    title?: string;
    author?: string;
    palette?: string[];
    customPalette?: string[];
    hideHud?: boolean;
    roomSize?: number;
    world?: {
        rows?: number;
        cols?: number;
    };
    rooms?: RoomDefinition[];
    start?: {
        x?: number;
        y?: number;
        roomIndex?: number;
    };
    sprites?: unknown[];
    enemies?: unknown[];
    items?: unknown[];
    objects?: ObjectEntry[];
    variables?: VariableDefinition[];
    exits?: unknown[];
    tileset?: {
        tiles?: unknown[];
        maps?: unknown;
        map?: unknown;
    };
    customSprites?: unknown[];
};
declare class StateDataManager {
    game: GameDefinition;
    worldManager: StateWorldManager;
    objectManager: StateObjectManager;
    variableManager: StateVariableManager;
    constructor({ game, worldManager, objectManager, variableManager }: StateDataManagerOptions);
    setGame(game: GameDefinition): void;
    setWorldManager(worldManager: StateWorldManager): void;
    setObjectManager(objectManager: StateObjectManager): void;
    setVariableManager(variableManager: StateVariableManager): void;
    exportGameData(): ImportData;
    importGameData(data: ImportData | null): {
        x: number;
        y: number;
        roomIndex: number;
    } | null;
}
export { StateDataManager };
