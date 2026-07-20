import { describe, expect, it } from 'vitest';
import { CustomEffectsIO } from '../../editor/modules/CustomEffectsIO';
import { CUSTOM_TILE_EFFECT_LIMITS } from '../../runtime/domain/definitions/customTileEffects';

function packOf(effects: unknown[], extras: Record<string, unknown> = {}): string {
    return JSON.stringify({
        format: CustomEffectsIO.FORMAT,
        version: CustomEffectsIO.VERSION,
        effects,
        ...extras,
    });
}

const moonlit = {
    id: 'custom:a' as const,
    name: 'Moonlit',
    baseEffectIds: ['cool-tint', 'glow', 'sparkle'] as const,
    color: '#88aaff' as const,
};

describe('CustomEffectsIO', () => {
    it('exposes deeply cloned portable recipe helpers', () => {
        const portable = CustomEffectsIO.toPortableRecipes([
            { ...moonlit, baseEffectIds: [...moonlit.baseEffectIds] },
        ]);
        expect(portable.ok).toBe(true);
        if (!portable.ok) return;
        expect(portable.recipes).toEqual([{
            name: 'Moonlit',
            baseEffectIds: ['cool-tint', 'glow', 'sparkle'],
            color: '#88AAFF',
        }]);

        const source = [{ name: ' Glow ', baseEffectIds: ['glow'], color: '#aabbcc' }];
        const validated = CustomEffectsIO.validatePortableRecipes(source);
        expect(validated.ok).toBe(true);
        if (!validated.ok) return;
        source[0]?.baseEffectIds.push('sparkle');
        expect(validated.recipes).toEqual([{
            name: 'Glow',
            baseEffectIds: ['glow'],
            color: '#AABBCC',
        }]);
    });

    it('serializes portable recipes and round-trips with fresh ordered IDs', () => {
        const serialized = CustomEffectsIO.serialize([
            { ...moonlit, baseEffectIds: [...moonlit.baseEffectIds] },
            { id: 'custom:z', name: 'Ripple', baseEffectIds: ['calm-wave', 'reflection-top'] },
        ], { exportedAt: '2026-07-20T12:00:00.000Z' });
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) return;

        const raw = JSON.parse(serialized.text) as Record<string, unknown> & { effects: Record<string, unknown>[] };
        expect(raw).toMatchObject({
            format: CustomEffectsIO.FORMAT,
            version: 1,
            exportedAt: '2026-07-20T12:00:00.000Z',
        });
        expect(raw.effects[0]).toEqual({
            name: 'Moonlit',
            baseEffectIds: ['cool-tint', 'glow', 'sparkle'],
            color: '#88AAFF',
        });
        expect(raw.effects.every((effect) => !Object.hasOwn(effect, 'id'))).toBe(true);
        expect(serialized.text).not.toContain('visualEffect');

        const parsed = CustomEffectsIO.parse(serialized.text);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.effects).toEqual([
            { id: 'custom:0', name: 'Moonlit', baseEffectIds: ['cool-tint', 'glow', 'sparkle'], color: '#88AAFF' },
            { id: 'custom:1', name: 'Ripple', baseEffectIds: ['calm-wave', 'reflection-top'] },
        ]);
    });

    it('deep-clones imported pass arrays and ignores unknown metadata', () => {
        const source = { name: 'Glow', baseEffectIds: ['glow'], future: { value: true } };
        const parsed = CustomEffectsIO.parse(packOf([source], { futureEnvelope: true }));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        source.baseEffectIds.push('sparkle');
        expect(parsed.effects[0]?.baseEffectIds).toEqual(['glow']);
    });

    it.each([
        ['malformed JSON', '{bad', CustomEffectsIO.ERROR_INVALID_JSON],
        ['wrong format', JSON.stringify({ format: 'other', version: 1, effects: [{}] }), CustomEffectsIO.ERROR_WRONG_FORMAT],
        ['unsupported version', packOf([{ name: 'Glow', baseEffectIds: ['glow'] }], { version: 2 }), CustomEffectsIO.ERROR_UNSUPPORTED_VERSION],
        ['missing effects', JSON.stringify({ format: CustomEffectsIO.FORMAT, version: 1 }), CustomEffectsIO.ERROR_EFFECTS_NOT_ARRAY],
        ['empty effects', packOf([]), CustomEffectsIO.ERROR_NOTHING_TO_IMPORT],
    ])('rejects %s', (_label, text, error) => {
        const parsed = CustomEffectsIO.parse(text);
        expect(parsed).toEqual({ ok: false, error });
    });

    it('rejects oversized text and packs over the project limit', () => {
        const oversized = ' '.repeat(CustomEffectsIO.MAX_FILE_BYTES + 1);
        expect(CustomEffectsIO.parse(oversized)).toEqual({ ok: false, error: CustomEffectsIO.ERROR_FILE_TOO_LARGE });
        const effects = Array.from({ length: CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions + 1 }, (_, index) => ({
            name: `E${index}`,
            baseEffectIds: ['glow'],
        }));
        expect(CustomEffectsIO.parse(packOf(effects))).toEqual({ ok: false, error: CustomEffectsIO.ERROR_TOO_MANY_EFFECTS });
    });

    it.each([
        { name: '', baseEffectIds: ['glow'] },
        { name: '123456789', baseEffectIds: ['glow'] },
        { name: 'Glow', baseEffectIds: [] },
        { name: 'Glow', baseEffectIds: ['unknown'] },
        { name: 'Glow', baseEffectIds: ['glow', 'glow'] },
        { name: 'Glow', baseEffectIds: ['glow'], color: '#123' },
        { name: 'Glow', baseEffectIds: ['glow'], color: 123 },
    ])('rejects an invalid recipe atomically: $name', (recipe) => {
        const parsed = CustomEffectsIO.parse(packOf([
            { name: 'Valid', baseEffectIds: ['sparkle'] },
            recipe,
        ]));
        expect(parsed).toEqual({ ok: false, error: CustomEffectsIO.ERROR_INVALID_RECIPE });
    });

    it('rejects duplicate names case-insensitively', () => {
        const parsed = CustomEffectsIO.parse(packOf([
            { name: 'Glow', baseEffectIds: ['glow'] },
            { name: 'gLoW', baseEffectIds: ['sparkle'] },
        ]));
        expect(parsed).toEqual({ ok: false, error: CustomEffectsIO.ERROR_DUPLICATE_NAME });
    });
});
