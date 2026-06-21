import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareConstants, ShareDecoder, ShareEncoder } from './shareTestUtils';

type SpriteResult = {
  choiceEnabled?: boolean;
  choicePrompt?: string;
  choiceYesText?: string;
  choiceNoText?: string;
  choiceYesVariableId?: string | null;
  choiceNoVariableId?: string | null;
};

type DecodeResult = { sprites?: SpriteResult[] } | null;

const buildBaseGame = (sprite: Record<string, unknown>) => {
  const size = ShareConstants.MATRIX_SIZE;
  const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null as number | null));
  return {
    title: 'Choice Game',
    author: 'Tester',
    start: { x: 1, y: 1, roomIndex: 0 },
    sprites: [sprite],
    enemies: [],
    objects: [],
    variables: [],
    tileset: { map: { ground, overlay }, maps: [] },
  };
};

const roundTrip = (sprite: Record<string, unknown>): SpriteResult | undefined => {
  const code = ShareEncoder.buildShareCode(buildBaseGame(sprite));
  const decoded = ShareDecoder.decodeShareCode(code) as DecodeResult;
  return decoded?.sprites?.[0];
};

describe('Share round-trip — choice dialog', () => {
  beforeAll(() => {
    setupShareGlobals({
      npcDefinitions: [
        { id: 'npc-1', type: 'merchant', name: 'Merchant', defaultText: 'Hello!' },
      ],
      enemyDefinitions: [{ type: 'slime' }],
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime'),
    });
  });

  it('preserves all six choice fields through encode -> decode', () => {
    const npc = roundTrip({
      id: 'npc-1',
      type: 'merchant',
      name: 'Merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
      choiceEnabled: true,
      choicePrompt: 'Accept the quest?',
      choiceYesText: 'Wonderful!',
      choiceNoText: 'Maybe later.',
      choiceYesVariableId: 'var-3',
      choiceNoVariableId: 'var-5',
    });

    expect(npc?.choiceEnabled).toBe(true);
    expect(npc?.choicePrompt).toBe('Accept the quest?');
    expect(npc?.choiceYesText).toBe('Wonderful!');
    expect(npc?.choiceNoText).toBe('Maybe later.');
    expect(npc?.choiceYesVariableId).toBe('var-3');
    expect(npc?.choiceNoVariableId).toBe('var-5');
  });

  it('defaults to no choice for a plain NPC and emits no choice payload key', () => {
    const game = buildBaseGame({
      id: 'npc-1',
      type: 'merchant',
      name: 'Merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
    });
    const code = ShareEncoder.buildShareCode(game);

    // No NPC uses a choice -> the '9' segment must be absent.
    expect(code.split('.').some((segment) => segment.startsWith('9'))).toBe(false);

    const npc = (ShareDecoder.decodeShareCode(code) as DecodeResult)?.sprites?.[0];
    expect(npc?.choiceEnabled).toBe(false);
    expect(npc?.choicePrompt).toBe('');
  });

  it('drops invalid branch reward variables to null', () => {
    const npc = roundTrip({
      id: 'npc-1',
      type: 'merchant',
      name: 'Merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
      choiceEnabled: true,
      choicePrompt: 'Yes or no?',
      choiceYesVariableId: 'not-a-real-var',
      choiceNoVariableId: 'var-9',
    });

    expect(npc?.choiceYesVariableId).toBeNull();
    expect(npc?.choiceNoVariableId).toBe('var-9');
  });

  it('decodes pre-choice (v33) share codes without a choice', () => {
    const code = ShareEncoder.buildShareCode(buildBaseGame({
      id: 'npc-1',
      type: 'merchant',
      name: 'Merchant',
      x: 1,
      y: 1,
      roomIndex: 0,
      placed: true,
      choiceEnabled: true,
      choicePrompt: 'Ignored on old version',
    }));
    // Force the version marker down to 33 (pre-choice) — the '9' segment must be ignored.
    const legacy = code.replace(/(^|\.)v[0-9a-z]+/, `$1v${ShareConstants.VERSION_33.toString(36)}`);

    const npc = (ShareDecoder.decodeShareCode(legacy) as DecodeResult)?.sprites?.[0];
    expect(npc?.choiceEnabled).toBe(false);
  });
});
