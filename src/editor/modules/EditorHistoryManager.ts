import type { EditorManager } from '../EditorManager';

class EditorHistoryManager {
    editorManager: EditorManager;
    stack: string[];
    index: number;

    constructor(editorManager: EditorManager) {
        this.editorManager = editorManager;
        this.stack = [];
        this.index = -1;
    }

    pushSnapshot(snapshot: string): void {
        if (this.stack[this.index] === snapshot) return;
        this.stack = this.stack.slice(0, this.index + 1);
        this.stack.push(snapshot);
        this.index = this.stack.length - 1;
    }

    pushCurrentState() {
        const snapshot = JSON.stringify(this.editorManager.gameEngine.exportGameData());
        this.pushSnapshot(snapshot);
    }

    canUndo() {
        return this.index > 0;
    }

    canRedo() {
        return this.index < this.stack.length - 1;
    }

    undo() {
        if (!this.canUndo()) return;
        this.index -= 1;
        this.restoreCurrent();
    }

    redo() {
        if (!this.canRedo()) return;
        this.index += 1;
        this.restoreCurrent();
    }

    restoreCurrent() {
        const snapshot = this.stack[this.index];
        if (!snapshot) return;
        try {
            const data: Record<string, unknown> = JSON.parse(snapshot) as Record<string, unknown>;
            this.editorManager.restore(data, { skipHistory: true });
        } catch (error) {
            console.error('Failed to restore snapshot at index', this.index, error);
            this.stack.splice(this.index, 1);
            this.index = Math.min(this.index, this.stack.length - 1);
        }
    }
}

export { EditorHistoryManager };
