const ITEM_TYPES = {
    // Online: not synced — metadata only, used to place the local player at start.
    PLAYER_START: 'player-start',

    // Online: not synced — triggers game completion via the `game-over` message,
    // no per-object state needs broadcasting.
    PLAYER_END: 'player-end',

    // Online: fully synced — `on` state in ObjectNetState; the associated variable
    // is also synced via WorldStateDiff.variables, so door-variables and logic
    // gates all react correctly on both clients.
    SWITCH: 'switch',

    // Online: fully synced — `opened` state in ObjectNetState.
    DOOR: 'door',

    // Online: implicit sync — no per-object state; `opened` is derived from the
    // linked variable, which is synced via WorldStateDiff.variables.
    DOOR_VARIABLE: 'door-variable',

    // Online: fully synced — `collected` in ObjectNetState; pickup also fires an
    // `item-picked` message so the remote client hides the object immediately.
    KEY: 'key',

    // Online: fully synced — same mechanism as KEY.
    LIFE_POTION: 'life-potion',

    // Online: fully synced — same mechanism as KEY.
    XP_SCROLL: 'xp-scroll',

    // Online: collected state synced via ObjectNetState. Equipment state (sword
    // type, durability) is carried in PlayerPositionMsg, not in the object diff.
    SWORD: 'sword',

    // Online: same as SWORD.
    SWORD_BRONZE: 'sword-bronze',

    // Online: same as SWORD.
    SWORD_WOOD: 'sword-wood',

    // Online: stateless — output variable is synced via WorldStateDiff.variables;
    // no per-object field needed.
    LOGIC_GATE_NOT: 'logic-gate-not',

    // Online: same as LOGIC_GATE_NOT.
    LOGIC_GATE_AND: 'logic-gate-and',

    // Online: same as LOGIC_GATE_NOT.
    LOGIC_GATE_OR: 'logic-gate-or',

    // Online: same as LOGIC_GATE_NOT.
    LOGIC_GATE_NAND: 'logic-gate-nand',

    // Online: same as LOGIC_GATE_NOT.
    LOGIC_GATE_NOR: 'logic-gate-nor',

    // Online: visual state derived from linked variable (synced); no object diff
    // needed. Only visible in the editor, hidden at runtime.
    LOGIC_LED: 'logic-led',

    // Online: collected state synced via ObjectNetState. Whether equipped is
    // carried in PlayerPositionMsg.armorEquipped, not the object diff.
    ARMOR: 'armor',

    // Online: same as ARMOR — equipped status in PlayerPositionMsg.bootsEquipped.
    BOOTS: 'boots',

    // Online: no per-object state — active/inactive is fully derived from the
    // linked variable (synced via WorldStateDiff.variables).
    TRAP: 'trap',

    // Online: coordination via variable — host evaluates both local and guest
    // positions to determine activation, then broadcasts the variable change.
    // No explicit `activated` field needs to be in ObjectNetState.
    PRESSURE_PLATE: 'pressure-plate',

    // Online: partially synced — `opened` state is in ObjectNetState so both
    // clients see the chest as open after one player interacts with it.
    // Contents (containsItemType / randomItem) are resolved independently on each
    // client — intentional design, each player gets their own reward.
    CHEST: 'chest',

    // Online: fully synced — current position (x, y) explicitly included in
    // ObjectNetState so the box moves in sync on all clients.
    PUSH_BOX: 'push-box',
} as const;

type ItemType = (typeof ITEM_TYPES)[keyof typeof ITEM_TYPES];

export { ITEM_TYPES };
export type { ItemType };
