import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareDecoder, ShareEncoder, ShareConstants } from './shareTestUtils';
import type { CustomSpriteEntry } from '../../types/gameState';

type ShareDecodeResult = { customSprites?: CustomSpriteEntry[] };

describe('ShareDecoder', () => {
  beforeAll(() => {
    setupShareGlobals({
      objectTypes: {
        DOOR: 'door',
        KEY: 'key',
        LIFE_POTION: 'life-potion',
        XP_SCROLL: 'xp-scroll',
        SWORD: 'sword',
        SWORD_BRONZE: 'sword-bronze',
        SWORD_WOOD: 'sword-wood',
        PLAYER_END: 'player-end',
        SWITCH: 'switch',
        DOOR_VARIABLE: 'door-variable'
      },
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime')
    });
  });

  it('decodes share code payloads', () => {
    const size = ShareConstants.MATRIX_SIZE;
    const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
    const code = ShareEncoder.buildShareCode({
      title: 'Decoded',
      author: 'Someone',
      start: { x: 3, y: 4, roomIndex: 0 },
      tileset: { map: { ground, overlay }, maps: [] }
    });

    const decoded = ShareDecoder.decodeShareCode(code);

    expect(decoded?.title).toBe('Decoded');
    expect((decoded?.start as { x: number }).x).toBe(3);
  });

  it('returns null for unsupported versions', () => {
    const decoded = ShareDecoder.decodeShareCode('v0');

    expect(decoded).toBeNull();
  });
});

describe('ShareDecoder - customSprites', () => {
  beforeAll(() => {
    setupShareGlobals({
      objectTypes: {
        DOOR: 'door',
        KEY: 'key',
        LIFE_POTION: 'life-potion',
        XP_SCROLL: 'xp-scroll',
        SWORD: 'sword',
        SWORD_BRONZE: 'sword-bronze',
        SWORD_WOOD: 'sword-wood',
        PLAYER_END: 'player-end',
        SWITCH: 'switch',
        DOOR_VARIABLE: 'door-variable'
      },
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime')
    });
  });

  it('decodes the S segment correctly', () => {
    const customSprites = [
      { group: 'npc' as const, key: 'guard', variant: 'base' as const, frames: [Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 5))] },
    ];
    const code = ShareEncoder.buildShareCode({ customSprites });
    const result = ShareDecoder.decodeShareCode(code) as ShareDecodeResult | null;
    expect(result?.customSprites).toHaveLength(1);
    expect(result?.customSprites?.[0]?.group).toBe('npc');
    expect(result?.customSprites?.[0]?.key).toBe('guard');
    expect(result?.customSprites?.[0]?.frames[0]?.[0]?.[0]).toBe(5);
  });

  it('tolerates the absence of the S segment without errors', () => {
    const code = ShareEncoder.buildShareCode({});
    const result = ShareDecoder.decodeShareCode(code) as ShareDecodeResult | null;
    expect(result).not.toBeNull();
    expect(!result?.customSprites || result.customSprites.length === 0).toBe(true);
  });

  it('keeps compatibility with the legacy JSON/base64 S segment', () => {
    const legacyPayload = [
      {
        g: 'enemy',
        k: 'bat',
        v: 'base',
        f: ['0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef']
      }
    ];
    const legacyEncoded = btoa(JSON.stringify(legacyPayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const code = `v${ShareConstants.VERSION_20.toString(36)}.S${legacyEncoded}`;

    const result = ShareDecoder.decodeShareCode(code) as ShareDecodeResult | null;

    expect(result?.customSprites).toHaveLength(1);
    expect(result?.customSprites?.[0]?.group).toBe('enemy');
    expect(result?.customSprites?.[0]?.key).toBe('bat');
    expect(result?.customSprites?.[0]?.frames[0]?.[0]?.[0]).toBe(0);
    expect(result?.customSprites?.[0]?.frames[0]?.[1]?.[1]).toBe(9);
  });
});
