import { describe, it, expect } from 'vitest';
import { CustomSpritesIO } from '../../editor/modules/CustomSpritesIO';
import type { CustomSpriteEntry, CustomSpriteFrame } from '../../types/gameState';

function makeFrame(fill: number | null = 3): CustomSpriteFrame {
    return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => fill));
}

function makeEntry(
    overrides: Partial<CustomSpriteEntry> & Pick<CustomSpriteEntry, 'group' | 'key'> = {
        group: 'tile',
        key: '0',
    }
): CustomSpriteEntry {
    return {
        group: overrides.group,
        key: overrides.key,
        variant: overrides.variant ?? 'base',
        frames: overrides.frames ?? [makeFrame()],
    };
}

function packOf(sprites: unknown[], extras: Record<string, unknown> = {}): string {
    return JSON.stringify({
        format: CustomSpritesIO.FORMAT,
        version: CustomSpritesIO.VERSION,
        sprites,
        ...extras,
    });
}

/** Mutate top-left cell without non-null assertions (eslint). */
function setTopLeft(frame: CustomSpriteFrame | undefined, value: number | null): void {
    const row = frame?.[0];
    if (!row) {
        throw new Error('expected 8x8 frame with a first row');
    }
    row[0] = value;
}

describe('CustomSpritesIO', () => {
    describe('serialize', () => {
        it('round-trips a non-empty list through parse', () => {
            const entries = [
                makeEntry({ group: 'tile', key: '0', frames: [makeFrame(1), makeFrame(2)] }),
                makeEntry({ group: 'npc', key: 'default' }),
                makeEntry({ group: 'object', key: 'switch', variant: 'base' }),
                makeEntry({ group: 'object', key: 'switch', variant: 'on' }),
                makeEntry({ group: 'enemy', key: 'bandit' }),
                makeEntry({ group: 'player', key: 'default' }),
            ];

            const result = CustomSpritesIO.serialize(entries, { engineHint: 'test' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const parsed = CustomSpritesIO.parse(result.text);
            expect(parsed.ok).toBe(true);
            if (!parsed.ok) return;
            expect(parsed.sprites).toHaveLength(entries.length);
            expect(parsed.skipped).toBe(0);

            for (const original of entries) {
                const found = parsed.sprites.find(
                    (s) =>
                        s.group === original.group &&
                        s.key === original.key &&
                        (s.variant ?? 'base') === (original.variant ?? 'base')
                );
                expect(found).toBeDefined();
                expect(found?.frames).toEqual(original.frames);
            }
        });

        it('allows empty list serialize for unit tests (export UI refuses empty separately)', () => {
            const result = CustomSpritesIO.serialize([]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const data = JSON.parse(result.text) as { sprites: unknown[] };
            expect(data.sprites).toEqual([]);
        });

        it('refuses more than MAX_ENTRIES without truncating', () => {
            const entries = Array.from({ length: CustomSpritesIO.MAX_ENTRIES + 1 }, (_, i) =>
                makeEntry({ group: 'tile', key: String(i) })
            );
            const result = CustomSpritesIO.serialize(entries);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_TOO_MANY_ENTRIES);
        });

        it('refuses a serialized version 2 payload over MAX_FILE_BYTES', () => {
            const result = CustomSpritesIO.serialize([
                makeEntry({ group: 'tile', key: 'x'.repeat(CustomSpritesIO.MAX_FILE_BYTES) }),
            ]);
            expect(result).toEqual({
                ok: false,
                error: CustomSpritesIO.ERROR_FILE_TOO_LARGE,
            });
        });

        it('deep-clones frames so mutating originals does not change serialized payload', () => {
            const entry = makeEntry({ group: 'tile', key: '0' });
            const result = CustomSpritesIO.serialize([entry]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            setTopLeft(entry.frames[0], 99);
            const again = JSON.parse(result.text) as { sprites: CustomSpriteEntry[] };
            expect(again.sprites[0]?.frames[0]?.[0]?.[0]).toBe(3);
        });

        it('includes format, version, and exportedAt', () => {
            const result = CustomSpritesIO.serialize([makeEntry()], {
                exportedAt: '2026-07-11T12:00:00.000Z',
                engineHint: '1.4.0',
            });
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const data = JSON.parse(result.text) as {
                format: string;
                version: number;
                exportedAt: string;
                engineHint: string;
            };
            expect(data.format).toBe(CustomSpritesIO.FORMAT);
            expect(data.version).toBe(2);
            expect(data.exportedAt).toBe('2026-07-11T12:00:00.000Z');
            expect(data.engineHint).toBe('1.4.0');
        });

        it('serializes portable effects and index-based tile assignments', () => {
            const result = CustomSpritesIO.serialize(
                [makeEntry({ group: 'tile', key: '7' })],
                { exportedAt: '2026-07-20T12:00:00.000Z' },
                {
                    customEffects: [{
                        name: 'Moonlit',
                        baseEffectIds: ['glow', 'sparkle'],
                        color: '#88aaff',
                    }],
                    tileEffectAssignments: [
                        { tileKey: '7', effectIndex: 0 },
                        { tileKey: '8', effectIndex: 0 },
                    ],
                }
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const data = JSON.parse(result.text) as Record<string, unknown>;
            expect(data).toMatchObject({
                version: 2,
                customEffects: [{
                    name: 'Moonlit',
                    baseEffectIds: ['glow', 'sparkle'],
                    color: '#88AAFF',
                }],
                tileEffectAssignments: [
                    { tileKey: '7', effectIndex: 0 },
                    { tileKey: '8', effectIndex: 0 },
                ],
            });
        });

        it('omits effect fields for a sprite-only version 2 pack', () => {
            const result = CustomSpritesIO.serialize([makeEntry()]);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const data = JSON.parse(result.text) as Record<string, unknown>;
            expect(data.version).toBe(2);
            expect(data).not.toHaveProperty('customEffects');
            expect(data).not.toHaveProperty('tileEffectAssignments');
        });
    });

    describe('parse', () => {
        it('normalizes a version 1 pack to empty effect arrays', () => {
            const result = CustomSpritesIO.parse(JSON.stringify({
                format: CustomSpritesIO.FORMAT,
                version: 1,
                sprites: [makeEntry()],
            }));
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.customEffects).toEqual([]);
            expect(result.tileEffectAssignments).toEqual([]);
        });

        it('rejects invalid JSON', () => {
            const result = CustomSpritesIO.parse('{not json');
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_INVALID_JSON);
        });

        it('rejects wrong format', () => {
            const result = CustomSpritesIO.parse(
                JSON.stringify({ format: 'other', version: 1, sprites: [makeEntry()] })
            );
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_WRONG_FORMAT);
        });

        it('rejects unsupported version', () => {
            const result = CustomSpritesIO.parse(
                JSON.stringify({
                    format: CustomSpritesIO.FORMAT,
                    version: 99,
                    sprites: [makeEntry()],
                })
            );
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_UNSUPPORTED_VERSION);
        });

        it('rejects missing sprites array', () => {
            const result = CustomSpritesIO.parse(
                JSON.stringify({ format: CustomSpritesIO.FORMAT, version: 1 })
            );
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_SPRITES_NOT_ARRAY);
        });

        it('rejects empty sprites pack (nothing to import / replace-wipe guard)', () => {
            const result = CustomSpritesIO.parse(packOf([]));
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_NOTHING_TO_IMPORT);
        });

        it('rejects zero valid entries after soft filter', () => {
            const result = CustomSpritesIO.parse(
                packOf([
                    { group: 'bogus', key: 'x', frames: [makeFrame()] },
                    { group: 'tile', key: '  ', frames: [makeFrame()] },
                ])
            );
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_NOTHING_TO_IMPORT);
        });

        it('accepts dual-state object pair (base + on)', () => {
            const result = CustomSpritesIO.parse(
                packOf([
                    makeEntry({ group: 'object', key: 'switch', variant: 'base' }),
                    makeEntry({ group: 'object', key: 'switch', variant: 'on' }),
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(2);
            expect(result.sprites.map((s) => s.variant).sort()).toEqual(['base', 'on']);
        });

        it('accepts tile with 2 frames', () => {
            const result = CustomSpritesIO.parse(
                packOf([
                    makeEntry({
                        group: 'tile',
                        key: '5',
                        frames: [makeFrame(1), makeFrame(2)],
                    }),
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites[0]?.frames).toHaveLength(2);
        });

        it('defaults missing variant to base', () => {
            const result = CustomSpritesIO.parse(
                packOf([
                    {
                        group: 'npc',
                        key: 'default',
                        frames: [makeFrame()],
                    },
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites[0]?.variant).toBe('base');
        });

        it('skips entry with out-of-range palette index', () => {
            const badFrame = makeFrame(16);
            const result = CustomSpritesIO.parse(
                packOf([
                    makeEntry({ group: 'tile', key: 'good' }),
                    { group: 'tile', key: 'bad', frames: [badFrame] },
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.sprites[0]?.key).toBe('good');
            expect(result.skipped).toBe(1);
        });

        it('skips entry with float palette index', () => {
            const frame = makeFrame(1);
            setTopLeft(frame, 1.5 as unknown as number);
            const result = CustomSpritesIO.parse(
                packOf([{ group: 'tile', key: 'bad', frames: [frame] }])
            );
            expect(result.ok).toBe(false);
        });

        it('skips non-8x8 / jagged frames', () => {
            const jagged = Array.from({ length: 8 }, (_, i) =>
                Array.from({ length: i === 0 ? 7 : 8 }, () => 1)
            );
            const tooSmall = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 1));
            const result = CustomSpritesIO.parse(
                packOf([
                    makeEntry({ group: 'tile', key: 'good' }),
                    { group: 'tile', key: 'jagged', frames: [jagged] },
                    { group: 'tile', key: 'small', frames: [tooSmall] },
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.skipped).toBe(2);
        });

        it('skips empty frames and frames.length > 4', () => {
            const result = CustomSpritesIO.parse(
                packOf([
                    makeEntry({ group: 'tile', key: 'good' }),
                    { group: 'tile', key: 'empty', frames: [] },
                    {
                        group: 'tile',
                        key: 'too-many',
                        frames: [makeFrame(), makeFrame(), makeFrame(), makeFrame(), makeFrame()],
                    },
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.skipped).toBe(2);
        });

        it('skips bad group and whitespace-only key', () => {
            const result = CustomSpritesIO.parse(
                packOf([
                    makeEntry({ group: 'player', key: 'default' }),
                    { group: 'weapon', key: 'sword', frames: [makeFrame()] },
                    { group: 'tile', key: '   ', frames: [makeFrame()] },
                ])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.skipped).toBe(2);
        });

        it('last-wins on duplicate (group, key, variant)', () => {
            const first = makeEntry({ group: 'tile', key: '0', frames: [makeFrame(1)] });
            const second = makeEntry({ group: 'tile', key: '0', frames: [makeFrame(9)] });
            const result = CustomSpritesIO.parse(packOf([first, second]));
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.sprites[0]?.frames[0]?.[0]?.[0]).toBe(9);
            expect(result.skipped).toBe(1);
        });

        it('hard-fails when unique valid entries exceed MAX_ENTRIES', () => {
            const sprites = Array.from({ length: CustomSpritesIO.MAX_ENTRIES + 1 }, (_, i) =>
                makeEntry({ group: 'tile', key: String(i) })
            );
            const result = CustomSpritesIO.parse(packOf(sprites));
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_TOO_MANY_ENTRIES);
        });

        it('allows raw arrays that collapse under MAX_ENTRIES via dedupe', () => {
            const sprites = Array.from({ length: 300 }, () =>
                makeEntry({ group: 'tile', key: 'same', frames: [makeFrame(7)] })
            );
            const result = CustomSpritesIO.parse(packOf(sprites));
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.sprites[0]?.frames[0]?.[0]?.[0]).toBe(7);
        });

        it('ignores unknown top-level and entry fields (forward compatible)', () => {
            const result = CustomSpritesIO.parse(
                packOf(
                    [
                        {
                            group: 'enemy',
                            key: 'giant-rat',
                            frames: [makeFrame()],
                            futureField: true,
                        },
                    ],
                    { authorNote: 'hello' }
                )
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites[0]?.key).toBe('giant-rat');
        });

        it.each([
            [{ customEffects: [{ name: 'Glow', baseEffectIds: ['glow'] }] }, CustomSpritesIO.ERROR_INVALID_EFFECT_ASSIGNMENTS],
            [{ tileEffectAssignments: [{ tileKey: '7', effectIndex: 0 }] }, CustomSpritesIO.ERROR_INVALID_EFFECT_ASSIGNMENTS],
            [{ customEffects: [{ name: '', baseEffectIds: ['glow'] }], tileEffectAssignments: [{ tileKey: '7', effectIndex: 0 }] }, CustomSpritesIO.ERROR_INVALID_EFFECT_RECIPES],
            [{ customEffects: [{ name: 'Glow', baseEffectIds: ['glow'] }], tileEffectAssignments: [{ tileKey: '', effectIndex: 0 }] }, CustomSpritesIO.ERROR_INVALID_EFFECT_ASSIGNMENTS],
            [{ customEffects: [{ name: 'Glow', baseEffectIds: ['glow'] }], tileEffectAssignments: [{ tileKey: '7', effectIndex: 1 }] }, CustomSpritesIO.ERROR_INVALID_EFFECT_ASSIGNMENTS],
            [{ customEffects: [{ name: 'Glow', baseEffectIds: ['glow'] }], tileEffectAssignments: [{ tileKey: '7', effectIndex: 0 }, { tileKey: '7', effectIndex: 0 }] }, CustomSpritesIO.ERROR_INVALID_EFFECT_ASSIGNMENTS],
        ])('rejects invalid version 2 effect data', (extras, error) => {
            const result = CustomSpritesIO.parse(packOf([makeEntry()], extras));
            expect(result).toEqual({ ok: false, error });
        });

        it('preserves exact tile keys and deeply clones parsed effect recipes', () => {
            const result = CustomSpritesIO.parse(packOf([makeEntry()], {
                customEffects: [{ name: 'Glow', baseEffectIds: ['glow'] }],
                tileEffectAssignments: [{ tileKey: ' 7 ', effectIndex: 0 }],
                futureEnvelope: true,
            }));
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.tileEffectAssignments).toEqual([{ tileKey: ' 7 ', effectIndex: 0 }]);
            expect(result.customEffects).toEqual([{ name: 'Glow', baseEffectIds: ['glow'] }]);
        });

        it('accepts null cells (transparent)', () => {
            const frame = makeFrame(null);
            const result = CustomSpritesIO.parse(
                packOf([{ group: 'tile', key: '0', frames: [frame] }])
            );
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites[0]?.frames[0]?.[0]?.[0]).toBeNull();
        });

        it('deep-clones so mutating pack source arrays after parse does not affect result', () => {
            const frame = makeFrame(4);
            const entry = { group: 'tile' as const, key: '0', frames: [frame] };
            const text = packOf([entry]);
            const result = CustomSpritesIO.parse(text);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            setTopLeft(frame, 0);
            expect(result.sprites[0]?.frames[0]?.[0]?.[0]).toBe(4);
        });
    });

    describe('applyImport', () => {
        it('replace mode uses only incoming entries', () => {
            const current = [makeEntry({ group: 'tile', key: 'old' })];
            const incoming = [makeEntry({ group: 'npc', key: 'new' })];
            const result = CustomSpritesIO.applyImport(current, incoming, 'replace');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(1);
            expect(result.sprites[0]?.key).toBe('new');
        });

        it('merge mode upserts by (group, key, variant) and keeps unrelated', () => {
            const current = [
                makeEntry({ group: 'tile', key: 'keep', frames: [makeFrame(1)] }),
                makeEntry({ group: 'npc', key: 'overwrite', frames: [makeFrame(2)] }),
            ];
            const incoming = [
                makeEntry({ group: 'npc', key: 'overwrite', frames: [makeFrame(8)] }),
                makeEntry({ group: 'enemy', key: 'added' }),
            ];
            const result = CustomSpritesIO.applyImport(current, incoming, 'merge');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.sprites).toHaveLength(3);
            const overwritten = result.sprites.find((s) => s.key === 'overwrite');
            expect(overwritten?.frames[0]?.[0]?.[0]).toBe(8);
            expect(result.sprites.some((s) => s.key === 'keep')).toBe(true);
            expect(result.sprites.some((s) => s.key === 'added')).toBe(true);
        });

        it('fails closed when merge would exceed MAX_ENTRIES', () => {
            const current = Array.from({ length: 200 }, (_, i) =>
                makeEntry({ group: 'tile', key: `a${i}` })
            );
            const incoming = Array.from({ length: 100 }, (_, i) =>
                makeEntry({ group: 'tile', key: `b${i}` })
            );
            const result = CustomSpritesIO.applyImport(current, incoming, 'merge');
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_MERGE_TOO_LARGE);
        });

        it('fails closed when replace list exceeds MAX_ENTRIES', () => {
            const incoming = Array.from({ length: CustomSpritesIO.MAX_ENTRIES + 1 }, (_, i) =>
                makeEntry({ group: 'tile', key: String(i) })
            );
            const result = CustomSpritesIO.applyImport(undefined, incoming, 'replace');
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_MERGE_TOO_LARGE);
        });

        it('refuses empty incoming', () => {
            const result = CustomSpritesIO.applyImport([makeEntry()], [], 'merge');
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error).toBe(CustomSpritesIO.ERROR_NOTHING_TO_IMPORT);
        });

        it('deep-clones so mutating current after apply does not change result', () => {
            const current = [makeEntry({ group: 'tile', key: 'x', frames: [makeFrame(5)] })];
            const incoming = [makeEntry({ group: 'npc', key: 'y' })];
            const result = CustomSpritesIO.applyImport(current, incoming, 'merge');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            setTopLeft(current[0]?.frames[0], 0);
            const kept = result.sprites.find((s) => s.key === 'x');
            expect(kept?.frames[0]?.[0]?.[0]).toBe(5);
        });
    });
});
