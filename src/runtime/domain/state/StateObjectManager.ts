
import { ITEM_TYPES, type ItemType } from '../constants/itemTypes';
import { itemCatalog } from '../services/ItemCatalog';
const PLAYER_END_TEXT_LIMIT = 40;

type RawObjectInput = {
    type?: string;
    roomIndex?: number;
    x?: number;
    y?: number;
    id?: string;
    variableId?: string | null;
    collected?: boolean;
    opened?: boolean;
    on?: boolean;
    endingText?: string;
};

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

class StateObjectManager {
    static _collectibleSet?: Set<ItemType>;
    game: ({ objects?: ObjectEntry[]; start?: { x: number; y: number; roomIndex: number } } & Record<string, unknown>) | null;
    worldManager: WorldManagerApi | null;
    variableManager: VariableManagerApi | null;

    static get TYPES() {
        return ITEM_TYPES;
    }

    get types() {
        return StateObjectManager.TYPES;
    }

    static get PLAYER_START_TYPE() {
        return this.TYPES.PLAYER_START;
    }

    static get PLAYER_END_TYPE() {
        return this.TYPES.PLAYER_END;
    }

    static get SWITCH_TYPE() {
        return this.TYPES.SWITCH;
    }

    static get PLACEABLE_OBJECT_TYPES() {
        return this.getPlaceableTypesArray();
    }

    static get COLLECTIBLE_OBJECT_TYPES() {
        return this.getCollectibleTypeSet();
    }

    static get PLAYER_END_TEXT_LIMIT() {
        return PLAYER_END_TEXT_LIMIT;
    }

    static getPlaceableTypesArray() {
        return itemCatalog.getPlaceableTypes();
    }

    static getPlaceableTypeSet() {
        return new Set(this.getPlaceableTypesArray());
    }

    static getCollectibleTypeSet() {
        if (!this._collectibleSet) {
            this._collectibleSet = new Set(itemCatalog.getCollectibleTypes());
        }
        return this._collectibleSet;
    }

    static isCollectibleType(type: ItemType) {
        return itemCatalog.isCollectible(type);
    }

    constructor(
        game: ({ objects?: ObjectEntry[]; start?: { x: number; y: number; roomIndex: number } } & Record<string, unknown>) | null,
        worldManager: WorldManagerApi | null,
        variableManager: VariableManagerApi | null
    ) {
        this.game = game;
        this.worldManager = worldManager;
        this.variableManager = variableManager;
        this.ensurePlayerStartObject();
    }

    setGame(game: ({ objects?: ObjectEntry[]; start?: { x: number; y: number; roomIndex: number } } & Record<string, unknown>) | null) {
        this.game = game;
        this.ensurePlayerStartObject();
    }

    setWorldManager(worldManager: WorldManagerApi | null) {
        this.worldManager = worldManager;
    }

    setVariableManager(variableManager: VariableManagerApi | null) {
        this.variableManager = variableManager;
    }

    normalizeObjects(objects: unknown[] | null | undefined): ObjectEntry[] {
        if (!Array.isArray(objects)) return [];
        const OT = this.types;
        const allowedTypes = StateObjectManager.getPlaceableTypeSet();
        let playerStartIncluded = false;
        const playerEndRooms = new Set();
        return objects
            .map((object) => {
                const raw = object as RawObjectInput;
                const sourceType = typeof raw.type === 'string' ? raw.type : null;
                if (!sourceType || !allowedTypes.has(sourceType as ItemType)) return null;
                const type = sourceType as ItemType;
                if (!this.worldManager) return null;
                const roomIndex = this.worldManager.clampRoomIndex(raw.roomIndex ?? 0);
                if (type === StateObjectManager.PLAYER_START_TYPE) {
                    if (playerStartIncluded) return null;
                    playerStartIncluded = true;
                }
                if (type === StateObjectManager.PLAYER_END_TYPE) {
                    if (playerEndRooms.has(roomIndex)) return null;
                    playerEndRooms.add(roomIndex);
                }
                const x = this.worldManager.clampCoordinate(raw.x ?? 0);
                const y = this.worldManager.clampCoordinate(raw.y ?? 0);
                const rawId = raw.id;
                const id = typeof rawId === 'string' && rawId.trim()
                    ? rawId.trim()
                    : this.generateObjectId(type, roomIndex);
                const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
                const needsVariable = itemCatalog.requiresVariable(type);
                const normalizedVariable = needsVariable
                    ? (this.variableManager?.normalizeVariableId?.(raw.variableId) ?? fallbackVariableId)
                    : null;

                const base: ObjectEntry = {
                    id,
                    type,
                    roomIndex,
                    x,
                    y,
                    collected: StateObjectManager.isCollectibleType(type) ? Boolean(raw.collected) : false,
                    opened: type === OT.DOOR ? Boolean(raw.opened) : false,
                    variableId: normalizedVariable
                };
                if (type === StateObjectManager.SWITCH_TYPE) {
                    base.on = Boolean(raw.on);
                }
                if (type === StateObjectManager.PLAYER_END_TYPE) {
                    base.endingText = this.normalizePlayerEndText(raw.endingText);
                }
                return this.applyObjectBehavior(base);
            })
            .filter((entry): entry is ObjectEntry => Boolean(entry));
    }

