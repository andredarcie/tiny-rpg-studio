import type { TileDefinition } from './tileTypes';
import type { CustomSpriteEntry } from '../../../types/gameState';

const copyFrame = <T>(frame: T[][]): T[][] => frame.map((row) => row.slice());

export function normalizeTileFrames(tile: TileDefinition): void {
  if (tile.layouts?.length === 1) {
    tile.layouts.push(copyFrame(tile.layouts[0]));
  }
  if ((!tile.frames || tile.frames.length === 0) && tile.pixels) {
    tile.frames = [copyFrame(tile.pixels)];
  }
  if (tile.frames?.length === 1) {
    tile.frames.push(copyFrame(tile.frames[0]));
  }
  if (!tile.pixels && tile.frames?.[0]) tile.pixels = tile.frames[0];
  tile.animated = (tile.frames?.length ?? 0) > 1;
}

export function normalizeTileSpriteFrames(entries: CustomSpriteEntry[] | undefined): void {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (entry.group === 'tile' && entry.frames.length === 1) {
      entry.frames.push(copyFrame(entry.frames[0]));
    }
  }
}
