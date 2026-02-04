import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareDecoder, ShareEncoder, ShareConstants } from './shareTestUtils';

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
