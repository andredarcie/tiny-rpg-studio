import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareEncoder, ShareDecoder } from './shareTestUtils';

type DecodedObject = { type: string; x: number; y: number; roomIndex: number; variableId?: string | null; solid?: boolean; collected?: boolean; opened?: boolean; containsItemType?: string | null; randomItem?: boolean };
type DecodedData = { objects?: DecodedObject[] };

const encode = (data: unknown) => ShareEncoder.buildShareCode(data as never);
const decode = (code: string | null): DecodedData | null => ShareDecoder.decodeShareCode(code) as DecodedData | null;

const findObj = (decoded: DecodedData | null, type: string, roomIndex = 0) =>
    decoded?.objects?.find((o) => o.type === type && o.roomIndex === roomIndex) ?? null;

const findObjs = (decoded: DecodedData | null, type: string) =>
    decoded?.objects?.filter((o) => o.type === type) ?? [];

describe('New objects — URL round-trip', () => {
    beforeAll(() => {
        setupShareGlobals({
            enemyNormalize: (t) => (typeof t === 'string' && t ? t : 'slime'),
        });
    });

    const baseGame = {
        start: { x: 1, y: 1, roomIndex: 0 },
        sprites: [],
        enemies: [],
        variables: [{ id: 'var-1', value: false }],
        tileset: { tiles: [], maps: [], map: { ground: [], overlay: [] } },
    };

    // ── armor ──────────────────────────────────────────────────────────────────

    it('armor: round-trips position and collected=false', () => {
        const game = { ...baseGame, objects: [{ type: 'armor', x: 2, y: 3, roomIndex: 0 }] };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'armor');
        expect(obj).not.toBeNull();
        expect(obj?.x).toBe(2);
        expect(obj?.y).toBe(3);
        expect(obj?.collected).toBe(false);
    });

    it('armor: multiple instances in different rooms survive round-trip', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'armor', x: 1, y: 1, roomIndex: 0 },
                { type: 'armor', x: 3, y: 3, roomIndex: 1 },
            ],
        };
        const decoded = decode(encode(game));
        expect(findObjs(decoded, 'armor')).toHaveLength(2);
    });

    // ── boots ──────────────────────────────────────────────────────────────────

    it('boots: round-trips position and collected=false', () => {
        const game = { ...baseGame, objects: [{ type: 'boots', x: 4, y: 5, roomIndex: 0 }] };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'boots');
        expect(obj).not.toBeNull();
        expect(obj?.x).toBe(4);
        expect(obj?.y).toBe(5);
        expect(obj?.collected).toBe(false);
    });

    // ── trap ───────────────────────────────────────────────────────────────────

    it('trap: round-trips position and linked variable', () => {
        const game = {
            ...baseGame,
            objects: [{ type: 'trap', x: 1, y: 2, roomIndex: 0, variableId: 'var-1' }],
        };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'trap');
        expect(obj).not.toBeNull();
        expect(obj?.x).toBe(1);
        expect(obj?.y).toBe(2);
        expect(obj?.variableId).toBe('var-1');
    });

    it('trap: multiple instances in same room survive round-trip', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'trap', x: 1, y: 1, roomIndex: 0, variableId: 'var-1' },
                { type: 'trap', x: 3, y: 3, roomIndex: 0, variableId: 'var-1' },
            ],
        };
        const decoded = decode(encode(game));
        expect(findObjs(decoded, 'trap')).toHaveLength(2);
    });

    it('trap: mixed solid flags stay aligned with sorted positions and variables', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'trap', x: 6, y: 6, roomIndex: 2, variableId: 'var-2', solid: true },
                { type: 'trap', x: 3, y: 1, roomIndex: 0, variableId: 'var-1', solid: false },
                { type: 'trap', x: 1, y: 1, roomIndex: 0, variableId: 'var-2', solid: true },
            ],
        };

        const code = encode(game);
        const traps = findObjs(decode(code), 'trap');

        expect(code.split('.').some((segment) => segment.startsWith('_'))).toBe(true);
        expect(traps.map(({ roomIndex, x, variableId, solid }) => ({ roomIndex, x, variableId, solid }))).toEqual([
            { roomIndex: 0, x: 1, variableId: 'var-2', solid: true },
            { roomIndex: 0, x: 3, variableId: 'var-1', solid: false },
            { roomIndex: 2, x: 6, variableId: 'var-2', solid: true },
        ]);
    });

    it('trap: omits all-false solid payload and defaults legacy or missing flags to false', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'trap', x: 1, y: 1, roomIndex: 0, variableId: 'var-1' },
                { type: 'trap', x: 2, y: 1, roomIndex: 0, variableId: 'var-1', solid: false },
            ],
        };
        const allFalseCode = encode(game);
        expect(allFalseCode.split('.').some((segment) => segment.startsWith('_'))).toBe(false);
        expect(findObjs(decode(allFalseCode), 'trap').map((trap) => trap.solid)).toEqual([false, false]);

        const solidCode = encode({
            ...baseGame,
            objects: [{ type: 'trap', x: 1, y: 1, roomIndex: 0, variableId: 'var-1', solid: true }],
        });
        const legacyCode = solidCode.replace(/^v[0-9a-z]+/, 'v11');
        expect(findObj(decode(legacyCode), 'trap')?.solid).toBe(false);

        const withoutFlags = solidCode.split('.').filter((segment) => !segment.startsWith('_')).join('.');
        expect(findObj(decode(withoutFlags), 'trap')?.solid).toBe(false);
    });

    it('trap: truncated solid flags retain present values and default missing ones to false', () => {
        const code = encode({
            ...baseGame,
            objects: [
                { type: 'trap', x: 0, y: 0, roomIndex: 0, variableId: 'var-1', solid: true },
                { type: 'trap', x: 1, y: 0, roomIndex: 0, variableId: 'var-1', solid: false },
                { type: 'trap', x: 2, y: 0, roomIndex: 0, variableId: 'var-1', solid: true },
            ],
        });
        const truncated = code.split('.').map((segment) =>
            segment.startsWith('_') ? segment.slice(0, 3) : segment
        ).join('.');

        expect(findObjs(decode(truncated), 'trap').map((trap) => trap.solid)).toEqual([true, false, false]);
    });

    // ── pressure-plate ────────────────────────────────────────────────────────

    it('pressure-plate: round-trips position and linked variable', () => {
        const game = {
            ...baseGame,
            objects: [{ type: 'pressure-plate', x: 3, y: 4, roomIndex: 0, variableId: 'var-1' }],
        };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'pressure-plate');
        expect(obj).not.toBeNull();
        expect(obj?.x).toBe(3);
        expect(obj?.y).toBe(4);
        expect(obj?.variableId).toBe('var-1');
    });

    it('pressure-plate: multiple instances in same room survive round-trip', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'pressure-plate', x: 0, y: 0, roomIndex: 0, variableId: 'var-1' },
                { type: 'pressure-plate', x: 5, y: 5, roomIndex: 0, variableId: 'var-1' },
            ],
        };
        const decoded = decode(encode(game));
        expect(findObjs(decoded, 'pressure-plate')).toHaveLength(2);
    });

    // ── push-box ───────────────────────────────────────────────────────────────

    it('push-box: round-trips position', () => {
        const game = { ...baseGame, objects: [{ type: 'push-box', x: 2, y: 2, roomIndex: 0 }] };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'push-box');
        expect(obj).not.toBeNull();
        expect(obj?.x).toBe(2);
        expect(obj?.y).toBe(2);
    });

    it('push-box: multiple instances in same room survive round-trip', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'push-box', x: 1, y: 1, roomIndex: 0 },
                { type: 'push-box', x: 4, y: 4, roomIndex: 0 },
            ],
        };
        const decoded = decode(encode(game));
        expect(findObjs(decoded, 'push-box')).toHaveLength(2);
    });

    // ── chest ──────────────────────────────────────────────────────────────────

    it('chest: round-trips position, containsItemType and randomItem=false', () => {
        const game = {
            ...baseGame,
            objects: [{ type: 'chest', x: 5, y: 6, roomIndex: 0, containsItemType: 'key', randomItem: false }],
        };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'chest');
        expect(obj).not.toBeNull();
        expect(obj?.x).toBe(5);
        expect(obj?.y).toBe(6);
        expect(obj?.containsItemType).toBe('key');
        expect(obj?.randomItem).toBe(false);
        expect(obj?.opened).toBe(false);
    });

    it('chest: preserves randomItem=true', () => {
        const game = {
            ...baseGame,
            objects: [{ type: 'chest', x: 0, y: 0, roomIndex: 0, containsItemType: null, randomItem: true }],
        };
        const decoded = decode(encode(game));
        const obj = findObj(decoded, 'chest');
        expect(obj?.randomItem).toBe(true);
        expect(obj?.containsItemType).toBeNull();
    });

    it('chest: preserves all containsItemType values', () => {
        const itemTypes = ['key', 'life-potion', 'xp-scroll', 'sword', 'sword-bronze', 'sword-wood', 'armor', 'boots'];
        for (const containsItemType of itemTypes) {
            const game = {
                ...baseGame,
                objects: [{ type: 'chest', x: 1, y: 1, roomIndex: 0, containsItemType }],
            };
            const decoded = decode(encode(game));
            const obj = findObj(decoded, 'chest');
            expect(obj?.containsItemType).toBe(containsItemType);
        }
    });

    it('chest: preserves empty, mixed, sorted, and var-16 variable references', () => {
        const code = encode({
            ...baseGame,
            objects: [
                { type: 'chest', x: 6, y: 2, roomIndex: 1, containsItemType: 'boots', variableId: 'var-16' },
                { type: 'chest', x: 4, y: 1, roomIndex: 0, containsItemType: 'key' },
                { type: 'chest', x: 1, y: 1, roomIndex: 0, containsItemType: 'armor', variableId: 'var-2' },
            ],
        });
        const chests = findObjs(decode(code), 'chest');

        expect(code.split('.').some((segment) => segment.startsWith('!'))).toBe(true);
        expect(chests.map(({ roomIndex, x, containsItemType, variableId }) => ({
            roomIndex, x, containsItemType, variableId
        }))).toEqual([
            { roomIndex: 0, x: 1, containsItemType: 'armor', variableId: 'var-2' },
            { roomIndex: 0, x: 4, containsItemType: 'key', variableId: null },
            { roomIndex: 1, x: 6, containsItemType: 'boots', variableId: 'var-16' },
        ]);
    });

    it('chest: omits empty references and decodes pre-feature VERSION_39 links as null', () => {
        const emptyCode = encode({
            ...baseGame,
            objects: [{ type: 'chest', x: 1, y: 1, roomIndex: 0, containsItemType: 'key' }],
        });
        expect(emptyCode.split('.').some((segment) => segment.startsWith('!'))).toBe(false);
        expect(findObj(decode(emptyCode), 'chest')?.variableId).toBeNull();

        const selectedCode = encode({
            ...baseGame,
            objects: [{ type: 'chest', x: 1, y: 1, roomIndex: 0, containsItemType: 'key', variableId: 'var-1' }],
        });
        const withoutFeatureSegment = selectedCode.split('.').filter((segment) => !segment.startsWith('!')).join('.');
        expect(findObj(decode(withoutFeatureSegment), 'chest')?.variableId).toBeNull();
    });

    it('chest: safely handles malformed, short, out-of-range, and special references', () => {
        const baseCode = encode({
            ...baseGame,
            objects: [
                { type: 'chest', x: 0, y: 0, roomIndex: 0, containsItemType: 'key' },
                { type: 'chest', x: 1, y: 0, roomIndex: 0, containsItemType: 'key' },
                { type: 'chest', x: 2, y: 0, roomIndex: 0, containsItemType: 'key' },
            ],
        });

        expect(findObjs(decode(`${baseCode}.!@@`), 'chest').map((chest) => chest.variableId))
            .toEqual([null, null, null]);
        expect(findObjs(decode(`${baseCode}.!AQ`), 'chest').map((chest) => chest.variableId))
            .toEqual(['var-1', null, null]);
        expect(findObjs(decode(`${baseCode}.!_w`), 'chest').map((chest) => chest.variableId))
            .toEqual([null, null, null]);
        expect(findObjs(decode(`${baseCode}.!Cg`), 'chest').map((chest) => chest.variableId))
            .toEqual([null, null, null]);
    });

    // ── mixed scenario ─────────────────────────────────────────────────────────

    it('all new object types coexist in the same game without corruption', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'armor',          x: 1, y: 1, roomIndex: 0 },
                { type: 'boots',          x: 2, y: 1, roomIndex: 0 },
                { type: 'trap',           x: 3, y: 1, roomIndex: 0, variableId: 'var-1' },
                { type: 'pressure-plate', x: 4, y: 1, roomIndex: 0, variableId: 'var-1' },
                { type: 'push-box',       x: 5, y: 1, roomIndex: 0 },
                { type: 'chest',          x: 6, y: 1, roomIndex: 0, containsItemType: 'key' },
            ],
        };

        const code = encode(game);
        expect(typeof code).toBe('string');
        expect(typeof code === 'string' && code.length).toBeGreaterThan(0);

        const decoded = decode(code);
        expect(decoded?.objects?.some((o) => o.type === 'armor')).toBe(true);
        expect(decoded?.objects?.some((o) => o.type === 'boots')).toBe(true);
        expect(decoded?.objects?.some((o) => o.type === 'trap')).toBe(true);
        expect(decoded?.objects?.some((o) => o.type === 'pressure-plate')).toBe(true);
        expect(decoded?.objects?.some((o) => o.type === 'push-box')).toBe(true);
        expect(decoded?.objects?.some((o) => o.type === 'chest')).toBe(true);
    });

    it('URL is valid (no undefined or null segments) with all new object types', () => {
        const game = {
            ...baseGame,
            objects: [
                { type: 'armor',          x: 0, y: 0, roomIndex: 0 },
                { type: 'boots',          x: 1, y: 0, roomIndex: 0 },
                { type: 'trap',           x: 2, y: 0, roomIndex: 0, variableId: 'var-1' },
                { type: 'pressure-plate', x: 3, y: 0, roomIndex: 0, variableId: 'var-1' },
                { type: 'push-box',       x: 4, y: 0, roomIndex: 0 },
                { type: 'chest',          x: 5, y: 0, roomIndex: 0, containsItemType: 'sword' },
            ],
        };

        const code = encode(game);
        expect(code).toBeTruthy();
        expect(code).not.toContain('undefined');
        expect(code).not.toContain('null');

        // All segments must be key+payload (no empty segments)
        const segments = code.split('.');
        for (const segment of segments) {
            expect(segment.length).toBeGreaterThan(0);
        }
    });
});
