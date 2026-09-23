import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateApi, TileDefinition, TileFrame } from '../runtime/domain/definitions/tileTypes';
import { TileManager } from '../runtime/services/TileManager';

const makeFrame = (value: string): TileFrame =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => value));

const createGameState = (overrides?: Partial<GameStateApi>): GameStateApi => ({
  game: {
    tileset: {
      tiles: [],
      maps: [],
      map: { ground: [], overlay: [] },
    },
    roomSize: 8,
    world: { rows: 3, cols: 3 },
  },
  ...overrides,
});

let presets: TileDefinition[] = [];

vi.mock('../runtime/domain/definitions/tilePresets', () => ({
  get TILE_PRESETS_SOURCE() {
    return presets;
  },
}));

describe('TileManager - Critical Edge Cases', () => {
  beforeEach(() => {
    presets = [
      {
        id: 1,
        name: 'Ground',
        collision: false,
        pixels: makeFrame('ground'),
        category: 'Base',
      },
      {
        id: 2,
        name: 'Wall',
        collision: true,
        pixels: makeFrame('wall'),
        category: 'Obstacle',
      },
    ] as TileDefinition[];
  });

  describe('Animation frame boundary handling', () => {
    it('wraps negative frame index to valid range', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b'), makeFrame('c')],
      });

      const wrapped = manager.setAnimationFrameIndex(-1);
      expect(wrapped).toBe(2); // -1 mod 3 = 2
    });

    it('wraps large positive frame index to valid range', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b')],
      });

      const wrapped = manager.setAnimationFrameIndex(100);
      expect(wrapped).toBe(0); // 100 mod 2 = 0
    });

    it('returns correct frame for tile with mixed frame counts', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      // Tile 1 has 3 frames
      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b'), makeFrame('c')],
      });

      // Tile 2 has 2 frames
      manager.updateTile(2, {
        frames: [makeFrame('x'), makeFrame('y')],
      });

      // Set global frame to 2
      manager.setAnimationFrameIndex(2);

      // Tile 1 should show frame 2 (index 2)
      const pixels1 = manager.getTilePixels(1);
      expect(pixels1?.[0]?.[0]).toBe('c');

      // Tile 2 should wrap to frame 0 (2 mod 2 = 0)
      const pixels2 = manager.getTilePixels(2);
      expect(pixels2?.[0]?.[0]).toBe('x');
    });

    it('handles tile with no frames or pixels gracefully', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, { name: 'Empty' });
      gameState.game.tileset.tiles[0].frames = undefined;
      gameState.game.tileset.tiles[0].pixels = undefined;

      const pixels = manager.getTilePixels(1);
      expect(pixels).toBeNull();
    });

    it('advances frame correctly when at boundary', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b'), makeFrame('c')],
      });

      manager.setAnimationFrameIndex(2); // Last frame
      const next = manager.advanceAnimationFrame();

      expect(next).toBe(0); // Should wrap to start
    });

    it('advances through the two default tile frames', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      expect(manager.getAnimationFrameCount()).toBe(2);
      manager.setAnimationFrameIndex(0);
      const next = manager.advanceAnimationFrame();

      expect(next).toBe(1);
      expect(manager.advanceAnimationFrame()).toBe(0);
    });
  });

  describe('Tile placement with collision logic', () => {
    it('places non-collision tile on ground layer only', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.setMapTile(3, 4, 1); // Tile 1 is non-collision

      const map = manager.getTileMap(0);
      expect(map.ground[4][3]).toBe(1);
      expect(map.overlay[4][3]).toBeNull();
    });

    it('places collision tile on overlay layer only', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.setMapTile(3, 4, 2); // Tile 2 is collision

      const map = manager.getTileMap(0);
      expect(map.overlay[4][3]).toBe(2);
      expect(map.ground[4][3]).toBe(1); // Ground remains default tile
    });

    it('replaces collision tile with ground tile correctly', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      // Place collision tile
      manager.setMapTile(2, 2, 2);
      expect(manager.getTileMap(0).overlay[2][2]).toBe(2);

      // Replace with ground tile
      manager.setMapTile(2, 2, 1);
      expect(manager.getTileMap(0).ground[2][2]).toBe(1);
      expect(manager.getTileMap(0).overlay[2][2]).toBeNull(); // Overlay cleared
    });

    it('handles tile placement in different rooms', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      // Place tiles in different rooms
      manager.setMapTile(1, 1, 1, 0); // Room 0
      manager.setMapTile(1, 1, 2, 4); // Room 4
      manager.setMapTile(1, 1, 1, 8); // Room 8

      expect(manager.getTileMap(0).ground[1][1]).toBe(1);
      expect(manager.getTileMap(4).overlay[1][1]).toBe(2);
      expect(manager.getTileMap(8).ground[1][1]).toBe(1);
    });

    it('ignores placement when tile does not exist', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      const mapBefore = JSON.stringify(manager.getTileMap(0));

      manager.setMapTile(1, 1, 999); // Non-existent tile

      const mapAfter = JSON.stringify(manager.getTileMap(0));
      expect(mapAfter).toBe(mapBefore); // No change
    });
  });

  describe('Tile updates and frame metadata', () => {
    it('recalculates max frames when tile is updated with more frames', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      // Every default tile has two editable frames.
      expect(manager.getAnimationFrameCount()).toBe(2);

      // Add animated tile
      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b'), makeFrame('c'), makeFrame('d')],
      });

      expect(manager.getAnimationFrameCount()).toBe(4);
    });

    it('recalculates max frames when tile is updated with fewer frames', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      // Add animated tile with 4 frames
      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b'), makeFrame('c'), makeFrame('d')],
      });
      expect(manager.getAnimationFrameCount()).toBe(4);

      // Add another tile with only 2 frames
      manager.updateTile(2, {
        frames: [makeFrame('x'), makeFrame('y')],
      });

      // Max should still be 4 (from tile 1)
      expect(manager.getAnimationFrameCount()).toBe(4);
    });

    it('updates pixels field when frames are set', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('new'), makeFrame('frames')],
      });

      const tile = manager.getTile(1);
      expect(tile?.pixels).toEqual(makeFrame('new')); // First frame
      expect(tile?.animated).toBe(true);
    });

    it('clears animation when pixels are set directly', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      // First set frames
      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b')],
      });

      // Then update with pixels
      manager.updateTile(1, {
        pixels: makeFrame('static'),
      });

      const tile = manager.getTile(1);
      expect(tile?.frames).toBeUndefined();
      expect(tile?.animated).toBe(false);
      expect(tile?.pixels).toEqual(makeFrame('static'));
    });
  });

  describe('Multi-room world initialization', () => {
    it('creates correct number of tile maps for 3x3 world', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);

      manager.ensureDefaultTiles();

      expect(gameState.game.tileset.maps.length).toBe(9); // 3x3 = 9 rooms
    });

    it('initializes all room maps with default ground tile', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);

      manager.ensureDefaultTiles();

      for (let i = 0; i < 9; i++) {
        const map = manager.getTileMap(i);
        expect(map.ground[0][0]).toBe(1); // Default tile
        expect(map.overlay[0][0]).toBeNull();
      }
    });

    it('handles fallback to main map when room index is out of bounds', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      const mainMap = gameState.game.tileset.map;
      const retrievedMap = manager.getTileMap(999);

      expect(retrievedMap).toBe(mainMap);
    });
  });

  describe('Tile frame override', () => {
    it('returns specific frame when override is provided', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('0'), makeFrame('1'), makeFrame('2')],
      });

      manager.setAnimationFrameIndex(0); // Global is 0

      // Request frame 2 specifically
      const pixels = manager.getTilePixels(1, 2);
      expect(pixels?.[0]?.[0]).toBe('2');
    });

    it('wraps override frame index to valid range', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b')],
      });

      // Request frame 5 (should wrap to 1)
      const pixels = manager.getTilePixels(1, 5);
      expect(pixels?.[0]?.[0]).toBe('b');
    });

    it('handles negative override frame index', () => {
      const gameState = createGameState();
      const manager = new TileManager(gameState);
      manager.ensureDefaultTiles();

      manager.updateTile(1, {
        frames: [makeFrame('a'), makeFrame('b'), makeFrame('c')],
      });

      // Request frame -1 (should wrap to 2)
      const pixels = manager.getTilePixels(1, -1);
      expect(pixels?.[0]?.[0]).toBe('c');
    });
  });

  describe('Empty preset handling', () => {
    it('handles empty preset list gracefully', () => {
      presets = [];
      const gameState = createGameState();
      const manager = new TileManager(gameState);

      const builtPresets = manager.buildPresetTiles();
      expect(builtPresets).toEqual([]);
    });

    it('does not initialize tiles when presets are empty', () => {
      presets = [];
      const gameState = createGameState();
      const manager = new TileManager(gameState);

      manager.ensureDefaultTiles();

      expect(gameState.game.tileset.tiles.length).toBe(0);
    });
  });
});
