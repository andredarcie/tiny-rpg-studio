import type { TileMapLayer, TileId } from '../runtime/domain/definitions/tileTypes';
import type { ExitState, ItemInstance, RoomDefinition } from '../types/gameState';
import { NPCDefinitions } from '../runtime/domain/definitions/NPCDefinitions';
import { EnemyDefinitions } from '../runtime/domain/definitions/EnemyDefinitions';
import { StateEnemyManager } from '../runtime/domain/state/StateEnemyManager';
import { StateObjectManager } from '../runtime/domain/state/StateObjectManager';
import { itemCatalog } from '../runtime/domain/services/ItemCatalog';
import type { ItemType } from '../runtime/domain/constants/itemTypes';
import { validateBaseProject, validateTileLayer } from './validation';

import { ShareConstants } from '../runtime/infra/share/ShareConstants';
import { normalizeEnemyExperienceOverride } from '../runtime/domain/definitions/enemyExperience';
import { resolveVariableId, type VariableRef } from './variables';
import type {
    ChestItemType,
    EnemyType,
    LogicGateType,
    NpcType,
    SdkEnemy,
    SdkObject,
    SdkSprite,
    SwordTier,
} from './types';

const VALID_ENEMY_TYPES = EnemyDefinitions.definitions.map(entry => entry.type);
const VALID_NPC_TYPES = NPCDefinitions.definitions.map(entry => entry.type);

const VALID_CHEST_ITEMS: ChestItemType[] = [
    'key', 'life-potion', 'xp-scroll',
    'sword', 'sword-bronze', 'sword-wood',
    'armor', 'boots'
];

const GATE_TYPE_MAP: Record<LogicGateType, SdkObject['type']> = {
    not: 'logic-gate-not',
    and: 'logic-gate-and',
    or: 'logic-gate-or',
    nand: 'logic-gate-nand',
    nor: 'logic-gate-nor',
};

const MAX_ENEMIES_PER_ROOM = StateEnemyManager.MAX_ENEMIES_PER_ROOM;

function validateCoord(axis: 'x' | 'y', value: number): void {
    const max = ShareConstants.MATRIX_SIZE - 1;
    if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new Error(`${axis} must be between 0 and ${max}, got ${value}`);
    }
}

export type NpcOptions = {
    name?: string;
    disappearAfterDialog?: boolean;
    type: NpcType;
    x: number;
    y: number;
    text?: string;
    /** Variable that, when ON, switches the NPC to its conditional dialog. */
    conditionVariable?: VariableRef | number | 'skill:bard';
    /** Dialog shown while `conditionVariable` is ON. */
    conditionText?: string;
    /** Variable set ON after the player reads the NPC. */
    rewardVariable?: VariableRef | number | 'END_GAME';
    /** Variable set ON instead when the conditional dialog is shown. */
    conditionalRewardVariable?: VariableRef | number | 'END_GAME';
    /** Optional definitive Yes/No choice shown after the normal dialog. */
    choice?: {
        prompt: string;
        yesText: string;
        noText: string;
        /** Variable set ON when the player answers Yes. */
        yesVariable?: VariableRef | number | 'END_GAME';
        /** Variable set ON when the player answers No. */
        noVariable?: VariableRef | number | 'END_GAME';
    };
};

export type EnemyOptions = {
    type: EnemyType;
    x: number;
    y: number;
    /** Variable set ON when this enemy is defeated. */
    defeatVariable?: VariableRef | number;
    /** XP awarded when this enemy is defeated. Defaults to the enemy type's reward. */
    experience?: number;
};

class RoomBuilder {
    private readonly roomIndex: number;
    private readonly validateEntities: (entities: { sprites: SdkSprite[]; enemies: SdkEnemy[]; objects: SdkObject[] }) => void;
    private sequence = 0;

    private nextId(kind: 'object' | 'enemy'): string {
        const entries = kind === 'object' ? this._objects : this._enemies;
        let id: string;
        do { id = `sdk-${kind}-${this.roomIndex}-${this.sequence++}`; } while (entries.some(entry => entry.id === id));
        return id;
    }

    constructor(roomIndex = 0, validateEntities: (entities: { sprites: SdkSprite[]; enemies: SdkEnemy[]; objects: SdkObject[] }) => void = () => {}) {
        this.roomIndex = roomIndex; this.validateEntities = validateEntities;
    }

    private checkEntities(sprites = this._sprites, enemies = this._enemies, objects = this._objects): void {
        const entities = {
            sprites: sprites.map(entry => ({ ...entry, roomIndex: this.roomIndex })),
            enemies: enemies.map(entry => ({ ...entry, roomIndex: this.roomIndex })),
            objects: objects.map(entry => ({ ...entry, roomIndex: this.roomIndex })),
        };
        validateBaseProject(entities); this.validateEntities(entities);
    }

