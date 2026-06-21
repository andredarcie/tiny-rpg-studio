type NpcDialogState = {
  id?: string;
  text?: string;
  conditionText?: string;
  conditionVariableId?: string | null;
  rewardVariableId?: string | null;
  conditionalRewardVariableId?: string | null;
  choiceEnabled?: boolean;
  choicePrompt?: string;
  choiceYesText?: string;
  choiceNoText?: string;
  choiceYesVariableId?: string | null;
  choiceNoVariableId?: string | null;
};

type NpcDialogResolverGameState = {
  normalizeVariableId?: (id: string | null) => string | null;
  isVariableOn?: (id: string) => boolean;
  hasSkill?: (skillId: string) => boolean;
  // True when this NPC's choice was already answered in the current playthrough.
  // A definitive (answered) choice never re-prompts until a full restart.
  hasAnsweredChoice?: (npcId: string | undefined) => boolean;
};

type ResolvedChoiceBranch = {
  text: string;
  rewardVariableId: string | null;
};

type ResolvedNpcDialog = {
  kind: 'simple' | 'choice';
  text: string;
  hasDialog: boolean;
  variantKey: string | null;
  rewardVariableId: string | null;
  choices: { yes: ResolvedChoiceBranch; no: ResolvedChoiceBranch } | null;
};

const getTrimmedDialogText = (value: string | undefined): string => {
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Resolves the NPC's condition VARIABLE state, ignoring whether a conditionText
 * exists. Used as the choice "gate" (D2): the choice is presented only when the
 * condition is active. Distinct from `isNpcDialogConditionActive`, which also
 * requires a non-empty conditionText for the simple conditional-text swap.
 */
const isNpcConditionVariableActive = (npc: NpcDialogState, gameState: NpcDialogResolverGameState): boolean => {
  const rawConditionId = npc.conditionVariableId || null;
  if (!rawConditionId) {
    return false;
  }
  if (rawConditionId === 'skill:bard') {
    return Boolean(gameState.hasSkill?.('charisma'));
  }
  const conditionId = gameState.normalizeVariableId?.(rawConditionId) ?? rawConditionId;
  return Boolean(conditionId && gameState.isVariableOn?.(conditionId));
};

const isNpcDialogConditionActive = (npc: NpcDialogState, gameState: NpcDialogResolverGameState): boolean => {
  const hasConditionText = getTrimmedDialogText(npc.conditionText).length > 0;
  if (!hasConditionText) {
    return false;
  }
  return isNpcConditionVariableActive(npc, gameState);
};

const resolveChoiceDialog = (npc: NpcDialogState, gameState: NpcDialogResolverGameState): ResolvedNpcDialog | null => {
  if (npc.choiceEnabled !== true) {
    return null;
  }
  // A definitive choice is answered once per playthrough: after that it never
  // re-prompts and the NPC falls back to its simple dialog.
  if (gameState.hasAnsweredChoice?.(npc.id)) {
    return null;
  }

  // The choice is independent of the condition: the condition only swaps the simple
  // (default) dialog text, which is shown BEFORE the choice. So the choice shows
  // whenever it is enabled with a prompt.
  const promptText = npc.choicePrompt ?? '';
  if (getTrimmedDialogText(promptText).length === 0) {
    return null;
  }

  // Use the normalizer's verdict directly: an invalid id must stay null rather than
  // falling back to the raw value (unlike the legacy simple-reward path below).
  // NOTE: call through `gameState` (not a detached reference) so the method keeps its
  // `this` binding — GameState.normalizeVariableId delegates to this.variableManager.
  const yesReward = gameState.normalizeVariableId
    ? gameState.normalizeVariableId(npc.choiceYesVariableId ?? null)
    : (npc.choiceYesVariableId ?? null);
  const noReward = gameState.normalizeVariableId
    ? gameState.normalizeVariableId(npc.choiceNoVariableId ?? null)
    : (npc.choiceNoVariableId ?? null);

  return {
    kind: 'choice',
    text: promptText,
    hasDialog: true,
    variantKey: `choice:${promptText}`,
    rewardVariableId: null,
    choices: {
      yes: { text: npc.choiceYesText ?? '', rewardVariableId: yesReward },
      no: { text: npc.choiceNoText ?? '', rewardVariableId: noReward },
    },
  };
};

/**
 * Resolves the NPC's SIMPLE dialog (default text, or the conditional text when the
 * condition is active). The choice dialog is resolved separately via
 * resolveChoiceDialog and shown AFTER this one (default dialog first, then the
 * Yes/No question), so this function never returns a choice.
 */
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
    kind: 'simple',
    text,
    hasDialog,
    variantKey,
    rewardVariableId,
    choices: null,
  };
};

export type { NpcDialogResolverGameState, NpcDialogState, ResolvedChoiceBranch, ResolvedNpcDialog };
export { isNpcConditionVariableActive, isNpcDialogConditionActive, resolveChoiceDialog, resolveNpcDialog };
