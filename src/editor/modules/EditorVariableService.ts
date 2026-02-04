import type { EditorManager } from '../EditorManager';
import type { VariableDefinition } from '../../types/gameState';

type VariableEntry = VariableDefinition & { name?: string; color?: string };

class EditorVariableService {
    manager: EditorManager;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
    }

    get dom() {
        return this.manager.domCache;
    }

    get gameEngine() {
        return this.manager.gameEngine;
    }

    toggle(variableId: string, nextValue: boolean | null = null) {
        if (!variableId) return;
        const current = (this.gameEngine.getVariableDefinitions() as VariableEntry[]).find((entry: VariableEntry) => entry.id === variableId);
        const targetValue = nextValue !== null ? Boolean(nextValue) : !Boolean(current?.value);
        const changed = this.gameEngine.setVariableDefault(variableId, targetValue);
        if (!changed) return;
        this.manager.renderService.renderObjects();
        this.manager.npcService.updateNpcSelection(this.manager.state.selectedNpcType, this.manager.state.selectedNpcId);
        this.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }
}

export { EditorVariableService };
