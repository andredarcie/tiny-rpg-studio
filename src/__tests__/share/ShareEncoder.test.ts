import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareConstants, ShareDecoder, ShareEncoder } from './shareTestUtils';
import type { CustomSpriteEntry } from '../../types/gameState';

type ShareDecodeResult = { customSprites?: CustomSpriteEntry[] };
type ShareCustomSpriteInput = {
  group: string;
  key: string;
  variant?: string;
  frames: ((number | null)[][])[];
};

describe('ShareEncoder', () => {
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

  it('builds a share code with version and data segments', () => {
    const size = ShareConstants.MATRIX_SIZE;
    const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    ground[0][0] = 1;
    const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

    const code = ShareEncoder.buildShareCode({
      title: 'Custom Title',
      author: 'Author',
      start: { x: 2, y: 3, roomIndex: 0 },
      tileset: { map: { ground, overlay }, maps: [] }
    });

    expect(code.startsWith('v')).toBe(true);
    expect(code).toContain('g');
    expect(code).toContain('n');
    expect(code).toContain('y');
  });

  it('preserves hideHud through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({ hideHud: true });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ hideHud?: boolean } | null);

    expect(code.split('.').some((segment) => segment === 'H1')).toBe(true);
    expect(decoded?.hideHud).toBe(true);
  });

  it('preserves spriteOutline false through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({ spriteOutline: false });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ spriteOutline?: boolean; spriteOutlineColor?: number } | null);

    expect(code.split('.').some((segment) => segment === '10')).toBe(true);
    expect(decoded?.spriteOutline).toBe(false);
    expect(decoded?.spriteOutlineColor).toBe(1);
  });

  it('defaults spriteOutline to true when not encoded', () => {
    const code = ShareEncoder.buildShareCode({});
    const decoded = ShareDecoder.decodeShareCode(code) as ({ spriteOutline?: boolean; spriteOutlineColor?: number } | null);

    expect(code.split('.').some((segment) => /^1(0|c|$)/.test(segment) || segment === '10')).toBe(false);
    expect(decoded?.spriteOutline).toBe(true);
    expect(decoded?.spriteOutlineColor).toBe(1);
  });

  it('preserves spriteOutlineColor through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({ spriteOutline: true, spriteOutlineColor: 10 });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ spriteOutline?: boolean; spriteOutlineColor?: number } | null);

    expect(code.split('.').some((segment) => segment === '1ca')).toBe(true);
    expect(decoded?.spriteOutline).toBe(true);
    expect(decoded?.spriteOutlineColor).toBe(10);
  });

  it('preserves disabled outline with a custom color', () => {
    const code = ShareEncoder.buildShareCode({ spriteOutline: false, spriteOutlineColor: 3 });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ spriteOutline?: boolean; spriteOutlineColor?: number } | null);

    expect(code.split('.').some((segment) => segment === '10c3')).toBe(true);
    expect(decoded?.spriteOutline).toBe(false);
    expect(decoded?.spriteOutlineColor).toBe(3);
  });

  it('preserves disableSkills through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({ disableSkills: true });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ disableSkills?: boolean } | null);

    expect(code.split('.').some((segment) => segment === 'R1')).toBe(true);
    expect(decoded?.disableSkills).toBe(true);
  });

  it('preserves online config through an encode/decode round trip', () => {
    const online = {
      enabled: true,
      spawnPoints: [{ role: 'p2', roomIndex: 2, x: 3, y: 4 }]
    };
    const code = ShareEncoder.buildShareCode({ online });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ online?: typeof online } | null);

    expect(code.split('.').some((segment) => segment.startsWith('8'))).toBe(true);
    expect(decoded?.online?.enabled).toBe(true);
    expect(decoded?.online?.spawnPoints).toHaveLength(1);
    expect(decoded?.online?.spawnPoints[0]).toMatchObject({ role: 'p2', roomIndex: 2, x: 3, y: 4 });
  });

  it('omits online segment when online is disabled or absent', () => {
    expect(ShareEncoder.buildShareCode({}).split('.').some((s) => s.startsWith('8'))).toBe(false);
    expect(ShareEncoder.buildShareCode({ online: { enabled: false } }).split('.').some((s) => s.startsWith('8'))).toBe(false);
  });

  it('preserves skill customizations through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({
      skillCustomizations: {
        necromancer: {
          name: 'Second Wind',
          description: 'Revive once.'
        }
      }
    });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ skillCustomizations?: Record<string, { name?: string; description?: string }> } | null);

    expect(code.split('.').some((segment) => segment.startsWith('C'))).toBe(true);
    expect(decoded?.skillCustomizations).toEqual({
      necromancer: {
        name: 'Second Wind',
        description: 'Revive once.'
      }
    });
  });

  it('emits an M segment when backgroundMusicVideoId exists', () => {
    const code = ShareEncoder.buildShareCode({
      backgroundMusicVideoId: 't0ihNLLZNi0'
    } as { backgroundMusicVideoId?: string });

    expect(code.split('.').some((segment) => segment.startsWith('M'))).toBe(true);
  });

  it('preserves backgroundMusicVideoId through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({
      backgroundMusicVideoId: 't0ihNLLZNi0'
    } as { backgroundMusicVideoId?: string });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ backgroundMusicVideoId?: string } | null);

    expect(decoded?.backgroundMusicVideoId).toBe('t0ihNLLZNi0');
  });

  it('emits a compact volume segment only when backgroundMusicVolume differs from the default', () => {
    const customVolumeCode = ShareEncoder.buildShareCode({
      backgroundMusicVideoId: 't0ihNLLZNi0',
      backgroundMusicVolume: 75
    } as { backgroundMusicVideoId?: string; backgroundMusicVolume?: number });
    const defaultVolumeCode = ShareEncoder.buildShareCode({
      backgroundMusicVideoId: 't0ihNLLZNi0',
      backgroundMusicVolume: 100
    } as { backgroundMusicVideoId?: string; backgroundMusicVolume?: number });

    expect(customVolumeCode.split('.')).toContain('223');
    expect(defaultVolumeCode.split('.').some((segment) => segment.startsWith('2'))).toBe(false);
  });

  it('preserves backgroundMusicVolume through an encode/decode round trip', () => {
    const code = ShareEncoder.buildShareCode({
      backgroundMusicVideoId: 't0ihNLLZNi0',
      backgroundMusicVolume: 33
    } as { backgroundMusicVideoId?: string; backgroundMusicVolume?: number });
    const decoded = ShareDecoder.decodeShareCode(code) as ({ backgroundMusicVolume?: number } | null);

    expect(decoded?.backgroundMusicVolume).toBe(33);
  });
});