    normalizePlayerEndText(value: unknown): string {
        if (typeof value !== 'string') return '';
        const normalized = value.replace(/\r\n/g, '\n');
        const sliced = normalized.slice(0, PLAYER_END_TEXT_LIMIT);
        return sliced.trim();
    }

    resetRuntime() {
        const objects = this.getObjects();
        objects.forEach((object) => {
            if (object.isCollectible) {
                object.collected = false;
            }
            const isLockedDoor = Boolean(object.isLockedDoor);
            if (isLockedDoor) {
                object.opened = false;
            }
            if (object.type === StateObjectManager.SWITCH_TYPE) {
                object.on = false;
            }
        });
        this.ensurePlayerStartObject();
    }

    generateObjectId(type: ItemType, roomIndex: number) {
        if (type === StateObjectManager.PLAYER_START_TYPE) {
            return StateObjectManager.PLAYER_START_TYPE;
        }
        return `${type}-${roomIndex}`;
    }

    getObjects(): ObjectEntry[] {
        if (!this.game) return [];
        if (!Array.isArray(this.game.objects)) {
            this.game.objects = [];
        }
        this.game.objects.forEach((object) => this.applyObjectBehavior(object as ObjectEntry));
        return this.game.objects as ObjectEntry[];
    }

    getObjectsForRoom(roomIndex: number | null | undefined): ObjectEntry[] {
        if (!this.worldManager) return [];
        const target = this.worldManager.clampRoomIndex(roomIndex ?? 0);
        return this.getObjects().filter((object) => object.roomIndex === target);
    }

