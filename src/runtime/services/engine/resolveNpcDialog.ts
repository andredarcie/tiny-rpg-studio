type NpcDialogState = {
  id?: string;
  text?: string;
  conditionText?: string;
  conditionVariableId?: string | null;
  rewardVariableId?: string | null;
  conditionalRewardVariableId?: string | null;
};

type NpcDialogResolverGameState = {
  normalizeVariableId?: (id: string | null) => string | null;
  isVariableOn?: (id: string) => boolean;
  hasSkill?: (skillId: string) => boolean;
};

type ResolvedNpcDialog = {
  text: string;
  hasDialog: boolean;
  variantKey: string | null;
  rewardVariableId: string | null;
};

const getTrimmedDialogText = (value: string | undefined): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const isNpcDialogConditionActive = (npc: NpcDialogState, gameState: NpcDialogResolverGameState): boolean => {
  const rawConditionId = npc.conditionVariableId || null;
  const hasConditionText = getTrimmedDialogText(npc.conditionText).length > 0;
  if (!hasConditionText) {
    return false;
  }

  if (rawConditionId === 'skill:bard') {
    return Boolean(gameState.hasSkill?.('charisma'));
  }

  const conditionId = gameState.normalizeVariableId?.(rawConditionId) ?? rawConditionId;
  return Boolean(conditionId && gameState.isVariableOn?.(conditionId));
};

const resolveNpcDialog = (npc: NpcDialogState, gameState: NpcDialogResolverGameState): ResolvedNpcDialog => {
  const conditionActive = isNpcDialogConditionActive(npc, gameState);
  const useConditionalText = conditionActive && getTrimmedDialogText(npc.conditionText).length > 0;
  const text = useConditionalText ? (npc.conditionText ?? '') : (npc.text ?? '');
  const hasDialog = getTrimmedDialogText(text).length > 0;
  const variantKey = hasDialog
    ? useConditionalText
      ? `conditional:${npc.conditionVariableId || ''}:${npc.conditionText || ''}`
      : `default:${npc.text || ''}`
    : null;
  const rewardVariableId = useConditionalText
    ? (gameState.normalizeVariableId?.(npc.conditionalRewardVariableId ?? null) ?? npc.conditionalRewardVariableId ?? null)
    : (gameState.normalizeVariableId?.(npc.rewardVariableId ?? null) ?? npc.rewardVariableId ?? null);

  return {
    text,
    hasDialog,
    variantKey,
    rewardVariableId,
  };
};

export type { NpcDialogResolverGameState, NpcDialogState, ResolvedNpcDialog };
export { isNpcDialogConditionActive, resolveNpcDialog };
