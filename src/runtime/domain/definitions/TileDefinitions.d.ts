import { Tile } from '../entities/Tile';
import type { TileFrame } from '../entities/Tile';
/**
 * TileDefinitions centralizes the PICO-8 palette and the default tiles.
 */
declare class TileDefinitions {
    static PICO8_COLORS: readonly string[];
    static createTile(id: number, name: string, layouts: (number | null)[][][] | (number | null)[][], collision?: boolean, category?: string, palette?: string[]): Tile;
    static createEmptyLayout(): null[][];
    static toPixels(layout: (number | null)[][], palette?: string[]): TileFrame;
    static tile(index: number, name: string, layout: (number | null)[][], collision?: boolean, category?: string, alternateLayout?: (number | null)[][] | null): Tile;
    static TILE_PRESETS: Tile[];
    static get presets(): Tile[];
}
declare const PICO8_COLORS: readonly string[];
declare const TILE_PRESETS: Tile[];
export { PICO8_COLORS, TILE_PRESETS, TileDefinitions };