    private pushObject(object: SdkObject): void {
        try {
            this.checkEntities(this._sprites, this._enemies, [...this._objects, object]);
            this._objects.push({ ...object, id: this.nextId('object') } as SdkObject);
        } finally { this.rebuildReservations(); }
    }
    private resolveVariableId(ref: VariableRef | number | 'END_GAME' | 'skill:bard'): string { return ref === 'END_GAME' || ref === 'skill:bard' ? ref : resolveVariableId(ref); }
    private _ground?: TileMapLayer;
    private _overlay?: TileMapLayer;
    private _enemies: SdkEnemy[] = [];
    private _sprites: SdkSprite[] = [];
    private _objects: SdkObject[] = [];
    private _objectTypes = new Set<string>();
    private _items: Omit<ItemInstance, 'collected'>[] = [];
    private _exits: ExitState[] = [];
    private _room?: RoomDefinition;

    setCell(layer: 'ground' | 'overlay', x: number, y: number, tileId: TileId | null): this {
        validateCoord('x', x); validateCoord('y', y);
        if (!['ground', 'overlay'].includes(layer)) throw Error('Invalid tile layer');
        const matrix: TileMapLayer = structuredClone((layer === 'ground' ? this._ground : this._overlay) ?? Array.from({ length: 8 }, () => Array<TileId | null>(8).fill(null)));
        matrix[y][x] = tileId;
        return this[layer](matrix);
    }

    setLayout(room: RoomDefinition): this {
        if (room.size !== 8 || [room.tiles, room.walls].some(matrix => matrix.length !== 8 || matrix.some(row => row.length !== 8))) throw Error('Room must be 8x8');
        this._room = structuredClone(room); return this;
    }

    addItem(item: Omit<ItemInstance, 'roomIndex' | 'collected'>): this {
        validateCoord('x', item.x); validateCoord('y', item.y);
        this._items.push({ ...item, roomIndex: 0 }); return this;
    }

    addExit(exit: Omit<ExitState, 'roomIndex'>): this {
        validateCoord('x', exit.x); validateCoord('y', exit.y);
        validateCoord('x', exit.targetX); validateCoord('y', exit.targetY);
        if (!Number.isInteger(exit.targetRoomIndex) || exit.targetRoomIndex < 0 || exit.targetRoomIndex > 8) throw Error('Invalid exit room');
        this._exits.push({ ...exit, roomIndex: 0 }); return this;
    }

    removeEntity(kind: 'sprites' | 'enemies' | 'objects', id: string): this {
        if (kind === 'sprites') this._sprites = this._sprites.filter(entry => entry.id !== id);
        else if (kind === 'enemies') this._enemies = this._enemies.filter(entry => entry.id !== id);
        else this._objects = this._objects.filter(entry => Reflect.get(entry, 'id') !== id);
        this.rebuildReservations(); return this;
    }

    updateEntity(kind: 'sprites' | 'enemies' | 'objects', id: string, changes: Partial<SdkSprite> | Partial<SdkEnemy> | Partial<SdkObject>): this {
        const update = <T extends { id?: string }>(entries: T[]) => entries.map(entry => entry.id === id ? { ...entry, ...structuredClone(changes), id } as T : entry);
        const sprites = kind === 'sprites' ? update(this._sprites) : this._sprites;
        const enemies = kind === 'enemies' ? update(this._enemies) : this._enemies;
        const objects = kind === 'objects' ? update(this._objects) : this._objects;
        this.checkEntities(sprites, enemies, objects);
        this._sprites = sprites; this._enemies = enemies; this._objects = objects;
        this.rebuildReservations(); return this;
    }

    removeItem(x: number, y: number): this { this._items = this._items.filter(entry => entry.x !== x || entry.y !== y); return this; }
    removeExit(x: number, y: number): this { this._exits = this._exits.filter(entry => entry.x !== x || entry.y !== y); return this; }
    clearItems(): this { this._items = []; return this; }
    clearExits(): this { this._exits = []; return this; }

    private rebuildReservations(): void {
        this._objectTypes = new Set(this._objects.map(entry => entry.type));
    }

