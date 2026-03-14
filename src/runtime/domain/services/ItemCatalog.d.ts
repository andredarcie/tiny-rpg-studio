import { type ItemType } from '../constants/itemTypes';
import type { Item } from '../entities/Item';
type ItemBehaviorEntry = {
    order: number;
    tags: string[];
    tagSet: Set<string>;
    swordDurability: number | null;
};
declare class ItemCatalog {
    private items;
    private behaviorMap?;
    constructor(items: Item[]);
    get definitions(): Item[];
    getItemDefinition(type: ItemType): Item | null;
    getTags(type: ItemType): string[];
    hasTag(type: ItemType, tag: string): boolean;
    getTypesByTag(tag: string): ItemType[];
    getEditorTypeOrder(): ItemType[];
    getPlaceableTypes(): ItemType[];
    getCollectibleTypes(): ItemType[];
    isCollectible(type: ItemType): boolean;
    shouldHideWhenCollected(type: ItemType): boolean;
    shouldHideWhenOpened(type: ItemType): boolean;
    shouldHideWhenVariableOpen(type: ItemType): boolean;
    isHiddenInRuntime(type: ItemType): boolean;
    requiresVariable(type: ItemType): boolean;
    isDoor(type: ItemType): boolean;
    isVariableDoor(type: ItemType): boolean;
    isLockedDoor(type: ItemType): boolean;
    isSwitch(type: ItemType): boolean;
    isPlayerStart(type: ItemType): boolean;
    isPlayerEnd(type: ItemType): boolean;
    getSwordDurability(type: ItemType): number | null;
    private getBehaviorMap;
}
declare const itemCatalog: ItemCatalog;
export { ItemCatalog, itemCatalog };
export type { ItemBehaviorEntry };
