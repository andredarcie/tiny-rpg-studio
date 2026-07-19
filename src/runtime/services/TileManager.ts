import type {
  GameStateApi,
  TileDefinition,
  TileFrame,
  TileId,
  TileMap,
  TileMapLayer,
  TileVisualEffectKind,
} from '../domain/definitions/tileTypes';
import {
  getCustomTileEffect,
  isCustomTileEffectId,
  normalizeTileVisualEffect,
} from '../domain/definitions/customTileEffects';
import { TILE_PRESETS_SOURCE } from '../domain/definitions/tilePresets';
import { TileDefinitions } from '../domain/definitions/TileDefinitions';
import { CustomSpriteLookup } from '../domain/sprites/CustomSpriteLookup';
import type { CustomSpriteEntry } from '../../types/gameState';

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
    const layouts = tile.layouts?.map((layout) => layout.map((row) => row.slice()));
    return { ...tile, frames, pixels, layouts };
  }

  regenerateTilesWithPalette(palette: string[]): void {
    const tiles = this.gameState.game.tileset.tiles;
    if (!Array.isArray(tiles)) return;

    for (const tile of tiles) {
      if (Array.isArray(tile.layouts) && tile.layouts.length) {
        // Regenerate frames from layouts with new palette
        const frames = tile.layouts.map((layout) => TileDefinitions.toPixels(layout, palette));
        tile.frames = frames;
        tile.pixels = frames[0] ?? tile.pixels;
      }
    }
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
    return this.gameState.game.tileset.tiles.map((t) => this.getTile(t.id as TileId) ?? t);
  }

  getTile(tileId: TileId): TileDefinition | null {
    const tile = this.gameState.game.tileset.tiles.find((t) => t.id === tileId) || null;
    if (!tile) return null;

    const customSprites = (this.gameState as unknown as { game: { customSprites?: CustomSpriteEntry[] } }).game.customSprites;
    const custom = CustomSpriteLookup.find(customSprites, 'tile', String(tileId));
    if (!custom || custom.frames.length === 0) return tile;
    const game = (this.gameState as unknown as { game: { customPalette?: string[] } }).game;
    const palette = Array.isArray(game.customPalette)
      ? game.customPalette
      : undefined;
    const pixelFrames = custom.frames.map((frame) => TileDefinitions.toPixels(frame, palette));

    return {
      ...tile,
      layouts: custom.frames.map((frame) => frame.map((row) => row.slice())),
      frames: pixelFrames,
      pixels: pixelFrames[0] as TileFrame,
      animated: custom.frames.length > 1,
    };
  }

  /**
   * Apply VERSION_36 share map onto current tileset tiles.
   * IDs not listed keep their existing/default visualEffect.
   * Listed IDs get water/lava; to clear an effect the map simply omits it and
   * the caller may pass resetUnknown=true to force unlisted tiles to none —
   * we only set listed ones so presets keep water/lava defaults when map is sparse.
   */
  applyTileVisualEffects(effects: Record<string, TileVisualEffectKind> | null | undefined): void {
    if (!effects || typeof effects !== 'object') return;
    const tiles = this.gameState.game.tileset.tiles;
    if (!Array.isArray(tiles)) return;
    for (const tile of tiles) {
      if (tile.id === undefined) continue;
      const key = String(tile.id);
      if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
      tile.visualEffect = normalizeTileVisualEffect(
        effects[key],
        this.gameState.game.customTileEffects
      );
    }
  }

  setTileVisualEffect(tileId: TileId, effect: TileVisualEffectKind): void {
    const tile = this.gameState.game.tileset.tiles.find((t) => t.id === tileId);
    if (!tile) return;
    tile.visualEffect = normalizeTileVisualEffect(effect, this.gameState.game.customTileEffects);
  }

  getTileVisualEffect(tileId: TileId): TileVisualEffectKind {
    const tile = this.getTile(tileId);
    if (!tile) return 'none';
    const explicitEffect = (tile as { visualEffect?: unknown }).visualEffect;
    if (explicitEffect === 'water' || explicitEffect === 'lava' || explicitEffect === 'none') {
      return explicitEffect;
    }
    if (isCustomTileEffectId(explicitEffect)) {
      return getCustomTileEffect(this.gameState.game.customTileEffects, explicitEffect)?.id ?? 'none';
    }
    if (typeof explicitEffect === 'string' && explicitEffect.startsWith('custom:')) {
      return 'none';
    }
    // Legacy heuristics when property is unset (pre-VERSION_36 games).
    const normalize = (value = '') =>
      value
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const category = normalize(tile.category || '');
    const name = normalize(tile.name || '');
    if (category === 'agua' || name.includes('agua') || name.includes('water')) return 'water';
    if (category === 'perigo' || name.includes('lava')) return 'lava';
    return 'none';
  }

  updateTile(tileId: TileId, data: Partial<TileDefinition>): void {
    // Mutate the tileset entry directly (getTile may return a spread copy with custom frames).
    const stored = this.gameState.game.tileset.tiles.find((t) => t.id === tileId);
    if (!stored) return;
    Object.assign(stored, data);
    if (Array.isArray(data.frames)) {
      stored.pixels = data.frames[0];
      stored.animated = data.frames.length > 1;
    } else if (Array.isArray(data.pixels)) {
      stored.frames = undefined;
      stored.animated = false;
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
