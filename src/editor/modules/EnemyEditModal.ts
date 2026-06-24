
import { EditorRendererBase } from './renderers/EditorRendererBase';
import { EditorModal } from './EditorModal';
import { track } from '../../analytics/track';
import type { EditorModalButton } from './EditorModal';
import type { EditorRenderService } from './EditorRenderService';
import type { EnemyDefinitionData } from '../../runtime/domain/entities/Enemy';
import type { EnemyDefinition } from '../../types/gameState';

class EnemyEditModal extends EditorRendererBase {
    private currentEnemyId: string | null = null;
    private readonly modal: EditorModal;

    constructor(service: EditorRenderService) {
        super(service);
        this.modal = new EditorModal(() => this.dom.enemyEditModal);
    }

    open(enemyId: string): void {
        const enemy = this.findEnemy(enemyId);
        if (!enemy) return;

        track('enemy_edit_opened', { type: enemy.type });
        this.currentEnemyId = enemyId;

        const definition = this.getDefinition(enemy.type);

        this.modal.open({
            header: {
                title: this.service.enemyRenderer.getEnemyDisplayName(definition, enemy.type),
                subtitle: `(${enemy.x}, ${enemy.y})`,
                description: definition
                    ? this.t(definition.descriptionKey ?? '', definition.description || '')
                    : '',
                drawPreview: definition
                    ? (canvas) => this.service.enemyRenderer.drawEnemyPreview(canvas, definition)
                    : undefined,
            },
            body: this.buildBody(enemy, definition),
            buttons: this.buildButtons(enemy, definition),
            closeLabel: this.t('buttons.close', 'Fechar'),
            onClose: () => this.close(),
        });
    }

    close(): void {
        this.modal.close();
        this.currentEnemyId = null;
    }

    private findEnemy(id: string): EnemyDefinition | null {
        const enemies = (this.gameEngine.getActiveEnemies() || []) as EnemyDefinition[];
        return enemies.find((e) => e.id === id) || null;
    }

    private getDefinition(type: string): EnemyDefinitionData | null {
        return this.manager.enemyService.getEnemyDefinition(type) as EnemyDefinitionData | null;
    }

    private buildBody(enemy: EnemyDefinition, definition: EnemyDefinitionData | null): HTMLElement {
        const body = document.createElement('div');
        body.className = 'object-edit-modal__config';

        body.appendChild(this.buildStats(definition));

        // Variable toggled when this enemy is defeated.
        const label = document.createElement('label');
        label.className = 'object-config-label';
        label.textContent = this.t('enemies.defeatVariableLabel', 'Ao morrer ativa a variável');

        const select = document.createElement('select');
        select.className = 'object-config-select';
        this.manager.npcService.populateVariableSelect(select, enemy.defeatVariableId || '');
        select.addEventListener('change', () => {
            this.manager.enemyService.handleEnemyVariableChange(enemy.id, select.value || null);
            this.refresh();
        });
        label.appendChild(select);
        body.appendChild(label);

        return body;
    }

    private buildStats(definition: EnemyDefinitionData | null): HTMLElement {
        const grid = document.createElement('div');
        grid.className = 'enemy-stats-grid';

        const yes = this.t('enemies.stats.yes', 'Sim');
        const no = this.t('enemies.stats.no', 'Não');

        grid.appendChild(this.buildStat(this.t('enemies.stats.life', 'Vida'), this.formatNumber(definition?.lives)));
        grid.appendChild(this.buildStat(this.t('enemies.stats.damage', 'Dano'), this.formatNumber(definition?.damage)));
        grid.appendChild(this.buildStat(this.t('enemies.stats.experience', 'XP'), this.formatNumber(definition?.experience)));
        grid.appendChild(this.buildStat(this.t('enemies.stats.missChance', 'Esquiva'), this.formatPercent(definition?.missChance)));
        grid.appendChild(this.buildStat(this.t('enemies.stats.vision', 'Visão'), definition?.hasEyes ? yes : no));
        grid.appendChild(this.buildStat(
            this.t('enemies.stats.type', 'Tipo'),
            definition?.boss ? this.t('enemies.stats.boss', 'Chefe') : this.t('enemies.stats.minion', 'Comum')
        ));

        return grid;
    }

    private buildStat(label: string, value: string): HTMLElement {
        const cell = document.createElement('div');
        cell.className = 'enemy-stat-cell';

        const labelEl = document.createElement('span');
        labelEl.className = 'enemy-stat-cell__label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.className = 'enemy-stat-cell__value';
        valueEl.textContent = value;

        cell.append(labelEl, valueEl);
        return cell;
    }

    private formatNumber(value: number | undefined): string {
        return Number.isFinite(value) ? String(value) : '?';
    }

    private formatPercent(value: number | undefined): string {
        if (!Number.isFinite(value)) return '?';
        const clamped = Math.max(0, Math.min(1, value as number));
        return `${Math.round(clamped * 100)}%`;
    }

    private buildButtons(enemy: EnemyDefinition, definition: EnemyDefinitionData | null): EditorModalButton[] {
        return [
            {
                label: this.t('buttons.move', 'Mover'),
                variant: 'move',
                onClick: () => {
                    const name = this.service.enemyRenderer.getEnemyDisplayName(definition, enemy.type);
                    this.manager.enemyService.startRepositioning(enemy.id, name);
                    this.close();
                },
            },
            {
                label: this.t('buttons.remove', 'Remover'),
                variant: 'remove',
                onClick: () => {
                    this.manager.enemyService.removeEnemy(enemy.id);
                    this.close();
                },
            },
        ];
    }

    private refresh(): void {
        if (this.currentEnemyId) this.open(this.currentEnemyId);
    }
}

export { EnemyEditModal };
