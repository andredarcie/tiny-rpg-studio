import {
    CUSTOM_TILE_EFFECT_LIMITS,
    isBaseTileEffectId,
    normalizeCustomTileEffectColor,
    normalizeCustomTileEffects,
    type BaseTileEffectId,
    type CustomTileEffectColor,
    type CustomTileEffectDefinition,
} from '../../runtime/domain/definitions/customTileEffects';

export type PortableCustomEffectRecipe = {
    name: string;
    baseEffectIds: BaseTileEffectId[];
    color?: CustomTileEffectColor;
};

export type CustomEffectsPackV1 = {
    format: 'tiny-rpg-studio-custom-effects';
    version: 1;
    exportedAt?: string;
    effects: PortableCustomEffectRecipe[];
};

export type CustomEffectsParseResult =
    | { ok: true; effects: CustomTileEffectDefinition[] }
    | { ok: false; error: string };

export type CustomEffectsSerializeResult =
    | { ok: true; text: string }
    | { ok: false; error: string };

export type PortableRecipesResult =
    | { ok: true; recipes: PortableCustomEffectRecipe[] }
    | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class CustomEffectsIO {
    static readonly FORMAT = 'tiny-rpg-studio-custom-effects' as const;
    static readonly VERSION = 1 as const;
    static readonly MAX_FILE_BYTES = 256 * 1024;

    static readonly ERROR_INVALID_JSON = 'invalid_json';
    static readonly ERROR_WRONG_FORMAT = 'wrong_format';
    static readonly ERROR_UNSUPPORTED_VERSION = 'unsupported_version';
    static readonly ERROR_EFFECTS_NOT_ARRAY = 'effects_not_array';
    static readonly ERROR_NOTHING_TO_IMPORT = 'nothing_to_import';
    static readonly ERROR_TOO_MANY_EFFECTS = 'too_many_effects';
    static readonly ERROR_INVALID_RECIPE = 'invalid_recipe';
    static readonly ERROR_DUPLICATE_NAME = 'duplicate_name';
    static readonly ERROR_FILE_TOO_LARGE = 'file_too_large';

    static serialize(
        definitions: readonly CustomTileEffectDefinition[],
        meta?: { exportedAt?: string }
    ): CustomEffectsSerializeResult {
        const portable = CustomEffectsIO.toPortableRecipes(definitions);
        if (!portable.ok) return portable;

        const pack: CustomEffectsPackV1 = {
            format: CustomEffectsIO.FORMAT,
            version: CustomEffectsIO.VERSION,
            exportedAt: meta?.exportedAt ?? new Date().toISOString(),
            effects: portable.recipes,
        };
        return { ok: true, text: JSON.stringify(pack, null, 2) };
    }

    static toPortableRecipes(
        definitions: readonly CustomTileEffectDefinition[]
    ): PortableRecipesResult {
        if (!Array.isArray(definitions) || definitions.length === 0) {
            return { ok: false, error: CustomEffectsIO.ERROR_NOTHING_TO_IMPORT };
        }
        if (definitions.length > CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions) {
            return { ok: false, error: CustomEffectsIO.ERROR_TOO_MANY_EFFECTS };
        }

        const normalized = normalizeCustomTileEffects(definitions);
        if (normalized.length !== definitions.length) {
            return { ok: false, error: CustomEffectsIO.ERROR_INVALID_RECIPE };
        }

        return {
            ok: true,
            recipes: normalized.map(({ name, baseEffectIds, color }) => ({
                name,
                baseEffectIds: baseEffectIds.slice(),
                ...(color ? { color } : {}),
            })),
        };
    }

    static validatePortableRecipes(value: unknown): PortableRecipesResult {
        if (!Array.isArray(value)) {
            return { ok: false, error: CustomEffectsIO.ERROR_EFFECTS_NOT_ARRAY };
        }
        if (value.length === 0) {
            return { ok: false, error: CustomEffectsIO.ERROR_NOTHING_TO_IMPORT };
        }
        if (value.length > CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions) {
            return { ok: false, error: CustomEffectsIO.ERROR_TOO_MANY_EFFECTS };
        }

        const recipes: PortableCustomEffectRecipe[] = [];
        const usedNames = new Set<string>();
        for (const candidate of value) {
            const recipe = CustomEffectsIO.validateRecipe(candidate);
            if (!recipe) {
                return { ok: false, error: CustomEffectsIO.ERROR_INVALID_RECIPE };
            }
            const nameKey = recipe.name.toLocaleLowerCase();
            if (usedNames.has(nameKey)) {
                return { ok: false, error: CustomEffectsIO.ERROR_DUPLICATE_NAME };
            }
            usedNames.add(nameKey);
            recipes.push(recipe);
        }

        return { ok: true, recipes };
    }

    static parse(text: string): CustomEffectsParseResult {
        if (typeof text !== 'string') {
            return { ok: false, error: CustomEffectsIO.ERROR_INVALID_JSON };
        }
        if (new TextEncoder().encode(text).length > CustomEffectsIO.MAX_FILE_BYTES) {
            return { ok: false, error: CustomEffectsIO.ERROR_FILE_TOO_LARGE };
        }

        let data: unknown;
        try {
            data = JSON.parse(text) as unknown;
        } catch {
            return { ok: false, error: CustomEffectsIO.ERROR_INVALID_JSON };
        }
        if (!isRecord(data)) {
            return { ok: false, error: CustomEffectsIO.ERROR_INVALID_JSON };
        }
        if (data.format !== CustomEffectsIO.FORMAT) {
            return { ok: false, error: CustomEffectsIO.ERROR_WRONG_FORMAT };
        }
        if (data.version !== CustomEffectsIO.VERSION) {
            return { ok: false, error: CustomEffectsIO.ERROR_UNSUPPORTED_VERSION };
        }
        const validated = CustomEffectsIO.validatePortableRecipes(data.effects);
        if (!validated.ok) return validated;

        return {
            ok: true,
            effects: validated.recipes.map((recipe, index) => ({
                id: `custom:${index.toString(36)}`,
                name: recipe.name,
                baseEffectIds: recipe.baseEffectIds.slice(),
                ...(recipe.color ? { color: recipe.color } : {}),
            })),
        };
    }

    private static validateRecipe(value: unknown): PortableCustomEffectRecipe | null {
        if (!isRecord(value) || typeof value.name !== 'string') return null;
        const name = value.name.trim();
        if (!name || name.length > CUSTOM_TILE_EFFECT_LIMITS.maxNameLength) return null;

        if (
            !Array.isArray(value.baseEffectIds) ||
            value.baseEffectIds.length === 0 ||
            value.baseEffectIds.length > CUSTOM_TILE_EFFECT_LIMITS.maxPasses ||
            value.baseEffectIds.some((id) => !isBaseTileEffectId(id)) ||
            new Set(value.baseEffectIds).size !== value.baseEffectIds.length
        ) {
            return null;
        }

        let color: CustomTileEffectColor | undefined;
        if (Object.prototype.hasOwnProperty.call(value, 'color')) {
            color = normalizeCustomTileEffectColor(value.color);
            if (!color) return null;
        }

        return {
            name,
            baseEffectIds: (value.baseEffectIds as BaseTileEffectId[]).slice(),
            ...(color ? { color } : {}),
        };
    }
}

export default CustomEffectsIO;