describe('ShareEncoder - customSprites', () => {
  const toBase64Url = (bytes: Uint8Array) => {
    let binary = '';
    for (let index = 0; index < bytes.length; index++) {
      binary += String.fromCharCode(bytes[index] ?? 0);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const encodeLegacyBinaryV1 = (customSprites: ShareCustomSpriteInput[]) => {
    const bytes: number[] = [1, customSprites.length & 0xff];
    const encoder = new TextEncoder();
    const groupToId: Record<string, number> = { tile: 0, npc: 1, enemy: 2, object: 3 };

    for (const entry of customSprites) {
      const keyBytes = Array.from(encoder.encode(entry.key));
      const flags = (groupToId[entry.group] ?? 0) | (((entry.variant === 'on' ? 1 : 0) & 0x01) << 2);
      bytes.push(flags, keyBytes.length & 0xff, entry.frames.length & 0xff, ...keyBytes);

      for (const frame of entry.frames) {
        const rows = frame.length;
        const cols = frame[0]?.length ?? 0;
        const flat = frame.flat();
        const pixelCount = rows * cols;
        const maskBytes = new Uint8Array(Math.ceil(pixelCount / 8));
        const colors: number[] = [];

        for (let index = 0; index < pixelCount; index++) {
          const px = flat[index];
          if (px !== null) {
            maskBytes[index >> 3] |= 1 << (index & 7);
            colors.push(px & 0x0f);
          }
        }

        bytes.push(rows & 0xff, cols & 0xff, ...maskBytes);
        for (let index = 0; index < colors.length; index += 2) {
          const left = colors[index] & 0x0f;
          const right = index + 1 < colors.length ? (colors[index + 1] & 0x0f) : 0;
          bytes.push((left << 4) | right);
        }
      }
    }

    return toBase64Url(Uint8Array.from(bytes));
  };

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

  it('generates an S segment when customSprites is not empty', () => {
    const customSprites = [
      { group: 'npc' as const, key: 'wizard', variant: 'base' as const, frames: [Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0))] },
    ];
    const code = ShareEncoder.buildShareCode({ customSprites });
    const segments = code.split('.');
    const hasS = segments.some(s => s.startsWith('S'));
    expect(hasS).toBe(true);
  });

  it('does not generate an S segment when customSprites is empty', () => {
    const code = ShareEncoder.buildShareCode({ customSprites: [] });
    const segments = code.split('.');
    const hasS = segments.some(s => s.startsWith('S'));
    expect(hasS).toBe(false);
  });

  it('does not generate an S segment when customSprites is undefined', () => {
    const code = ShareEncoder.buildShareCode({});
    const segments = code.split('.');
    const hasS = segments.some(s => s.startsWith('S'));
    expect(hasS).toBe(false);
  });

  it('preserves customSprites through an encode/decode round trip', () => {
    const customSprites = [
      {
        group: 'enemy' as const,
        key: 'slime',
        variant: 'base' as const,
        frames: [Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 16))],
      },
    ];
    const code = ShareEncoder.buildShareCode({ customSprites });
    const decoded = ShareDecoder.decodeShareCode(code) as ShareDecodeResult | null;
    expect(decoded?.customSprites).toHaveLength(1);
    expect(decoded?.customSprites?.[0]?.key).toBe('slime');
    expect(decoded?.customSprites?.[0]?.frames[0]?.[0]?.[0]).toBe(0);
    expect(decoded?.customSprites?.[0]?.frames[0]?.[1]?.[1]).toBe(2);
  });

  it('generates a smaller payload than the legacy JSON/base64 format', () => {
    const customSprites = [
      {
        group: 'npc' as const,
        key: 'wizard',
        variant: 'base' as const,
        frames: [Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r + c) % 3 === 0 ? null : (r + c) % 16)))],
      },
      {
        group: 'object' as const,
        key: 'torch',
        variant: 'on' as const,
        frames: [Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r * c) % 5 === 0 ? 8 : null)))],
      }
    ];

    const code = ShareEncoder.buildShareCode({ customSprites });
    const encodedSegment = code.split('.').find((segment) => segment.startsWith('S'))?.slice(1) ?? '';
    const legacyPayload = customSprites.map(e => ({
      g: e.group,
      k: e.key,
      v: e.variant,
      f: e.frames.map(frame => frame.flat().map(px => px === null ? 'z' : px.toString(16)).join(''))
    }));
    const legacyEncoded = btoa(JSON.stringify(legacyPayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    expect(encodedSegment.length).toBeLessThan(legacyEncoded.length);
  });

  it('uses a delta against the base sprite for small NPC edits', () => {
    const frame = [
      [ null,  1,  1,  1,  1,  1, null, null ],
      [  1,  4,  6,  6,  6,  6,  1, null ],
      [  1,  4, 15, 12, 15, 12,  1, null ],
      [  1,  4, 15, 15, 15, 15,  5,  1 ],
      [  1, 15,  5,  6,  6,  6, 15,  1 ],
      [  1,  4,  5,  6,  6,  6,  1, null ],
      [  1,  4,  5,  5,  6,  6,  1, null ],
      [  1,  4,  5,  5,  5,  5,  1, null ]
    ] as (number | null)[][];
    frame[0][0] = 6;

    const customSprites = [
      { group: 'npc' as const, key: 'old-mage', variant: 'base' as const, frames: [frame] },
    ];

    const code = ShareEncoder.buildShareCode({ customSprites });
    const encodedSegment = code.split('.').find((segment) => segment.startsWith('S'))?.slice(1) ?? '';
    const legacyBinaryV1 = encodeLegacyBinaryV1(customSprites);

    expect(encodedSegment.length).toBeLessThan(legacyBinaryV1.length);
    expect(encodedSegment).not.toContain('b2xkLW1hZ2U');
  });
});

