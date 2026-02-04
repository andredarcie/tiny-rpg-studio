
import { EditorConstants } from '../EditorConstants';
import { RendererConstants } from '../../../runtime/adapters/renderer/RendererConstants';
import { EditorRendererBase } from './EditorRendererBase';
import type { EnemyDefinitionData } from '../../../runtime/domain/entities/Enemy';
import type { EnemyDefinition } from '../../../types/gameState';

type EditorGameData = {
    rooms: Array<{ bg?: number }>;
    world?: {
        rows?: number;
        cols?: number;
    };
};

class EditorEnemyRenderer extends EditorRendererBase {
    renderEnemies(): void {
        const list = this.dom.enemiesList;
        if (!list) return;
        list.innerHTML = '';

        const activeRoom = this.state.activeRoomIndex;
        const enemies = (this.gameEngine
            .getActiveEnemies() as EnemyDefinition[])
            .filter((enemy: EnemyDefinition) => enemy.roomIndex === activeRoom);
        this.renderEnemyOverlay(enemies, activeRoom);
        if (!enemies.length) return;

        const definitions = EditorConstants.ENEMY_DEFINITIONS as EnemyDefinitionData[];
        const definitionMap = new Map<string, EnemyDefinitionData>();
        definitions.forEach((entry: EnemyDefinitionData) => {
            definitionMap.set(entry.type, entry);
            if (Array.isArray(entry.aliases)) {
                entry.aliases.forEach((alias: string) => definitionMap.set(alias, entry));
            }
        });

        const bosses = enemies.filter((enemy: EnemyDefinition) => definitionMap.get(enemy.type)?.boss);
        if (!bosses.length) return;

        bosses.forEach((enemy: EnemyDefinition) => {
            const definition = definitionMap.get(enemy.type) ?? null;
            const item = document.createElement('div');
            item.className = 'enemy-item';

            const label = document.createElement('span');
            const displayName = this.getEnemyDisplayName(definition, enemy.type);
            const damageInfo = Number.isFinite(definition?.damage)
                ? this.tf('enemies.damageInfo', { value: definition?.damage ?? 0 })
                : '';
            label.textContent = `${displayName} @ (${enemy.x}, ${enemy.y})${damageInfo}`;

            const variableWrapper = document.createElement('label');
            variableWrapper.className = 'enemy-variable-wrapper';
            variableWrapper.textContent = `${this.t('enemies.variableLabel')} `;

            const variableSelect = document.createElement('select');
            variableSelect.className = 'enemy-variable-select';
            variableSelect.dataset.enemyVariable = enemy.id;
            this.manager.npcService.populateVariableSelect(
                variableSelect,
                enemy.defeatVariableId || ''
            );
            variableWrapper.appendChild(variableSelect);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'enemy-remove';
            removeBtn.dataset.removeEnemy = enemy.id;
            removeBtn.textContent = this.t('buttons.remove');

            const controls = document.createElement('div');
            controls.className = 'enemy-controls';
            controls.append(variableWrapper, removeBtn);

            item.append(label, controls);
            list.appendChild(item);
        });
    }

    renderEnemyCatalog(): void {
        const container = this.dom.enemyTypes;
        if (!container) return;
        container.innerHTML = '';

        const definitions = EditorConstants.ENEMY_DEFINITIONS as EnemyDefinitionData[];
        if (!definitions.length) return;

        const selectedType = this.manager.selectedEnemyType;

        this.renderEnemyCountProgress(container.parentElement || container, container);

        definitions.forEach((definition: EnemyDefinitionData) => {
            const card = document.createElement('div');
            card.className = 'enemy-card';
            card.dataset.type = definition.type;
            if (definition.boss) {
                card.classList.add('boss');
            }
            if (definition.type === selectedType) {
                card.classList.add('selected');
            }

            const preview = document.createElement('canvas');
            preview.className = 'enemy-preview';
            preview.width = 48;
            preview.height = 48;
            this.drawEnemyPreview(preview, definition);

            const meta = document.createElement('div');
            meta.className = 'enemy-meta';

            const name = document.createElement('div');
            name.className = 'enemy-name';
            name.textContent = this.getEnemyDisplayName(definition, definition.type);

            const damage = document.createElement('div');
            damage.className = 'enemy-damage';
            const damageValue = Number.isFinite(definition.damage) ? definition.damage : '?';
            damage.textContent = `Dano: ${damageValue}`;

            if (definition.boss) {
                const badge = document.createElement('span');
                badge.className = 'enemy-boss-badge';
                badge.textContent = 'Boss';
                meta.appendChild(badge);
            }

            meta.append(name, damage);
            card.append(preview, meta);
            container.appendChild(card);
        });
    }

