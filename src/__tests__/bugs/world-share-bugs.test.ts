import { describe, it, expect, vi } from 'vitest';
import { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import { StateDataManager } from '../../runtime/domain/state/StateDataManager';
import type { StateObjectManager } from '../../runtime/domain/state/StateObjectManager';
import type { StateVariableManager } from '../../runtime/domain/state/StateVariableManager';
import type { GameDefinition } from '../../types/gameState';
import { ShareBase64 } from '../../runtime/infra/share/ShareBase64';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';

/**
 * Failing-by-design regression tests for two real bugs in the world/share pipeline.
 *
 * Each test encodes the CORRECT/EXPECTED behavior, so it FAILS against the current
 * (buggy) source and will PASS once the underlying bug is fixed. They do NOT modify
 * production code.
 */

// ---------------------------------------------------------------------------
// BUG A (HIGH): normalizeRooms throws TypeError on oversized room matrices.
//
// File: src/runtime/domain/state/StateWorldManager.ts:71-77
//   target.tiles = Array.isArray(room.tiles)
//       ? room.tiles.map((row, y) =>
//           Array.from({ length: size }, (_, x) => {
//               const value = row[x];
//               return Number.isFinite(value) ? value : target.tiles[y][x]; // <-- line 75
//           }))
//       : target.tiles;
//
// `room.tiles.map` iterates ALL source rows. `target` is an empty room with only
// `size` (= 8) rows, so `target.tiles[y]` is undefined for any row y >= 8. When a
// cell in such an extra row is non-finite (null/undefined), the fallback
// `target.tiles[y][x]` dereferences `undefined[x]` and throws TypeError.
//
// Reproduced both directly (normalizeRooms) and through the public entry point
// StateDataManager.importGameData (which calls normalizeRooms at line 124 and does
// NOT wrap it in try/catch, so the TypeError propagates to the caller).
//
// EXPECTED (correct behavior): importing/normalizing an oversized room must NOT
// throw. Extra rows beyond `size` should be clamped/ignored, producing a clean
// 8x8 room. TODAY it throws TypeError, so these assertions fail.
// ---------------------------------------------------------------------------
describe('BUG A: normalizeRooms TypeError on oversized room matrix', () => {
    // Build a room whose `tiles` has 10 rows (each 8 wide) with a non-finite cell
    // (null) in a row beyond index 7 — the exact shape that triggers the crash.
    const makeOversizedTiles = (): number[][] => {
        const tiles = Array.from({ length: 10 }, () => Array.from({ length: 8 }, () => 0));
        // Non-finite cell in an "extra" row (index 9 > size-1 = 7).
        // Cast: the production type is number[][], but a malformed/legacy payload
        // can carry nulls; the bug is precisely about that non-finite value.
        (tiles[9] as (number | null)[])[0] = null;
        return tiles as number[][];
    };

    it('does not throw when normalizeRooms receives a room with more rows than roomSize', () => {
        const game = { roomSize: 8 } as unknown as GameDefinition;
        const worldManager = new StateWorldManager(game, 8);

        const tiles = makeOversizedTiles();

        // EXPECTED: oversized rows are clamped/ignored instead of crashing.
        // TODAY: throws TypeError "Cannot read properties of undefined (reading '0')"
        // from StateWorldManager.ts:75, so this fails.
        expect(() => worldManager.normalizeRooms([{ tiles }], 9, 3)).not.toThrow();
    });

    it('clamps an oversized room to exactly 8 rows of 8 finite values', () => {
        const game = { roomSize: 8 } as unknown as GameDefinition;
        const worldManager = new StateWorldManager(game, 8);

        const tiles = makeOversizedTiles();

        // Guard against the test passing for the wrong reason: if normalizeRooms threw,
        // `rooms` would never be assigned. We catch so the subsequent shape assertions
        // (not an uncaught throw) are what report the failure.
        let rooms: ReturnType<StateWorldManager['normalizeRooms']> = [];
        let threw: unknown = null;
        try {
            rooms = worldManager.normalizeRooms([{ tiles }], 9, 3);
        } catch (error) {
            threw = error;
        }

        // EXPECTED: no throw, and the normalized room is a clean 8x8 grid of numbers.
        expect(threw).toBeNull();
        expect(rooms).toHaveLength(9);
        const room = rooms[0];
        expect(room.tiles).toHaveLength(8);
        expect(room.tiles.every((row) => row.length === 8)).toBe(true);
        expect(room.tiles.every((row) => row.every((cell) => Number.isFinite(cell)))).toBe(true);
    });

    it('does not throw when importing game data (public entry) with an oversized room', () => {
        const game = { roomSize: 8, tileset: { tiles: [] } } as unknown as GameDefinition;
        const worldManager = new StateWorldManager(game, 8);
        const objectManager = {
            normalizeObjects: vi.fn(() => []),
            setGame: vi.fn(),
        } as unknown as StateObjectManager;
        const variableManager = {
            normalizeVariables: vi.fn(() => []),
            setGame: vi.fn(),
        } as unknown as StateVariableManager;

        const manager = new StateDataManager({ game, worldManager, objectManager, variableManager });

        const tiles = makeOversizedTiles();

        // EXPECTED: importing a (malformed/oversized) room must not crash.
        // TODAY: StateDataManager.importGameData (line 124) calls normalizeRooms,
        // which throws TypeError, propagating to this caller, so this fails.
        expect(() => manager.importGameData({ rooms: [{ tiles } as never] })).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// BUG B (HIGH): Off-by-one extra byte in delta custom-sprite encoding desyncs decode.
//
// File: src/runtime/infra/share/ShareEncoder.ts:136-142 (tryEncodeDeltaFrame)
//   if (changedCount === 0) {
//       bytes.push(rows & 0xff);
//       bytes.push(cols & 0xff);
//       bytes.push(...new Uint8Array(Math.ceil(pixelCount / 8)));
//       bytes.push(0); // <-- EXTRA trailing byte the decoder never reads
//       return true;
//   }
//
// Decoder: src/runtime/infra/share/ShareDecoder.ts:143-182. For a delta frame it
// reads rows, cols, the changedMask, then `changedCount` (= 0 here) bytes of state
// mask (0) and color bytes (0). It NEVER consumes the extra trailing 0, so the read
// offset is shifted by 1, corrupting every subsequent frame/sprite.
//
// This is the tryEncodeDeltaFrame path (NOT the indexed 8x8 path). To route here we
// need:
//   - canUseDelta = true  -> resolveBaseFrame() returns a base AND frame dims match it
//   - isFixed8x8Indexed = false -> useIndexedKey must be false
// We use group 'npc', key 'default': the sprite 'default' EXISTS in
// SpriteMatrixRegistry (so the base frame resolves), but 'default' is NOT one of the
// NPC catalog types in ShareSpriteCatalog.KNOWN_KEYS, so getKeyIndex returns -1 and
// useIndexedKey is false. The first frame is byte-identical to the base
// (changedCount === 0 -> hits the buggy branch), followed by a second, different
// frame so the off-by-one corrupts the trailing data.
//
// EXPECTED (correct behavior): the encode->decode round trip reproduces both frames
// exactly. TODAY the second frame decodes empty/garbage, so this fails.
// ---------------------------------------------------------------------------
describe('BUG B: delta custom-sprite off-by-one desyncs decode', () => {
    // The real 'npc' / 'default' base sprite (from NpcSpriteMatrices.default), used so
    // the encoder's resolveBaseFrame returns a matching 8x8 base and canUseDelta is true.
    const baseFrame = (): (number | null)[][] => [
        [null, null, null, 5, 5, 5, null, null],
        [null, null, 5, 5, 5, 5, 5, null],
        [null, null, 7, 1, 7, 1, 7, null],
        [5, null, 7, 7, 7, 7, 7, null],
        [5, null, 5, 5, 5, 5, 5, null],
        [5, 7, 6, 5, 5, 5, 6, null],
        [5, null, 6, 6, 5, 6, 6, null],
        [5, null, 6, 6, 6, 6, 6, null],
    ];

    it('routes through tryEncodeDeltaFrame (delta flag set, indexed-key flag clear)', () => {
        // Sanity check that the constructed input actually reaches the buggy branch
        // rather than the indexed 8x8 path. Decode the binary header flags directly.
        const identical = baseFrame();
        const modified = baseFrame();
        modified[0][3] = 9;

        const customSprites = [
            { group: 'npc' as const, key: 'default', variant: 'base' as const, frames: [identical, modified] },
        ];

        const code = ShareEncoder.buildShareCode({ customSprites });
        const segment = code.split('.').find((s) => s.startsWith('S'))?.slice(1) ?? '';
        const bytes = ShareBase64.fromBase64Url(segment);

        // bytes[0] = binary version (5), bytes[1] = entry count, bytes[2] = flags.
        const flags = bytes[2];
        const usesDelta = ((flags >> 4) & 0x01) === 1;
        const usesIndexedKey = ((flags >> 5) & 0x01) === 1;
        const usesFixed8x8Indexed = ((flags >> 6) & 0x01) === 1;

        expect(usesDelta).toBe(true);
        expect(usesIndexedKey).toBe(false);
        expect(usesFixed8x8Indexed).toBe(false);
    });

    it('preserves both frames through an encode/decode round trip (no-change frame first)', () => {
        // Frame 0 is byte-identical to the base -> changedCount === 0 -> hits the buggy
        // branch that emits the extra trailing byte. Frame 1 differs.
        const identical = baseFrame();
        const modified = baseFrame();
        modified[0][3] = 9;
        modified[0][4] = 9;

        const customSprites = [
            { group: 'npc' as const, key: 'default', variant: 'base' as const, frames: [identical, modified] },
        ];

        const code = ShareEncoder.buildShareCode({ customSprites });
        const decoded = ShareDecoder.decodeShareCode(code) as { customSprites?: typeof customSprites } | null;

        const decodedFrames = decoded?.customSprites?.[0]?.frames;

        // The first (unchanged) frame still decodes correctly today.
        expect(decodedFrames?.[0]).toEqual(identical);

        // EXPECTED: the second frame round-trips exactly. TODAY the extra trailing byte
        // from the no-change frame shifts the decode offset, so the second frame decodes
        // empty/garbage and this assertion fails.
        expect(decodedFrames?.[1]).toEqual(modified);
    });

    it('preserves a following sprite after a sprite whose frame matches its base', () => {
        // First sprite has a single no-change frame (triggers the extra byte). A second,
        // distinct sprite follows; the off-by-one corrupts its decode too.
        const identical = baseFrame();

        const secondSpriteFrame = baseFrame();
        secondSpriteFrame[2][3] = 12;
        secondSpriteFrame[3][4] = 8;

        const customSprites = [
            { group: 'npc' as const, key: 'default', variant: 'base' as const, frames: [identical] },
            { group: 'npc' as const, key: 'default', variant: 'base' as const, frames: [secondSpriteFrame] },
        ];

        const code = ShareEncoder.buildShareCode({ customSprites });
        const decoded = ShareDecoder.decodeShareCode(code) as { customSprites?: typeof customSprites } | null;

        // EXPECTED: both sprites round-trip. TODAY the trailing byte from the first
        // sprite's no-change frame desyncs the decoder, corrupting the second sprite.
        expect(decoded?.customSprites).toHaveLength(2);
        expect(decoded?.customSprites?.[0]?.frames[0]).toEqual(identical);
        expect(decoded?.customSprites?.[1]?.frames[0]).toEqual(secondSpriteFrame);
    });
});
