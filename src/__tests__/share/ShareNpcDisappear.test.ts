import { beforeAll, describe, expect, it } from 'vitest';
import {
  setupShareGlobals,
  ShareConstants,
  ShareDecoder,
  ShareEncoder,
  ShareTextCodec,
} from './shareTestUtils';

type DecodedNpc = {
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
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_45);
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
