
import { ShareConstants } from '../runtime/infra/share/ShareConstants';
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

const VALID_ENEMY_TYPES: EnemyType[] = [
    'giant-rat', 'bandit', 'skeleton', 'dark-knight',
    'necromancer', 'dragon', 'fallen-king', 'ancient-demon'
];

const VALID_NPC_TYPES: NpcType[] = [
    'old-mage', 'villager-man', 'villager-woman', 'child',
    'king', 'knight', 'thief', 'blacksmith',
    'old-mage-elf', 'villager-man-elf', 'villager-woman-elf', 'child-elf',
    'king-elf', 'knight-elf', 'thief-elf', 'blacksmith-elf',
    'old-mage-dwarf', 'villager-man-dwarf', 'villager-woman-dwarf', 'child-dwarf',
    'king-dwarf', 'knight-dwarf', 'thief-dwarf', 'blacksmith-dwarf',
    'thought-bubble', 'wooden-sign'
];

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

const MAX_ENEMIES_PER_ROOM = 9;

function validateCoord(axis: 'x' | 'y', value: number): void {
    const max = ShareConstants.MATRIX_SIZE - 1;
    if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new Error(`${axis} must be between 0 and ${max}, got ${value}`);
    }
}

type NpcOptions = {
    type: NpcType;
    x: number;
    y: number;
    text?: string;
    /** Variable that, when ON, switches the NPC to its conditional dialog. */
    conditionVariable?: VariableRef | number;
    /** Dialog shown while `conditionVariable` is ON. */
    conditionText?: string;
    /** Variable set ON after the player reads the NPC. */
    rewardVariable?: VariableRef | number;
    /** Variable set ON instead when the conditional dialog is shown. */
    conditionalRewardVariable?: VariableRef | number;
    /** Optional definitive Yes/No choice shown after the normal dialog. */
    choice?: {
        prompt: string;
        yesText: string;
        noText: string;
        /** Variable set ON when the player answers Yes. */
        yesVariable?: VariableRef | number;
        /** Variable set ON when the player answers No. */
        noVariable?: VariableRef | number;
    };
};

type EnemyOptions = {
    type: EnemyType;
    x: number;
    y: number;
    /** Variable set ON when this enemy is defeated. */
    defeatVariable?: VariableRef | number;
};

class RoomBuilder {
    private _ground?: number[][];
    private _overlay?: (number | null)[][];
    private _enemies: SdkEnemy[] = [];
    private _sprites: SdkSprite[] = [];
    private _objects: SdkObject[] = [];
    private _objectTypes = new Set<string>();
    private _objectTiles = new Set<string>();

    ground(matrix: number[][]): this {
        const size = ShareConstants.MATRIX_SIZE;
        if (!Array.isArray(matrix) || matrix.length !== size || matrix.some(row => !Array.isArray(row) || row.length !== size)) {
            throw new Error(`Ground matrix must be ${size}x${size}`);
        }
        this._ground = matrix;
        return this;
    }

    overlay(matrix: (number | null)[][]): this {
        const size = ShareConstants.MATRIX_SIZE;
        if (!Array.isArray(matrix) || matrix.length !== size || matrix.some(row => !Array.isArray(row) || row.length !== size)) {
            throw new Error(`Overlay matrix must be ${size}x${size}`);
        }
        this._overlay = matrix;
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
        if (opts.defeatVariable !== undefined) {
            enemy.defeatVariableId = resolveVariableId(opts.defeatVariable);
        }
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
            text: opts.text ?? '', placed: true,
        };
        if (opts.conditionVariable !== undefined) {
            sprite.conditionVariableId = resolveVariableId(opts.conditionVariable);
        }
        if (opts.conditionText !== undefined) {
            sprite.conditionText = opts.conditionText;
        }
        if (opts.rewardVariable !== undefined) {
            sprite.rewardVariableId = resolveVariableId(opts.rewardVariable);
        }
        if (opts.conditionalRewardVariable !== undefined) {
            sprite.conditionalRewardVariableId = resolveVariableId(opts.conditionalRewardVariable);
        }
        if (opts.choice !== undefined) {
            sprite.choiceEnabled = true;
            sprite.choicePrompt = opts.choice.prompt;
            sprite.choiceYesText = opts.choice.yesText;
            sprite.choiceNoText = opts.choice.noText;
            if (opts.choice.yesVariable !== undefined) {
                sprite.choiceYesVariableId = resolveVariableId(opts.choice.yesVariable);
            }
            if (opts.choice.noVariable !== undefined) {
                sprite.choiceNoVariableId = resolveVariableId(opts.choice.noVariable);
            }
        }
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

    addXpScroll(pos: { x: number; y: number }): this {
        return this._addUniqueObject('xp-scroll', pos.x, pos.y);
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
        this._reserveTile('switch', opts.x, opts.y);
        this._objects.push({
            type: 'switch', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: resolveVariableId(opts.variable), on: opts.on ?? false,
        });
        return this;
    }

