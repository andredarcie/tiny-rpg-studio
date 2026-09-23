import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { ShareConstants, ShareDecoder, ShareEncoder } from './shareTestUtils';

type Scroll = { type: string; roomIndex: number; x: number; y: number; experience?: number };
const scroll = (roomIndex: number, experience?: unknown, x = 0): Record<string, unknown> => ({
  type: ITEM_TYPES.XP_SCROLL, roomIndex, x, y: 0,
  ...(experience === undefined ? {} : { experience }),
});
const decode = (code: string) => (ShareDecoder.decodeShareCode(code) as { objects: Scroll[] }).objects
  .filter((object) => object.type === ITEM_TYPES.XP_SCROLL);

describe('VERSION_43 XP scroll experience', () => {
  it('is the current supported share version', () => {
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_45);
    expect(ShareConstants.XP_SCROLL_EXPERIENCE_VERSION).toBe(ShareConstants.VERSION_43);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_43)).toBe(true);
  });

  it('round-trips sparse custom values after first-per-room normalization and sorting', () => {
    const objects = [scroll(2, 9), scroll(0, 7, 1), scroll(0, 8, 2), scroll(1, 3)];
    const code = ShareEncoder.buildShareCode({ objects });
    expect(code.split('.').find((segment) => segment.startsWith('*'))).toBe('*0:7,2:9');
    expect(decode(code)).toMatchObject([
      { roomIndex: 0, x: 1, experience: 7 },
      { roomIndex: 1 },
      { roomIndex: 2, experience: 9 },
    ]);
    expect(decode(code)[1]).not.toHaveProperty('experience');
  });

  it('preserves zero and omits default, missing, and invalid values', () => {
    expect(decode(ShareEncoder.buildShareCode({ objects: [scroll(0, 0)] }))[0].experience).toBe(0);
    for (const value of [undefined, 3, -1, 1.5, '5', Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const code = ShareEncoder.buildShareCode({ objects: [scroll(0, value)] });
      expect(code.split('.').some((segment) => segment.startsWith('*'))).toBe(false);
      expect(decode(code)[0]).not.toHaveProperty('experience');
    }
  });

  it.each(['', 'bad', '0:', ':1', '0:-1', '0:+1', '0:1,0:2', '1:1', '0:9007199254740992'])(
    'ignores malformed sparse payload %s',
    (segment) => {
      const code = ShareEncoder.buildShareCode({ objects: [scroll(0)] });
      expect(decode(`${code}.*${segment}`)[0]).not.toHaveProperty('experience');
    },
  );

  it('ignores overrides on VERSION_42 links', () => {
    const code = ShareEncoder.buildShareCode({ objects: [scroll(0)] });
    const legacy = code.replace(/^v[^.]+/, `v${ShareConstants.VERSION_42.toString(36)}`);
    expect(decode(`${legacy}.*0:7`)[0]).not.toHaveProperty('experience');
  });
});
