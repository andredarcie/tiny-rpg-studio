import { ITEM_TYPES, type ItemType } from '../../domain/constants/itemTypes';
type DialogManagerApi = {
    showDialog: (text: string, meta?: Record<string, unknown>) => void;
};
type PlayerPosition = {
    roomIndex: number;
    x: number;
    y: number;
};
type ItemState = {
    roomIndex: number;
    x: number;
    y: number;
    collected?: boolean;
    text?: string;
};
type GameObjectState = {
    type: ItemType;
    roomIndex: number;
    x: number;
    y: number;
    collected?: boolean;
    variableId?: string | null;
    on?: boolean;
};
type NpcState = {
    placed?: boolean;
    roomIndex: number;
    x: number;
    y: number;
    text?: string;
    conditionText?: string;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};
type ExitState = {
    roomIndex: number;
    x: number;
    y: number;
    targetRoomIndex: number;
    targetX: number;
    targetY: number;
};
type RoomState = Record<string, unknown>;
type GameData = {
    items?: unknown[];
    sprites?: unknown[];
    exits?: unknown[];
    rooms?: unknown[];
} & Record<string, unknown>;
type GameStateApi = {
    getGame: () => GameData;
    getPlayer: () => PlayerPosition | null;
    isInCombat?: () => boolean;
    getObjectsForRoom?: (roomIndex: number) => GameObjectState[];
    getPlayerEndText: (roomIndex: number) => string;
    setActiveEndingText?: (text: string) => void;
    normalizeVariableId?: (id: string | null) => string | null;
    isVariableOn?: (id: string) => boolean;
    setVariableValue?: (id: string, value: boolean, persist?: boolean) => [boolean, boolean?];
    addKeys?: (count: number) => void;
    getLives?: () => number;
    getMaxLives?: () => number;
    hasSkill?: (skillId: string) => boolean;
    healPlayerToFull?: () => void;
    addLife?: (count: number) => void;
    getExperienceToNext?: () => number;
    addExperience?: (amount: number) => void;
    getSwordType?: () => string | null;
    addDamageShield?: (durability: number, type: string) => void;
    showPickupOverlay?: (payload: Record<string, unknown>) => void;
    setPlayerPosition: (x: number, y: number, roomIndex: number | null) => void;
    getRoomIndex: (row: number, col: number) => number | null;
};
type Options = {
    onPlayerVictory?: () => void;
};
declare class InteractionManager {
    gameState: GameStateApi;
    dialogManager: DialogManagerApi;
    options?: Options;
    constructor(gameState: GameStateApi, dialogManager: DialogManagerApi, options?: Options);
    get types(): typeof ITEM_TYPES;
    handlePlayerInteractions(): void;
    checkItems(items: ItemState[], player: PlayerPosition): void;
    checkObjects(player: PlayerPosition): void;
    handleCollectibleObject(object: GameObjectState): boolean;
    getSwordDurability(type: ItemType): number;
    getSwordPriority(type: ItemType | string): number;
    shouldPickupSword(type: ItemType): boolean;
    showPickupOverlay(type: ItemType, effect?: (() => void) | null): void;
    getObjectDisplayName(type: ItemType): string;
    getInteractionText(key: string, fallback?: string): string;
    formatInteractionText(key: string, params?: Record<string, string | number | boolean>, fallback?: string): string;
    handleSwitch(object: GameObjectState): boolean;
    handlePlayerEnd(object: GameObjectState): boolean;
    checkNpcs(npcs: NpcState[], player: PlayerPosition): void;
    getNpcDialogText(npc: NpcState): string;
    getNpcDialogMeta(npc: NpcState): Record<string, unknown> | undefined;
    checkRoomExits(exits: ExitState[], rooms: RoomState[], player: PlayerPosition): void;
    clamp(v: number, a: number, b: number): number;
}
export type { ExitState };
export { InteractionManager };