    _load(data: { sprites: SdkSprite[]; enemies: SdkEnemy[]; objects: SdkObject[]; items: Omit<ItemInstance, 'collected'>[]; exits: ExitState[] }, map: { ground?: TileMapLayer; overlay?: TileMapLayer }, room?: RoomDefinition): void {
        this._sprites = structuredClone(data.sprites); this._enemies = structuredClone(data.enemies); this._objects = structuredClone(data.objects);
        for (const sprite of this._sprites) sprite.id ??= `npc-${sprite.type}`;
        for (const enemy of this._enemies) enemy.id ??= this.nextId('enemy');
        for (const object of this._objects) object.id ??= this.nextId('object');
        this._items = structuredClone(data.items); this._exits = structuredClone(data.exits);
        if (map.ground) this.ground(map.ground); if (map.overlay) this.overlay(map.overlay); if (room) this.setLayout(room);
        this.rebuildReservations();
    }

    _getAdditional(roomIndex: number) {
        return { items: this._items.map(entry => ({ ...entry, roomIndex })), exits: this._exits.map(entry => ({ ...entry, roomIndex })), room: this._room ? structuredClone(this._room) : undefined };
    }

    ground(matrix: TileMapLayer): this {
        const size = ShareConstants.MATRIX_SIZE;
        if (!Array.isArray(matrix) || matrix.length !== size || matrix.some(row => !Array.isArray(row) || row.length !== size)) {
            throw new Error(`Ground matrix must be ${size}x${size}`);
        }
        validateTileLayer(matrix);
        this._ground = structuredClone(matrix);
        return this;
    }

    overlay(matrix: TileMapLayer): this {
        const size = ShareConstants.MATRIX_SIZE;
        if (!Array.isArray(matrix) || matrix.length !== size || matrix.some(row => !Array.isArray(row) || row.length !== size)) {
            throw new Error(`Overlay matrix must be ${size}x${size}`);
        }
        validateTileLayer(matrix);
        this._overlay = structuredClone(matrix);
        return this;
    }

    addEnemy(opts: EnemyOptions): this {
        if (!VALID_ENEMY_TYPES.includes(opts.type)) {
            throw new Error(`Unknown enemy type '${opts.type}'. Valid types: ${VALID_ENEMY_TYPES.join(', ')}`);
        }
        validateCoord('x', opts.x);
        validateCoord('y', opts.y);
        if (this._enemies.length >= MAX_ENEMIES_PER_ROOM) {
            throw new Error(`Room already has ${MAX_ENEMIES_PER_ROOM} enemies (maximum)`);
        }
        const enemy: SdkEnemy = { type: opts.type, x: opts.x, y: opts.y, roomIndex: 0 };
        if (opts.experience !== undefined) {
            if (!Number.isSafeInteger(opts.experience) || opts.experience < 0) {
                throw new Error(`experience must be a safe non-negative integer, got ${opts.experience}`);
            }
            const normalizedExperience = normalizeEnemyExperienceOverride(opts.type, opts.experience);
            if (normalizedExperience !== undefined) enemy.experience = normalizedExperience;
        }
        if (opts.defeatVariable !== undefined) {
            enemy.defeatVariableId = this.resolveVariableId(opts.defeatVariable);
        }
        this.checkEntities(this._sprites, [...this._enemies, enemy]);
        enemy.id = this.nextId('enemy');
        this._enemies.push(enemy);
        return this;
    }

    addNPC(opts: NpcOptions): this {
        if (!VALID_NPC_TYPES.includes(opts.type)) {
            throw new Error(`Unknown NPC type '${opts.type}'. Valid types: ${VALID_NPC_TYPES.join(', ')}`);
        }
        validateCoord('x', opts.x);
        validateCoord('y', opts.y);
        const sprite: SdkSprite = {
            type: opts.type, x: opts.x, y: opts.y, roomIndex: 0,
            text: opts.text ?? '', placed: true, name: opts.name, disappearAfterDialog: opts.disappearAfterDialog, id: `npc-${opts.type}`,
        };
        if (opts.conditionVariable !== undefined) {
            sprite.conditionVariableId = this.resolveVariableId(opts.conditionVariable);
        }
        if (opts.conditionText !== undefined) {
            sprite.conditionText = opts.conditionText;
        }
        if (opts.rewardVariable !== undefined) {
            sprite.rewardVariableId = this.resolveVariableId(opts.rewardVariable);
        }
        if (opts.conditionalRewardVariable !== undefined) {
            sprite.conditionalRewardVariableId = this.resolveVariableId(opts.conditionalRewardVariable);
        }
        if (opts.choice !== undefined) {
            sprite.choiceEnabled = true;
            sprite.choicePrompt = opts.choice.prompt;
            sprite.choiceYesText = opts.choice.yesText;
            sprite.choiceNoText = opts.choice.noText;
            if (opts.choice.yesVariable !== undefined) {
                sprite.choiceYesVariableId = this.resolveVariableId(opts.choice.yesVariable);
            }
            if (opts.choice.noVariable !== undefined) {
                sprite.choiceNoVariableId = this.resolveVariableId(opts.choice.noVariable);
            }
        }
        this.checkEntities([...this._sprites, sprite]);
        this._sprites.push(sprite);
        return this;
    }

