import type { GameDefinition, ItemInstance } from '../../../types/gameState';
type GameWithItems = GameDefinition & {
    items: ItemInstance[];
};
declare class StateItemManager {
    game: GameWithItems;
    constructor(game: GameDefinition);
    setGame(game: GameDefinition): void;
    resetItems(): void;
}
export { StateItemManager };