    getObjectAt(roomIndex: number | null | undefined, x: number | null | undefined, y: number | null | undefined): ObjectEntry | null {
        if (!this.worldManager) return null;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex ?? 0);
        const cx = this.worldManager.clampCoordinate(x ?? 0);
        const cy = this.worldManager.clampCoordinate(y ?? 0);
        return this.getObjects().find((object) =>
            object.roomIndex === targetRoom &&
            object.x === cx &&
            object.y === cy
        ) || null;
    }

    setObjectPosition(type: ItemType, roomIndex: number, x: number, y: number): ObjectEntry | null {
        if (!this.worldManager) return null;
        const placeableTypes = StateObjectManager.getPlaceableTypeSet();
        const normalizedType = placeableTypes.has(type) ? type : null;
        if (!normalizedType) return null;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex);
        const cx = this.worldManager.clampCoordinate(x);
        const cy = this.worldManager.clampCoordinate(y);
        const objects = this.getObjects();
        let entry: ObjectEntry | null = null;
        if (normalizedType === StateObjectManager.PLAYER_START_TYPE) {
            entry = objects.find((object) => object.type === normalizedType) || null;
        } else {
            entry = objects.find((object) =>
                object.type === normalizedType && object.roomIndex === targetRoom
            ) || null;
        }
        if (!entry) {
            entry = {
                id: this.generateObjectId(normalizedType, targetRoom),
                type: normalizedType,
                roomIndex: targetRoom,
                x: cx,
                y: cy
            } as ObjectEntry;
            if (normalizedType === StateObjectManager.SWITCH_TYPE) {
                entry.on = false;
            }
            if (normalizedType === StateObjectManager.PLAYER_END_TYPE) {
                entry.endingText = '';
            }
            objects.push(entry);
        } else {
            entry.roomIndex = targetRoom;
            entry.x = cx;
            entry.y = cy;
        }
        if (StateObjectManager.isCollectibleType(normalizedType)) {
            entry.collected = false;
        }
        if (itemCatalog.isLockedDoor(normalizedType)) {
            entry.opened = false;
        }
        if (itemCatalog.isVariableDoor(normalizedType)) {
            const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
            entry.variableId = this.variableManager?.normalizeVariableId?.(entry.variableId) ?? fallbackVariableId;
        }
        if (normalizedType === StateObjectManager.PLAYER_START_TYPE) {
            this.syncPlayerStart(entry);
        }
        if (normalizedType === StateObjectManager.SWITCH_TYPE) {
            const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
            entry.variableId = this.variableManager?.normalizeVariableId?.(entry.variableId) ?? fallbackVariableId;
            entry.on = Boolean(entry.on);
        }
        if (normalizedType === StateObjectManager.PLAYER_END_TYPE) {
            entry.endingText = this.normalizePlayerEndText(entry.endingText);
        }
        return this.applyObjectBehavior(entry);
    }

    removeObject(type: ItemType, roomIndex: number) {
        const placeableTypes = StateObjectManager.getPlaceableTypeSet();
        const normalizedType = placeableTypes.has(type) ? type : null;
        if (!normalizedType || normalizedType === StateObjectManager.PLAYER_START_TYPE) return;
        if (!this.worldManager || !this.game) return;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex);
        this.game.objects = this.getObjects().filter((object) =>
            !(object.type === normalizedType && object.roomIndex === targetRoom)
        );
    }

    setObjectVariable(type: ItemType, roomIndex: number, variableId: string | null) {
        if (!this.worldManager) return null;
        const handledByDefinition = itemCatalog.requiresVariable(type);
        if (!handledByDefinition) return null;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex);
        const entry = this.getObjects().find((object) =>
            object.type === type &&
            object.roomIndex === targetRoom
        );
        if (!entry) return null;
        const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId);
        entry.variableId = normalized ?? fallbackVariableId;
        return entry.variableId;
    }

    syncSwitchState(variableId: string | null | undefined, value: unknown): boolean {
        if (!variableId) return false;
        let changed = false;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId) ?? null;
        if (!normalized) return false;
        const desired = Boolean(value);
        this.getObjects().forEach((object) => {
            if (object.type === StateObjectManager.SWITCH_TYPE && object.variableId === normalized) {
                if (object.on !== desired) {
                    object.on = desired;
                    changed = true;
                }
            }
        });
        return changed;
    }

    ensurePlayerStartObject(): ObjectEntry | null {
        if (!this.game || !this.worldManager) return null;
        const objects = this.getObjects();
        const start = this.game.start || { x: 1, y: 1, roomIndex: 0 };
        const roomIndex = this.worldManager.clampRoomIndex(start.roomIndex);
        const x = this.worldManager.clampCoordinate(start.x);
        const y = this.worldManager.clampCoordinate(start.y);
        let marker = objects.find((object) => object.type === StateObjectManager.PLAYER_START_TYPE) || null;
        if (!marker) {
            marker = {
                id: StateObjectManager.PLAYER_START_TYPE,
                type: StateObjectManager.PLAYER_START_TYPE,
                roomIndex,
                x,
                y
            } as ObjectEntry;
            objects.unshift(marker);
        } else {
            marker.roomIndex = roomIndex;
            marker.x = x;
            marker.y = y;
        }
        return this.applyObjectBehavior(marker);
    }

    getPlayerEndObject(roomIndex: number | null = null): ObjectEntry | null {
        const objects = this.getObjects();
        if (roomIndex === null) {
            return objects.find((object) => object.type === StateObjectManager.PLAYER_END_TYPE) || null;
        }
        if (!this.worldManager) return null;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex);
        return objects.find((object) =>
            object.type === StateObjectManager.PLAYER_END_TYPE && object.roomIndex === targetRoom
        ) || null;
    }

    getPlayerEndText(roomIndex: number | null = null): string {
        const entry = this.getPlayerEndObject(roomIndex);
        return typeof entry?.endingText === 'string' ? entry.endingText : '';
    }

    setPlayerEndText(roomIndex: number, text: string): string {
        const entry = this.getPlayerEndObject(roomIndex);
        if (!entry) return '';
        const normalized = this.normalizePlayerEndText(text);
        entry.endingText = normalized;
        return normalized;
    }

    syncPlayerStart(entry: ObjectEntry | null) {
        if (!entry || !this.worldManager || !this.game) return;
        const x = this.worldManager.clampCoordinate(entry.x);
        const y = this.worldManager.clampCoordinate(entry.y);
        const roomIndex = this.worldManager.clampRoomIndex(entry.roomIndex);
        this.game.start = { x, y, roomIndex };
        entry.x = x;
        entry.y = y;
        entry.roomIndex = roomIndex;
    }

    applyObjectBehavior(entry: ObjectEntry | null) {
        if (!entry) return entry;
        const type = entry.type as ItemType;
        const isCollectible = StateObjectManager.isCollectibleType(type);
        entry.isCollectible = isCollectible;
        entry.hideWhenCollected = itemCatalog.shouldHideWhenCollected(type);
        entry.hiddenInRuntime = itemCatalog.isHiddenInRuntime(type);
        entry.isLockedDoor = itemCatalog.isLockedDoor(type);
        entry.hideWhenOpened = itemCatalog.shouldHideWhenOpened(type);
        entry.isVariableDoor = itemCatalog.isVariableDoor(type);
        entry.hideWhenVariableOpen = itemCatalog.shouldHideWhenVariableOpen(type);
        entry.requiresVariable = itemCatalog.requiresVariable(type);
        entry.swordDurability = itemCatalog.getSwordDurability(type);
        return entry;
    }

    checkOpenedMagicDoor(variableId: string | null | undefined, value: unknown) {
        const OT = this.types;
        for (const object of this.getObjects()) {
            if (value && object.type === OT.DOOR_VARIABLE && object.variableId === variableId) {
                return true;
            }
        }
        return false;
    }
}

export type { ObjectEntry };
export { StateObjectManager };
