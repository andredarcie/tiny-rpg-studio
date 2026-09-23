import { describe, expect, it } from 'vitest';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { ShareConstants, ShareDecoder, ShareEncoder } from './shareTestUtils';

type DecodedEnemy = { type: string; experience?: number };

const enemy = (type: string, experience?: unknown, roomIndex = 0, x = 0) => ({
  id: `${type}-${roomIndex}-${x}`,
  type,
  roomIndex,
  x,
  y: 0,
  ...(experience === undefined ? {} : { experience }),
});

describe('VERSION_42 custom enemy experience', () => {
  it('is the current supported share version', () => {
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_45);
    expect(ShareConstants.ENEMY_EXPERIENCE_VERSION).toBe(ShareConstants.VERSION_42);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_42)).toBe(true);
  });

  it.each(EnemyDefinitions.definitions.map((definition) => [definition.type, definition.experience]))(
    'round-trips a non-default override for %s',
    (type, defaultExperience) => {
      const code = ShareEncoder.buildShareCode({ enemies: [enemy(type, defaultExperience + 5)] });
      const decoded = ShareDecoder.decodeShareCode(code) as { enemies: DecodedEnemy[] };

      expect(code.split('.').some((segment) => segment.startsWith('-'))).toBe(true);
      expect(decoded.enemies[0]).toMatchObject({ type, experience: defaultExperience + 5 });
    },
  );

  it('preserves zero and omits invalid or default-equal overrides', () => {
    const zeroCode = ShareEncoder.buildShareCode({ enemies: [enemy('giant-rat', 0)] });
    expect((ShareDecoder.decodeShareCode(zeroCode) as { enemies: DecodedEnemy[] }).enemies[0].experience).toBe(0);

    for (const value of [3, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const code = ShareEncoder.buildShareCode({ enemies: [enemy('giant-rat', value)] });
      expect(code.split('.').some((segment) => segment.startsWith('-'))).toBe(false);
    }
  });

  it('caps encoded and decoded overrides at 16 XP', () => {
    const code = ShareEncoder.buildShareCode({ enemies: [enemy('giant-rat', 99)] });
    expect((ShareDecoder.decodeShareCode(code) as { enemies: DecodedEnemy[] }).enemies[0].experience).toBe(16);

    const base = ShareEncoder.buildShareCode({ enemies: [enemy('giant-rat')] });
    const decoded = ShareDecoder.decodeShareCode(`${base}.-0:2r`) as { enemies: DecodedEnemy[] };
    expect(decoded.enemies[0].experience).toBe(16);
  });

  it('indexes overrides after enemy normalization filters over-limit entries', () => {
    const raw = Array.from({ length: 10 }, (_, index) => enemy('giant-rat', undefined, 0, index));
    raw.push(enemy('bandit', 19, 1, 0));
    const decoded = ShareDecoder.decodeShareCode(ShareEncoder.buildShareCode({ enemies: raw })) as { enemies: DecodedEnemy[] };

    expect(decoded.enemies).toHaveLength(10);
    expect(decoded.enemies[9]).toMatchObject({ type: 'bandit', experience: 16 });
  });

  it.each(['', 'bad', '0:', ':1', '0:-1', '0:+1', '0:1,0:2', 'z:1', '0:9007199254740992'])(
    'ignores malformed sparse payload %s',
    (segment) => {
      const base = ShareEncoder.buildShareCode({ enemies: [enemy('giant-rat')] });
      const decoded = ShareDecoder.decodeShareCode(`${base}.-${segment}`) as { enemies: DecodedEnemy[] };
      expect(decoded.enemies[0]).not.toHaveProperty('experience');
    },
  );

  it('ignores the segment for legacy versions', () => {
    const current = ShareEncoder.buildShareCode({ enemies: [enemy('giant-rat')] });
    const legacy = current.replace(/^v[^.]+/, `v${ShareConstants.VERSION_41.toString(36)}`);
    const decoded = ShareDecoder.decodeShareCode(`${legacy}.-0:7`) as { enemies: DecodedEnemy[] };
    expect(decoded.enemies[0]).not.toHaveProperty('experience');
  });
});