    /** Door that stays locked until `variable` is ON. One per room. */
    addVariableDoor(opts: { x: number; y: number; variable: VariableRef | number }): this {
        if (this._objectTypes.has('door-variable')) {
            throw new Error(`Room already has a 'door-variable'`);
        }
        this._reserveTile('door-variable', opts.x, opts.y);
        this._objectTypes.add('door-variable');
        this._objects.push({
            type: 'door-variable', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: resolveVariableId(opts.variable),
        });
        return this;
    }

    /** Indicator lamp that lights up while `variable` is ON. */
    addLed(opts: { x: number; y: number; variable: VariableRef | number }): this {
        this._reserveTile('logic-led', opts.x, opts.y);
        this._objects.push({
            type: 'logic-led', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: resolveVariableId(opts.variable),
        });
        return this;
    }

    /** Spikes that hurt the player. Active unless its (optional) `variable` is ON. */
    addTrap(opts: { x: number; y: number; variable?: VariableRef | number }): this {
        this._reserveTile('trap', opts.x, opts.y);
        this._objects.push({
            type: 'trap', x: opts.x, y: opts.y, roomIndex: 0,
            ...(opts.variable !== undefined ? { variableId: resolveVariableId(opts.variable) } : {}),
        });
        return this;
    }

    /** Floor plate that holds `variable` ON while a player or push-box rests on it. */
    addPressurePlate(opts: { x: number; y: number; variable: VariableRef | number }): this {
        this._reserveTile('pressure-plate', opts.x, opts.y);
        this._objects.push({
            type: 'pressure-plate', x: opts.x, y: opts.y, roomIndex: 0,
            variableId: resolveVariableId(opts.variable),
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
        inputA?: VariableRef | number;
        inputB?: VariableRef | number;
        output: VariableRef | number;
        hidden?: boolean;
    }): this {
        const mapped = GATE_TYPE_MAP[opts.type] as SdkObject['type'] | undefined;
        if (!mapped) {
            throw new Error(`Unknown logic gate type '${opts.type}'. Valid: ${Object.keys(GATE_TYPE_MAP).join(', ')}`);
        }
        this._reserveTile(mapped, opts.x, opts.y);
        this._objects.push({
            type: mapped as Extract<SdkObject, { type: `logic-gate-${string}` }>['type'],
            x: opts.x, y: opts.y, roomIndex: 0,
            inputVariableId: opts.inputA !== undefined ? resolveVariableId(opts.inputA) : undefined,
            inputVariableId2: opts.inputB !== undefined ? resolveVariableId(opts.inputB) : undefined,
            outputVariableId: resolveVariableId(opts.output),
            hiddenInGame: opts.hidden ? true : undefined,
        });
        return this;
    }

    /** Chest revealing a fixed item, or a random one when `random` is set. */
    addChest(opts: { x: number; y: number; contains?: ChestItemType; random?: boolean }): this {
        if (opts.contains !== undefined && !VALID_CHEST_ITEMS.includes(opts.contains)) {
            throw new Error(`Unknown chest item '${opts.contains}'. Valid: ${VALID_CHEST_ITEMS.join(', ')}`);
        }
        if (!opts.random && opts.contains === undefined) {
            throw new Error(`addChest requires either 'contains' or 'random: true'`);
        }
        this._reserveTile('chest', opts.x, opts.y);
        this._objects.push({
            type: 'chest', x: opts.x, y: opts.y, roomIndex: 0,
            containsItemType: opts.contains ?? null,
            randomItem: Boolean(opts.random),
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
        this._objects.push({ type: 'player-end', x: opts.x, y: opts.y, roomIndex: 0, endingText: opts.message });
        return this;
    }

    private _addUniqueObject(type: string, x: number, y: number): this {
        if (this._objectTypes.has(type)) {
            throw new Error(`Room already has a '${type}'`);
        }
        this._reserveTile(type, x, y);
        this._objectTypes.add(type);
        this._objects.push({ type, x, y, roomIndex: 0 } as SdkObject);
        return this;
    }

    private _addMultiObject(type: string, x: number, y: number): this {
        this._reserveTile(type, x, y);
        this._objects.push({ type, x, y, roomIndex: 0 } as SdkObject);
        return this;
    }

    /** Validates coordinates and rejects placing two objects on the same tile. */
    private _reserveTile(type: string, x: number, y: number): void {
        validateCoord('x', x);
        validateCoord('y', y);
        const key = `${x},${y}`;
        if (this._objectTiles.has(key)) {
            throw new Error(`Tile (${x}, ${y}) already has an object — cannot place '${type}' there`);
        }
        this._objectTiles.add(key);
    }

    _getTileData(): { ground?: number[][]; overlay?: (number | null)[][] } {
        const result: { ground?: number[][]; overlay?: (number | null)[][] } = {};
        if (this._ground) result.ground = this._ground;
        if (this._overlay) result.overlay = this._overlay;
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
