
import { EditorRendererBase } from './EditorRendererBase';

type NpcDefinitionView = {
    type: string;
    variant?: string;
    name?: string;
    nameKey?: string;
};

type EditorNpc = {
    id?: string;
    type: string;
    roomIndex: number;
    x: number;
    y: number;
    placed?: boolean;
    text?: string;
    textKey?: string;
    conditionText?: string;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};

class EditorNpcRenderer extends EditorRendererBase {
    renderNpcs(): void {
        const list = this.dom.npcsList;
        if (!list) return;

        this.gameEngine.npcManager.ensureDefaultNPCs();
        this.updateVariantButtons();
        const game = this.gameEngine.getGame() as { world?: { cols?: number } };
        const filter = this.manager.state.npcVariantFilter || 'human';
        const definitions = this.gameEngine.npcManager.getDefinitions() as NpcDefinitionView[];
        const filteredDefinitions = definitions
            .filter((def: NpcDefinitionView) => {
                const variant = def.variant || 'human';
                return variant === filter;
            });
        const npcs = this.gameEngine.getSprites() as EditorNpc[];

        list.innerHTML = '';
        filteredDefinitions.forEach((def: NpcDefinitionView) => {
            const npc = npcs.find((entry) => entry.type === def.type);
            const card = document.createElement('div');
            card.className = 'npc-card';
            card.dataset.type = def.type;
            card.dataset.id = npc?.id || '';
            if (def.type === this.manager.selectedNpcType) {
                card.classList.add('selected');
            }
            if (npc?.placed) {
                card.classList.add('npc-card-placed');
            } else {
                card.classList.add('npc-card-available');
            }

            const preview = document.createElement('canvas');
            preview.className = 'npc-preview';
            preview.width = 48;
            preview.height = 48;
            this.drawNpcPreview(preview, def);

            const meta = document.createElement('div');
            meta.className = 'meta';

            const name = document.createElement('div');
            name.className = 'npc-name';
            name.textContent = this.getNpcName(def);

            const pos = document.createElement('div');
            pos.className = 'npc-position';
            if (npc?.placed) {
                const cols = game.world?.cols || 1;
                const roomRow = Math.floor(npc.roomIndex / cols) + 1;
                const roomCol = (npc.roomIndex % cols) + 1;
                pos.textContent = this.tf('npc.status.position', {
                    col: roomCol,
                    row: roomRow,
                    x: npc.x,
                    y: npc.y
                }, `Mapa (${roomCol}, ${roomRow}) - (${npc.x}, ${npc.y})`);
            } else {
                pos.textContent = this.t('npc.status.available');
            }

            meta.append(name, pos);
            card.append(preview, meta);
            list.appendChild(card);
        });

        this.updateNpcForm();
    }

    drawNpcPreview(canvas: HTMLCanvasElement, definition: NpcDefinitionView): void {
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        const npcSprites = this.gameEngine.renderer.npcSprites;
        const sprite = npcSprites[definition.type] || npcSprites.default;
        if (!Array.isArray(sprite)) return;
        const step = canvas.width / 8;

        for (let y = 0; y < sprite.length; y++) {
            for (let x = 0; x < sprite[y].length; x++) {
                const col = sprite[y][x];
                if (!col) continue;
                ctx.fillStyle = col;
                ctx.fillRect(x * step, y * step, step, step);
            }
        }
    }

    updateNpcForm(): void {
        const selectedNpcId = this.manager.selectedNpcId;
        const npc = (this.gameEngine.getSprites() as EditorNpc[]).find((entry) => entry.id === selectedNpcId);
        const {
            npcEditor,
            npcText,
            npcConditionalText,
            npcConditionalVariable,
            npcRewardVariable,
            npcConditionalRewardVariable,
            btnToggleNpcConditional,
            npcConditionalSection
        } = this.dom;
        const hasSelection = Boolean(selectedNpcId);
        const hasNpc = Boolean(npc);
        if (npcEditor) {
            npcEditor.hidden = !hasSelection;
        }

        if (npcText) {
            npcText.disabled = !hasNpc;
            npcText.value = this.getNpcDialogueText(npc ?? null);
        }

        if (npcConditionalText) {
            npcConditionalText.disabled = !hasNpc;
            npcConditionalText.value = npc?.conditionText || '';
        }

        this.manager.npcService.populateVariableSelect(npcConditionalVariable, npc?.conditionVariableId || '', { includeBardSkill: true });
        this.manager.npcService.populateVariableSelect(npcRewardVariable, npc?.rewardVariableId || '');
        this.manager.npcService.populateVariableSelect(npcConditionalRewardVariable, npc?.conditionalRewardVariableId || '');

        if (npcConditionalVariable) npcConditionalVariable.disabled = !hasNpc;
        if (npcRewardVariable) npcRewardVariable.disabled = !hasNpc;
        if (npcConditionalRewardVariable) npcConditionalRewardVariable.disabled = !hasNpc;

        const btnNpcDelete = this.dom.btnNpcDelete;
        if (btnNpcDelete && 'disabled' in btnNpcDelete) {
            btnNpcDelete.disabled = !hasNpc || !npc?.placed;
        }

        const expanded = Boolean(this.manager.state.conditionalDialogueExpanded);
        if (npcConditionalSection) {
            npcConditionalSection.hidden = !expanded;
        }
        if (btnToggleNpcConditional) {
            btnToggleNpcConditional.textContent = expanded
                ? this.t('npc.toggle.hide')
                : this.t('npc.toggle.create');
            btnToggleNpcConditional.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    }

    getNpcName(definition: NpcDefinitionView | null): string {
        if (!definition) return this.t('npc.defaultName', 'NPC');
        const fallback = definition.name || this.t('npc.defaultName', 'NPC');
        if (definition.nameKey) {
            return this.t(definition.nameKey, fallback);
        }
        return fallback;
    }

    getNpcDialogueText(npc: EditorNpc | null): string {
        if (!npc) return '';
        if (npc.textKey) {
            return this.t(npc.textKey, npc.text || '');
        }
        return npc.text || '';
    }

    updateVariantButtons(): void {
        const buttons = (Array.isArray(this.dom.npcVariantButtons) ? this.dom.npcVariantButtons : []) as HTMLButtonElement[];
        if (!buttons.length) return;
        const current = this.manager.state.npcVariantFilter || 'human';
        buttons.forEach((btn) => {
            const match = btn.dataset.npcVariantFilter === current;
            btn.classList.toggle('active', match);
            btn.setAttribute('aria-pressed', match ? 'true' : 'false');
        });
    }
}

export { EditorNpcRenderer };
