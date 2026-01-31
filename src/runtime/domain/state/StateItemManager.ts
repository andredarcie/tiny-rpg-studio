import type { GameDefinition, ItemInstance } from '../../../types/gameState';

type GameWithItems = GameDefinition & { items: ItemInstance[] };

class StateItemManager {
    game: GameWithItems;

    constructor(game: GameDefinition) {
        this.game = game as GameWithItems;
    }

    setGame(game: GameDefinition): void {
        this.game = game as GameWithItems;
    }

    resetItems(): void {
        if (!Array.isArray(this.game.items)) return;
        this.game.items.forEach((item) => {
            item.collected = false;
        });
    }
}

export { StateItemManager };
