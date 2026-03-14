declare class GameStateScreenManager {
    gameState: unknown;
    canResetAfterGameOver: boolean;
    lastEndingText: string;
    gameOverResetTimer: ReturnType<typeof setTimeout> | null;
    constructor(gameState: unknown);
    reset(): void;
    setActiveEndingText(text?: string): string;
    getActiveEndingText(): string;
    startGameOverCooldown(duration: number): void;
    clearGameOverCooldown(): void;
}
export { GameStateScreenManager };
