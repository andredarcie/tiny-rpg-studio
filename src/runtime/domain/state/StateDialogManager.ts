
import type { DialogChoicePhase, DialogChoiceState, DialogMeta, DialogState, RuntimeState } from '../../../types/gameState';

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

    get npcChoiceAnswered() {
        return this.state?.npcChoiceAnswered ?? null;
    }

    getDialog(): DialogState {
        return this.dialog ?? { active: false, text: '', page: 1, maxPages: 1, meta: null, choice: null };
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
            // A closed dialog never keeps a pending choice sub-state.
            dialog.choice = null;
            return;
        }
        dialog.active = true;
        dialog.text = text;
        dialog.page = 1;
        dialog.maxPages = 1;
        dialog.meta = meta || null;
        // NOTE: `choice` is intentionally left untouched here so the choice flow can
        // call setDialog(true, branchText) to switch to a branch message without
        // dropping the choice sub-state. Callers reset it explicitly when needed.
    }

    setDialogChoice(choice: DialogChoiceState | null) {
        const dialog = this.dialog;
        if (!dialog) return;
        dialog.choice = choice;
    }

    setChoicePhase(phase: DialogChoicePhase) {
        const choice = this.dialog?.choice;
        if (!choice) return;
        choice.phase = phase;
    }

    setChoiceSelection(index: number) {
        const choice = this.dialog?.choice;
        if (!choice) return;
        const max = Math.max(0, choice.options.length - 1);
        const numeric = Number(index);
        if (!Number.isFinite(numeric)) return;
        choice.selectedIndex = Math.min(Math.max(0, Math.floor(numeric)), max);
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

    markNpcChoiceAnswered(npcId: string | null | undefined) {
        const state = this.npcChoiceAnswered;
        if (!state || !npcId) return;
        state[npcId] = true;
    }

    hasNpcChoiceAnswered(npcId: string | null | undefined): boolean {
        const state = this.npcChoiceAnswered;
        if (!state || !npcId) return false;
        return state[npcId] === true;
    }

    resetNpcChoiceAnswered() {
        const state = this.npcChoiceAnswered;
        if (!state) return;
        Object.keys(state).forEach((npcId) => {
            delete state[npcId];
        });
    }

    reset() {
        this.setDialog(false);
        this.resetNpcDialogReadState();
        // A definitive choice only clears on a full restart, which routes through reset().
        this.resetNpcChoiceAnswered();
    }
}

export { StateDialogManager };
