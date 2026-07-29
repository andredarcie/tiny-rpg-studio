import { beforeAll, describe, expect, it } from 'vitest';
import { NPC_END_GAME_REWARD_ID } from '../../runtime/domain/constants/npcRewards';
import {
  setupShareGlobals,
  ShareConstants,
  ShareDataNormalizer,
  ShareDecoder,
  ShareEncoder,
  ShareVariableCodec,
} from './shareTestUtils';

type DecodedNpc = {
  conditionVariableId?: string | null;
  rewardVariableId?: string | null;
  conditionalRewardVariableId?: string | null;
  choiceYesVariableId?: string | null;
  choiceNoVariableId?: string | null;
};

const buildGame = (sprite: Record<string, unknown>) => {
  const size = ShareConstants.MATRIX_SIZE;
  const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const overlay = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as number | null));
  return {
    title: 'Dialog Ending',
    sprites: [sprite],
    enemies: [],
    objects: [],
    variables: [],
    tileset: { map: { ground, overlay }, maps: [] },
  };
};

describe('VERSION_39 NPC END_GAME rewards', () => {
  beforeAll(() => {
    setupShareGlobals({
      npcDefinitions: [
        { id: 'npc-1', type: 'merchant', name: 'Merchant', defaultText: 'Hello!' },
      ],
      enemyDefinitions: [{ type: 'slime' }],
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime'),
    });
  });

  it('registers VERSION_39 without moving older feature boundaries', () => {
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_39);
    expect(ShareConstants.NPC_END_GAME_VERSION).toBe(ShareConstants.VERSION_39);
    expect(ShareConstants.TRAP_SOLID_VERSION).toBe(ShareConstants.VERSION_38);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_39)).toBe(true);
  });

  it('appends END_GAME only to the reward reference catalog', () => {
    const oldIds = [...ShareConstants.VARIABLE_IDS];
    const reference = ShareVariableCodec.rewardIdToReference(NPC_END_GAME_REWARD_ID);

    expect(ShareConstants.VARIABLE_IDS).toEqual(oldIds);
    expect(reference).toBe(ShareConstants.VARIABLE_IDS.length + 1);
    expect(ShareVariableCodec.referenceToRewardId(reference, true)).toBe(NPC_END_GAME_REWARD_ID);
    expect(ShareVariableCodec.referenceToRewardId(reference, false)).toBeNull();
    expect(ShareVariableCodec.variableIdToNibble(NPC_END_GAME_REWARD_ID)).toBe(0);
    expect(ShareVariableCodec.buildVariableEntries([])).toHaveLength(oldIds.length);
  });

  it('round-trips END_GAME in all four NPC reward fields', () => {
    const code = ShareEncoder.buildShareCode(buildGame({
      id: 'npc-1',
      type: 'merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
      text: 'Goodbye',
      rewardVariableId: NPC_END_GAME_REWARD_ID,
      conditionalRewardVariableId: NPC_END_GAME_REWARD_ID,
      choiceEnabled: true,
      choicePrompt: 'Finish?',
      choiceYesVariableId: NPC_END_GAME_REWARD_ID,
      choiceNoVariableId: NPC_END_GAME_REWARD_ID,
    }));
    const decoded = ShareDecoder.decodeShareCode(code) as { sprites?: DecodedNpc[] } | null;

    expect(decoded?.sprites?.[0]).toMatchObject({
      rewardVariableId: NPC_END_GAME_REWARD_ID,
      conditionalRewardVariableId: NPC_END_GAME_REWARD_ID,
      choiceYesVariableId: NPC_END_GAME_REWARD_ID,
      choiceNoVariableId: NPC_END_GAME_REWARD_ID,
    });
  });

  it('does not allow a VERSION_38 payload to manufacture END_GAME', () => {
    const current = ShareEncoder.buildShareCode(buildGame({
      id: 'npc-1',
      type: 'merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
      rewardVariableId: NPC_END_GAME_REWARD_ID,
      conditionalRewardVariableId: NPC_END_GAME_REWARD_ID,
      choiceEnabled: true,
      choicePrompt: 'Finish?',
      choiceYesVariableId: NPC_END_GAME_REWARD_ID,
      choiceNoVariableId: NPC_END_GAME_REWARD_ID,
    }));
    const legacy = current.replace(
      /(^|\.)v[0-9a-z]+/,
      `$1v${ShareConstants.VERSION_38.toString(36)}`,
    );
    const decoded = ShareDecoder.decodeShareCode(legacy) as { sprites?: DecodedNpc[] } | null;

    expect(decoded?.sprites?.[0]).toMatchObject({
      rewardVariableId: null,
      conditionalRewardVariableId: null,
      choiceYesVariableId: null,
      choiceNoVariableId: null,
    });
  });

  it('allows END_GAME only in NPC reward fields during normalization', () => {
    const npc = ShareDataNormalizer.normalizeSprites([{
      id: 'npc-1',
      type: 'merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
      conditionVariableId: NPC_END_GAME_REWARD_ID,
      rewardVariableId: NPC_END_GAME_REWARD_ID,
      conditionalRewardVariableId: NPC_END_GAME_REWARD_ID,
      choiceYesVariableId: NPC_END_GAME_REWARD_ID,
      choiceNoVariableId: NPC_END_GAME_REWARD_ID,
    }])[0];

    expect(npc.conditionVariableId).toBeNull();
    expect(npc.rewardVariableId).toBe(NPC_END_GAME_REWARD_ID);
    expect(npc.conditionalRewardVariableId).toBe(NPC_END_GAME_REWARD_ID);
    expect(npc.choiceYesVariableId).toBe(NPC_END_GAME_REWARD_ID);
    expect(npc.choiceNoVariableId).toBe(NPC_END_GAME_REWARD_ID);
    expect(ShareDataNormalizer.normalizeEnemyVariable(NPC_END_GAME_REWARD_ID)).toBeNull();
  });
});
