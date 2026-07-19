import { describe, expect, it, vi } from 'vitest';
import { BASE_TILE_EFFECT_IDS } from '../../runtime/domain/definitions/customTileEffects';
import {
  BASE_TILE_EFFECT_CATALOG,
  listBaseTileEffects,
  paintBaseTileEffectComposition,
} from '../../runtime/adapters/renderer/tileEffects/baseEffectRegistry';

describe('base tile effect registry', () => {
  it('pins one selectable painter to every VERSION_37 catalog ID', () => {
    expect(BASE_TILE_EFFECT_IDS).toHaveLength(25);
    expect(BASE_TILE_EFFECT_CATALOG.map((entry) => entry.id)).toEqual(BASE_TILE_EFFECT_IDS);
    expect(BASE_TILE_EFFECT_CATALOG.every((entry) => typeof entry.painter === 'function')).toBe(true);
    expect(listBaseTileEffects().every((entry) => !('painter' in entry))).toBe(true);
    expect(BASE_TILE_EFFECT_IDS.slice(-4)).toEqual([
      'reflection-top', 'reflection-bottom', 'reflection-left', 'reflection-right',
    ]);
    expect(BASE_TILE_EFFECT_IDS.some((id) => id.includes('procedural'))).toBe(false);
  });

  it('adapts every directional reflection to the single-tile painter contract', () => {
    const host = {
      drawPixelGrid: vi.fn(),
      isEmptyPixel: vi.fn(() => false),
      isSpriteOutlineEnabled: vi.fn(() => false),
      getSpriteOutlineColor: vi.fn(() => '#000'),
    };
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      fillRect: vi.fn(), fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D;
    const pixels = Array.from({ length: 8 }, () => Array<string | null>(8).fill('#fff'));

    paintBaseTileEffectComposition(
      { ctx, host, pixels, px: 16, py: 24, step: 2, size: 16, timeMs: 0 },
      ['reflection-top', 'reflection-bottom', 'reflection-left', 'reflection-right'],
    );

    expect(host.drawPixelGrid).toHaveBeenCalledTimes(5);
    expect(ctx.clip).toHaveBeenCalledTimes(4);
  });

  it('always paints the normal tile body before the selected composition', () => {
    const host = {
      drawPixelGrid: vi.fn(),
      isEmptyPixel: vi.fn(() => false),
      isSpriteOutlineEnabled: vi.fn(() => false),
      getSpriteOutlineColor: vi.fn(() => '#000'),
    };
    const ctx = {
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(),
      fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D;
    const pixels = [['#fff']];
    paintBaseTileEffectComposition(
      { ctx, host, pixels, px: 0, py: 0, step: 1, size: 8, timeMs: 0 },
      ['cool-tint', 'deep-tint'],
    );
    expect(host.drawPixelGrid).toHaveBeenCalledTimes(1);
    expect(host.drawPixelGrid).toHaveBeenCalledWith(ctx, pixels, 0, 0, 1);
    expect((ctx.save as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });
});
