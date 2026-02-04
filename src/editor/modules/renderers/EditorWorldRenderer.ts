
import { EditorRendererBase } from './EditorRendererBase';

type GameWithWorld = {
    world?: { rows?: number; cols?: number };
    start?: { roomIndex?: number };
    rooms?: unknown[];
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
}

export { EditorWorldRenderer };