    // ---- Collectibles & equipment (unique per room) ----

    addKey(pos: { x: number; y: number }): this {
        return this._addUniqueObject('key', pos.x, pos.y);
    }

    addDoor(pos: { x: number; y: number }): this {
        return this._addUniqueObject('door', pos.x, pos.y);
    }

    addPotion(pos: { x: number; y: number }): this {
        return this._addUniqueObject('life-potion', pos.x, pos.y);
    }

    addXpScroll(pos: { x: number; y: number; experience?: number }): this {
        if (pos.experience !== undefined && (!Number.isSafeInteger(pos.experience) || pos.experience < 0)) throw Error('Invalid XP scroll experience');
        this._addMultiObject('xp-scroll', pos.x, pos.y);
        Object.assign(this._objects[this._objects.length - 1], { experience: pos.experience });
        return this;
    }

    addSword(opts: { x: number; y: number; tier?: SwordTier }): this {
        const tier = opts.tier ?? 'iron';
        const type = tier === 'iron' ? 'sword' : tier === 'bronze' ? 'sword-bronze' : 'sword-wood';
        return this._addUniqueObject(type, opts.x, opts.y);
    }

    // ---- Equipment (multiple per room) ----

    addArmor(pos: { x: number; y: number }): this {
        return this._addMultiObject('armor', pos.x, pos.y);
    }

    addBoots(pos: { x: number; y: number }): this {
        return this._addMultiObject('boots', pos.x, pos.y);
    }

    addPushBox(pos: { x: number; y: number }): this {
        return this._addMultiObject('push-box', pos.x, pos.y);
    }

    // ---- Logic & variable-driven objects ----

    /** Lever the player toggles by stepping on it; flips `variable`. */
    addSwitch(opts: { x: number; y: number; variable: VariableRef | number; on?: boolean }): this {
        this.resolveVariableId(opts.variable);
        this._reserveTile('switch', opts.x, opts.y);
        this.pushObject({
            type: 'switch', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: this.resolveVariableId(opts.variable), on: opts.on ?? false,
        });
        return this;
    }

    /** Door that stays locked until `variable` is ON. One per room. */
    addVariableDoor(opts: { x: number; y: number; variable: VariableRef | number }): this {
        if (this._objectTypes.has('door-variable')) {
            throw new Error(`Room already has a 'door-variable'`);
        }
        this.resolveVariableId(opts.variable);
        this._reserveTile('door-variable', opts.x, opts.y);
        this._objectTypes.add('door-variable');
        this.pushObject({
            type: 'door-variable', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: this.resolveVariableId(opts.variable),
        });
        return this;
    }

    /** Indicator lamp that lights up while `variable` is ON. */
    addLed(opts: { x: number; y: number; variable: VariableRef | number }): this {
        this.resolveVariableId(opts.variable);
        this._reserveTile('logic-led', opts.x, opts.y);
        this.pushObject({
            type: 'logic-led', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: this.resolveVariableId(opts.variable),
        });
        return this;
    }

    /**
     * Active while its optional `variable` is OFF. Damage traps hurt the player;
     * solid traps block passage instead.
     */
    addTrap(opts: { x: number; y: number; variable?: VariableRef | number; solid?: boolean }): this {
        if (opts.variable !== undefined) this.resolveVariableId(opts.variable);
        this._reserveTile('trap', opts.x, opts.y);
        this.pushObject({
            type: 'trap', x: opts.x, y: opts.y, roomIndex: 0,
            ...(opts.variable !== undefined ? { variableId: this.resolveVariableId(opts.variable) } : {}),
            ...(opts.solid === true ? { solid: true } : {}),
        });
        return this;
    }

    /** Floor plate that holds `variable` ON while a player or push-box rests on it. */
    addPressurePlate(opts: { x: number; y: number; variable: VariableRef | number }): this {
        this.resolveVariableId(opts.variable);
        this._reserveTile('pressure-plate', opts.x, opts.y);
        this.pushObject({
            type: 'pressure-plate', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: this.resolveVariableId(opts.variable),
        });
        return this;
    }

