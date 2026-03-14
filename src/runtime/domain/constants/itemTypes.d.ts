declare const ITEM_TYPES: {
    readonly PLAYER_START: "player-start";
    readonly PLAYER_END: "player-end";
    readonly SWITCH: "switch";
    readonly DOOR: "door";
    readonly DOOR_VARIABLE: "door-variable";
    readonly KEY: "key";
    readonly LIFE_POTION: "life-potion";
    readonly XP_SCROLL: "xp-scroll";
    readonly SWORD: "sword";
    readonly SWORD_BRONZE: "sword-bronze";
    readonly SWORD_WOOD: "sword-wood";
};
type ItemType = (typeof ITEM_TYPES)[keyof typeof ITEM_TYPES];
export { ITEM_TYPES };
export type { ItemType };
