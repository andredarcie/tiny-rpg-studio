import { describe, expect, it } from 'vitest';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { ShareTextCodec } from '../../runtime/infra/share/ShareTextCodec';

const presets = TileDefinitions.TILE_PRESETS;
const walkable = presets.find((tile) => tile.collision === false);
const solid = presets.find((tile) => tile.collision === true);
if (!walkable || !solid) throw new Error('Expected walkable and solid presets');
const game = (tiles: unknown[]) => ({
  title: 'Solid tiles', start: { x: 1, y: 1, roomIndex: 0 },
  rooms: [], sprites: [], enemies: [], objects: [], variables: [],
  tileset: { tiles, maps: [] },
});

describe('VERSION_44 tile collision', () => {
  it('encodes only differences from known presets in both directions', () => {
    const code = ShareEncoder.buildShareCode(game([
      { id: walkable.id, collision: true },
      { id: solid.id, collision: false },
      { id: 'unknown', collision: true },
    ]) as never);
    expect(code.startsWith(`v${ShareConstants.VERSION_45.toString(36)}.`)).toBe(true);
    const decoded = ShareDecoder.decodeShareCode(code) as { tileCollisions?: Record<string, boolean> };
    expect(decoded.tileCollisions).toEqual({ [String(walkable.id)]: true, [String(solid.id)]: false });
  });

  it('omits matching defaults and ignores malformed values and old versions', () => {
    expect(ShareEncoder.collectTileCollisions([
      { id: walkable.id, collision: false }, { id: solid.id, collision: true },
    ])).toEqual({});
    expect(ShareEncoder.buildShareCode(game([
      { id: walkable.id, collision: false }, { id: solid.id, collision: true },
    ]) as never)).toBe(ShareEncoder.buildShareCode(game([]) as never));
    const payload = ShareTextCodec.encodeText(JSON.stringify({ c: {
      [String(walkable.id)]: true, [String(solid.id)]: 'false', unknown: false,
    } }));
    const current = ShareDecoder.decodeShareCode(`v18.0${payload}`) as { tileCollisions?: Record<string, boolean> };
    expect(current.tileCollisions).toEqual({ [String(walkable.id)]: true });
    const old = ShareDecoder.decodeShareCode(`v17.0${payload}`) as { tileCollisions?: Record<string, boolean> };
    expect(old.tileCollisions).toBeUndefined();
  });
});
