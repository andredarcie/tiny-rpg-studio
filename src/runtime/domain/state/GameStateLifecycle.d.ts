import type { GameState } from '../GameState';
import type { GameStateScreenManager } from './GameStateScreenManager';
type LifecycleOptions = {
    timeToResetAfterGameOver?: number;
};
declare class GameStateLifecycle {
    gameState: GameState;
    screenManager: GameStateScreenManager;
    pauseReasons: Set<string>;
    timeToResetAfterGameOver: number;
    constructor(gameState: GameState, screenManager: GameStateScreenManager, options?: LifecycleOptions);
    pauseGame(reason?: string): void;
    resumeGame(reason?: string | null | undefined): void;
    updatePlayingLock(): void;
    setGameOver(active?: boolean, reason?: string): void;
    isGameOver(): boolean;
    getGameOverReason(): string;
}
export { GameStateLifecycle };