describe('ShareEncoder/ShareDecoder - player sprite roundtrip', () => {
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

  it('preserves a player sprite through an encode/decode round trip', () => {
    const playerMatrix = Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => (r + c) % 16)
    );
    const customSprites = [
      { group: 'player', key: 'default', variant: 'base' as const, frames: [playerMatrix] },
    ] as unknown as CustomSpriteEntry[];

    const code = ShareEncoder.buildShareCode({ customSprites });
    const decoded = ShareDecoder.decodeShareCode(code) as ShareDecodeResult | null;

    expect(decoded?.customSprites).toHaveLength(1);
    expect(decoded?.customSprites?.[0]?.group).toBe('player');
    expect(decoded?.customSprites?.[0]?.key).toBe('default');
    expect(decoded?.customSprites?.[0]?.frames[0]?.[0]?.[0]).toBe(0);
    expect(decoded?.customSprites?.[0]?.frames[0]?.[1]?.[1]).toBe(2);
  });

  it('generates an S segment for a player customSprite', () => {
    const playerMatrix = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 5));
    const customSprites = [
      { group: 'player', key: 'default', variant: 'base' as const, frames: [playerMatrix] },
    ] as unknown as CustomSpriteEntry[];

    const code = ShareEncoder.buildShareCode({ customSprites });
    const hasS = code.split('.').some(s => s.startsWith('S'));
    expect(hasS).toBe(true);
  });
});
