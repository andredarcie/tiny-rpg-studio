
import { TextResources } from '../../runtime/adapters/TextResources';
import type { EditorManager } from '../EditorManager';
import type { NpcDefinitionData } from '../../runtime/domain/entities/Npc';
import type { VariableDefinition } from '../../types/gameState';

type SpriteInstance = {
    id: string;
    type: string;
    placed?: boolean;
    text?: string | null;
    textKey?: string | null;
    conditionText?: string | null;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};

class EditorNpcService {
    manager: EditorManager;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
    }

    get text() {
        return TextResources;
    }

    t(key: string, fallback = '') {
        const resource = this.text as typeof TextResources & { get?: (key: string, fallback: string) => string };
        const value = resource.get(key, fallback);
        if (value) return value;
        if (fallback) return fallback;
        return key || '';
    }

    get gameEngine() {
        return this.manager.gameEngine;
    }

    get dom() {
        return this.manager.domCache;
    }

    get state() {
        return this.manager.state;
    }

    addNpc() {
        this.gameEngine.npcManager.ensureDefaultNPCs();
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const definitions = this.gameEngine.npcManager.getDefinitions();
        const available = definitions
            .map((def: NpcDefinitionData) => ({
                def,
                npc: sprites.find((entry: SpriteInstance) => entry.type === def.type) || null
            }))
            .find((entry: { def: NpcDefinitionData; npc: SpriteInstance | null }) => !entry.npc || !entry.npc.placed);

        if (!available) {
            alert(this.t('alerts.npc.full'));
            return;
        }

        const npc = available.npc;
        if (!npc) {
            const manager = this.gameEngine.npcManager as { createNPC?: (type: string) => SpriteInstance | null };
            const created = manager.createNPC ? manager.createNPC(available.def.type) : null;
            if (!created) {
                alert(this.t('alerts.npc.createError'));
                return;
            }
            this.state.selectedNpcId = created.id;
            this.state.selectedNpcType = created.type;
        } else {
            this.state.selectedNpcId = npc.id;
            this.state.selectedNpcType = npc.type;
        }

        this.activatePlacement();
        this.manager.renderService.renderNpcs();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    activatePlacement() {
        if (!this.state.selectedNpcId) {
            alert(this.t('alerts.npc.selectFirst'));
            return;
        }
        if (this.state.placingNpc) return;

        this.manager.enemyService.deactivatePlacement();
        if (this.state.placingObjectType) {
            this.manager.objectService.togglePlacement(this.state.placingObjectType, true);
        }

        this.state.placingNpc = true;
        this.state.placingEnemy = false;
        this.state.placingObjectType = null;

        if (this.dom.editorCanvas) {
            this.dom.editorCanvas.style.cursor = 'crosshair';
        }
    }

    deactivatePlacement() {
        if (!this.state.placingNpc) return;
        this.state.placingNpc = false;
        if (!this.state.placingEnemy && !this.state.placingObjectType && this.dom.editorCanvas) {
            this.dom.editorCanvas.style.cursor = 'default';
        }
    }

    clearSelection({ render = true }: { render?: boolean } = {}) {
        const hadSelection = Boolean(
            this.state.selectedNpcId ||
            this.state.selectedNpcType ||
            this.state.placingNpc
        );
        this.state.selectedNpcId = null;
        this.state.selectedNpcType = null;
        this.state.conditionalDialogueExpanded = false;
        this.deactivatePlacement();
        if (render && hadSelection) {
            this.manager.renderService.renderNpcs();
        }
        return hadSelection;
    }

    removeSelectedNpc() {
        if (!this.state.selectedNpcId) return;
        const removed = this.gameEngine.npcManager.removeNPC(this.state.selectedNpcId);
        if (!removed) return;

        this.clearSelection({ render: false });
        this.manager.renderService.renderNpcs();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    updateNpcSelection(type: string | null, id: string | null) {
        if (!id) {
            this.clearSelection();
            return;
        }
        this.state.selectedNpcType = type;
        this.state.selectedNpcId = id;
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const npc = sprites.find((entry: SpriteInstance) => entry.id === id) || null;
        const hasConditionalData = Boolean(
            npc?.conditionText ||
            npc?.conditionVariableId ||
            npc?.conditionalRewardVariableId
        );
        this.state.conditionalDialogueExpanded = hasConditionalData;
        this.manager.renderService.renderNpcs();
        this.activatePlacement();
    }

    placeNpcAt(coord: { x: number; y: number }) {
        if (!this.state.selectedNpcId) {
            alert(this.t('alerts.npc.selectFirst'));
            this.deactivatePlacement();
            return;
        }
        const roomIndex = this.state.activeRoomIndex;
        const updated = this.gameEngine.npcManager.setNPCPosition(
            this.state.selectedNpcId,
            coord.x,
            coord.y,
            roomIndex
        );
        if (!updated) {
            alert(this.t('alerts.npc.placeError'));
            return;
        }
        this.manager.renderService.renderNpcs();
        this.manager.renderService.renderWorldGrid();
        this.manager.renderService.renderEditor();
        this.manager.gameEngine.draw();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    populateVariableSelect(selectElement: HTMLSelectElement | null, selectedId = '', options: { includeBardSkill?: boolean } = {}) {
        if (!selectElement) return;
        const variables = (this.gameEngine.getVariableDefinitions() ?? []) as (VariableDefinition & { name?: string })[];
        const includeBardSkill = Boolean(options.includeBardSkill);
        selectElement.innerHTML = '';

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = this.t('variables.none');
        selectElement.appendChild(emptyOption);

        if (includeBardSkill) {
            const bardOption = document.createElement('option');
            bardOption.value = 'skill:bard';
            bardOption.textContent = this.t('variables.skill.bard');
            selectElement.appendChild(bardOption);
        }

        variables.forEach((variable: VariableDefinition & { name?: string }) => {
            const option = document.createElement('option');
            option.value = variable.id;
            option.textContent = variable.name || variable.id;
            selectElement.appendChild(option);
        });

        selectElement.value = selectedId || '';
    }

    updateNpcText(text: string) {
        if (!this.state.selectedNpcId) return;
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const npc = sprites.find((entry: SpriteInstance) => entry.id === this.state.selectedNpcId);
        if (!npc) return;

        npc.text = text;
        npc.textKey = null;
        this.manager.renderService.renderNpcs();
        this.manager.updateJSON();
        this.scheduleNpcTextUpdate();
    }

    updateNpcConditionalText(text: string) {
        if (!this.state.selectedNpcId) return;
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const npc = sprites.find((entry: SpriteInstance) => entry.id === this.state.selectedNpcId);
        if (!npc) return;
        npc.conditionText = text;
        this.manager.renderService.renderNpcs();
        this.manager.updateJSON();
        this.scheduleNpcTextUpdate();
    }

    scheduleNpcTextUpdate() {
        if (this.state.npcTextUpdateTimer) {
            clearTimeout(this.state.npcTextUpdateTimer);
        }
        this.state.npcTextUpdateTimer = setTimeout(() => {
            this.manager.history.pushCurrentState();
        }, 400);
    }

    handleConditionVariableChange(variableId: string) {
        if (!this.state.selectedNpcId) return;
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const npc = sprites.find((entry: SpriteInstance) => entry.id === this.state.selectedNpcId);
        if (!npc) return;
        npc.conditionVariableId = variableId || null;
        this.manager.renderService.renderNpcs();
        this.manager.renderService.renderWorldGrid();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    handleRewardVariableChange(variableId: string) {
        if (!this.state.selectedNpcId) return;
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const npc = sprites.find((entry: SpriteInstance) => entry.id === this.state.selectedNpcId);
        if (!npc) return;
        npc.rewardVariableId = variableId || null;
        this.manager.renderService.renderNpcs();
        this.manager.renderService.renderWorldGrid();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    handleConditionalRewardVariableChange(variableId: string) {
        if (!this.state.selectedNpcId) return;
        const sprites = this.gameEngine.getSprites() as SpriteInstance[];
        const npc = sprites.find((entry: SpriteInstance) => entry.id === this.state.selectedNpcId);
        if (!npc) return;
        npc.conditionalRewardVariableId = variableId || null;
        this.manager.renderService.renderNpcs();
        this.manager.renderService.renderWorldGrid();
        this.manager.updateJSON();
        this.manager.history.pushCurrentState();
    }

    setVariantFilter(variant: string) {
        const allowed = ['human', 'elf', 'dwarf', 'fixed'];
        const normalized = allowed.includes(variant) ? variant : 'human';
        if (this.state.npcVariantFilter === normalized) return;
        this.clearSelection({ render: false });
        this.state.npcVariantFilter = normalized;
        this.manager.renderService.renderNpcs();
    }

}

export { EditorNpcService };
