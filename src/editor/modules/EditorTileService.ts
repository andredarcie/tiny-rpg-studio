
import type { EditorManager } from '../EditorManager';

class EditorTileService {
    manager: EditorManager;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
    }

    get dom() {
        return this.manager.domCache;
    }

    get state() {
        return this.manager.state;
    }

    startPaint(ev: PointerEvent) {
        const canvas = this.dom.editorCanvas;
        if (!canvas) return;
        ev.preventDefault();
        this.state.mapPainting = true;
        canvas.setPointerCapture(ev.pointerId);
        this.applyPaint(ev);
    }

    continuePaint(ev: PointerEvent) {
        if (!this.state.mapPainting) return;
        this.applyPaint(ev);
    }

    finishPaint(ev: PointerEvent) {
        if (!this.state.mapPainting) return;
        this.state.mapPainting = false;
        const canvas = this.dom.editorCanvas;
        if (!canvas) {
            this.state.mapPainting = false;
            return;
        }
        if (canvas.hasPointerCapture(ev.pointerId)) {
            canvas.releasePointerCapture(ev.pointerId);
        }
        if (this.state.skipMapHistory) {
            this.state.skipMapHistory = false;
            return;
        }
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    applyPaint(ev: PointerEvent) {
        const coord = this.getTileFromEvent(ev);
        if (!coord) return;
        const roomIndex = this.state.activeRoomIndex;

        if (this.state.placingNpc) {
            this.manager.npcService.placeNpcAt(coord);
            this.state.skipMapHistory = true;
            return;
        }
        if (this.state.placingEnemy) {
            this.manager.enemyService.placeEnemyAt(coord);
            this.state.skipMapHistory = true;
            return;
        }
        if (this.state.placingObjectType) {
            this.manager.objectService.placeObjectAt(this.state.placingObjectType, coord, roomIndex);
            this.state.skipMapHistory = true;
            return;
        }

        if (this.state.selectedTileId === null) return;
        this.manager.gameEngine.setMapTile(coord.x, coord.y, this.state.selectedTileId, roomIndex);
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
    }

    clearSelection({ render = true }: { render?: boolean } = {}) {
        const hadSelection = this.state.selectedTileId !== null;
        if (!hadSelection) return false;
        this.state.selectedTileId = null;
        if (render) {
            this.manager.renderService.renderTileList();
            this.manager.renderService.updateSelectedTilePreview();
        }
        return true;
    }

    getTileFromEvent(ev: PointerEvent) {
        const canvas = this.dom.editorCanvas;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const relX = (ev.clientX - rect.left) / rect.width;
        const relY = (ev.clientY - rect.top) / rect.height;
        if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
        return {
            x: Math.min(7, Math.floor(relX * 8)),
            y: Math.min(7, Math.floor(relY * 8))
        };
    }
}

export { EditorTileService };
