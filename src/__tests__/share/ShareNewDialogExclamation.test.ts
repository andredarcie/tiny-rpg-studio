import { describe, expect, it } from 'vitest';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';

const game = { start: { x: 1, y: 1, roomIndex: 0 }, rooms: [], sprites: [], enemies: [], objects: [], variables: [] };

describe('new dialog exclamation share setting', () => {
  it('round trips explicit false in version 45', () => {
    const code = ShareEncoder.buildShareCode({ ...game, showNewDialogExclamation: false });
    expect(code.startsWith(`v${ShareConstants.VERSION_45.toString(36)}.`)).toBe(true);
    expect((ShareDecoder.decodeShareCode(code) as { showNewDialogExclamation?: boolean }).showNewDialogExclamation).toBe(false);
  });

  it('defaults to visible for missing or malformed values and ignores the key in version 44', () => {
    const base = ShareEncoder.buildShareCode(game);
    for (const code of [base, `${base}.?1`, `${base}.?false`, `${base.replace(/^v[0-9a-z]+/, `v${ShareConstants.VERSION_44.toString(36)}`)}.?0`]) {
      const decoded = ShareDecoder.decodeShareCode(code) as { showNewDialogExclamation?: boolean } | null;
      expect(decoded, code).not.toBeNull();
      expect(decoded?.showNewDialogExclamation, code).toBe(true);
    }
  });
});
