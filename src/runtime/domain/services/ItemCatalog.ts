import { ITEM_TYPES, type ItemType } from '../constants/itemTypes';
import { ItemDefinitions } from '../definitions/ItemDefinitions';
import type { Item, ItemBehavior } from '../entities/Item';

type ItemBehaviorEntry = {
    order: number;
    tags: string[];
    tagSet: Set<string>;
    swordDurability: number | null;
};

class ItemCatalog {
    private items: Item[];
    private behaviorMap?: Map<ItemType, ItemBehaviorEntry>;

    constructor(items: Item[]) {
        this.items = items;
    }

    get definitions(): Item[] {
        return this.items;
    }

    getItemDefinition(type: ItemType): Item | null {
        return this.items.find((entry) => entry.type === type) || null;
    }

    getTags(type: ItemType): string[] {
        const behavior = this.getBehaviorMap().get(type);
        return behavior?.tags || [];
    }

    hasTag(type: ItemType, tag: string): boolean {
        if (!tag) return false;
        const normalizedTag = String(tag);
        const behavior = this.getBehaviorMap().get(type);
        if (!behavior) return false;
        return behavior.tagSet.has(normalizedTag);
    }

    getTypesByTag(tag: string): ItemType[] {
        if (!tag) return [];
        const normalized = String(tag);
        const result: ItemType[] = [];
        this.items.forEach((definition) => {
            if (this.hasTag(definition.type, normalized)) {
                result.push(definition.type);
            }
        });
        return result;
    }

    getEditorTypeOrder(): ItemType[] {
        return [...this.items]
            .sort((a, b) => {
                const ao = this.getBehaviorMap().get(a.type);
                const bo = this.getBehaviorMap().get(b.type);
                const aOrder = ao ? ao.order : 0;
                const bOrder = bo ? bo.order : 0;
                return aOrder - bOrder;
            })
            .map((definition) => definition.type);
    }

    getPlaceableTypes(): ItemType[] {
        const types = this.getTypesByTag('placeable');
        if (types.length) return types;
        const OT = ITEM_TYPES;
        return [
            OT.DOOR,
            OT.DOOR_VARIABLE,
            OT.KEY,
            OT.LIFE_POTION,
            OT.XP_SCROLL,
            OT.SWORD,
            OT.SWORD_BRONZE,
            OT.SWORD_WOOD,
            OT.PLAYER_START,
            OT.PLAYER_END,
            OT.SWITCH
        ].filter(Boolean);
    }

    getCollectibleTypes(): ItemType[] {
        const types = this.getTypesByTag('collectible');
        if (types.length) return types;
        const OT = ITEM_TYPES;
        return [OT.KEY, OT.LIFE_POTION, OT.XP_SCROLL, OT.SWORD, OT.SWORD_BRONZE, OT.SWORD_WOOD].filter(Boolean);
    }

    isCollectible(type: ItemType): boolean {
        return this.hasTag(type, 'collectible');
    }

    shouldHideWhenCollected(type: ItemType): boolean {
        return this.hasTag(type, 'hide-when-collected');
    }

    shouldHideWhenOpened(type: ItemType): boolean {
        return this.hasTag(type, 'hide-when-opened');
    }

    shouldHideWhenVariableOpen(type: ItemType): boolean {
        return this.hasTag(type, 'hide-when-variable-open');
    }

    isHiddenInRuntime(type: ItemType): boolean {
        return this.hasTag(type, 'hidden-in-runtime');
    }

    requiresVariable(type: ItemType): boolean {
        return this.hasTag(type, 'requires-variable');
    }

    isDoor(type: ItemType): boolean {
        return this.hasTag(type, 'door');
    }

    isVariableDoor(type: ItemType): boolean {
        return this.hasTag(type, 'variable-door');
    }

    isLockedDoor(type: ItemType): boolean {
        return this.hasTag(type, 'locked-door');
    }

    isSwitch(type: ItemType): boolean {
        return this.hasTag(type, 'switch');
    }

    isPlayerStart(type: ItemType): boolean {
        return this.hasTag(type, 'player-start');
    }

    isPlayerEnd(type: ItemType): boolean {
        return this.hasTag(type, 'player-end');
    }

    getSwordDurability(type: ItemType): number | null {
        const behavior = this.getBehaviorMap().get(type);
        if (!behavior) return null;
        if (Number.isFinite(behavior.swordDurability)) {
            return behavior.swordDurability;
        }
        return null;
    }

    private getBehaviorMap(): Map<ItemType, ItemBehaviorEntry> {
        if (!this.behaviorMap) {
            const data = new Map<ItemType, ItemBehaviorEntry>();
            this.items.forEach((definition, index) => {
                const config: ItemBehavior = definition.behavior;
                const tags = Array.isArray(config.tags) ? config.tags.slice() : [];
                data.set(definition.type, {
                    order: definition.getOrder(100 + index),
                    tags,
                    tagSet: new Set(tags),
                    swordDurability: definition.getSwordDurability()
                });
            });
            this.behaviorMap = data;
        }
        return this.behaviorMap;
    }
}

const itemCatalog = new ItemCatalog(ItemDefinitions.definitions);

export { ItemCatalog, itemCatalog };
export type { ItemBehaviorEntry };
