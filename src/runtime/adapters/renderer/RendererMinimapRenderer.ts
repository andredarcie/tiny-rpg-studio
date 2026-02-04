type MinimapGameState = {
    getGame: () => { world?: { rows?: number; cols?: number } };
    getPlayer: () => { roomIndex?: number | null };
};

class RendererMinimapRenderer {
    gameState: MinimapGameState;
    minimapElement: HTMLElement | null;
    minimapCells: HTMLElement[] | null;

    constructor(gameState: MinimapGameState) {
        this.gameState = gameState;
        this.minimapElement = typeof document !== 'undefined'
            ? document.getElementById('game-minimap')
            : null;
        this.minimapCells = null;
    }

    drawMinimap() {
        if (!this.minimapElement) return;
        const game = this.gameState.getGame();
        const player = this.gameState.getPlayer() ?? { roomIndex: 0 };
        const rows = game.world?.rows || 1;
        const cols = game.world?.cols || 1;
        const total = rows * cols;

        if (!this.minimapCells || this.minimapCells.length !== total) {
            this.minimapElement.innerHTML = '';
            this.minimapElement.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            this.minimapCells = [];
            for (let i = 0; i < total; i++) {
                const cell = document.createElement('div');
                cell.className = 'game-minimap-cell';
                this.minimapElement.appendChild(cell);
                this.minimapCells.push(cell);
            }
        }

        if (!this.minimapCells || !this.minimapCells.length) return;
        const clampedRoom = Math.max(0, Math.min(this.minimapCells.length - 1, player.roomIndex ?? 0));
        for (let i = 0; i < this.minimapCells.length; i++) {
            this.minimapCells[i].classList.toggle('active', i === clampedRoom);
        }
    }
}

export { RendererMinimapRenderer };
