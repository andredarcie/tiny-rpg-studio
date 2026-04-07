import type { GameState } from "../GameState";
import type { StateDataManager } from "./StateDataManager";

class GameStateDataFacade {
    gameState: GameState;
    dataManager: StateDataManager;

    constructor(gameState: GameState, dataManager: StateDataManager) {
        this.gameState = gameState;
        this.dataManager = dataManager;
    }

    exportGameData(): unknown {
        return this.dataManager.exportGameData();
    }

    importGameData(data: unknown): void {
        this.dataManager.importGameData(data as Parameters<StateDataManager['importGameData']>[0]);
        this.gameState.enemyManager.setGame(this.gameState.game);
        this.gameState.itemManager.setGame(this.gameState.game);
        this.gameState.objectManager.setGame(this.gameState.game);
        this.gameState.variableManager.setGame(this.gameState.game);
        this.gameState.ensureDefaultVariables();
        this.gameState.skillManager.setSkillOrder(this.gameState.game.skillOrder);
        this.gameState.resetGame();
    }
}

export { GameStateDataFacade };
