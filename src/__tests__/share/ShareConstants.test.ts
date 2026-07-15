import { describe, expect, it } from 'vitest';
import { GameConfig } from '../../config/GameConfig';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';

describe('ShareConstants', () => {
  it('exposes current version and world metadata', () => {
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_35);
    expect(ShareConstants.WORLD_ROOM_COUNT).toBe(9);
    expect(ShareConstants.MATRIX_SIZE).toBe(8);
  });

  it('registers the choice-dialog version as supported', () => {
    expect(ShareConstants.NPC_CHOICE_DIALOG_VERSION).toBe(ShareConstants.VERSION_34);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_34)).toBe(true);
  });

  it('registers sprite outline version as supported', () => {
    expect(ShareConstants.SPRITE_OUTLINE_VERSION).toBe(ShareConstants.VERSION_35);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_35)).toBe(true);
  });

  it('exposes legacy/tier constants and returns a palette copy', () => {
    expect(ShareConstants.PLAYER_END_TEXT_VERSION).toBe(17);
    expect(ShareConstants.TILE_LEGACY_MAX).toBe(GameConfig.tiles.legacyMax);

    const palette = ShareConstants.DEFAULT_PALETTE;
    expect(palette).toEqual(GameConfig.palette.colors);
    expect(palette).not.toBe(GameConfig.palette.colors);
  });
});

describe('ShareConstants - VERSION_20', () => {
    it('VERSION_20 existe e vale 20', () => {
        expect(ShareConstants.VERSION_20).toBe(20);
    });

    it('VERSION_20 esta em SUPPORTED_VERSIONS', () => {
        expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_20)).toBe(true);
    });
});

describe('ShareConstants - VERSION_28', () => {
    it('VERSION_28 existe e vale 28', () => {
        expect(ShareConstants.VERSION_28).toBe(28);
    });

    it('VERSION_28 esta em SUPPORTED_VERSIONS', () => {
        expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_28)).toBe(true);
    });
});

describe('ShareConstants - background music volume version', () => {
    it('VERSION_33 existe e vale 33', () => {
        expect(ShareConstants.VERSION_33).toBe(33);
    });

    it('BACKGROUND_MUSIC_VOLUME_VERSION aponta para VERSION_33 e esta suportada', () => {
        expect(ShareConstants.BACKGROUND_MUSIC_VOLUME_VERSION).toBe(ShareConstants.VERSION_33);
        expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_33)).toBe(true);
    });
});
