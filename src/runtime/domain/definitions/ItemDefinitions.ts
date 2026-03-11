
import { SpriteMatrixRegistry } from '../sprites/SpriteMatrixRegistry';
import { Item } from '../entities/Item';
import type { ItemDefinitionData } from '../entities/Item';
import { ITEM_TYPES, type ItemType } from '../constants/itemTypes';

/**
 * ItemDefinitions encapsulates the interactive items available in the editor.
 */
const ITEM_DEFINITION_DATA: ItemDefinitionData[] = [
    {
        type: ITEM_TYPES.PLAYER_START,
        id: 'object-player-start',
        name: 'Inicio do Jogador',
        nameKey: 'objects.label.playerStart',
        behavior: {
            order: 10,
            tags: ['placeable', 'player-start', 'global-unique', 'hidden-in-runtime']
        },
        sprite: SpriteMatrixRegistry.get('object', 'player-start')
    },
    {
        type: ITEM_TYPES.PLAYER_END,
        id: 'object-player-end',
        name: 'Fim do Jogo',
        nameKey: 'objects.label.playerEnd',
        behavior: {
            order: 20,
            tags: ['placeable', 'player-end', 'per-room-unique']
        },
        sprite: SpriteMatrixRegistry.get('object', 'player-end')
    },
    {
        type: ITEM_TYPES.SWITCH,
        id: 'object-switch',
        name: 'Alavanca',
        nameKey: 'objects.label.switch',
        behavior: {
            order: 30,
            tags: ['placeable', 'switch', 'requires-variable']
        },
        sprite: SpriteMatrixRegistry.get('object', 'switch'),
        spriteOn: SpriteMatrixRegistry.get('object', 'switch--on')
    },
    {
        type: ITEM_TYPES.KEY,
        id: 'object-key',
        name: 'Chave',
        nameKey: 'objects.label.key',
        behavior: {
            order: 60,
            tags: ['placeable', 'collectible', 'hide-when-collected']
        },
        sprite: SpriteMatrixRegistry.get('object', 'key')
    },
    {
        type: ITEM_TYPES.DOOR,
        id: 'object-door',
        name: 'Porta',
        nameKey: 'objects.label.door',
        behavior: {
            order: 40,
            tags: ['placeable', 'door', 'locked-door', 'hide-when-opened']
        },
        sprite: SpriteMatrixRegistry.get('object', 'door')
    },
    {
        type: ITEM_TYPES.DOOR_VARIABLE,
        id: 'object-door-variable',
        name: 'Porta Magica',
        nameKey: 'objects.label.doorVariable',
        behavior: {
            order: 50,
            tags: ['placeable', 'door', 'requires-variable', 'variable-door', 'hide-when-variable-open']
        },
        sprite: SpriteMatrixRegistry.get('object', 'door-variable')
    },
    {
        type: ITEM_TYPES.LIFE_POTION,
        id: 'object-life-potion',
        name: 'Pocao de Vida',
        nameKey: 'objects.label.lifePotion',
        behavior: {
            order: 70,
            tags: ['placeable', 'collectible', 'hide-when-collected']
        },
        sprite: SpriteMatrixRegistry.get('object', 'life-potion')
    },
    {
        type: ITEM_TYPES.XP_SCROLL,
        id: 'object-xp-scroll',
        name: 'Pergaminho de XP',
        nameKey: 'objects.label.xpScroll',
        behavior: {
            order: 110,
            tags: ['placeable', 'collectible', 'hide-when-collected']
        },
        sprite: SpriteMatrixRegistry.get('object', 'xp-scroll')
    },
    {
        type: ITEM_TYPES.SWORD,
        id: 'object-sword',
        name: 'Espada de Aço',
        nameKey: 'objects.label.sword',
        behavior: {
            order: 80,
            swordDurability: 5,
            swordDamage: 4,
            tags: ['placeable', 'collectible', 'sword', 'hide-when-collected']
        },
        sprite: SpriteMatrixRegistry.get('object', 'sword')
    },
    {
        type: ITEM_TYPES.SWORD_BRONZE,
        id: 'object-sword-bronze',
        name: 'Espada de Bronze',
        nameKey: 'objects.label.swordBronze',
        behavior: {
            order: 90,
            swordDurability: 4,
            swordDamage: 3,
            tags: ['placeable', 'collectible', 'sword', 'hide-when-collected']
        },
        sprite: SpriteMatrixRegistry.get('object', 'sword-bronze')
    },
    {
        type: ITEM_TYPES.SWORD_WOOD,
        id: 'object-sword-wood',
        name: 'Espada de Madeira',
        nameKey: 'objects.label.swordWood',
        behavior: {
            order: 100,
            swordDurability: 3,
            swordDamage: 2,
            tags: ['placeable', 'collectible', 'sword', 'hide-when-collected']
        },
        sprite: SpriteMatrixRegistry.get('object', 'sword-wood')
    }
];

class ItemDefinitions {
    static ITEM_DEFINITIONS: Item[] = ITEM_DEFINITION_DATA.map((entry) => new Item(entry));

    static get definitions(): Item[] {
        return this.ITEM_DEFINITIONS;
    }

    static get TYPES(): typeof ITEM_TYPES {
        return ITEM_TYPES;
    }

    static getItemDefinition(type: ItemType): Item | null {
        return this.ITEM_DEFINITIONS.find((entry) => entry.type === type) || null;
    }
}

export { ITEM_TYPES, ItemDefinitions };
export type { ItemType };
