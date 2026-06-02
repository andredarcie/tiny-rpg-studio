
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
            tags: ['placeable', 'player-start', 'global-unique', 'hidden-in-runtime', 'markers']
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
            tags: ['placeable', 'player-end', 'per-room-unique', 'markers']
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
            tags: ['placeable', 'switch', 'requires-variable', 'triggers']
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
            tags: ['placeable', 'collectible', 'hide-when-collected', 'consumables']
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
            tags: ['placeable', 'door', 'locked-door', 'hide-when-opened', 'obstacles']
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
            tags: ['placeable', 'door', 'requires-variable', 'variable-door', 'hide-when-variable-open', 'obstacles']
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
            tags: ['placeable', 'collectible', 'hide-when-collected', 'consumables']
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
            tags: ['placeable', 'collectible', 'hide-when-collected', 'consumables']
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
            tags: ['placeable', 'collectible', 'sword', 'hide-when-collected', 'equipment']
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
            tags: ['placeable', 'collectible', 'sword', 'hide-when-collected', 'equipment']
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
            tags: ['placeable', 'collectible', 'sword', 'hide-when-collected', 'equipment']
        },
        sprite: SpriteMatrixRegistry.get('object', 'sword-wood')
    },
    {
        type: ITEM_TYPES.LOGIC_GATE_NOT,
        id: 'object-logic-gate-not',
        name: 'Porta NOT',
        nameKey: 'objects.label.logicGateNot',
        behavior: {
            order: 120,
            tags: ['placeable', 'logic-gate', 'single-input', 'logic']
        },
        sprite: SpriteMatrixRegistry.get('object', 'logic-gate-not')
    },
    {
        type: ITEM_TYPES.LOGIC_GATE_AND,
        id: 'object-logic-gate-and',
        name: 'Porta AND',
        nameKey: 'objects.label.logicGateAnd',
        behavior: {
            order: 130,
            tags: ['placeable', 'logic-gate', 'logic']
        },
        sprite: SpriteMatrixRegistry.get('object', 'logic-gate-and')
    },
    {
        type: ITEM_TYPES.LOGIC_GATE_OR,
        id: 'object-logic-gate-or',
        name: 'Porta OR',
        nameKey: 'objects.label.logicGateOr',
        behavior: {
            order: 140,
            tags: ['placeable', 'logic-gate', 'logic']
        },
        sprite: SpriteMatrixRegistry.get('object', 'logic-gate-or')
    },
    {
        type: ITEM_TYPES.LOGIC_GATE_NAND,
        id: 'object-logic-gate-nand',
        name: 'Porta NAND',
        nameKey: 'objects.label.logicGateNand',
        behavior: {
            order: 150,
            tags: ['placeable', 'logic-gate', 'logic']
        },
        sprite: SpriteMatrixRegistry.get('object', 'logic-gate-nand')
    },
    {
        type: ITEM_TYPES.LOGIC_GATE_NOR,
        id: 'object-logic-gate-nor',
        name: 'Porta NOR',
        nameKey: 'objects.label.logicGateNor',
        behavior: {
            order: 160,
            tags: ['placeable', 'logic-gate', 'logic']
        },
        sprite: SpriteMatrixRegistry.get('object', 'logic-gate-nor')
    },
    {
        type: ITEM_TYPES.LOGIC_LED,
        id: 'object-logic-led',
        name: 'LED',
        nameKey: 'objects.label.logicLed',
        behavior: {
            order: 170,
            tags: ['placeable', 'led', 'requires-variable', 'logic']
        },
        sprite: SpriteMatrixRegistry.get('object', 'logic-led'),
        spriteOn: SpriteMatrixRegistry.get('object', 'logic-led--on')
    },
    {
        type: ITEM_TYPES.ARMOR,
        id: 'object-armor',
        name: 'Armadura',
        nameKey: 'objects.label.armor',
        behavior: {
            order: 75,
            tags: ['placeable', 'collectible', 'hide-when-collected', 'equipment']
        },
        sprite: SpriteMatrixRegistry.get('object', 'armor')
    },
    {
        type: ITEM_TYPES.BOOTS,
        id: 'object-boots',
        name: 'Botas',
        nameKey: 'objects.label.boots',
        behavior: {
            order: 78,
            tags: ['placeable', 'collectible', 'hide-when-collected', 'equipment']
        },
        sprite: SpriteMatrixRegistry.get('object', 'boots')
    },
    {
        type: ITEM_TYPES.TRAP,
        id: 'object-trap',
        name: 'Armadilha',
        nameKey: 'objects.label.trap',
        behavior: {
            order: 85,
            tags: ['placeable', 'requires-variable', 'multi-instance', 'obstacles']
        },
        sprite: SpriteMatrixRegistry.get('object', 'trap'),
        spriteOn: SpriteMatrixRegistry.get('object', 'trap--on')
    },
    {
        type: ITEM_TYPES.PRESSURE_PLATE,
        id: 'object-pressure-plate',
        name: 'Placa de Pressão',
        nameKey: 'objects.label.pressurePlate',
        behavior: {
            order: 90,
            tags: ['placeable', 'requires-variable', 'multi-instance', 'triggers']
        },
        sprite: SpriteMatrixRegistry.get('object', 'pressure-plate'),
        spriteOn: SpriteMatrixRegistry.get('object', 'pressure-plate--on')
    },
    {
        type: ITEM_TYPES.CHEST,
        id: 'object-chest',
        name: 'Baú',
        nameKey: 'objects.label.chest',
        behavior: {
            order: 95,
            tags: ['placeable', 'multi-instance', 'triggers']
        },
        sprite: SpriteMatrixRegistry.get('object', 'chest'),
        spriteOn: SpriteMatrixRegistry.get('object', 'chest--on')
    },
    {
        type: ITEM_TYPES.PUSH_BOX,
        id: 'object-push-box',
        name: 'Caixa',
        nameKey: 'objects.label.pushBox',
        behavior: {
            order: 100,
            tags: ['placeable', 'multi-instance', 'obstacles']
        },
        sprite: SpriteMatrixRegistry.get('object', 'push-box')
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
