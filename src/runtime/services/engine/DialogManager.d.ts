type DialogMeta = {
    pauseReason?: string;
    setVariableId?: string;
    rewardAllowed?: boolean;
};
type GameStateApi = {
    pauseGame: (reason: string) => void;
    resumeGame: (reason: string) => void;
    setDialog: (active: boolean, text?: string, meta?: DialogMeta | null) => void;
    getDialog: () => {
        active: boolean;
    };
    setVariableValue?: (id: string, value: boolean) => [boolean, boolean];
};
type RendererApi = {
    draw: () => void;
    setIconOverPlayer: (icon: string) => void;
};
declare class DialogManager {
    gameState: GameStateApi;
    renderer: RendererApi;
    pendingDialogAction: DialogMeta | null;
    constructor(gameState: GameStateApi, renderer: RendererApi);
    showDialog(text: string, options?: DialogMeta): void;
    completeDialog(): void;
    closeDialog(): void;
    reset(): void;
}
export type { DialogMeta };
export { DialogManager };
