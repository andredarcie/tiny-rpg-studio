import { describe, expect, it } from 'vitest';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { ShareTextCodec } from '../../runtime/infra/share/ShareTextCodec';

const gameData = {
  title: 'Merged',
  start: { x: 1, y: 1, roomIndex: 0 },
  rooms: [], sprites: [], enemies: [], objects: [], variables: [],
  tileset: {
    tiles: [
      { id: 0, mergeEdges: true },
      { id: 1, mergeEdges: false },
      { id: 'water', mergeEdges: true },
    ],
    maps: [],
  },
};

describe('VERSION_41 tile edge merging', () => {
  it('registers the feature version', () => {
    expect(ShareConstants.VERSION).toBe(ShareConstants.VERSION_44);
    expect(ShareConstants.TILE_MERGE_EDGES_VERSION).toBe(ShareConstants.VERSION_41);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_41)).toBe(true);
  });

  it('stores and restores only enabled tile IDs', () => {
    expect(ShareEncoder.collectTileMergeEdges(gameData.tileset.tiles)).toEqual(['0', 'water']);
    const code = ShareEncoder.buildShareCode(gameData as never);
    const decoded = ShareDecoder.decodeShareCode(code) as { tileMergeEdges?: string[] };
    expect(decoded.tileMergeEdges).toEqual(['0', 'water']);
  });

  it('defaults old and malformed payloads to disabled', () => {
    const oldEnvelope = ShareTextCodec.encodeText(JSON.stringify({ a: {}, d: [], m: ['0'] }));
    const oldDecoded = ShareDecoder.decodeShareCode(`v14.0${oldEnvelope}`) as { tileMergeEdges?: string[] };
    expect(oldDecoded.tileMergeEdges).toBeUndefined();

    const malformedEnvelope = ShareTextCodec.encodeText(JSON.stringify({ a: {}, d: [], m: [null, 1, {}, false] }));
    const malformed = ShareDecoder.decodeShareCode(`v15.0${malformedEnvelope}`) as { tileMergeEdges?: string[] };
    expect(malformed.tileMergeEdges).toBeUndefined();
  });
});
