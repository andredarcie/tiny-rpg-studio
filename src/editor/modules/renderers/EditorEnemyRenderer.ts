
import { EditorConstants } from '../EditorConstants';
import { RendererConstants } from '../../../runtime/adapters/renderer/RendererConstants';
import { EditorRendererBase } from './EditorRendererBase';
import { CustomSpriteLookup } from '../../../runtime/domain/sprites/CustomSpriteLookup';
import type { CustomSpriteEntry } from '../../../types/gameState';
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
    renderEnemyCatalog(): void {
        const container = this.dom.enemyTypes;
        if (!container) return;
        container.innerHTML = '';

        const definitions = EditorConstants.ENEMY_DEFINITIONS as EnemyDefinitionData[];
        if (!definitions.length) return;

        const selectedType = this.manager.selectedEnemyType;
        const game = (this.gameEngine as unknown as { getGame?(): { customSprites?: CustomSpriteEntry[] } }).getGame?.();
        const customSprites = game?.customSprites;

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
            preview.width = 56;
            preview.height = 56;
            this.drawEnemyPreview(preview, definition);

            const meta = document.createElement('div');
            meta.className = 'enemy-meta';

            const name = document.createElement('div');
            name.className = 'enemy-name';
            name.textContent = this.getEnemyDisplayName(definition, definition.type);

            const stats = document.createElement('div');
            stats.className = 'enemy-stats';

            const livesValue = Number.isFinite(definition.lives) ? definition.lives : '?';
            const damageValue = Number.isFinite(definition.damage) ? definition.damage : '?';

            const livesSpan = document.createElement('span');
            livesSpan.className = 'enemy-stat-lives';
            livesSpan.textContent = `LIFE: ${livesValue}`;

            const separator = document.createElement('span');
            separator.className = 'enemy-stat-separator';
            separator.textContent = ' - ';

            const damageSpan = document.createElement('span');
            damageSpan.className = 'enemy-stat-damage';
            damageSpan.textContent = `ATK: ${damageValue}`;

            stats.append(livesSpan, separator, damageSpan);

            if (definition.boss) {
                const badge = document.createElement('span');
                badge.className = 'enemy-boss-badge';
                badge.textContent = 'Boss';
                meta.appendChild(badge);
            }

            meta.append(name, stats);

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'sprite-edit-btn';
            editBtn.dataset.editGroup = 'enemy';
            editBtn.dataset.editKey = definition.type;
            editBtn.textContent = '✎';
            const isCustom = CustomSpriteLookup.find(customSprites, 'enemy', definition.type) !== null;
            if (isCustom) {
                editBtn.classList.add('is-custom');
            }

            card.append(preview, meta, editBtn);
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
            const palette = renderer.paletteManager.getActivePalette();
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

}

export { EditorEnemyRenderer };
