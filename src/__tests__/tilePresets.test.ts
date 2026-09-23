import { describe, expect, it } from 'vitest';
import { TILE_PRESETS, TileDefinitions } from '../runtime/domain/definitions/TileDefinitions';
import { TILE_PRESETS_SOURCE } from '../runtime/domain/definitions/tilePresets';

describe('tilePresets source selection', () => {
  it('provides two independent frames for static tiles and preserves animated art', () => {
    for (const tile of TILE_PRESETS) {
      expect(tile.frames).toHaveLength(2);
      expect(tile.layouts).toHaveLength(2);
      expect(tile.frames[0]).not.toBe(tile.frames[1]);
      expect(tile.layouts?.[0]).not.toBe(tile.layouts?.[1]);
    }
    expect(TILE_PRESETS.find((tile) => tile.id === 5)?.frames[0]).not.toEqual(
      TILE_PRESETS.find((tile) => tile.id === 5)?.frames[1]
    );
    const tile = TileDefinitions.createTile(99, 'One', [TileDefinitions.createEmptyLayout()]);
    expect(tile.frames[1]).toEqual(tile.frames[0]);
    expect(tile.frames[1]).not.toBe(tile.frames[0]);
    expect(tile.layouts?.[1]).not.toBe(tile.layouts?.[0]);
  });

  it('adds three distinct presets at stable IDs', () => {
    const added = [18, 19, 20].map((id) => TILE_PRESETS.find((tile) => tile.id === id));
    expect(added.every((tile) => tile?.nameKey && tile.layouts?.[0].length === 8)).toBe(true);
    expect(new Set(added.map((tile) => JSON.stringify(tile?.layouts?.[0]))).size).toBe(3);
  });
  it('uses TileDefinitions presets as the source', () => {
    expect(TILE_PRESETS_SOURCE).toEqual(TILE_PRESETS);
  });
});