    /**
     * Logic gate that writes `output = gate(inputA, inputB)` every time an input
     * changes. `NOT` uses only `inputA`. Set `hidden` to hide the gate in-game
     * (still active) while keeping it visible in the editor.
     */
    addLogicGate(opts: {
        type: LogicGateType;
        x: number;
        y: number;
        inputA: VariableRef | number;
        inputB?: VariableRef | number;
        output: VariableRef | number;
        hidden?: boolean;
    }): this {
        const mapped = GATE_TYPE_MAP[opts.type] as SdkObject['type'] | undefined;
        if (!mapped) {
            throw new Error(`Unknown logic gate type '${opts.type}'. Valid: ${Object.keys(GATE_TYPE_MAP).join(', ')}`);
        }
        [opts.inputA, opts.inputB, opts.output].forEach(ref => { if (ref !== undefined) this.resolveVariableId(ref); });
        this._reserveTile(mapped, opts.x, opts.y);
        this.pushObject({
            type: mapped as Extract<SdkObject, { type: `logic-gate-${string}` }>['type'],
            x: opts.x, y: opts.y, roomIndex: 0,
            inputVariableId: this.resolveVariableId(opts.inputA),
            inputVariableId2: opts.inputB !== undefined ? this.resolveVariableId(opts.inputB) : undefined,
            outputVariableId: this.resolveVariableId(opts.output),
            hiddenInGame: opts.hidden ? true : undefined,
        });
        return this;
    }

    /** Chest revealing a fixed item, or a random one when `random` is set. */
    addChest(opts: { x: number; y: number; contains?: ChestItemType; random?: boolean; variable?: VariableRef | number }): this {
        if (opts.contains !== undefined && !VALID_CHEST_ITEMS.includes(opts.contains)) {
            throw new Error(`Unknown chest item '${opts.contains}'. Valid: ${VALID_CHEST_ITEMS.join(', ')}`);
        }
        if (!opts.random && opts.contains === undefined) {
            throw new Error(`addChest requires either 'contains' or 'random: true'`);
        }
        if (opts.variable !== undefined) this.resolveVariableId(opts.variable);
        this._reserveTile('chest', opts.x, opts.y);
        this.pushObject({
            type: 'chest', x: opts.x, y: opts.y, roomIndex: 0,
            containsItemType: opts.contains ?? null,
            randomItem: Boolean(opts.random),
            ...(opts.variable !== undefined ? { variableId: this.resolveVariableId(opts.variable) } : {}),
        });
        return this;
    }

    // ---- Goal ----

    addEnd(opts: { x: number; y: number; message?: string }): this {
        validateCoord('x', opts.x);
        validateCoord('y', opts.y);
        if (this._objectTypes.has('player-end')) {
            throw new Error(`Room already has a 'player-end'`);
        }
        this._reserveTile('player-end', opts.x, opts.y);
        this._objectTypes.add('player-end');
        this.pushObject({ type: 'player-end', x: opts.x, y: opts.y, roomIndex: 0, endingText: opts.message });
        return this;
    }

    private _addUniqueObject(type: string, x: number, y: number): this {
        if (this._objectTypes.has(type)) {
            throw new Error(`Room already has a '${type}'`);
        }
        this._reserveTile(type, x, y);
        this._objectTypes.add(type);
        this.pushObject({ type, x, y, roomIndex: 0 } as SdkObject);
        return this;
    }

    private _addMultiObject(type: string, x: number, y: number): this {
        this._reserveTile(type, x, y);
        this.pushObject({ type, x, y, roomIndex: 0 } as SdkObject);
        return this;
    }

    /** Matches the engine's per-type object limits. */
    private _reserveTile(type: string, x: number, y: number): void {
        validateCoord('x', x);
        validateCoord('y', y);
        const count = this._objects.filter(entry => entry.type === type).length;
        const limit = itemCatalog.allowsMultiplePerRoom(type as ItemType) ? StateObjectManager.MULTI_INSTANCE_LIMIT : 1;
        if (count >= limit) throw Error(`Room already has the maximum number of '${type}' objects`);

    }

    _getTileData(): { ground?: TileMapLayer; overlay?: TileMapLayer } {
        const result: { ground?: TileMapLayer; overlay?: TileMapLayer } = {};
        if (this._ground) result.ground = structuredClone(this._ground);
        if (this._overlay) result.overlay = structuredClone(this._overlay);
        return result;
    }

    _getEntities(roomIndex: number): { enemies: SdkEnemy[]; sprites: SdkSprite[]; objects: SdkObject[] } {
        return {
            enemies: this._enemies.map(e => ({ ...e, roomIndex })),
            sprites: this._sprites.map(s => ({ ...s, roomIndex })),
            objects: this._objects.map(o => ({ ...o, roomIndex })) as SdkObject[]
        };
    }
}

export { RoomBuilder };
