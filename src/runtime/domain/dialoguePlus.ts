export type DialoguePlusAlternative = {
  id: string;
  kind: 'alternative';
  conditionVariableId: string | null;
  text: string;
  rewardVariableId: string | null;
  disappearAfterDialog: boolean;
};

export type DialoguePlusChoice = {
  id: string;
  kind: 'choice';
  prompt: string;
  yesText: string;
  noText: string;
  yesVariableId: string | null;
  noVariableId: string | null;
  disappearAfterDialog: boolean;
};

export type DialoguePlusBlock = DialoguePlusAlternative | DialoguePlusChoice;
export type DialoguePlusNpc = { dialoguePlus?: DialoguePlusBlock[] };
export type NpcDialogueSequence = (npc: DialoguePlusNpc) => DialoguePlusBlock[] | undefined;

export const dialoguePlusReadKey = (id: string): string => `dialogue-plus:${id}`;
export const dialoguePlusChoiceKey = (npcId: string, id: string): string => `${npcId}:dialogue-plus:${id}`;

export function normalizeDialoguePlus(
  value: unknown,
  normalizeCondition: (id: string | null) => string | null,
  normalizeReward: (id: string | null) => string | null,
): DialoguePlusBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set<string>();
  const blocks: DialoguePlusBlock[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const block = raw as Record<string, unknown>;
    const id = typeof block.id === 'string' ? block.id.trim() : '';
    if (!id || ids.has(id)) continue;
    const field = (name: string) => typeof block[name] === 'string' ? block[name] as string : '';
    const variable = (name: string) => field(name) || null;
    if (block.kind === 'alternative') {
      blocks.push({
        id, kind: 'alternative', conditionVariableId: normalizeCondition(variable('conditionVariableId')),
        text: field('text'), rewardVariableId: normalizeReward(variable('rewardVariableId')),
        disappearAfterDialog: block.disappearAfterDialog === true,
      });
    } else if (block.kind === 'choice') {
      blocks.push({
        id, kind: 'choice', prompt: field('prompt'), yesText: field('yesText'), noText: field('noText'),
        yesVariableId: normalizeReward(variable('yesVariableId')),
        noVariableId: normalizeReward(variable('noVariableId')),
        disappearAfterDialog: block.disappearAfterDialog === true,
      });
    } else continue;
    ids.add(id);
  }
  return blocks;
}
