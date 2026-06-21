
import { EditorRendererBase } from './renderers/EditorRendererBase';
import { EditorModal } from './EditorModal';
import { track } from '../../analytics/track';
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
    choiceEnabled?: boolean;
    choicePrompt?: string | null;
    choiceYesText?: string | null;
    choiceNoText?: string | null;
    choiceYesVariableId?: string | null;
    choiceNoVariableId?: string | null;
};

class NpcEditModal extends EditorRendererBase {
    private currentNpcId: string | null = null;
    private conditionalExpanded = false;
    private choiceExpanded = false;
    private readonly modal: EditorModal;

    constructor(service: EditorRenderService) {
        super(service);
        this.modal = new EditorModal(() => this.dom.npcEditModal);
        // Rebuild the open modal when the language changes so its variable selects
        // (and labels) follow the new locale instead of keeping the old names.
        if (typeof document !== 'undefined') {
            document.addEventListener('language-changed', () => this.refresh());
        }
    }

    open(npcId: string): void {
        const npc = this.findNpc(npcId);
        if (!npc) return;

        track('npc_edit_opened', { type: npc.type });
        this.currentNpcId = npcId;
        this.manager.state.selectedNpcId = npcId;
        this.manager.state.selectedNpcType = npc.type;
        this.conditionalExpanded = Boolean(
            npc.conditionText || npc.conditionVariableId || npc.conditionalRewardVariableId
        );
        // The choice section tracks the active flag, not its content: hiding it
        // disables the choice in-game but keeps the text/variables for later.
        this.choiceExpanded = Boolean(npc.choiceEnabled);

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

        // Choice dialog section (optional, mutually independent from the conditional one).
        const choiceSection = document.createElement('div');
        choiceSection.className = 'npc-choice-section';
        choiceSection.hidden = !this.choiceExpanded;
        this.buildChoiceSection(npc, choiceSection);

        const choiceToggleBtn = document.createElement('button');
        choiceToggleBtn.type = 'button';
        choiceToggleBtn.className = 'btn-secondary npc-edit-modal__toggle';
        choiceToggleBtn.textContent = this.choiceExpanded
            ? this.t('npc.choice.hideButton', 'Remover diálogo de escolhas')
            : this.t('npc.choice.createButton', 'Criar diálogo de escolhas');
        choiceToggleBtn.setAttribute('aria-expanded', String(this.choiceExpanded));
        choiceToggleBtn.addEventListener('click', () => {
            this.choiceExpanded = !this.choiceExpanded;
            choiceSection.hidden = !this.choiceExpanded;
            choiceToggleBtn.textContent = this.choiceExpanded
                ? this.t('npc.choice.hideButton', 'Ocultar diálogo de escolhas')
                : this.t('npc.choice.createButton', 'Criar diálogo de escolhas');
            choiceToggleBtn.setAttribute('aria-expanded', String(this.choiceExpanded));
            // Toggle the in-game flag without rebuilding the modal, so the content
            // (prompt, branches, variables) is preserved if the author reopens it.
            this.manager.npcService.toggleChoiceEnabled(this.choiceExpanded);
        });

        body.appendChild(choiceToggleBtn);
        body.appendChild(choiceSection);

        return body;
    }

    private buildChoiceSection(npc: EditorNpc, container: HTMLElement): void {
        // Prompt (the question shown to the player above the Yes/No options).
        const promptLabel = document.createElement('label');
        promptLabel.className = 'object-config-label npc-choice-prompt';
        promptLabel.textContent = this.t('npc.choice.promptLabel', 'Pergunta');

        const promptTextarea = document.createElement('textarea');
        promptTextarea.className = 'object-config-textarea';
        promptTextarea.rows = 2;
        promptTextarea.value = npc.choicePrompt || '';
        promptTextarea.placeholder = this.t('npc.choice.promptPlaceholder', '');
        promptTextarea.addEventListener('input', () => {
            this.manager.npcService.updateNpcChoicePrompt(promptTextarea.value);
        });
        promptLabel.appendChild(promptTextarea);
        container.appendChild(promptLabel);

        // Each branch is its own colour-coded card: green = "Yes", red = "No".
        container.appendChild(this.buildChoiceBranch({
            kind: 'yes',
            title: this.t('npc.choice.yesTitle', 'Se escolher "Sim"'),
            messageLabel: this.t('npc.choice.messageLabel', 'Resposta'),
            messageValue: npc.choiceYesText || '',
            messagePlaceholder: this.t('npc.choice.yesPlaceholder', ''),
            rewardLabel: this.t('npc.choice.branchRewardLabel', 'Ativar variável'),
            rewardValue: npc.choiceYesVariableId || '',
            onMessage: (value) => this.manager.npcService.updateNpcChoiceYesText(value),
            onReward: (value) => this.manager.npcService.handleChoiceYesVariableChange(value),
        }));

        container.appendChild(this.buildChoiceBranch({
            kind: 'no',
            title: this.t('npc.choice.noTitle', 'Se escolher "Não"'),
            messageLabel: this.t('npc.choice.messageLabel', 'Resposta'),
            messageValue: npc.choiceNoText || '',
            messagePlaceholder: this.t('npc.choice.noPlaceholder', ''),
            rewardLabel: this.t('npc.choice.branchRewardLabel', 'Ativar variável'),
            rewardValue: npc.choiceNoVariableId || '',
            onMessage: (value) => this.manager.npcService.updateNpcChoiceNoText(value),
            onReward: (value) => this.manager.npcService.handleChoiceNoVariableChange(value),
        }));
    }

    private buildChoiceBranch(opts: {
        kind: 'yes' | 'no';
        title: string;
        messageLabel: string;
        messageValue: string;
        messagePlaceholder: string;
        rewardLabel: string;
        rewardValue: string;
        onMessage: (value: string) => void;
        onReward: (value: string) => void;
    }): HTMLElement {
        const branch = document.createElement('div');
        branch.className = `npc-choice-branch npc-choice-branch--${opts.kind}`;

        const title = document.createElement('div');
        title.className = 'npc-choice-branch__title';
        title.textContent = opts.title;
        branch.appendChild(title);

        const messageLabel = document.createElement('label');
        messageLabel.className = 'object-config-label';
        messageLabel.textContent = opts.messageLabel;
        const textarea = document.createElement('textarea');
        textarea.className = 'object-config-textarea';
        textarea.rows = 2;
        textarea.value = opts.messageValue;
        textarea.placeholder = opts.messagePlaceholder;
        textarea.addEventListener('input', () => opts.onMessage(textarea.value));
        messageLabel.appendChild(textarea);
        branch.appendChild(messageLabel);

        const rewardLabel = document.createElement('label');
        rewardLabel.className = 'object-config-label';
        rewardLabel.textContent = opts.rewardLabel;
        const select = document.createElement('select');
        select.className = 'object-config-select';
        this.manager.npcService.populateVariableSelect(select, opts.rewardValue);
        select.addEventListener('change', () => {
            opts.onReward(select.value);
            this.refresh();
        });
        rewardLabel.appendChild(select);
        branch.appendChild(rewardLabel);

        return branch;
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
