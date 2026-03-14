import type { GameState } from "../GameState";
import type { StateDataManager } from "./StateDataManager";
declare class GameStateDataFacade {
    gameState: GameState;
    dataManager: StateDataManager;
    constructor(gameState: GameState, dataManager: StateDataManager);
    exportGameData(): unknown;
    importGameData(data: unknown): void;
}
export { GameStateDataFacade };
