import type { DialogMeta, DialogState, RuntimeState } from '../../../types/gameState';
declare class StateDialogManager {
    state: RuntimeState | null;
    constructor(state: RuntimeState | null);
    setState(state: RuntimeState | null): void;
    get dialog(): DialogState | null;
    getDialog(): DialogState;
    setDialog(active: boolean, text?: string, meta?: DialogMeta | null): void;
    setPage(page: number): void;
    reset(): void;
}
export { StateDialogManager };
