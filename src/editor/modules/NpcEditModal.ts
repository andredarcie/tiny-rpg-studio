
import { EditorRendererBase } from './renderers/EditorRendererBase';
import { EditorModal } from './EditorModal';
import type { EditorModalButton } from './EditorModal';
import type { EditorRenderService } from './EditorRenderService';

type NpcDefinitionView = {
    type: string;
    name?: string;
    nameKey?: string;
};

type EditorNpc = {
    id: string;
    type: string;
    roomIndex: number;
    x?: number;
    y?: number;
    placed?: boolean;
    text?: string | null;
    textKey?: string | null;
    conditionText?: string | null;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};

class NpcEditModal extends EditorRendererBase {
    private currentNpcId: string | null = null;
    private conditionalExpanded = false;
    private readonly modal: EditorModal;

    constructor(service: EditorRenderService) {
        super(service);
        this.modal = new EditorModal(() => this.dom.npcEditModal);
    }

    open(npcId: string): void {
        const npc = this.findNpc(npcId);
        if (!npc) return;

        this.currentNpcId = npcId;
        this.manager.state.selectedNpcId = npcId;
        this.manager.state.selectedNpcType = npc.type;
        this.conditionalExpanded = Boolean(
            npc.conditionText || npc.conditionVariableId || npc.conditionalRewardVariableId
        );

        const def = this.getDefinition(npc);

        this.modal.open({
            panelClassName: 'npc-edit-modal__panel object-edit-modal__panel',
            header: {
                title: this.service.npcRenderer.getNpcName(def),
                subtitle: (npc.x !== undefined && npc.y !== undefined) ? `(${npc.x}, ${npc.y})` : '',
                drawPreview: (canvas) => this.service.npcRenderer.drawNpcPreview(canvas, def),
            },
            body: this.buildBody(npc),
            buttons: this.buildButtons(npc),
            closeLabel: this.t('buttons.close', 'Fechar'),
            onClose: () => this.close(),
        });
    }

    close(preserveNpcSelection = false): void {
        this.modal.close();
        if (!preserveNpcSelection) {
            this.manager.state.selectedNpcId = null;
            this.manager.state.selectedNpcType = null;
        }
        this.currentNpcId = null;
    }

    private getDefinition(npc: EditorNpc): NpcDefinitionView {
        const defs = (this.gameEngine.npcManager as { getDefinitions?(): NpcDefinitionView[] }).getDefinitions?.() || [];
        return defs.find((d) => d.type === npc.type) || { type: npc.type };
    }

    private findNpc(id: string): EditorNpc | null {
        const sprites = (this.gameEngine.getSprites() || []) as EditorNpc[];
        return sprites.find((s) => s.id === id) || null;
    }

    private refresh(): void {
        if (this.currentNpcId) this.open(this.currentNpcId);
    }

    private buildBody(npc: EditorNpc): HTMLElement {
        const body = document.createElement('div');
        body.className = 'object-edit-modal__config npc-edit-modal__body';

        // Main dialogue textarea
        const dialogLabel = document.createElement('label');
        dialogLabel.className = 'object-config-label';
        dialogLabel.textContent = this.t('npc.dialog.defaultLabel', 'Diálogo');

        const dialogTextarea = document.createElement('textarea');
        dialogTextarea.className = 'object-config-textarea';
        dialogTextarea.rows = 3;
        const dialogText = npc.textKey ? this.t(npc.textKey, npc.text || '') : (npc.text || '');
        dialogTextarea.value = dialogText;
        dialogTextarea.placeholder = this.t('npc.dialog.placeholder', '');
        dialogTextarea.addEventListener('input', () => {
            this.manager.npcService.updateNpcText(dialogTextarea.value);
        });
        dialogLabel.appendChild(dialogTextarea);
        body.appendChild(dialogLabel);

        // Reward variable
        const rewardLabel = document.createElement('label');
        rewardLabel.className = 'object-config-label';
        rewardLabel.textContent = this.t('npc.reward.defaultLabel', 'Recompensa');

        const rewardSelect = document.createElement('select');
        rewardSelect.className = 'object-config-select';
        this.manager.npcService.populateVariableSelect(rewardSelect, npc.rewardVariableId || '');
        rewardSelect.addEventListener('change', () => {
            this.manager.npcService.handleRewardVariableChange(rewardSelect.value);
            this.refresh();
        });
        rewardLabel.appendChild(rewardSelect);
        body.appendChild(rewardLabel);

        // Conditional section
        const conditionalSection = document.createElement('div');
        conditionalSection.className = 'npc-conditional-section';
        conditionalSection.hidden = !this.conditionalExpanded;
        this.buildConditionalSection(npc, conditionalSection);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn-secondary npc-edit-modal__toggle';
        toggleBtn.textContent = this.conditionalExpanded
            ? this.t('npc.toggle.hide')
            : this.t('npc.toggle.create');
        toggleBtn.setAttribute('aria-expanded', String(this.conditionalExpanded));
        toggleBtn.addEventListener('click', () => {
            this.conditionalExpanded = !this.conditionalExpanded;
            conditionalSection.hidden = !this.conditionalExpanded;
            toggleBtn.textContent = this.conditionalExpanded
                ? this.t('npc.toggle.hide')
                : this.t('npc.toggle.create');
            toggleBtn.setAttribute('aria-expanded', String(this.conditionalExpanded));
        });

        body.appendChild(toggleBtn);
        body.appendChild(conditionalSection);

        return body;
    }

