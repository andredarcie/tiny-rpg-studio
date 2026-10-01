import { NPC_END_GAME_REWARD_ID } from '../../domain/constants/npcRewards';
import {
  dialoguePlusChoiceKey,
  dialoguePlusReadKey,
  type DialoguePlusAlternative,
  type DialoguePlusBlock,
  type DialoguePlusChoice,
} from '../../domain/dialoguePlus';
import { isNpcConditionVariableActive, type NpcDialogResolverGameState } from './resolveNpcDialog';

export type DialoguePlusSelection =
  | { kind: 'default'; variantKey: string }
  | { kind: 'alternative'; block: DialoguePlusAlternative; variantKey: string }
  | { kind: 'choice'; block: DialoguePlusChoice; variantKey: string };

export type DialoguePlusState = NpcDialogResolverGameState & {
  hasUnreadNpcDialog?: (npcId: string, variantKey: string | null) => boolean;
};

export type DialoguePlusNpcState = {
  id?: string;
  text?: string;
  rewardVariableId?: string | null;
};

const isRewardActive = (rewardId: string | null | undefined, state: DialoguePlusState): boolean => {
  if (!rewardId || rewardId === NPC_END_GAME_REWARD_ID) return false;
  const variableId = state.normalizeVariableId?.(rewardId) ?? rewardId;
  return Boolean(state.isVariableOn?.(variableId));
};

export const resolveDialoguePlus = (
  npc: DialoguePlusNpcState,
  blocks: DialoguePlusBlock[],
  state: DialoguePlusState,
): DialoguePlusSelection | null => {
  const npcId = npc.id || '';
  const activeAlternatives = blocks.filter((block): block is DialoguePlusAlternative =>
    block.kind === 'alternative' && Boolean(block.text.trim()) && isNpcConditionVariableActive(block, state));
  const availableAlternatives = activeAlternatives.filter(block => !isRewardActive(block.rewardVariableId, state));
  const unread = (variantKey: string) => state.hasUnreadNpcDialog?.(npcId, variantKey) !== false;

  const newAlternative = availableAlternatives.find(block => unread(dialoguePlusReadKey(block.id)));
  if (newAlternative) {
    return { kind: 'alternative', block: newAlternative, variantKey: dialoguePlusReadKey(newAlternative.id) };
  }

  const defaultKey = `default:${npc.text || ''}`;
  const defaultAvailable = activeAlternatives.length === 0 && Boolean(npc.text?.trim())
    && !isRewardActive(npc.rewardVariableId, state);
  if (defaultAvailable && unread(defaultKey)) return { kind: 'default', variantKey: defaultKey };

  const choice = blocks.find((block): block is DialoguePlusChoice =>
    block.kind === 'choice' && Boolean(block.prompt.trim())
    && !state.hasAnsweredChoice?.(dialoguePlusChoiceKey(npcId, block.id)));
  if (choice) return { kind: 'choice', block: choice, variantKey: dialoguePlusReadKey(choice.id) };

  if (availableAlternatives.length) {
    const block = availableAlternatives[0];
    return { kind: 'alternative', block, variantKey: dialoguePlusReadKey(block.id) };
  }
  if (defaultAvailable) return { kind: 'default', variantKey: defaultKey };
  return null;
};
