
import { EditorManagerModule } from './EditorManagerModule';

class EditorInteractionController extends EditorManagerModule {
    handleCanvasResize(force: boolean = false) {
        const canvas = this.manager.editorCanvas;
        if (!canvas) return;
        const container = canvas.parentElement;
        if (!container) return;

        const availableWidth = container.offsetWidth || container.clientWidth || 0;

        const maxCanvasSize = 512;
        const minCanvasSize = 128;
        const highestDivisor = Math.floor((availableWidth + minCanvasSize - 1) / minCanvasSize) * minCanvasSize;

        const size = Math.min(Math.max(highestDivisor, minCanvasSize), maxCanvasSize);
        if (!force && Math.abs(canvas.width - size) < 1) {
            return;
        }

        canvas.style.width = `${size}px`;
        canvas.width = size;
        canvas.height = size;
        this.renderService.renderEditor();
    }

    handleKey(ev: KeyboardEvent) {
        if (ev.defaultPrevented) return;
        if (ev.key === 'Escape') {
            if (this.state.placingNpc || this.manager.selectedNpcId || this.manager.selectedNpcType) {
                this.manager.npcService.clearSelection();
                ev.preventDefault();
                return;
            }
            if (this.state.placingEnemy) {
                this.manager.enemyService.deactivatePlacement();
                ev.preventDefault();
                return;
            }
            if (this.state.placingObjectType) {
                this.manager.objectService.togglePlacement(this.state.placingObjectType, true);
                ev.preventDefault();
                return;
            }
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
            ev.preventDefault();
            if (ev.shiftKey) {
                this.manager.redo();
            } else {
                this.manager.undo();
            }
        }

        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
            ev.preventDefault();
            this.manager.redo();
        }
    }
}

export { EditorInteractionController };
