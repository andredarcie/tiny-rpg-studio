
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
    inputVariableId?: string | null;
    inputVariableId2?: string | null;
    outputVariableId?: string | null;
    hiddenInGame?: boolean;
    containsItemType?: string | null;
    randomItem?: boolean;
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
    inputVariableId?: string | null;
    inputVariableId2?: string | null;
    outputVariableId?: string | null;
    isLogicGate?: boolean;
    isSingleInputGate?: boolean;
    isLed?: boolean;
    hiddenInGame?: boolean;
    containsItemType?: string | null;
    randomItem?: boolean;
    activated?: boolean;
    originalX?: number;
    originalY?: number;
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

    static get MULTI_INSTANCE_LIMIT() {
        return 4;
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
        const normalized = objects
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
                // Multi-instance types always use a positional id (collision-free per tile).
                // Single-instance types preserve the raw id when present.
                const id = itemCatalog.allowsMultiplePerRoom(type)
                    ? this.generateObjectId(type, roomIndex, x, y)
                    : (typeof rawId === 'string' && rawId.trim()
                        ? rawId.trim()
                        : this.generateObjectId(type, roomIndex));
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
                    opened: (type === OT.DOOR || type === OT.CHEST) ? Boolean(raw.opened) : false,
                    variableId: normalizedVariable
                };
                if (type === OT.PUSH_BOX) {
                    base.originalX = x;
                    base.originalY = y;
                }
                if (type === OT.CHEST) {
                    const rawContains = raw.containsItemType;
                    base.containsItemType = typeof rawContains === 'string' && rawContains ? rawContains : null;
                    base.randomItem = Boolean(raw.randomItem);
                }
                if (type === StateObjectManager.SWITCH_TYPE) {
                    base.on = Boolean(raw.on);
                }
                if (type === StateObjectManager.PLAYER_END_TYPE) {
                    base.endingText = this.normalizePlayerEndText(raw.endingText);
                }
                if (itemCatalog.isLogicGate(type)) {
                    base.inputVariableId = this.variableManager?.normalizeVariableId?.(raw.inputVariableId ?? null) ?? null;
                    base.inputVariableId2 = this.variableManager?.normalizeVariableId?.(raw.inputVariableId2 ?? null) ?? null;
                    base.outputVariableId = this.variableManager?.normalizeVariableId?.(raw.outputVariableId ?? null) ?? null;
                    base.hiddenInGame = Boolean(raw.hiddenInGame);
                }
                return this.applyObjectBehavior(base);
            })
            .filter((entry): entry is ObjectEntry => Boolean(entry));

        // De-dup tile + cap per type+room for multi-instance objects (discard stacked/over-limit)
        const seenTiles = new Set<string>();
        const perTypeRoomCount = new Map<string, number>();
        const result: ObjectEntry[] = [];
        for (const entry of normalized) {
            if (itemCatalog.allowsMultiplePerRoom(entry.type)) {
                const tileKey = `${entry.type}:${entry.roomIndex}:${entry.x}:${entry.y}`;
                if (seenTiles.has(tileKey)) continue;
                const countKey = `${entry.type}:${entry.roomIndex}`;
                const count = perTypeRoomCount.get(countKey) ?? 0;
                if (count >= StateObjectManager.MULTI_INSTANCE_LIMIT) continue;
                seenTiles.add(tileKey);
                perTypeRoomCount.set(countKey, count + 1);
            }
            result.push(entry);
        }

        // First-wins: discard duplicate logic gate outputs to keep evaluation deterministic
        const usedOutputs = new Set<string>();
        for (const entry of result) {
            if (entry.isLogicGate && entry.outputVariableId) {
                if (usedOutputs.has(entry.outputVariableId)) {
                    entry.outputVariableId = null;
                } else {
                    usedOutputs.add(entry.outputVariableId);
                }
            }
        }
        return result;
    }

    normalizePlayerEndText(value: unknown): string {
        if (typeof value !== 'string') return '';
        const normalized = value.replace(/\r\n/g, '\n');
        const sliced = normalized.slice(0, PLAYER_END_TEXT_LIMIT);
        return sliced.trim();
    }

    resetRuntime() {
        const objects = this.getObjects();
        const OT = this.types;
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
            if (object.type === OT.CHEST) {
                object.opened = false;
            }
            if (object.type === OT.PRESSURE_PLATE) {
                object.activated = false;
            }
            if (object.type === OT.PUSH_BOX && typeof object.originalX === 'number' && typeof object.originalY === 'number') {
                object.x = object.originalX;
                object.y = object.originalY;
            }
        });
        this.ensurePlayerStartObject();
    }

    resetPushBoxesForRoom(roomIndex: number): void {
        const OT = this.types;
        const target = this.worldManager?.clampRoomIndex(roomIndex) ?? roomIndex;
        this.getObjects().forEach((object) => {
            if (
                object.type === OT.PUSH_BOX &&
                object.roomIndex === target &&
                typeof object.originalX === 'number' &&
                typeof object.originalY === 'number'
            ) {
                object.x = object.originalX;
                object.y = object.originalY;
            }
        });
    }

    generateObjectId(type: ItemType, roomIndex: number, x?: number, y?: number) {
        if (type === StateObjectManager.PLAYER_START_TYPE) {
            return StateObjectManager.PLAYER_START_TYPE;
        }
        if (itemCatalog.allowsMultiplePerRoom(type) && typeof x === 'number' && typeof y === 'number') {
            return `${type}-${roomIndex}-${x}-${y}`;
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
        const matches = this.getObjects().filter((object) =>
            object.roomIndex === targetRoom &&
            object.x === cx &&
            object.y === cy
        );
        // Push-box takes priority over passive floor objects (e.g. pressure plate underneath)
        return matches.find((o) => o.type === ITEM_TYPES.PUSH_BOX) || matches[0] || null;
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
        const multi = itemCatalog.allowsMultiplePerRoom(normalizedType);
        let entry: ObjectEntry | null = null;
        if (normalizedType === StateObjectManager.PLAYER_START_TYPE) {
            entry = objects.find((object) => object.type === normalizedType) || null;
        } else if (multi) {
            // Reuse if an instance already sits on this exact tile (idempotent re-place)
            entry = objects.find((object) =>
                object.type === normalizedType && object.roomIndex === targetRoom &&
                object.x === cx && object.y === cy
            ) || null;
            if (!entry) {
                const count = objects.filter((object) =>
                    object.type === normalizedType && object.roomIndex === targetRoom
                ).length;
                if (count >= StateObjectManager.MULTI_INSTANCE_LIMIT) return null;
                // Note: same-type/same-tile is handled by the reuse branch above; cross-type
                // stacking stays allowed (legacy behavior). Positional ids include the type,
                // so they remain unique.
            }
        } else {
            entry = objects.find((object) =>
                object.type === normalizedType && object.roomIndex === targetRoom
            ) || null;
        }
        if (!entry) {
            entry = {
                id: this.generateObjectId(normalizedType, targetRoom, cx, cy),
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
        if (itemCatalog.isLogicGate(normalizedType)) {
            entry.inputVariableId = entry.inputVariableId ?? null;
            entry.inputVariableId2 = entry.inputVariableId2 ?? null;
            entry.outputVariableId = entry.outputVariableId ?? null;
        }
        if (itemCatalog.isLed(normalizedType)) {
            const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
            entry.variableId = this.variableManager?.normalizeVariableId?.(entry.variableId) ?? fallbackVariableId;
        }
        if (normalizedType === ITEM_TYPES.CHEST) {
            entry.opened = false;
            if (entry.randomItem === undefined) {
                entry.randomItem = true;
            }
        }
        if (normalizedType === ITEM_TYPES.TRAP) {
            const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
            entry.variableId = this.variableManager?.normalizeVariableId?.(entry.variableId) ?? fallbackVariableId;
        }
        if (normalizedType === ITEM_TYPES.PRESSURE_PLATE) {
            const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
            entry.variableId = this.variableManager?.normalizeVariableId?.(entry.variableId) ?? fallbackVariableId;
            entry.activated = false;
        }
        if (normalizedType === ITEM_TYPES.PUSH_BOX) {
            entry.originalX = entry.x;
            entry.originalY = entry.y;
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

    moveObjectById(id: string, x: number, y: number): boolean {
        if (!this.worldManager) return false;
        const entry = this.getObjects().find((object) => object.id === id);
        if (!entry) return false;
        entry.x = this.worldManager.clampCoordinate(x);
        entry.y = this.worldManager.clampCoordinate(y);
        if (entry.type === StateObjectManager.PLAYER_START_TYPE) {
            this.syncPlayerStart(entry);
        }
        if (entry.type === ITEM_TYPES.PUSH_BOX) {
            entry.originalX = entry.x;
            entry.originalY = entry.y;
        }
        return true;
    }

    removeObjectById(id: string) {
        if (!this.game) return;
        if (id === StateObjectManager.PLAYER_START_TYPE) return; // player-start is protected
        this.game.objects = this.getObjects().filter((object) => object.id !== id);
    }

    setObjectVariableById(id: string, variableId: string | null): string | null {
        const entry = this.getObjects().find((object) => object.id === id);
        if (!entry || !itemCatalog.requiresVariable(entry.type)) return null;
        const fallbackVariableId = this.variableManager?.getFirstVariableId?.() ?? null;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId);
        entry.variableId = normalized ?? fallbackVariableId;
        return entry.variableId;
    }

    setObjectContainsItemById(id: string, containsItemType: string | null): void {
        const entry = this.getObjects().find((object) => object.id === id);
        if (!entry) return;
        entry.containsItemType = containsItemType || null;
    }

    setObjectRandomItemById(id: string, randomItem: boolean): void {
        const entry = this.getObjects().find((object) => object.id === id);
        if (!entry) return;
        entry.randomItem = randomItem;
    }

    getAllObjects(): ObjectEntry[] {
        return this.getObjects();
    }

    setGateInputVariableById(id: string, variableId: string | null, slot: 1 | 2): string | null {
        const entry = this.getObjects().find((object) => object.id === id);
        if (!entry || !entry.isLogicGate) return null;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId) ?? null;
        if (slot === 1) {
            entry.inputVariableId = normalized;
        } else {
            entry.inputVariableId2 = normalized;
        }
        return normalized;
    }

    setGateOutputVariableById(id: string, variableId: string | null): string | null {
        const objects = this.getObjects();
        const entry = objects.find((object) => object.id === id);
        if (!entry || !entry.isLogicGate) return null;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId) ?? null;
        if (normalized && objects.some((obj) =>
            obj.isLogicGate && obj !== entry && obj.outputVariableId === normalized
        )) {
            return entry.outputVariableId ?? null;
        }
        entry.outputVariableId = normalized;
        return normalized;
    }

    setObjectHiddenInGameById(id: string, hidden: boolean): boolean {
        const entry = this.getObjects().find((object) => object.id === id);
        if (!entry) return false;
        entry.hiddenInGame = Boolean(hidden);
        return entry.hiddenInGame;
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

    isLogicGateOutput(variableId: string | null): boolean {
        if (!variableId) return false;
        return this.getObjects().some(
            (obj) => obj.isLogicGate && obj.outputVariableId === variableId
        );
    }

    setGateInputVariable(type: ItemType, roomIndex: number, variableId: string | null, slot: 1 | 2): string | null {
        if (!this.worldManager) return null;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex);
        const entry = this.getObjects().find((obj) => obj.type === type && obj.roomIndex === targetRoom);
        if (!entry || !entry.isLogicGate) return null;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId) ?? null;
        if (slot === 1) {
            entry.inputVariableId = normalized;
        } else {
            entry.inputVariableId2 = normalized;
        }
        return normalized;
    }

    setGateOutputVariable(type: ItemType, roomIndex: number, variableId: string | null): string | null {
        if (!this.worldManager) return null;
        const targetRoom = this.worldManager.clampRoomIndex(roomIndex);
        const objects = this.getObjects();
        const entry = objects.find((obj) => obj.type === type && obj.roomIndex === targetRoom);
        if (!entry || !entry.isLogicGate) return null;
        const normalized = this.variableManager?.normalizeVariableId?.(variableId) ?? null;
        // Reject an output already used by another gate (consistent with first-wins rule)
        if (normalized && objects.some((obj) =>
            obj.isLogicGate && obj !== entry && obj.outputVariableId === normalized
        )) {
            return entry.outputVariableId ?? null;
        }
        entry.outputVariableId = normalized;
        return normalized;
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
        entry.isLogicGate = itemCatalog.isLogicGate(type);
        entry.isSingleInputGate = itemCatalog.isSingleInputGate(type);
        entry.isLed = itemCatalog.isLed(type);
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
