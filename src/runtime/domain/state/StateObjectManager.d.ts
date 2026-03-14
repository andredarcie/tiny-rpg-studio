import { type ItemType } from '../constants/itemTypes';
type ObjectEntry = {
    id: string;
    type: ItemType;
    roomIndex: number;
    x: number;
    y: number;
    collected?: boolean;
    opened?: boolean;
    variableId?: string | null;
    on?: boolean;
    endingText?: string;
    isCollectible?: boolean;
    hideWhenCollected?: boolean;
    hiddenInRuntime?: boolean;
    isLockedDoor?: boolean;
    hideWhenOpened?: boolean;
    isVariableDoor?: boolean;
    hideWhenVariableOpen?: boolean;
    requiresVariable?: boolean;
    swordDurability?: number | null;
} & Record<string, unknown>;
type WorldManagerApi = {
    clampRoomIndex: (value: number) => number;
    clampCoordinate: (value: number) => number;
};
type VariableManagerApi = {
    normalizeVariableId?: (id: string | null | undefined) => string | null;
    getFirstVariableId?: () => string | null;
};
declare class StateObjectManager {
    static _collectibleSet?: Set<ItemType>;
    game: ({
        objects?: ObjectEntry[];
        start?: {
            x: number;
            y: number;
            roomIndex: number;
        };
    } & Record<string, unknown>) | null;
    worldManager: WorldManagerApi | null;
    variableManager: VariableManagerApi | null;
    static get TYPES(): {
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
    get types(): {
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
    static get PLAYER_START_TYPE(): "player-start";
    static get PLAYER_END_TYPE(): "player-end";
    static get SWITCH_TYPE(): "switch";
    static get PLACEABLE_OBJECT_TYPES(): ItemType[];
    static get COLLECTIBLE_OBJECT_TYPES(): Set<ItemType>;
    static get PLAYER_END_TEXT_LIMIT(): number;
    static getPlaceableTypesArray(): ItemType[];
    static getPlaceableTypeSet(): Set<ItemType>;
    static getCollectibleTypeSet(): Set<ItemType>;
    static isCollectibleType(type: ItemType): boolean;
    constructor(game: ({
        objects?: ObjectEntry[];
        start?: {
            x: number;
            y: number;
            roomIndex: number;
        };
    } & Record<string, unknown>) | null, worldManager: WorldManagerApi | null, variableManager: VariableManagerApi | null);
    setGame(game: ({
        objects?: ObjectEntry[];
        start?: {
            x: number;
            y: number;
            roomIndex: number;
        };
    } & Record<string, unknown>) | null): void;
    setWorldManager(worldManager: WorldManagerApi | null): void;
    setVariableManager(variableManager: VariableManagerApi | null): void;
    normalizeObjects(objects: unknown[] | null | undefined): ObjectEntry[];
    normalizePlayerEndText(value: unknown): string;
    resetRuntime(): void;
    generateObjectId(type: ItemType, roomIndex: number): string;
    getObjects(): ObjectEntry[];
    getObjectsForRoom(roomIndex: number | null | undefined): ObjectEntry[];
    getObjectAt(roomIndex: number | null | undefined, x: number | null | undefined, y: number | null | undefined): ObjectEntry | null;
    setObjectPosition(type: ItemType, roomIndex: number, x: number, y: number): ObjectEntry | null;
    removeObject(type: ItemType, roomIndex: number): void;
    setObjectVariable(type: ItemType, roomIndex: number, variableId: string | null): string | null;
    syncSwitchState(variableId: string | null | undefined, value: unknown): boolean;
    ensurePlayerStartObject(): ObjectEntry | null;
    getPlayerEndObject(roomIndex?: number | null): ObjectEntry | null;
    getPlayerEndText(roomIndex?: number | null): string;
    setPlayerEndText(roomIndex: number, text: string): string;
    syncPlayerStart(entry: ObjectEntry | null): void;
    applyObjectBehavior(entry: ObjectEntry | null): ObjectEntry | null;
    checkOpenedMagicDoor(variableId: string | null | undefined, value: unknown): boolean;
}
export type { ObjectEntry };
export { StateObjectManager };
