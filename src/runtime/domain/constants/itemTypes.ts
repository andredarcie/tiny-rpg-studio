const ITEM_TYPES = {
    PLAYER_START: 'player-start',
    PLAYER_END: 'player-end',
    SWITCH: 'switch',
    DOOR: 'door',
    DOOR_VARIABLE: 'door-variable',
    KEY: 'key',
    LIFE_POTION: 'life-potion',
    XP_SCROLL: 'xp-scroll',
    SWORD: 'sword',
    SWORD_BRONZE: 'sword-bronze',
    SWORD_WOOD: 'sword-wood',
    LOGIC_GATE_NOT: 'logic-gate-not',
    LOGIC_GATE_AND: 'logic-gate-and',
    LOGIC_GATE_OR: 'logic-gate-or',
    LOGIC_GATE_NAND: 'logic-gate-nand',
    LOGIC_GATE_NOR: 'logic-gate-nor',
    LOGIC_LED: 'logic-led',
    ARMOR: 'armor',
    BOOTS: 'boots',
    TRAP: 'trap',
    PRESSURE_PLATE: 'pressure-plate',
    CHEST: 'chest',
    PUSH_BOX: 'push-box'
} as const;

type ItemType = (typeof ITEM_TYPES)[keyof typeof ITEM_TYPES];

export { ITEM_TYPES };
export type { ItemType };
