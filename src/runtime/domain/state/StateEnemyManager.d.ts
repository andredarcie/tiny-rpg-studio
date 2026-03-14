import type { GameDefinition, RuntimeState, EnemyDefinition } from '../../../types/gameState';
import type { StateWorldManager } from './StateWorldManager';
declare class StateEnemyManager {
    game: GameDefinition | null;
    state: RuntimeState | null;
    worldManager: StateWorldManager;
    constructor(game: GameDefinition, state: RuntimeState, worldManager: StateWorldManager);
    setGame(game: GameDefinition): void;
    setState(state: RuntimeState): void;
    setWorldManager(worldManager: StateWorldManager): void;
    cloneEnemies(enemies: EnemyDefinition[] | null | undefined): EnemyDefinition[];
    resetRuntime(): EnemyDefinition[];
    getEnemies(): EnemyDefinition[];
    getEnemyDefinitions(): EnemyDefinition[];
    addEnemy(enemy: EnemyDefinition): string | null;
    removeEnemy(enemyId: string): void;
    removeEnemyFromRuntime(enemyId: string): void;
    setEnemyPosition(enemyId: string | number, x: number, y: number, roomIndex?: number | null): void;
    setEnemyVariable(enemyId: string | number, variableId?: string | null): boolean;
    normalizeEnemyType(type: string | null | undefined): string;
    isBossType(type: string): boolean;
    normalizeEnemyVariableId(variableId: string | null | undefined): string | null;
}
export { StateEnemyManager };
