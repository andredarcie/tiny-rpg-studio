import type { GameStateApi, TileDefinition, TileFrame, TileId, TileMap, TileMapLayer } from '../domain/definitions/tileTypes';
import { TILE_PRESETS_SOURCE } from '../domain/definitions/tilePresets';

// TileManager owns tile preset loading, tileset initialization, and tile map mutation.
// It keeps the game state wired with tiles and room maps, provides helpers
// for editing tiles (collision, names, frames), and tracks animation frame state for renderers.
class TileManager {
  gameState: GameStateApi;
  presets: TileDefinition[];
  animationFrameIndex: number;
  maxAnimationFrames: number;

  constructor(gameState: GameStateApi) {
    this.gameState = gameState;
    this.presets = this.buildPresetTiles();
    this.animationFrameIndex = 0;
    this.maxAnimationFrames = 1;
  }

    generateTileId(): string {
        const cryptoCandidate =
            typeof crypto !== 'undefined'
                ? crypto
                : (globalThis as Partial<typeof globalThis>).crypto;
        if (cryptoCandidate) {
            const randomUUID = (cryptoCandidate as { randomUUID?: () => string }).randomUUID;
            if (typeof randomUUID === 'function') {
                return randomUUID.call(cryptoCandidate);
            }
        }
        return `tile-${Math.random().toString(36).slice(2, 10)}`;
    }

  buildPresetTiles(): TileDefinition[] {
    if (!Array.isArray(TILE_PRESETS_SOURCE)) {
      return [];
    }
    return TILE_PRESETS_SOURCE.map((tile) => this.cloneTile(tile)).sort((a, b) => {
      if (typeof a.id === 'number' && typeof b.id === 'number') {
        return a.id - b.id;
      }
      return String(a.id).localeCompare(String(b.id));
    });
  }

  cloneTile(tile: TileDefinition): TileDefinition {
    const frames = tile.frames?.map((frame) => frame.map((row) => row.slice()));
    const pixels = tile.pixels ? tile.pixels.map((row) => row.slice()) : undefined;
    return { ...tile, frames, pixels };
  }

  ensureDefaultTiles(): void {
    const tileset = this.gameState.game.tileset;
    const size = 8;
    const totalRooms = (this.gameState.game.world?.rows || 1) * (this.gameState.game.world?.cols || 1);

    if (!Array.isArray(tileset.tiles) || tileset.tiles.length === 0) {
      tileset.tiles = this.presets.map((tile) => this.cloneTile(tile));
    }

    if (!Array.isArray(tileset.maps) || tileset.maps.length === 0) {
      const defaultTileId = tileset.tiles[0]?.id ?? null;
      const makeLayer = (fallback: TileId | null): TileMapLayer =>
        Array.from({ length: size }, () => Array.from({ length: size }, () => fallback));
      tileset.maps = Array.from({ length: totalRooms }, () => ({
        ground: makeLayer(defaultTileId),
        overlay: makeLayer(null),
      }));
    } else {
          const defaultTileId = tileset.tiles[0]?.id ?? null;
          if (defaultTileId !== null) {
              const isLayerEmpty = (layer?: TileMapLayer) =>
                Array.isArray(layer) && layer.every((row) => Array.isArray(row) && row.every((cell) => cell == null));
              const fillLayer = (fallback: TileId | null): TileMapLayer =>
                Array.from({ length: size }, () => Array.from({ length: size }, () => fallback));
              tileset.maps.forEach((map) => {
                  if (isLayerEmpty(map.ground) && isLayerEmpty(map.overlay)) {
                    map.ground = fillLayer(defaultTileId);
                    map.overlay = fillLayer(null);
          }
        });
      }
    }
    tileset.map = tileset.maps[0];
    this.refreshAnimationMetadata();
  }

  getPresetTileNames(): string[] {
    return this.presets.map((tile) => tile.name || '');
  }

  getTiles(): TileDefinition[] {
    return this.gameState.game.tileset.tiles;
  }

  getTile(tileId: TileId): TileDefinition | null {
    return this.gameState.game.tileset.tiles.find((t) => t.id === tileId) || null;
  }

  updateTile(tileId: TileId, data: Partial<TileDefinition>): void {
    const tile = this.getTile(tileId);
    if (!tile) return;
    Object.assign(tile, data);
    if (Array.isArray(data.frames)) {
      tile.pixels = data.frames[0];
      tile.animated = data.frames.length > 1;
    } else if (Array.isArray(data.pixels)) {
      tile.frames = undefined;
      tile.animated = false;
    }
    this.refreshAnimationMetadata();
  }

  setMapTile(x: number, y: number, tileId: TileId | null, roomIndex = 0): void {
    if (y < 0 || y >= 8 || x < 0 || x >= 8) return;
    const maps = this.gameState.game.tileset.maps;
    const map = Array.isArray(maps) ? maps[roomIndex] : null;
    if (!map) return;

    if (tileId === null) {
      map.overlay[y][x] = null;
      map.ground[y][x] = null;
      return;
    }

    const tile = this.getTile(tileId);
    if (!tile) return;
    if (tile.collision) {
      map.overlay[y][x] = tileId;
    } else {
      map.ground[y][x] = tileId;
      map.overlay[y][x] = null;
    }
  }

  getTileMap(roomIndex = 0): TileMap {
    const maps = this.gameState.game.tileset.maps;
    if (Array.isArray(maps) && maps[roomIndex]) {
      return maps[roomIndex];
    }
    return this.gameState.game.tileset.map;
  }

    refreshAnimationMetadata(): void {
      const tiles = this.getTiles();
      let maxFrames = 1;
      for (const tile of tiles) {
        const frameCount = Array.isArray(tile.frames) && tile.frames.length ? tile.frames.length : 1;
      if (frameCount > maxFrames) {
        maxFrames = frameCount;
      }
    }
    this.maxAnimationFrames = Math.max(1, maxFrames);
  }

  getAnimationFrameCount(): number {
    return Math.max(1, this.maxAnimationFrames || 1);
  }

  getAnimationFrameIndex(): number {
    return Math.max(0, this.animationFrameIndex || 0);
  }

  setAnimationFrameIndex(index = 0): number {
    if (!Number.isFinite(index)) return this.animationFrameIndex;
    const total = this.getAnimationFrameCount();
    const safe = ((Math.floor(index) % total) + total) % total;
    this.animationFrameIndex = safe;
    return this.animationFrameIndex;
  }

  advanceAnimationFrame(): number {
    const total = this.getAnimationFrameCount();
    if (total <= 1) return this.animationFrameIndex;
    this.animationFrameIndex = (this.getAnimationFrameIndex() + 1) % total;
    return this.animationFrameIndex;
  }

    getTilePixels(tileOrTileId: TileDefinition | TileId, frameOverride: number | null = null): TileFrame | null {
      const tile =
        typeof tileOrTileId === 'object'
          ? tileOrTileId
        : this.getTile(tileOrTileId);
    if (!tile) return null;
    const frames = Array.isArray(tile.frames) && tile.frames.length
      ? tile.frames
      : tile.pixels
      ? [tile.pixels]
      : [];
    if (!frames.length) return null;
    const index = typeof frameOverride === 'number' && Number.isFinite(frameOverride)
      ? frameOverride
      : this.getAnimationFrameIndex();
    const safeIndex = ((Math.floor(index) % frames.length) + frames.length) % frames.length;
    return frames[safeIndex];
  }
}

export { TileManager };
