import { describe, expect, it, vi } from 'vitest';
import { RendererCanvasHelper } from '../../runtime/adapters/renderer/RendererCanvasHelper';
import type { TileDefinition } from '../../runtime/domain/definitions/tileTypes';

type TestCtx = {
  fillStyle: string;
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
};

function makeCtx(): TestCtx {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  };
}

function asCanvasCtx(ctx: TestCtx): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
}

function makeTile(overrides: Partial<TileDefinition> = {}): TileDefinition {
  return {
    id: '1',
    name: 'Tile',
    pixels: Array.from({ length: 8 }, () => Array<string | null>(8).fill(null)),
    ...overrides,
  } as unknown as TileDefinition;
}

function setPixelGrid(color: string | null, transparent = false): (string | null)[][] {
  const grid = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null));
  grid[0][0] = transparent ? 'transparent' : color;
  grid[1][1] = color;
  return grid;
}

function setOpaqueGrid(color: string): string[][] {
  return Array.from({ length: 8 }, () => Array<string>(8).fill(color));
}

describe('RendererCanvasHelper', () => {
  it('computes tile pixel size from canvas width', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    const helper = new RendererCanvasHelper(canvas, asCanvasCtx(makeCtx()), null);
    expect(helper.getTilePixelSize()).toBe(10);
  });

  it('drawSprite draws only non-null pixels', () => {
    const ctx = makeCtx();
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(ctx), null);

    helper.drawSprite(
      asCanvasCtx(ctx),
      [
        ['#111', null],
        [null, '#222'],
      ],
      5,
      7,
      3,
    );

    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 5, 7, 3, 3);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(2, 8, 10, 3, 3);
  });

  it('resolveTilePixels prefers tileManager.getTilePixels when available', () => {
    const tile = makeTile();
    const pixels = setPixelGrid('#abc');
    const tileManager = {
      getTile: vi.fn(),
      getTilePixels: vi.fn(() => pixels),
    };
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), tileManager);

    expect(helper.resolveTilePixels(tile, 2)).toBe(pixels);
    expect(tileManager.getTilePixels).toHaveBeenCalledWith(tile, 2);
  });

  it('resolveTilePixels falls back to first frame and then pixels', () => {
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    const framePixels = setOpaqueGrid('#123');
    const framedTile = makeTile({ frames: [framePixels], pixels: setPixelGrid('#999') as unknown as TileDefinition['pixels'] });
    const plainTile = makeTile({ pixels: setPixelGrid('#456') as unknown as TileDefinition['pixels'] });

    expect(helper.resolveTilePixels(framedTile)).toBe(framePixels);
    expect(helper.resolveTilePixels(plainTile)).toEqual(setPixelGrid('#456'));
    expect(helper.resolveTilePixels(null)).toBeNull();
  });

  it('drawCustomTile handles early returns and draws skipping transparent pixels', () => {
    const ctx = makeCtx();
    const tilePixels = setPixelGrid('#f00', true);
    const tile = makeTile({ pixels: tilePixels as unknown as TileDefinition['pixels'] });
    const tileManager = {
      getTile: vi.fn(() => tile),
    };
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(ctx), tileManager);

    helper.drawCustomTile('x', 10, 20, 16);

    expect(tileManager.getTile).toHaveBeenCalledWith('x');
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalledWith(12, 22, 2, 2);

    const noMgr = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    expect(() => noMgr.drawCustomTile('x', 0, 0, 16)).not.toThrow();
  });

  it('drawTileOnCanvas clears and draws when context/pixels exist', () => {
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = 16;
    targetCanvas.height = 16;
    const targetCtx = makeCtx();
    vi.spyOn(targetCanvas, 'getContext').mockReturnValue(asCanvasCtx(targetCtx));

    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    const tile = makeTile({ pixels: setPixelGrid('#0f0', true) as unknown as TileDefinition['pixels'] });

    helper.drawTileOnCanvas(targetCanvas, tile);

    expect(targetCtx.clearRect).toHaveBeenCalledWith(0, 0, 16, 16);
    expect(targetCtx.fillRect).toHaveBeenCalledTimes(1);
    expect(targetCtx.fillRect).toHaveBeenCalledWith(2, 2, 2, 2);
  });

  it('drawTileOnCanvas returns early when context or pixels are missing', () => {
    const targetCanvas = document.createElement('canvas');
    vi.spyOn(targetCanvas, 'getContext').mockReturnValue(null);
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    expect(() => helper.drawTileOnCanvas(targetCanvas, null)).not.toThrow();

    const targetCanvas2 = document.createElement('canvas');
    targetCanvas2.width = 8;
    targetCanvas2.height = 8;
    const ctx2 = makeCtx();
    vi.spyOn(targetCanvas2, 'getContext').mockReturnValue(asCanvasCtx(ctx2));
    helper.drawTileOnCanvas(targetCanvas2, makeTile({ pixels: null as unknown as TileDefinition['pixels'] }));
    expect(ctx2.clearRect).toHaveBeenCalled();
    expect(ctx2.fillRect).not.toHaveBeenCalled();
  });

  it('drawTilePreview draws to provided context and supports early returns', () => {
    const mainCtx = makeCtx();
    const customCtx = makeCtx();
    const tile = makeTile({ pixels: setPixelGrid('#00f', true) as unknown as TileDefinition['pixels'] });
    const tileManager = { getTile: vi.fn(() => tile) };
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(mainCtx), tileManager);

    helper.drawTilePreview('tile-1', 4, 6, 16, asCanvasCtx(customCtx));

    expect(tileManager.getTile).toHaveBeenCalledWith('tile-1');
    expect(customCtx.fillRect).toHaveBeenCalledTimes(1);
    expect(customCtx.fillRect).toHaveBeenCalledWith(6, 8, 2, 2);
    expect(mainCtx.fillRect).not.toHaveBeenCalled();

    const noMgr = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(mainCtx), null);
    expect(() => noMgr.drawTilePreview('x', 0, 0, 8)).not.toThrow();
  });
});
