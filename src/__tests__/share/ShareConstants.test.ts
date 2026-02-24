import { describe, expect, it } from 'vitest';
import { GameConfig } from '../../config/GameConfig';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';

describe('ShareConstants', () => {
  it('exposes current version and world metadata', () => {
    expect(ShareConstants.VERSION).toBeGreaterThan(0);
    expect(ShareConstants.WORLD_ROOM_COUNT).toBe(9);
    expect(ShareConstants.MATRIX_SIZE).toBe(8);
  });

  it('exposes legacy/tier constants and returns a palette copy', () => {
    expect(ShareConstants.PLAYER_END_TEXT_VERSION).toBe(17);
    expect(ShareConstants.TILE_LEGACY_MAX).toBe(GameConfig.tiles.legacyMax);

    const palette = ShareConstants.DEFAULT_PALETTE;
    expect(palette).toEqual(GameConfig.palette.colors);
    expect(palette).not.toBe(GameConfig.palette.colors);
  });
});
