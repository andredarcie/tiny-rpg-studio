import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateApi, TileDefinition, TileFrame, TileMap } from '../runtime/domain/definitions/tileTypes';
import { TileManager } from '../runtime/services/TileManager';

const makeFrame = (value: string): TileFrame =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => value));

const createGameState = (overrides?: Partial<GameStateApi>): GameStateApi => ({
  game: {
    tileset: {
      tiles: [],
      maps: [],
      map: { ground: [], overlay: [] }
    },
    roomSize: 8,
    world: { rows: 1, cols: 1 }
  },
  ...overrides
});

let presets: TileDefinition[] = [];

vi.mock('../runtime/domain/definitions/tilePresets', () => ({
  get TILE_PRESETS_SOURCE() {
    return presets;
  },
}));

describe('TileManager business rules', () => {
  beforeEach(() => {
    presets = [
      {
        id: 1,
        name: 'Grass',
        collision: false,
        pixels: makeFrame('green'),
        category: 'Nature'
      },
      {
        id: 2,
        name: 'Wall',
        collision: true,
        pixels: makeFrame('gray'),
        category: 'Structure'
      }
    ] as TileDefinition[];
  });

  it('initializes default tiles and maps when empty', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);

    manager.ensureDefaultTiles();

    expect(gameState.game.tileset.tiles.length).toBe(2);
    expect(gameState.game.tileset.maps.length).toBe(1);
    expect(gameState.game.tileset.maps[0].ground.length).toBe(8);
    expect(gameState.game.tileset.maps[0].overlay.length).toBe(8);
    expect(gameState.game.tileset.maps[0].ground[0][0]).toBe(1);
  });

  it('always uses room size 8 for tile maps', () => {
    const gameState = createGameState();
    gameState.game.roomSize = 12;
    const manager = new TileManager(gameState);

    manager.ensureDefaultTiles();

    expect(gameState.game.tileset.maps[0].ground.length).toBe(8);
    expect(gameState.game.tileset.maps[0].ground[0].length).toBe(8);
  });

  it('fills an existing empty map with the default tile', () => {
    const gameState = createGameState();
    const size = 8;
    gameState.game.tileset.maps = [
      {
        ground: Array.from({ length: size }, () => Array(size).fill(null) as (string | number | null)[]),
        overlay: Array.from({ length: size }, () => Array(size).fill(null) as (string | number | null)[])
      }
    ] as TileMap[];
    const manager = new TileManager(gameState);

    manager.ensureDefaultTiles();

    expect(gameState.game.tileset.maps[0].ground[0][0]).toBe(1);
  });

  it('generates a tile id', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);

    const id = manager.generateTileId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('prefers crypto.randomUUID when available', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    const globalWithCrypto = globalThis as GlobalWithCrypto;
    const originalCrypto = globalWithCrypto.crypto;
    if ('randomUUID' in originalCrypto) {
      const spy = vi.spyOn(originalCrypto, 'randomUUID').mockReturnValue('uuid-123');
      expect(manager.generateTileId()).toBe('uuid-123');
      spy.mockRestore();
      return;
    }

    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'uuid-123' },
      configurable: true
    });
    expect(manager.generateTileId()).toBe('uuid-123');

    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true
    });
  });

  it('builds preset tiles using the configured presets', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);

    const builtPresets = manager.buildPresetTiles();
    expect(builtPresets.length).toBe(2);
    expect(builtPresets[0].name).toBe('Grass');
  });

  it('sorts preset tiles by id when ids are strings', () => {
    presets = [
      { id: 'b', name: 'B', pixels: makeFrame('b') },
      { id: 'a', name: 'A', pixels: makeFrame('a') }
    ] as TileDefinition[];
    const gameState = createGameState();
    const manager = new TileManager(gameState);

    const builtPresets = manager.buildPresetTiles();
    expect(builtPresets[0].id).toBe('a');
  });

  it('clones tiles without mutating the source', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    const source = { id: 1, pixels: makeFrame('green') } as TileDefinition;

    const cloned = manager.cloneTile(source);
    cloned.pixels?.[0]?.splice(0, 1, 'mutated');

    expect(source.pixels?.[0]?.[0]).toBe('green');
  });

  it('preserves existing tiles and maps when provided', () => {
    const gameState = createGameState({
      game: {
        tileset: {
          tiles: [
            { id: 10, name: 'Custom', pixels: makeFrame('red') },
            { name: 'Missing id', pixels: makeFrame('blue') }
          ],
          maps: [
            {
              ground: [[10, 999], [null, 10]],
              overlay: [[null, 10], [999, null]]
            }
          ],
          map: { ground: [], overlay: [] }
        },
        roomSize: 2,
        world: { rows: 1, cols: 1 }
      }
    });

    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    const tiles = gameState.game.tileset.tiles;
    expect(tiles[1].id).toBeUndefined();
    expect(gameState.game.tileset.maps[0].ground).toEqual([
      [10, 999],
      [null, 10]
    ]);
    expect(gameState.game.tileset.maps[0].overlay).toEqual([
      [null, 10],
      [999, null]
    ]);
  });

  it('returns preset tile names', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);

    expect(manager.getPresetTileNames()).toEqual(['Grass', 'Wall']);
  });

  it('returns tiles from game state', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    expect(manager.getTiles().length).toBe(2);
  });

  it('finds a tile by id', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    expect(manager.getTile(1)?.name).toBe('Grass');
  });

  it('updates tiles using the payload values', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.updateTile(1, { name: 'New Name', collision: true, category: 'Test' });

    const updated = manager.getTile(1);
    expect(updated?.name).toBe('New Name');
    expect(updated?.collision).toBe(true);
    expect(updated?.category).toBe('Test');
  });

  it('clears frames and animation when pixels are updated', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.updateTile(1, { frames: [makeFrame('a'), makeFrame('b')] });
    manager.updateTile(1, { pixels: makeFrame('c') });

    const updated = manager.getTile(1);
    expect(updated?.frames).toBeUndefined();
    expect(updated?.animated).toBe(false);
    expect(updated?.pixels?.[0]?.[0]).toBe('c');
  });

  it('routes map writes to ground or overlay based on collision', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.setMapTile(1, 1, 1);
    manager.setMapTile(2, 2, 2);

    const map = manager.getTileMap();
    expect(map.ground[1][1]).toBe(1);
    expect(map.overlay[1][1]).toBeNull();
    expect(map.overlay[2][2]).toBe(2);
  });

  it('ignores map writes that are out of bounds', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.setMapTile(99, 99, 1);

    const map = manager.getTileMap();
    expect(map.ground[0][0]).toBe(1);
  });

  it('clears both layers when tileId is null', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.setMapTile(0, 0, 1);
    manager.setMapTile(0, 0, null);

    const map = manager.getTileMap();
    expect(map.ground[0][0]).toBeNull();
    expect(map.overlay[0][0]).toBeNull();
  });

  it('returns a room map by index', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    expect(manager.getTileMap(0)).toBe(gameState.game.tileset.maps[0]);
  });

  it('falls back to tileset.map when room index is missing', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    expect(manager.getTileMap(99)).toBe(gameState.game.tileset.map);
  });

  it('refreshes animation metadata based on frames', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.updateTile(1, { frames: [makeFrame('a'), makeFrame('b'), makeFrame('c')] });
    manager.refreshAnimationMetadata();

    expect(manager.getAnimationFrameCount()).toBe(3);
  });

  it('tracks animation frame bounds', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.updateTile(1, { frames: [makeFrame('a'), makeFrame('b')] });

    expect(manager.getAnimationFrameCount()).toBe(2);
    expect(manager.setAnimationFrameIndex(3)).toBe(1);
    expect(manager.advanceAnimationFrame()).toBe(0);
  });

  it('returns the current animation frame index', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.updateTile(1, { frames: [makeFrame('a'), makeFrame('b')] });
    manager.setAnimationFrameIndex(1);
    expect(manager.getAnimationFrameIndex()).toBe(1);
  });

  it('returns normalized tile pixels for a given frame', () => {
    const gameState = createGameState();
    const manager = new TileManager(gameState);
    manager.ensureDefaultTiles();

    manager.updateTile(1, { frames: [makeFrame('a'), makeFrame('b')] });

    const pixels = manager.getTilePixels(1, 1);
    expect(pixels?.[0]?.[0]).toBe('b');
  });
});

type GlobalWithCrypto = typeof globalThis & {
  crypto?: Crypto & { randomUUID?: () => string };
};
