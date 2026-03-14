import { Item } from '../entities/Item';
import { ITEM_TYPES, type ItemType } from '../constants/itemTypes';
declare class ItemDefinitions {
    static ITEM_DEFINITIONS: Item[];
    static get definitions(): Item[];
    static get TYPES(): typeof ITEM_TYPES;
    static getItemDefinition(type: ItemType): Item | null;
}
export { ITEM_TYPES, ItemDefinitions };
export type { ItemType };
