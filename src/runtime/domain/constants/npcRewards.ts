export const NPC_END_GAME_REWARD_ID = 'END_GAME';

type VariableIdNormalizer = (id: string | null) => string | null;

export const normalizeNpcRewardId = (
    id: string | null | undefined,
    normalizeVariableId: VariableIdNormalizer,
): string | null => {
    if (id === NPC_END_GAME_REWARD_ID) return NPC_END_GAME_REWARD_ID;
    return normalizeVariableId(id ?? null);
};
