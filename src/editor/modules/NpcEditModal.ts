
import { EditorRendererBase } from './renderers/EditorRendererBase';
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

    constructor(service: EditorRenderService) {
        super(service);
        this.bindStaticEvents();
    }

    private bindStaticEvents(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dom.npcEditModal && !this.dom.npcEditModal.hidden) {
                e.preventDefault();
                this.close();
            }
        });

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

        const modal = this.dom.npcEditModal;
        if (!modal) return;

        const existing = modal.querySelector('.npc-edit-modal__panel');
        if (existing) existing.remove();

        modal.appendChild(this.buildPanel(npc));
        modal.hidden = false;
    }

    close(preserveNpcSelection = false): void {
        const modal = this.dom.npcEditModal;
        if (modal) modal.hidden = true;
        if (!preserveNpcSelection) {
            this.manager.state.selectedNpcId = null;
            this.manager.state.selectedNpcType = null;
        }
        this.currentNpcId = null;
    }

    private findNpc(id: string): EditorNpc | null {
        const sprites = (this.gameEngine.getSprites() || []) as EditorNpc[];
        return sprites.find((s) => s.id === id) || null;
    }

    private refresh(): void {
        if (this.currentNpcId) this.open(this.currentNpcId);
    }

    private buildPanel(npc: EditorNpc): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'npc-edit-modal__panel object-edit-modal__panel';

        panel.appendChild(this.buildHeader(npc));
        panel.appendChild(this.buildBody(npc));
        panel.appendChild(this.buildFooter(npc));
        return panel;
    }

    private buildHeader(npc: EditorNpc): HTMLElement {
        const header = document.createElement('div');
        header.className = 'object-edit-modal__header';

        const preview = document.createElement('canvas');
        preview.width = 48;
        preview.height = 48;
        preview.className = 'object-preview object-edit-modal__preview';
        const defs = (this.gameEngine.npcManager as { getDefinitions?(): NpcDefinitionView[] }).getDefinitions?.() || [];
        const def = defs.find((d) => d.type === npc.type) || { type: npc.type };
        this.service.npcRenderer.drawNpcPreview(preview, def);

        const titleGroup = document.createElement('div');
        titleGroup.className = 'object-edit-modal__title-group';

        const title = document.createElement('h3');
        title.className = 'object-edit-modal__title';
        title.textContent = this.service.npcRenderer.getNpcName(def);

        const pos = document.createElement('span');
        pos.className = 'object-position';
        if (npc.x !== undefined && npc.y !== undefined) {
            pos.textContent = `(${npc.x}, ${npc.y})`;
        }

        titleGroup.append(title, pos);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'object-edit-modal__close';
        closeBtn.setAttribute('aria-label', this.t('buttons.close', 'Fechar'));
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.close());

        header.append(preview, titleGroup, closeBtn);
        return header;
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

    private buildFooter(npc: EditorNpc): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'object-edit-modal__footer';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-secondary';
        closeBtn.textContent = this.t('buttons.close', 'Fechar');
        closeBtn.addEventListener('click', () => this.close());
        footer.appendChild(closeBtn);

        if (npc.placed) {
            const moveBtn = document.createElement('button');
            moveBtn.type = 'button';
            moveBtn.className = 'btn-secondary object-edit-modal__move';
            moveBtn.textContent = this.t('buttons.move', 'Mover');
            moveBtn.addEventListener('click', () => {
                const defs = (this.gameEngine.npcManager as { getDefinitions?(): NpcDefinitionView[] }).getDefinitions?.() || [];
                const def = defs.find((d) => d.type === npc.type) || { type: npc.type };
                const name = this.service.npcRenderer.getNpcName(def);
                this.manager.npcService.updateNpcSelection(npc.type, npc.id);
                this.manager.showRepositionIndicator(name);
                this.close(true);
            });
            footer.appendChild(moveBtn);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-secondary object-edit-modal__remove';
            removeBtn.textContent = this.t('npc.delete', 'Remover');
            removeBtn.addEventListener('click', () => {
                this.manager.npcService.removeSelectedNpc();
                this.close();
            });
            footer.appendChild(removeBtn);
        }

        return footer;
    }
}

export { NpcEditModal };
