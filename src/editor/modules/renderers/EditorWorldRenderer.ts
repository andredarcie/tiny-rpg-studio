
import { EditorRendererBase } from './EditorRendererBase';
import { ITEM_TYPES } from '../../../runtime/domain/constants/itemTypes';

type GameWithWorld = {
    world?: { rows?: number; cols?: number };
    start?: { roomIndex?: number };
    rooms?: unknown[];
};

type NpcSprite = {
    placed?: boolean;
    text?: string;
    conditionText?: string;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};

type EnemyEntry = {
    defeatVariableId?: string | null;
};

type TileId = string | number | null | undefined;
type TileLayer = TileId[][];

type TileMapEntry = {
    ground?: TileLayer;
    overlay?: TileLayer;
};

type ObjectWithType = {
    type?: string;
    variableId?: string | null;
};

type RoomWithWalls = {
    walls?: boolean[][];
};

type GameWithMetrics = {
    rooms?: RoomWithWalls[];
    sprites?: NpcSprite[];
    enemies?: EnemyEntry[];
    items?: unknown[];
    objects?: ObjectWithType[];
    tileset?: { tiles?: { id?: TileId }[]; maps?: TileMapEntry[] };
    customSprites?: unknown[];
};

class EditorWorldRenderer extends EditorRendererBase {
    renderWorldGrid(): void {
        const grid = this.dom.worldGrid;
        if (!grid) return;

        const game = this.gameEngine.getGame() as GameWithWorld;
        const rows = game.world?.rows || 1;
        const cols = game.world?.cols || 1;
        const startIndex = game.start?.roomIndex ?? 0;

        grid.innerHTML = '';
        grid.style.setProperty('--world-cols', String(cols));

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const index = row * cols + col;
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'world-cell';
                cell.setAttribute('data-room-index', String(index));
                if (index === this.state.activeRoomIndex) {
                    cell.classList.add('active');
                }

                const label = document.createElement('span');
                label.className = 'world-cell-label';
                label.textContent = `${col + 1},${row + 1}`;
                cell.appendChild(label);

                const badges = document.createElement('div');
                badges.className = 'world-cell-badges';

                if (index === startIndex) {
                    const badge = document.createElement('span');
                    badge.classList.add('world-cell-badge', 'badge-start');
                    badge.textContent = this.t('world.badge.start');
                    badges.appendChild(badge);
                    cell.classList.add('start');
                }

                if (badges.children.length) {
                    cell.appendChild(badges);
                }

                cell.title = this.tf('world.cell.title', { col: col + 1, row: row + 1 });
                grid.appendChild(cell);
            }
        }

        this.renderMapNavigation();
    }

    renderMapNavigation(): void {
        const buttons = (Array.isArray(this.dom.mapNavButtons) ? this.dom.mapNavButtons : []) as HTMLButtonElement[];
        const game = this.gameEngine.getGame() as GameWithWorld;
        const rows = Math.max(1, Number(game.world?.rows) || 1);
        const cols = Math.max(1, Number(game.world?.cols) || 1);
        const totalRooms = Math.max(1, game.rooms?.length || rows * cols);
        const maxIndex = totalRooms - 1;
        const activeIndex = Math.max(0, Math.min(maxIndex, this.state.activeRoomIndex));
        const currentRow = Math.floor(activeIndex / cols);
        const currentCol = activeIndex % cols;

        this.updateMapPosition(currentCol + 1, currentRow + 1);

        if (!buttons.length) {
            return;
        }

        const canMove = (rowOffset: number, colOffset: number): boolean => {
            const nextRow = currentRow + rowOffset;
            const nextCol = currentCol + colOffset;
            if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) {
                return false;
            }
            const targetIndex = nextRow * cols + nextCol;
            return targetIndex >= 0 && targetIndex <= maxIndex;
        };

        buttons.forEach((button) => {
            const direction = button.dataset.direction;
            let enabled = false;
            switch (direction) {
                case 'up':
                    enabled = canMove(-1, 0);
                    break;
                case 'down':
                    enabled = canMove(1, 0);
                    break;
                case 'left':
                    enabled = canMove(0, -1);
                    break;
                case 'right':
                    enabled = canMove(0, 1);
                    break;
                default:
                    enabled = false;
            }
            button.disabled = !enabled;
        });
    }

    renderGameMinimap(activeColIndex: number | null = null, activeRowIndex: number | null = null): void {
        const container = this.dom.mapPosition;
        if (!container) return;

        container.innerHTML = '';

        for (let r = 1; r <= 3; r++) {
            for (let c = 1; c <= 3; c++) {
                const cell = document.createElement('div');
                cell.className = 'game-minimap-cell';
                cell.dataset.mmRow = String(r);
                cell.dataset.mmCol = String(c);

                if (r === activeRowIndex && c === activeColIndex) {
                    cell.classList.add('game-minimap-cell-active');
                } else {
                    cell.classList.add('game-minimap-cell');
                }

                container.appendChild(cell);
            }
        }
    }

    updateMapPosition(col: number, row: number): void {
        const container = this.dom.mapPosition;
        if (!container) return;
        try {
            this.renderGameMinimap(col, row);
        } catch {}
    }

    renderWorldMetrics(): void {
        const container = this.dom.worldMetrics;
        if (!container) return;

        const game = this.gameEngine.getGame() as GameWithMetrics;

        const sprites = game.sprites ?? [];
        const tileMaps = game.tileset?.maps ?? [];
        const defaultTileId = game.tileset?.tiles?.[0]?.id ?? null;

        const countTiles = (layer: TileLayer, exclude?: TileId): number => {
            let n = 0;
            for (const row of layer) for (const tile of row) if (tile != null && tile !== exclude) n++;
            return n;
        };

        const countWords = (text: string | undefined): number =>
            text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

        let paintedTiles = 0;
        let roomsWithTiles = 0;
        for (const tileMap of tileMaps) {
            const painted = countTiles(tileMap.ground ?? [], defaultTileId) + countTiles(tileMap.overlay ?? []);
            paintedTiles += painted;
            if (painted > 0) roomsWithTiles++;
        }

        let wallCount = 0;
        for (const room of (game.rooms ?? [])) {
            for (const row of (room.walls ?? [])) {
                for (const wall of row) {
                    if (wall) wallCount++;
                }
            }
        }

        const usedVariableIds = new Set<string>();
        let placedNpcs = 0;
        let dialogWords = 0;
        let conditionalDialogs = 0;
        for (const sprite of sprites) {
            if (sprite.placed) {
                placedNpcs++;
                if (sprite.conditionText?.trim()) conditionalDialogs++;
            }
            dialogWords += countWords(sprite.text) + countWords(sprite.conditionText);
            if (sprite.conditionVariableId) usedVariableIds.add(sprite.conditionVariableId);
            if (sprite.rewardVariableId) usedVariableIds.add(sprite.rewardVariableId);
            if (sprite.conditionalRewardVariableId) usedVariableIds.add(sprite.conditionalRewardVariableId);
        }

        const objects = game.objects ?? [];
        let endings = 0;
        let placedObjects = 0;
        for (const obj of objects) {
            if (obj.type === ITEM_TYPES.PLAYER_END) { endings++; }
            else if (obj.type !== ITEM_TYPES.PLAYER_START) { placedObjects++; }
            if (obj.variableId) usedVariableIds.add(obj.variableId);
        }

        for (const enemy of (game.enemies ?? [])) {
            if (enemy.defeatVariableId) usedVariableIds.add(enemy.defeatVariableId);
        }

        const metrics: { label: string; value: number; tooltip: string }[] = [
            { label: this.t('metrics.npcs', 'NPCs'), value: placedNpcs, tooltip: this.t('metrics.tooltip.npcs') },
            { label: this.t('metrics.enemies', 'Enemies'), value: (game.enemies ?? []).length, tooltip: this.t('metrics.tooltip.enemies') },
            { label: this.t('metrics.items', 'Items'), value: (game.items ?? []).length, tooltip: this.t('metrics.tooltip.items') },
            { label: this.t('metrics.objects', 'Objects'), value: placedObjects, tooltip: this.t('metrics.tooltip.objects') },
            { label: this.t('metrics.endings', 'Endings'), value: endings, tooltip: this.t('metrics.tooltip.endings') },
            { label: this.t('metrics.conditionalDialogs', 'Cond. dialogs'), value: conditionalDialogs, tooltip: this.t('metrics.tooltip.conditionalDialogs') },
            { label: this.t('metrics.variablesInUse', 'Variables in use'), value: usedVariableIds.size, tooltip: this.t('metrics.tooltip.variablesInUse') },
            { label: this.t('metrics.roomsWithTiles', 'Rooms with tiles'), value: roomsWithTiles, tooltip: this.t('metrics.tooltip.roomsWithTiles') },
            { label: this.t('metrics.paintedTiles', 'Painted tiles'), value: paintedTiles, tooltip: this.t('metrics.tooltip.paintedTiles') },
            { label: this.t('metrics.walls', 'Walls'), value: wallCount, tooltip: this.t('metrics.tooltip.walls') },
            { label: this.t('metrics.dialogWords', 'Dialog words'), value: dialogWords, tooltip: this.t('metrics.tooltip.dialogWords') },
            { label: this.t('metrics.customSprites', 'Custom sprites'), value: (game.customSprites ?? []).length, tooltip: this.t('metrics.tooltip.customSprites') },
        ];

        container.innerHTML = '';

        const title = document.createElement('p');
        title.className = 'world-metrics-title';
        title.textContent = this.t('metrics.title', 'Game Metrics');
        container.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'world-metrics-grid';

        for (const metric of metrics) {
            const row = document.createElement('div');
            row.className = 'world-metric-row';
            row.title = metric.tooltip;

            const label = document.createElement('span');
            label.className = 'world-metric-label';
            label.textContent = metric.label;

            const value = document.createElement('span');
            value.className = 'world-metric-value';
            value.textContent = metric.value.toLocaleString();

            row.appendChild(label);
            row.appendChild(value);
            grid.appendChild(row);
        }

        container.appendChild(grid);
    }
}

export { EditorWorldRenderer };
