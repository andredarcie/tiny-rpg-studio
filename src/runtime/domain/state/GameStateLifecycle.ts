import type { GameState } from '../GameState';
import type { GameStateScreenManager } from './GameStateScreenManager';

type LifecycleOptions = {
    timeToResetAfterGameOver?: number;
};

class GameStateLifecycle {
    gameState: GameState;
    screenManager: GameStateScreenManager;
    pauseReasons: Set<string>;
    timeToResetAfterGameOver: number;

    constructor(gameState: GameState, screenManager: GameStateScreenManager, options: LifecycleOptions = {}) {
        this.gameState = gameState;
        this.screenManager = screenManager;
        this.pauseReasons = new Set();
        const provided = options.timeToResetAfterGameOver;
        if (typeof provided === 'number' && Number.isFinite(provided)) {
            this.timeToResetAfterGameOver = Math.max(0, provided);
        } else {
            this.timeToResetAfterGameOver = 2000;
        }
    }

    pauseGame(reason = 'manual'): void {
        const label = reason || 'manual';
        this.pauseReasons.add(label);
        this.updatePlayingLock();
    }

    resumeGame(reason: string | null | undefined = 'manual'): void {
        if (reason == null) {
            this.pauseReasons.clear();
        } else {
            this.pauseReasons.delete(reason);
        }
        this.updatePlayingLock();
    }

    updatePlayingLock(): void {
        this.gameState.playing = this.pauseReasons.size === 0;
    }

    setGameOver(active = true, reason = 'defeat'): void {
        const state = this.gameState.state;
        const activeValue = Boolean(active);
        if (activeValue) {
            this.screenManager.startGameOverCooldown(this.timeToResetAfterGameOver);
        }
        state.gameOver = activeValue;
        state.gameOverReason = activeValue ? (reason || 'defeat') : null;
    }

    isGameOver(): boolean {
        return Boolean(this.gameState.state.gameOver);
    }

    getGameOverReason(): string {
        return this.gameState.state.gameOverReason || 'defeat';
    }
}

export { GameStateLifecycle };
