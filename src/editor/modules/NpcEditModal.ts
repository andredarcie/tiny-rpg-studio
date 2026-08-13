
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
    disappearAfterDialog?: boolean;
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
    private hintsBubble: HTMLElement | null = null;
    private removeHintsListeners: (() => void) | null = null;

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
        this.removeHintsBubble();
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
        this.removeHintsBubble();
        const body = document.createElement('div');
        body.className = 'object-edit-modal__config npc-edit-modal__body';

        // Main dialogue heading and disappearance option
        const dialogGroup = document.createElement('div');
        dialogGroup.className = 'object-config-label';

        const dialogHeading = document.createElement('div');
        dialogHeading.className = 'npc-dialog-heading';

        const dialogLabel = document.createElement('label');
        dialogLabel.className = 'object-config-label';
        dialogLabel.htmlFor = 'npc-default-dialog';
        dialogLabel.textContent = this.t('npc.dialog.defaultLabel', 'Diálogo');

        const disappearLabel = document.createElement('label');
        disappearLabel.className = 'object-config-label object-config-label--checkbox';
        disappearLabel.htmlFor = 'npc-disappear-after-dialog';

        const disappearCheckbox = document.createElement('input');
        disappearCheckbox.id = 'npc-disappear-after-dialog';
        disappearCheckbox.type = 'checkbox';
        disappearCheckbox.checked = npc.disappearAfterDialog === true;
        disappearLabel.append(
            disappearCheckbox,
            ` ${this.t('npc.dialog.disappearAfter', 'Desaparecer')}`,
        );

        dialogHeading.append(dialogLabel, disappearLabel);
        dialogGroup.appendChild(dialogHeading);
        body.appendChild(dialogGroup);

        const dialogTextarea = document.createElement('textarea');
        dialogTextarea.id = 'npc-default-dialog';
        dialogTextarea.className = 'object-config-textarea';
        dialogTextarea.rows = 3;
        const dialogText = npc.textKey ? this.t(npc.textKey, npc.text || '') : (npc.text || '');
        dialogTextarea.value = dialogText;
        dialogTextarea.placeholder = this.t('npc.dialog.placeholder', '');
        dialogTextarea.addEventListener('input', () => {
            this.manager.npcService.updateNpcText(dialogTextarea.value);
        });
        dialogGroup.appendChild(dialogTextarea);

        const hints = document.createElement('div');
        hints.className = 'npc-dialog-hints';

        const hintsButton = document.createElement('button');
        hintsButton.type = 'button';
        hintsButton.className = 'npc-dialog-hints__button';
        hintsButton.textContent = 'i';
        hintsButton.setAttribute('aria-label', this.t('project.group.info', 'Information'));
        hintsButton.setAttribute('aria-controls', 'npc-dialog-hints-bubble');
        hintsButton.setAttribute('aria-expanded', 'false');

        const hintsBubble = document.createElement('div');
        hintsBubble.id = 'npc-dialog-hints-bubble';
        hintsBubble.className = 'npc-dialog-hints__bubble';
        hintsBubble.hidden = true;
        hintsBubble.setAttribute('role', 'note');

        const hintsList = document.createElement('ul');
        const hintItems = [
            this.t('npc.dialog.pageBreakHint', 'Use \\ to start a new dialogue page.'),
            this.t('npc.dialog.waveHint', 'Use {wvy}text{wvy} to make text wave.'),
            this.t('npc.dialog.rainbowHint', 'Use {rbw}text{rbw} to cycle through palette colors.'),
            this.t('npc.dialog.shakeHint', 'Use {shk}text{shk} to make text shake.'),
            this.t('npc.dialog.colorHint', 'Use [CLR0]text[CLR0] through [CLR15] to apply a palette color.'),
        ];
        hintItems.forEach((hint) => {
            const item = document.createElement('li');
            item.textContent = hint;
            hintsList.appendChild(item);
        });
        hintsBubble.appendChild(hintsList);

        const setHintsOpen = (open: boolean) => {
            hintsBubble.hidden = !open;
            hintsButton.setAttribute('aria-expanded', String(open));
            if (open) positionHintsBubble();
        };
        hintsButton.addEventListener('click', () => setHintsOpen(hintsBubble.hidden));

        const positionHintsBubble = () => {
            if (hintsBubble.hidden) return;
            const buttonRect = hintsButton.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const edgeGap = 8;
            const bubbleGap = 7;
            hintsBubble.style.right = `${Math.max(edgeGap, viewportWidth - buttonRect.right)}px`;
            hintsBubble.style.top = `${buttonRect.bottom + bubbleGap}px`;
            hintsBubble.dataset.placement = 'below';

            const bubbleRect = hintsBubble.getBoundingClientRect();
            const fitsBelow = buttonRect.bottom + bubbleGap + bubbleRect.height <= viewportHeight - edgeGap;
            if (!fitsBelow && buttonRect.top >= bubbleRect.height + bubbleGap + edgeGap) {
                hintsBubble.style.top = `${buttonRect.top - bubbleRect.height - bubbleGap}px`;
                hintsBubble.dataset.placement = 'above';
            }
        };
        const closeHintsFromOutside = (event: Event) => {
            const target = event.target;
            if (target instanceof Node && !hintsButton.contains(target) && !hintsBubble.contains(target)) {
                setHintsOpen(false);
            }
        };
        const closeHintsFromEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setHintsOpen(false);
        };
        const repositionHints = () => positionHintsBubble();

        document.addEventListener('pointerdown', closeHintsFromOutside);
        document.addEventListener('keydown', closeHintsFromEscape);
        window.addEventListener('resize', repositionHints);
        window.addEventListener('scroll', repositionHints, true);
        this.removeHintsListeners = () => {
            document.removeEventListener('pointerdown', closeHintsFromOutside);
            document.removeEventListener('keydown', closeHintsFromEscape);
            window.removeEventListener('resize', repositionHints);
            window.removeEventListener('scroll', repositionHints, true);
        };
        this.hintsBubble = hintsBubble;

        hints.appendChild(hintsButton);
        dialogGroup.appendChild(hints);
        document.body.appendChild(hintsBubble);

        // Reward variable
        const rewardLabel = document.createElement('label');
        rewardLabel.className = 'object-config-label';
        rewardLabel.textContent = this.t('npc.reward.defaultLabel', 'Recompensa');

        const rewardSelect = document.createElement('select');
        rewardSelect.className = 'object-config-select';
        this.manager.npcService.populateVariableSelect(
            rewardSelect,
            npc.rewardVariableId || '',
            { includeEndGame: true },
        );
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

        const updateAlternativeVisibility = () => {
            const hidden = disappearCheckbox.checked;
            toggleBtn.hidden = hidden;
            conditionalSection.hidden = hidden || !this.conditionalExpanded;
            choiceToggleBtn.hidden = hidden;
            choiceSection.hidden = hidden || !this.choiceExpanded;
        };
        disappearCheckbox.addEventListener('change', () => {
            this.manager.npcService.updateNpcDisappearAfterDialog(disappearCheckbox.checked);
            updateAlternativeVisibility();
        });
        updateAlternativeVisibility();

        body.appendChild(choiceToggleBtn);
        body.appendChild(choiceSection);

        return body;
    }

    private removeHintsBubble(): void {
        this.removeHintsListeners?.();
        this.removeHintsListeners = null;
        this.hintsBubble?.remove();
        this.hintsBubble = null;
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
        this.manager.npcService.populateVariableSelect(select, opts.rewardValue, { includeEndGame: true });
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
        this.manager.npcService.populateVariableSelect(
            condRewardSelect,
            npc.conditionalRewardVariableId || '',
            { includeEndGame: true },
        );
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
