type TrapStateLike = {
    variableId?: string | null;
};

type VariableStateLookup = (variableId: string) => boolean;

const isTrapActive = (
    trap: TrapStateLike | null | undefined,
    isVariableOn?: VariableStateLookup | null
): boolean => {
    const variableId = typeof trap?.variableId === 'string' && trap.variableId.trim()
        ? trap.variableId
        : null;
    if (!variableId || !isVariableOn) return true;
    return !isVariableOn(variableId);
};

export { isTrapActive };
export type { TrapStateLike, VariableStateLookup };
