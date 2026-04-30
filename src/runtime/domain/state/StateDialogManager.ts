
import type { DialogMeta, DialogState, RuntimeState } from '../../../types/gameState';

class StateDialogManager {
    state: RuntimeState | null;

    constructor(state: RuntimeState | null) {
        this.state = state;
    }

    setState(state: RuntimeState | null) {
        this.state = state;
    }

    get dialog() {
        return this.state?.dialog ?? null;
    }

    get npcDialogReadState() {
        return this.state?.npcDialogReadState ?? null;
    }

    getDialog(): DialogState {
        return this.dialog ?? { active: false, text: '', page: 1, maxPages: 1, meta: null };
    }

    setDialog(active: boolean, text: string = "", meta: DialogMeta | null = null) {
        const dialog = this.dialog;
        if (!dialog) return;
        if (!active) {
            dialog.active = false;
            dialog.text = "";
            dialog.page = 1;
            dialog.maxPages = 1;
            dialog.meta = null;
            return;
        }
        dialog.active = true;
        dialog.text = text;
        dialog.page = 1;
        dialog.maxPages = 1;
        dialog.meta = meta || null;
    }

    setPage(page: number) {
        const dialog = this.dialog;
        if (!dialog) return;
        const numeric = Number(page);
        if (!Number.isFinite(numeric)) return;
        const maxPages = Math.max(1, dialog.maxPages || 1);
        const clamped = Math.min(Math.max(1, Math.floor(numeric)), maxPages);
        dialog.page = clamped;
    }

    markNpcDialogAsRead(npcId: string, variantKey: string | null) {
        const state = this.npcDialogReadState;
        if (!state || !variantKey) return;
        const npcState = state[npcId] ?? {};
        npcState[variantKey] = true;
        state[npcId] = npcState;
    }

    hasReadNpcDialogVariant(npcId: string, variantKey: string | null): boolean {
        const state = this.npcDialogReadState;
        if (!state || !variantKey) return false;
        return state[npcId]?.[variantKey] === true;
    }

    hasUnreadNpcDialog(npcId: string, variantKey: string | null): boolean {
        if (!variantKey) return false;
        return !this.hasReadNpcDialogVariant(npcId, variantKey);
    }

    resetNpcDialogReadState() {
        const state = this.npcDialogReadState;
        if (!state) return;
        Object.keys(state).forEach((npcId) => {
            delete state[npcId];
        });
    }

    reset() {
        this.setDialog(false);
        this.resetNpcDialogReadState();
    }
}

export { StateDialogManager };
