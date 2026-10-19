import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  setupShareGlobals,
  ShareConstants,
  ShareDecoder,
  ShareEncoder,
  ShareTextCodec,
} from './shareTestUtils';

type DecodedNpc = {
  wander?: boolean;
  wanderSpeed?: number;
  disappearAfterDialog?: boolean;
  choiceEnabled?: boolean;
  choicePrompt?: string;
};

const buildGame = (sprite: Record<string, unknown>) => {
  const size = ShareConstants.MATRIX_SIZE;
  const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const overlay = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as number | null));
  return {
    title: 'Leaving NPC',
    sprites: [{
      id: 'npc-1', type: 'merchant', x: 1, y: 1, roomIndex: 0,
      placed: true, text: 'Bye', ...sprite,
    }],
    enemies: [], objects: [], variables: [],
    tileset: { map: { ground, overlay }, maps: [] },
  };
};

const decodeNpc = (code: string): DecodedNpc | undefined => {
  const decoded = ShareDecoder.decodeShareCode(code) as { sprites?: DecodedNpc[] } | null;
  return decoded?.sprites?.[0];
};

const replaceVersion = (code: string, version: number): string => code.replace(
  /(^|\.)v[0-9a-z]+/,
  `$1v${version.toString(36)}`,
);

const replaceNpcMetadata = (code: string, value: unknown): string => {
  const encoded = ShareTextCodec.encodeText(JSON.stringify(value));
  return code.split('.').map((part) => part.startsWith('9') ? `9${encoded}` : part).join('.');
};

describe('VERSION_40 disappearing NPCs', () => {
  beforeAll(() => {
    setupShareGlobals({
      npcDefinitions: [{ id: 'npc-1', type: 'merchant', name: 'Merchant', defaultText: 'Hello!' }],
      enemyDefinitions: [{ type: 'slime' }],
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime'),
    });
  });

  it('registers the new version without moving older feature boundaries', () => {
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_47);
    expect(ShareConstants.NPC_DISAPPEAR_VERSION).toBe(ShareConstants.VERSION_40);
    expect(ShareConstants.NPC_END_GAME_VERSION).toBe(ShareConstants.VERSION_39);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_40)).toBe(true);
  });

  it('round-trips a d-only entry without enabling choices', () => {
    const npc = decodeNpc(ShareEncoder.buildShareCode(buildGame({ disappearAfterDialog: true })));

    expect(npc).toMatchObject({ disappearAfterDialog: true, choiceEnabled: false });
  });

  it('keeps VERSION_39 choice entries enabled but ignores disappearance', () => {
    const current = ShareEncoder.buildShareCode(buildGame({
      disappearAfterDialog: true,
      choiceEnabled: true,
      choicePrompt: 'Stay?',
    }));
    const npc = decodeNpc(replaceVersion(current, ShareConstants.VERSION_39));

    expect(npc).toMatchObject({
      disappearAfterDialog: false,
      choiceEnabled: true,
      choicePrompt: 'Stay?',
    });
  });

  it('defaults missing and malformed disappearance flags to false', () => {
    const withoutFlag = ShareEncoder.buildShareCode(buildGame({ choiceEnabled: true, choicePrompt: 'Stay?' }));
    const malformed = replaceNpcMetadata(withoutFlag, { 0: { p: 'Stay?', d: '1' } });

    expect(decodeNpc(withoutFlag)?.disappearAfterDialog).toBe(false);
    expect(decodeNpc(malformed)?.disappearAfterDialog).toBe(false);
  });
});


describe('V47 NPC movement metadata', () => {
  it.each([[true, 0], [true, 0.5], [true, 1], [true, 2], [false, 0], [false, 1.5], [false, 1]])('round-trips wander=%s speed=%s without choices', (wander, wanderSpeed) => {
    const code = ShareEncoder.buildShareCode(buildGame({ wander, wanderSpeed }));
    expect(decodeNpc(code)).toMatchObject({ wander, wanderSpeed, choiceEnabled: false });
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_47);
  });
  it('defaults old metadata and normalizes malformed movement metadata', () => {
    const code = ShareEncoder.buildShareCode(buildGame({ disappearAfterDialog: true }));
    expect(decodeNpc(code)).toMatchObject({ wander: false, wanderSpeed: 1 });
    expect(decodeNpc(replaceNpcMetadata(code, { 0: { w: '1', s: '0' } }))).toMatchObject({ wander: false, wanderSpeed: 1 });
    expect(decodeNpc(replaceNpcMetadata(code, { 0: { w: 1, s: 5 } }))).toMatchObject({ wander: true, wanderSpeed: 2 });
  });
  it('coexists with choices and disappearance', () => {
    const code = ShareEncoder.buildShareCode(buildGame({ wander: true, wanderSpeed: 1.5, choiceEnabled: true, choicePrompt: 'Stay?', disappearAfterDialog: true }));
    expect(decodeNpc(code)).toMatchObject({ wander: true, wanderSpeed: 1.5, choiceEnabled: true, choicePrompt: 'Stay?', disappearAfterDialog: true });
  });
});


it('omits default metadata and decodes multiple NPCs through both construction branches', () => {
  const stationary = ShareEncoder.buildShareCode(buildGame({}));
  expect(stationary.split('.').some(part => part.startsWith('9'))).toBe(false);
  const game = buildGame({ wander: true, wanderSpeed: 0 });
  game.sprites.push({ ...game.sprites[0], id: 'npc-2', x: 3, wander: false, wanderSpeed: 2 } as typeof game.sprites[number]);
  const code = ShareEncoder.buildShareCode(game);
  const expected = [{ wander: true, wanderSpeed: 0 }, { wander: false, wanderSpeed: 2 }];
  const normal = ShareDecoder.decodeShareCode(code) as { sprites: unknown[] };
  expect(normal.sprites).toMatchObject(expected);
  const spy = vi.spyOn(ShareConstants, 'NPC_DEFINITIONS', 'get').mockReturnValue([]);
  try {
    const fallback = ShareDecoder.decodeShareCode(code) as { sprites: unknown[] };
    expect(fallback.sprites).toMatchObject(expected);
  } finally { spy.mockRestore(); }
});
