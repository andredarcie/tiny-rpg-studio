
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { TextResources } from '../../runtime/adapters/TextResources';
import { EditorConstants } from './EditorConstants';
import type { EditorManager } from '../EditorManager';
import type { EnemyDefinition } from '../../types/gameState';
import type { EnemyDefinitionData } from '../../runtime/domain/entities/Enemy';

class EditorEnemyService {
    manager: EditorManager;
    editorIndicator: HTMLElement | null;
    editorIndicatorTimeout: ReturnType<typeof setTimeout> | null;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
        this.editorIndicator = null;
        this.editorIndicatorTimeout = null;
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

    activatePlacement() {
        const definition = this.getEnemyDefinition(this.manager.selectedEnemyType);
        if (!definition) return;
        if (this.state.placingEnemy) return;

        this.manager.npcService.clearSelection();
        if (this.state.placingObjectType) {
            this.manager.objectService.togglePlacement(this.state.placingObjectType, true);
        }

        this.state.placingEnemy = true;
        this.state.placingNpc = false;
        this.state.placingObjectType = null;

        if (this.dom.editorCanvas) {
            this.dom.editorCanvas.style.cursor = 'crosshair';
        }
    }

    deactivatePlacement() {
        if (!this.state.placingEnemy) return;
        this.state.placingEnemy = false;
        if (!this.state.placingNpc && !this.state.placingObjectType && this.dom.editorCanvas) {
            this.dom.editorCanvas.style.cursor = 'default';
        }
    }

    placeEnemyAt(coord: { x: number; y: number }) {
        const roomIndex = this.state.activeRoomIndex;
        const enemyDefs = (this.gameEngine.getEnemyDefinitions() ?? []) as EnemyDefinition[];
        const existing = enemyDefs.find((enemy: EnemyDefinition) =>
            enemy.roomIndex === roomIndex && enemy.x === coord.x && enemy.y === coord.y
        );
        if (existing) {
            return;
        }
        const enemies = (this.gameEngine.getActiveEnemies() ?? []) as EnemyDefinition[];
        const currentRoomCount = enemies.reduce((count: number, enemy: EnemyDefinition) => (
            enemy.roomIndex === roomIndex ? count + 1 : count
        ), 0);
        if (currentRoomCount >= 6) {
            this.showEnemyLimitFeedback();
            return;
        }
        const definition = this.getEnemyDefinition(this.state.selectedEnemyType);
        const fallback = EditorConstants.ENEMY_DEFINITIONS[0]?.type || 'giant-rat';
        const type = definition?.type || fallback;
        const id = this.gameEngine.addEnemy({
            x: coord.x,
            y: coord.y,
            roomIndex,
            type
        });
        if (!id) {
            return;
        }
        this.manager.renderService.renderEnemies();
        this.manager.renderService.renderEnemyCatalog();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    removeEnemy(enemyId: string) {
        this.gameEngine.removeEnemy(enemyId);
        this.manager.renderService.renderEnemies();
        this.manager.renderService.renderEnemyCatalog();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    handleEnemyVariableChange(enemyId: string, variableId: string | null) {
        const normalizedId = typeof variableId === 'string' && variableId.trim().length
            ? variableId
            : null;
        const changed = this.gameEngine.setEnemyVariable(enemyId, normalizedId);
        if (!changed) return;
        this.manager.renderService.renderEnemies();
        this.manager.renderService.renderWorldGrid();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    selectEnemyType(type: string) {
        const definition = this.getEnemyDefinition(type);
        if (!definition) return;
        if (this.state.selectedEnemyType !== definition.type) {
            this.manager.selectedEnemyType = definition.type;
            this.manager.renderEnemyCatalog();
        }
        this.activatePlacement();
    }

    clearSelection({ render = true }: { render?: boolean } = {}) {
        const hadSelection = Boolean(this.manager.selectedEnemyType || this.state.placingEnemy);
        if (!hadSelection) return false;
        this.manager.selectedEnemyType = null;
        this.deactivatePlacement();
        if (render) {
            this.manager.renderEnemyCatalog();
        }
        return true;
    }

    getEditorIndicator() {
        if (this.editorIndicator) return this.editorIndicator;
        const container = document.querySelector('.editor-map-wrapper');
        if (!container) return null;
        const indicator = document.createElement('div');
        indicator.className = 'combat-indicator';
        indicator.setAttribute('aria-live', 'polite');
        indicator.setAttribute('aria-atomic', 'true');
        container.appendChild(indicator);
        this.editorIndicator = indicator;
        return indicator;
    }

    showEnemyLimitFeedback() {
        const indicator = this.getEditorIndicator();
        if (this.editorIndicatorTimeout) {
            clearTimeout(this.editorIndicatorTimeout);
            this.editorIndicatorTimeout = null;
        }
        if (indicator) {
            indicator.textContent = this.getEnemyLimitMessage();
            indicator.classList.remove('visible');
            indicator.setAttribute('data-visible', 'false');
            void indicator.offsetWidth;
            indicator.classList.add('visible');
            indicator.setAttribute('data-visible', 'true');
            this.editorIndicatorTimeout = setTimeout(() => {
                indicator.classList.remove('visible');
                indicator.setAttribute('data-visible', 'false');
                indicator.textContent = '';
                this.editorIndicatorTimeout = null;
            }, 700);
            return;
        }
        this.gameEngine.renderer.showCombatIndicator(this.getEnemyLimitMessage(), { duration: 700 });
    }

    getEnemyLimitMessage() {
        const message = (TextResources.get('enemies.limitReached', '') as string).trim();
        if (message) return message;
        return 'Max enemies reached';
    }

    getEnemyDefinition(type: string | null = null) {
        const target = typeof type === 'string' && type.length > 0
            ? type
            : this.state.selectedEnemyType;
        const definition = EnemyDefinitions.getEnemyDefinition(target);
        if (definition) {
            return definition;
        }
        const definitions = EditorConstants.ENEMY_DEFINITIONS;
        return definitions.find((entry: EnemyDefinitionData) => entry.type === target) ||
            (target ? definitions.find((entry: EnemyDefinitionData) => Array.isArray(entry.aliases) && entry.aliases.includes(target)) : null) ||
            null;
    }

}

export { EditorEnemyService };
