type ChestStateLike = {
    variableId?: string | null;
};

type VariableIdNormalizer = (variableId: string | null) => string | null;
type VariableStateLookup = (variableId: string) => boolean;

const CHEST_VARIABLE_IDS = new Set(
    Array.from({ length: 16 }, (_, index) => `var-${index + 1}`)
);

const normalizeChestVariableId = (
    variableId: string | null | undefined,
    normalizeVariableId?: VariableIdNormalizer | null
): string | null => {
    if (typeof variableId !== 'string' || !CHEST_VARIABLE_IDS.has(variableId)) {
        return null;
    }
    if (!normalizeVariableId) return variableId;
    return normalizeVariableId(variableId) === variableId ? variableId : null;
};

const isChestAccessible = (
    chest: ChestStateLike | null | undefined,
    isVariableOn?: VariableStateLookup | null,
    normalizeVariableId?: VariableIdNormalizer | null
): boolean => {
    const variableId = normalizeChestVariableId(chest?.variableId, normalizeVariableId);
    if (!variableId || !isVariableOn) return true;
    return isVariableOn(variableId);
};

export { isChestAccessible, normalizeChestVariableId };
export type { ChestStateLike, VariableIdNormalizer, VariableStateLookup };
