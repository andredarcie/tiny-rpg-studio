import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareEncoder, ShareDecoder } from './shareTestUtils';

type DecodedObject = { type: string; x: number; y: number; roomIndex: number; variableId?: string | null; collected?: boolean; opened?: boolean; containsItemType?: string | null; randomItem?: boolean };
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
