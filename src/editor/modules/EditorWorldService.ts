
import type { EditorManager } from '../EditorManager';

class EditorWorldService {
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

    get gameEngine() {
        return this.manager.gameEngine;
    }

    setActiveRoom(index: number | string) {
        const target = Number(index);
        if (!Number.isFinite(target)) return;
        const totalRooms = this.gameEngine.getGame().rooms?.length || 1;
        const clamped = Math.max(0, Math.min(totalRooms - 1, Math.floor(target)));
        if (clamped === this.state.activeRoomIndex) return;

        if (this.state.placingNpc || this.state.selectedNpcId || this.state.selectedNpcType) {
            this.manager.npcService.clearSelection();
        }
        if (this.state.placingEnemy) {
            this.manager.enemyService.deactivatePlacement();
        }
        this.state.activeRoomIndex = clamped;
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderObjects();
        this.manager.renderObjectCatalog();
        this.manager.renderService.renderEditor();
        this.manager.renderService.renderEnemies();
    }

    moveActiveRoom(direction: string | null | undefined) {
        if (!direction) return;
        const normalized = String(direction).toLowerCase();
        const game = this.gameEngine.getGame() as { world?: { rows?: number; cols?: number }; rooms?: unknown[] };
        const rows = Math.max(1, Number(game.world?.rows) || 1);
        const cols = Math.max(1, Number(game.world?.cols) || 1);
        const totalRooms = Math.max(1, game.rooms?.length || rows * cols);
        if (!rows || !cols || !totalRooms) return;

        const currentIndex = Math.max(0, Math.min(totalRooms - 1, this.state.activeRoomIndex));
        const currentRow = Math.floor(currentIndex / cols);
        const currentCol = currentIndex % cols;
        let targetRow = currentRow;
        let targetCol = currentCol;

        if (normalized === 'up') targetRow -= 1;
        if (normalized === 'down') targetRow += 1;
        if (normalized === 'left') targetCol -= 1;
        if (normalized === 'right') targetCol += 1;

        if (targetRow < 0 || targetRow >= rows || targetCol < 0 || targetCol >= cols) {
            return;
        }

        const targetIndex = targetRow * cols + targetCol;
        if (targetIndex < 0 || targetIndex >= totalRooms) {
            return;
        }

        this.setActiveRoom(targetIndex);
    }
}

export { EditorWorldService };
