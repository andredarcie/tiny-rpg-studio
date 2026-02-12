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

class Item {
    type: ItemType;
    id: string;
    name: string;
    nameKey: string;
    behavior: ItemBehavior;
    sprite: SpriteMatrix;
    spriteOn?: SpriteMatrix;

    constructor(data: ItemDefinitionData) {
        this.type = data.type;
        this.id = data.id;
        this.name = data.name;
        this.nameKey = data.nameKey;
        this.behavior = data.behavior ?? {};
        this.sprite = data.sprite;
        this.spriteOn = data.spriteOn;
    }

    getTags(): string[] {
        return Array.isArray(this.behavior.tags) ? this.behavior.tags.slice() : [];
    }

    hasTag(tag: string): boolean {
        if (!tag) return false;
        const normalized = String(tag);
        return this.getTags().includes(normalized);
    }

    getOrder(fallbackOrder: number): number {
        const order = this.behavior.order;
        return Number.isFinite(order) ? (order as number) : fallbackOrder;
    }

    getSwordDurability(): number | null {
        const value = this.behavior.swordDurability;
        if (!Number.isFinite(value)) return null;
        return Math.max(0, value as number);
    }

    getSwordDamage(): number | null {
        const value = this.behavior.swordDamage;
        if (!Number.isFinite(value)) return null;
        return Math.max(1, value as number);
    }
}

export type { ItemBehavior, ItemDefinitionData, SpriteMatrix };
export { Item };
