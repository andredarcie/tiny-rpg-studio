type ChestStateLike = {
    variableId?: string | null;
};

type VariableIdNormalizer = (variableId: string | null) => string | null;
type VariableStateLookup = (variableId: string) => boolean;

const normalizeChestVariableId = (
    variableId: string | null | undefined,
    normalizeVariableId?: VariableIdNormalizer | null
): string | null => {
    if (typeof variableId !== 'string' || !/^var-(?:[1-9]|[12][0-9]|3[0-2])$/.test(variableId)) {
        return null;
    }
    if (!normalizeVariableId) return /^var-(?:[1-9]|1[0-6])$/.test(variableId) ? variableId : null;
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