    drawEnemyPreview(canvas: HTMLCanvasElement, definition: EnemyDefinitionData): void {
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        const renderer = this.gameEngine.renderer;
        let sprite: (string | null)[][] | null = renderer.enemySprites[definition.type] ?? null;
        if (!sprite) {
            sprite = renderer.enemySprite;
        }

        if (!sprite && Array.isArray(definition.sprite)) {
            const palette = renderer.paletteManager.getPalette();
            const actualPalette = palette.length ? palette : RendererConstants.DEFAULT_PALETTE;
            const mapped = renderer.spriteFactory.mapPixels(definition.sprite, actualPalette);
            if (mapped) {
                sprite = mapped as (string | null)[][];
            }
        }

        if (!Array.isArray(sprite)) return;
        const step = canvas.width / 8;
        for (let y = 0; y < sprite.length; y++) {
            const row = sprite[y];
            if (!Array.isArray(row)) continue;
            for (let x = 0; x < row.length; x++) {
                const color = row[x];
                if (!color) continue;
                ctx.fillStyle = color;
                ctx.fillRect(x * step, y * step, step, step);
            }
        }
    }

    getEnemyDisplayName(definition: EnemyDefinitionData | null, fallback = ''): string {
        const defaultName = this.t('enemy.defaultName', 'Inimigo');
        const fallbackName = definition?.name || fallback || defaultName;
        const localized = definition?.nameKey
            ? this.t(definition.nameKey, fallbackName)
            : fallbackName;
        const cleaned = localized
            .replace(/[^\w\s\u00C0-\u024F'()-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned || fallback || defaultName;
    }

    renderEnemyCountProgress(parent: HTMLElement | null, beforeNode: HTMLElement | null = null): void {
        if (!parent) return;
        parent.querySelector('.enemy-xp-block')?.remove();
        const { currentCount, totalCount, ratio } = this.getEnemyCountProgress();

        const block = document.createElement('div');
        block.className = 'enemy-xp-block';

        const header = document.createElement('div');
        header.className = 'enemy-xp-header';

        const label = document.createElement('div');
        label.className = 'enemy-xp-label';
        label.textContent = this.t('enemies.xpBarLabel', 'Inimigos colocados');

        const value = document.createElement('div');
        value.className = 'enemy-xp-value';
        const valueText = this.tf(
            'enemies.xpBarValue',
            { current: currentCount, total: totalCount },
            `${currentCount} / ${totalCount} inimigos`
        );
        value.textContent = valueText;

        header.append(label, value);

        const track = document.createElement('div');
        track.className = 'enemy-xp-track';

        const fill = document.createElement('div');
        fill.className = 'enemy-xp-fill';
        fill.style.width = `${Math.round(ratio * 100)}%`;

        track.appendChild(fill);
        block.append(header, track);

        if (beforeNode && beforeNode.parentElement === parent) {
            parent.insertBefore(block, beforeNode);
        } else {
            parent.appendChild(block);
        }
    }

    getEnemyCountProgress(): { currentCount: number; totalCount: number; ratio: number } {
        const enemies = this.gameEngine.getActiveEnemies() as EnemyDefinition[];
        const currentCount = enemies.length;

        const game = this.gameEngine.getGame() as EditorGameData;
        const world = game.world ?? {};
        const rows = Number(world.rows) || 3;
        const cols = Number(world.cols) || 3;
        const totalRooms = Math.max(1, rows * cols);
        const maxPerRoom = 6;
        const totalCount = totalRooms * maxPerRoom;

        const ratio = Math.max(0, Math.min(1, totalCount > 0 ? currentCount / totalCount : 0));

        return { currentCount, totalCount, ratio };
    }

    renderEnemyOverlay(enemies: EnemyDefinition[], roomIndex: number): void {
        const canvas = this.dom.editorCanvas;
        if (!canvas) return;
        const wrapper = canvas.parentElement;
        if (!wrapper) return;

        const roomEnemies = Array.isArray(enemies)
            ? enemies.filter((enemy: EnemyDefinition) => enemy.roomIndex === roomIndex)
            : [];

        let overlay = wrapper.querySelector('.enemy-overlay');
        if (!roomEnemies.length) {
            if (overlay) {
                overlay.innerHTML = '';
                overlay.remove();
            }
            return;
        }

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'enemy-overlay';
            wrapper.appendChild(overlay);
        }

        const roomSize = this.gameEngine.gameState.worldManager.roomSize;
        const width = canvas.offsetWidth || canvas.clientWidth || canvas.width || 1;
        const height = canvas.offsetHeight || canvas.clientHeight || canvas.height || 1;
        const tileSizeX = width / roomSize;
        const tileSizeY = height / roomSize;

        const overlayElement = overlay as HTMLElement;
        overlayElement.style.width = `${width}px`;
        overlayElement.style.height = `${height}px`;
        overlayElement.style.left = `${canvas.offsetLeft}px`;
        overlayElement.style.top = `${canvas.offsetTop}px`;

        overlay.innerHTML = '';

        roomEnemies.forEach((enemy: EnemyDefinition) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'enemy-overlay-remove';
            btn.textContent = '✕';
            btn.style.left = `${(enemy.x + 1) * tileSizeX}px`;
            btn.style.top = `${enemy.y * tileSizeY}px`;
            btn.addEventListener('click', (ev: MouseEvent) => {
                ev.stopPropagation();
                this.manager.enemyService.removeEnemy(enemy.id);
            });
            overlay.appendChild(btn);
        });
    }
}

export { EditorEnemyRenderer };
