import type { ItemType } from '../constants/itemTypes';
type SpriteMatrix = (number | null)[][];
type ItemBehavior = {
    order?: number;
    tags?: string[];
    swordDurability?: number;
    swordDamage?: number;
};
type ItemDefinitionData = {
    type: ItemType;
    id: string;
    name: string;
    nameKey: string;
    behavior?: ItemBehavior;
    sprite: SpriteMatrix;
    spriteOn?: SpriteMatrix;
};
declare class Item {
    type: ItemType;
    id: string;
    name: string;
    nameKey: string;
    behavior: ItemBehavior;
    sprite: SpriteMatrix;
    spriteOn?: SpriteMatrix;
    constructor(data: ItemDefinitionData);
    getTags(): string[];
    hasTag(tag: string): boolean;
    getOrder(fallbackOrder: number): number;
    getSwordDurability(): number | null;
    getSwordDamage(): number | null;
}
export type { ItemBehavior, ItemDefinitionData, SpriteMatrix };
export { Item };
