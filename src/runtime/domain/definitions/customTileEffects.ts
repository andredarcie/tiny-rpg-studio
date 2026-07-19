export const BASE_TILE_EFFECT_IDS = [
    'calm-wave',
    'caustic',
    'choppy-wave',
    'cool-tint',
    'deep-tint',
    'diagonal-outline',
    'embers',
    'emissive',
    'gentle-ridge',
    'glow',
    'height-field-body',
    'inner-outline',
    'intense-glow',
    'murky-tint',
    'outline',
    'ridge-wave',
    'sharp-ridge',
    'soft-glow',
    'sparkle',
    'specular',
    'translucent-wave',
    'reflection-top',
    'reflection-bottom',
    'reflection-left',
    'reflection-right',
] as const;

export type BaseTileEffectId = (typeof BASE_TILE_EFFECT_IDS)[number];
export type CustomTileEffectId = `custom:${string}`;
export type BuiltInTileVisualEffectKind = 'none' | 'water' | 'lava';
export type TileVisualEffectKind = BuiltInTileVisualEffectKind | CustomTileEffectId;

export type CustomTileEffectDefinition = {
    id: CustomTileEffectId;
    name: string;
    baseEffectIds: BaseTileEffectId[];
};

export const CUSTOM_TILE_EFFECT_LIMITS = {
    maxNameLength: 8,
    maxDefinitions: 16,
    maxPasses: BASE_TILE_EFFECT_IDS.length,
} as const;

export type CreateCustomTileEffectError =
    | 'empty-name'
    | 'duplicate-name'
    | 'empty-passes'
    | 'invalid-passes'
    | 'project-limit';

export type CreateCustomTileEffectResult =
    | { ok: true; definition: CustomTileEffectDefinition }
    | { ok: false; error: CreateCustomTileEffectError };

const BASE_ID_SET = new Set<string>(BASE_TILE_EFFECT_IDS);
const CUSTOM_ID_PATTERN = /^custom:[0-9a-z]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function isBaseTileEffectId(value: unknown): value is BaseTileEffectId {
    return typeof value === 'string' && BASE_ID_SET.has(value);
}

export function isCustomTileEffectId(value: unknown): value is CustomTileEffectId {
    return typeof value === 'string' && CUSTOM_ID_PATTERN.test(value);
}

export function normalizeCustomTileEffects(value: unknown): CustomTileEffectDefinition[] {
    if (!Array.isArray(value)) return [];

    const result: CustomTileEffectDefinition[] = [];
    const usedIds = new Set<string>();
    const usedNames = new Set<string>();

    for (const candidate of value) {
        if (result.length >= CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions) break;
        if (!isRecord(candidate) || !isCustomTileEffectId(candidate.id)) continue;

        const name = typeof candidate.name === 'string'
            ? candidate.name.trim().slice(0, CUSTOM_TILE_EFFECT_LIMITS.maxNameLength)
            : '';
        const normalizedName = name.toLocaleLowerCase();
        if (!name || usedIds.has(candidate.id) || usedNames.has(normalizedName)) continue;

        const passes: BaseTileEffectId[] = [];
        const usedPasses = new Set<string>();
        if (Array.isArray(candidate.baseEffectIds)) {
            for (const pass of candidate.baseEffectIds) {
                if (passes.length >= CUSTOM_TILE_EFFECT_LIMITS.maxPasses) break;
                if (!isBaseTileEffectId(pass) || usedPasses.has(pass)) continue;
                usedPasses.add(pass);
                passes.push(pass);
            }
        }
        if (!passes.length) continue;

        usedIds.add(candidate.id);
        usedNames.add(normalizedName);
        result.push({ id: candidate.id, name, baseEffectIds: passes });
    }
    return result;
}

export function createCustomTileEffect(
    existingValue: unknown,
    nameValue: unknown,
    passValue: unknown
): CreateCustomTileEffectResult {
    const existing = normalizeCustomTileEffects(existingValue);
    if (existing.length >= CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions) {
        return { ok: false, error: 'project-limit' };
    }

    const name = typeof nameValue === 'string'
        ? nameValue.trim().slice(0, CUSTOM_TILE_EFFECT_LIMITS.maxNameLength)
        : '';
    if (!name) return { ok: false, error: 'empty-name' };
    if (existing.some((definition) => definition.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        return { ok: false, error: 'duplicate-name' };
    }
    if (!Array.isArray(passValue) || passValue.length === 0) {
        return { ok: false, error: 'empty-passes' };
    }
    if (
        passValue.length > CUSTOM_TILE_EFFECT_LIMITS.maxPasses ||
        passValue.some((pass) => !isBaseTileEffectId(pass)) ||
        new Set(passValue).size !== passValue.length
    ) {
        return { ok: false, error: 'invalid-passes' };
    }

    const usedIds = new Set(existing.map((definition) => definition.id));
    let suffix = 0;
    while (usedIds.has(`custom:${suffix.toString(36)}`)) suffix += 1;

    return {
        ok: true,
        definition: {
            id: `custom:${suffix.toString(36)}`,
            name,
            baseEffectIds: passValue as BaseTileEffectId[],
        },
    };
}

export function getCustomTileEffect(
    definitions: unknown,
    id: unknown
): CustomTileEffectDefinition | null {
    if (!isCustomTileEffectId(id)) return null;
    return normalizeCustomTileEffects(definitions).find((definition) => definition.id === id) ?? null;
}

export function normalizeTileVisualEffect(
    value: unknown,
    definitions: unknown
): TileVisualEffectKind {
    if (value === 'none' || value === 'water' || value === 'lava') return value;
    return getCustomTileEffect(definitions, value)?.id ?? 'none';
}