    private buildConditionalSection(npc: EditorNpc, container: HTMLElement): void {
        // Condition variable
        const condVarLabel = document.createElement('label');
        condVarLabel.className = 'object-config-label';
        condVarLabel.textContent = this.t('npc.conditional.variableLabel', 'Condição');

        const condVarSelect = document.createElement('select');
        condVarSelect.className = 'object-config-select';
        this.manager.npcService.populateVariableSelect(condVarSelect, npc.conditionVariableId || '', { includeBardSkill: true });
        condVarSelect.addEventListener('change', () => {
            this.manager.npcService.handleConditionVariableChange(condVarSelect.value);
            this.refresh();
        });
        condVarLabel.appendChild(condVarSelect);
        container.appendChild(condVarLabel);

        // Conditional dialogue textarea
        const condTextLabel = document.createElement('label');
        condTextLabel.className = 'object-config-label';
        condTextLabel.textContent = this.t('npc.conditional.textLabel', 'Diálogo condicional');

        const condTextarea = document.createElement('textarea');
        condTextarea.className = 'object-config-textarea';
        condTextarea.rows = 3;
        condTextarea.value = npc.conditionText || '';
        condTextarea.placeholder = this.t('npc.conditional.placeholder', '');
        condTextarea.addEventListener('input', () => {
            this.manager.npcService.updateNpcConditionalText(condTextarea.value);
        });
        condTextLabel.appendChild(condTextarea);
        container.appendChild(condTextLabel);

        // Conditional reward variable
        const condRewardLabel = document.createElement('label');
        condRewardLabel.className = 'object-config-label';
        condRewardLabel.textContent = this.t('npc.conditional.rewardLabel', 'Recompensa condicional');

        const condRewardSelect = document.createElement('select');
        condRewardSelect.className = 'object-config-select';
        this.manager.npcService.populateVariableSelect(condRewardSelect, npc.conditionalRewardVariableId || '');
        condRewardSelect.addEventListener('change', () => {
            this.manager.npcService.handleConditionalRewardVariableChange(condRewardSelect.value);
            this.refresh();
        });
        condRewardLabel.appendChild(condRewardSelect);
        container.appendChild(condRewardLabel);
    }

    private buildButtons(npc: EditorNpc): EditorModalButton[] {
        if (!npc.placed) return [];

        return [
            {
                label: this.t('buttons.move', 'Mover'),
                variant: 'move',
                onClick: () => {
                    const name = this.service.npcRenderer.getNpcName(this.getDefinition(npc));
                    this.manager.npcService.updateNpcSelection(npc.type, npc.id);
                    this.manager.showRepositionIndicator(name);
                    this.close(true);
                },
            },
            {
                label: this.t('npc.delete', 'Remover'),
                variant: 'remove',
                onClick: () => {
                    this.manager.npcService.removeSelectedNpc();
                    this.close();
                },
            },
        ];
    }
}

export { NpcEditModal };
