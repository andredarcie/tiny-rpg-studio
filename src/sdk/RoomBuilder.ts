
import { ShareConstants } from '../runtime/infra/share/ShareConstants';
import type { EnemyType, NpcType, SdkEnemy, SdkObject, SdkSprite } from './types';

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

const MAX_ENEMIES_PER_ROOM = 9;

function validateCoord(axis: 'x' | 'y', value: number): void {
    const max = ShareConstants.MATRIX_SIZE - 1;
    if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new Error(`${axis} must be between 0 and ${max}, got ${value}`);
    }
}

class RoomBuilder {
    private _ground?: number[][];
    private _overlay?: (number | null)[][];
    private _enemies: SdkEnemy[] = [];
    private _sprites: SdkSprite[] = [];
    private _objects: SdkObject[] = [];
    private _objectTypes = new Set<string>();

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

    addEnemy(opts: { type: EnemyType; x: number; y: number }): this {
        if (!VALID_ENEMY_TYPES.includes(opts.type)) {
            throw new Error(`Unknown enemy type '${opts.type}'. Valid types: ${VALID_ENEMY_TYPES.join(', ')}`);
        }
        validateCoord('x', opts.x);
        validateCoord('y', opts.y);
        if (this._enemies.length >= MAX_ENEMIES_PER_ROOM) {
            throw new Error(`Room already has ${MAX_ENEMIES_PER_ROOM} enemies (maximum)`);
        }
        this._enemies.push({ type: opts.type, x: opts.x, y: opts.y, roomIndex: 0 });
        return this;
    }

    addNPC(opts: { type: NpcType; x: number; y: number; text?: string }): this {
        if (!VALID_NPC_TYPES.includes(opts.type)) {
            throw new Error(`Unknown NPC type '${opts.type}'. Valid types: ${VALID_NPC_TYPES.join(', ')}`);
        }
        validateCoord('x', opts.x);
        validateCoord('y', opts.y);
        this._sprites.push({ type: opts.type, x: opts.x, y: opts.y, roomIndex: 0, text: opts.text ?? '', placed: true });
        return this;
    }

    addKey(pos: { x: number; y: number }): this {
        return this._addUniqueObject('key', pos.x, pos.y);
    }

    addDoor(pos: { x: number; y: number }): this {
        return this._addUniqueObject('door', pos.x, pos.y);
    }

    addPotion(pos: { x: number; y: number }): this {
        return this._addUniqueObject('life-potion', pos.x, pos.y);
    }

    addSword(opts: { x: number; y: number; tier?: 'wood' | 'bronze' | 'iron' }): this {
        const tier = opts.tier ?? 'iron';
        const type = tier === 'iron' ? 'sword' : tier === 'bronze' ? 'sword-bronze' : 'sword-wood';
        return this._addUniqueObject(type, opts.x, opts.y);
    }

    addEnd(opts: { x: number; y: number; message?: string }): this {
        validateCoord('x', opts.x);
        validateCoord('y', opts.y);
        if (this._objectTypes.has('player-end')) {
            throw new Error(`Room already has a 'player-end'`);
        }
        this._objectTypes.add('player-end');
        this._objects.push({ type: 'player-end', x: opts.x, y: opts.y, roomIndex: 0, endingText: opts.message });
        return this;
    }

    private _addUniqueObject(type: string, x: number, y: number): this {
        validateCoord('x', x);
        validateCoord('y', y);
        if (this._objectTypes.has(type)) {
            throw new Error(`Room already has a '${type}'`);
        }
        this._objectTypes.add(type);
        this._objects.push({ type, x, y, roomIndex: 0 } as SdkObject);
        return this;
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
