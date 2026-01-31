
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';
import { EditorConstants } from './EditorConstants';
import type { EditorManager } from '../EditorManager';

type ObjectDefinition = {
    type: string;
};

class EditorObjectService {
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

    togglePlacement(type: string | null, forceOff: boolean = false) {
        const normalizedType = this.normalizeType(type ?? this.state.placingObjectType ?? this.manager.selectedObjectType);
        if (forceOff) {
            if (!this.state.placingObjectType) return;
            this.state.placingObjectType = null;
            if (!this.state.placingNpc && !this.state.placingEnemy && this.dom.editorCanvas) {
                this.dom.editorCanvas.style.cursor = 'default';
            }
            this.manager.renderObjectCatalog();
            return;
        }

        if (!normalizedType) return;
        if (this.state.placingObjectType === normalizedType) {
            this.state.placingObjectType = null;
            if (!this.state.placingNpc && !this.state.placingEnemy && this.dom.editorCanvas) {
                this.dom.editorCanvas.style.cursor = 'default';
            }
            this.manager.renderObjectCatalog();
            return;
        }
        this.selectObjectType(normalizedType);
    }

    updatePlacementButtons() {
        this.manager.renderObjectCatalog();
    }

    placeObjectAt(type: string, coord: { x: number; y: number }, roomIndex: number) {
        const object = this.gameEngine.setObjectPosition(type, roomIndex, coord.x, coord.y);
        if (!object) return;
        this.manager.renderService.renderObjects();
        this.manager.renderObjectCatalog();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    removeObject(type: string, roomIndex: number) {
        if (this.state.placingObjectType === type) {
            this.togglePlacement(type, true);
        }
        this.gameEngine.removeObject(type, roomIndex);
        this.manager.renderService.renderObjects();
        this.manager.renderObjectCatalog();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    selectObjectType(type: string | null) {
        const normalized = this.normalizeType(type);
        if (!normalized) return;
        if (this.manager.selectedObjectType !== normalized) {
            this.manager.selectedObjectType = normalized;
        }
        this.activatePlacement(normalized);
    }

    activatePlacement(type: string | null = null) {
        const targetType = this.normalizeType(type ?? this.manager.selectedObjectType);
        if (!targetType) return;
        this.manager.npcService.clearSelection();
        if (this.state.placingEnemy) {
            this.manager.enemyService.deactivatePlacement();
        }
        this.state.placingNpc = false;
        this.state.placingObjectType = targetType;
        this.manager.selectedObjectType = targetType;
        if (this.dom.editorCanvas) {
            this.dom.editorCanvas.style.cursor = 'crosshair';
        }
        this.manager.renderObjectCatalog();
    }

    clearSelection({ render = true }: { render?: boolean } = {}) {
        const hadSelection = Boolean(this.manager.selectedObjectType || this.state.placingObjectType);
        if (!hadSelection) return false;
        this.state.placingObjectType = null;
        this.manager.selectedObjectType = null;
        if (!this.state.placingNpc && !this.state.placingEnemy && this.dom.editorCanvas) {
            this.dom.editorCanvas.style.cursor = 'default';
        }
        if (render) {
            this.manager.renderObjectCatalog();
        }
        return true;
    }

    updatePlayerEndText(roomIndex: number, text: string) {
        this.gameEngine.setPlayerEndText(roomIndex, text);
        this.manager.updateJSON();
        this.schedulePlayerEndTextHistory();
    }

    schedulePlayerEndTextHistory() {
        if (this.state.playerEndTextUpdateTimer) {
            clearTimeout(this.state.playerEndTextUpdateTimer);
        }
        this.state.playerEndTextUpdateTimer = setTimeout(() => {
            this.manager.history.pushCurrentState();
        }, 400);
    }

    normalizeType(type: string | null | undefined): string | null {
        if (typeof type !== 'string' || !type.length) return null;
        const definitions = EditorConstants.OBJECT_DEFINITIONS;
        if (Array.isArray(definitions) && definitions.length) {
            const normalized = definitions.find((entry: ObjectDefinition) => entry.type === type)?.type || null;
            if (normalized) return normalized;
        }
        const fallbackTypes = new Set(itemCatalog.getPlaceableTypes());
        return fallbackTypes.has(type as never) ? (type as never as Parameters<typeof this.manager.gameEngine.gameState.objectManager.generateObjectId>[0]) : null;
    }
}

export { EditorObjectService };
