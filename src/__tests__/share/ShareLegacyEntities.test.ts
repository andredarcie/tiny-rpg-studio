import { expect, it } from 'vitest';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { ShareTextCodec } from '../../runtime/infra/share/ShareTextCodec';

it('preserves authored legacy pickups and exits, resets pickup progress, and reads previous versions', () => {
  const items = [{ type: 'key', roomIndex: 0, x: 1, y: 2, text: '<b>A clue</b>', collected: true }];
  const exits = [{ roomIndex: 0, x: 7, y: 2, targetRoomIndex: 4, targetX: 0, targetY: 3 }];
  const code = ShareUtils.encode({ title: 'Legacy quest', items, exits });
  expect(ShareUtils.decode(code)).toMatchObject({ items: [{ ...items[0], collected: false }], exits });
  expect(ShareUtils.decode(`v${ShareConstants.VERSION_45.toString(36)}.nUXVlc3Q`)).not.toBeNull();
});

it('ignores malformed and out-of-bounds legacy data instead of spreading untrusted fields', () => {
  const encoded = ShareTextCodec.encodeText(JSON.stringify({ items: [{ roomIndex: 999, x: 1, y: 2 }], exits: [{ roomIndex: 0, x: 0, y: 0, targetRoomIndex: 1, targetX: 8, targetY: 0 }] }));
  const decoded = ShareUtils.decode(`v${ShareConstants.VERSION.toString(36)}.@${encoded}`);
  expect(decoded?.items).toBeUndefined(); expect(decoded?.exits).toBeUndefined();
  expect(ShareUtils.decode(`v${ShareConstants.VERSION.toString(36)}.@invalid`)).not.toBeNull();
});
