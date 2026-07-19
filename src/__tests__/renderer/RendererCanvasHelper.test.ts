import { describe, expect, it, vi } from 'vitest';
import { RendererCanvasHelper } from '../../runtime/adapters/renderer/RendererCanvasHelper';
import type { TileDefinition } from '../../runtime/domain/definitions/tileTypes';

type TestCtx = {
  fillStyle: string;
  globalAlpha: number;
  globalCompositeOperation: string;
  shadowColor: string;
  shadowBlur: number;
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
};

function makeCtx(): TestCtx {
  return {
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: 'transparent',
    shadowBlur: 0,
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  };
}

function asCanvasCtx(ctx: TestCtx): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
}

/** Outline defaults to off; tests that assert outlines must enable it. */
function outlineOnGameState(colorIndex = 1) {
  return { getGame: () => ({ spriteOutline: true, spriteOutlineColor: colorIndex }) };
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

  it('drawSprite draws palette index 0 outline only inside the sprite grid', () => {
    const ctx = makeCtx();
    const fillStyles: string[] = [];
    Object.defineProperty(ctx, 'fillStyle', {
      set(value: string) {
        fillStyles.push(value);
      },
      get() {
        return fillStyles[fillStyles.length - 1] ?? '';
      },
    });
    const paletteManager = { getColor: vi.fn((index: number) => (index === 1 ? '#1a0a2e' : '#fff')) };
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(ctx),
      null,
      paletteManager,
      outlineOnGameState()
    );

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

    // In-bounds empty neighbors only: (1,0) and (0,1) for each of the two solids that map there,
    // but each empty cell is drawn once per adjacent solid → 4 outline + 2 fill
    // (0,0)#111 outlines (1,0) and (0,1); (1,1)#222 outlines (0,1) and (1,0) → 4 outline rects + 2 fills
    expect(ctx.fillRect).toHaveBeenCalledTimes(6);

    // Outline uses default palette index 1
    expect(paletteManager.getColor).toHaveBeenCalledWith(1);
    expect(fillStyles[0]).toBe('#1a0a2e');
    expect(fillStyles).toContain('#111');
    expect(fillStyles).toContain('#222');

    // Last two calls are the fill pass (actual sprite colors)
    expect(ctx.fillRect).toHaveBeenNthCalledWith(5, 5, 7, 3, 3);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(6, 8, 10, 3, 3);

    // Outline stays inside the 2x2 grid (empty cells only), never outside the bounds
    expect(ctx.fillRect).toHaveBeenCalledWith(8, 7, 3, 3); // (1,0) empty
    expect(ctx.fillRect).toHaveBeenCalledWith(5, 10, 3, 3); // (0,1) empty
    expect(ctx.fillRect).not.toHaveBeenCalledWith(2, 7, 3, 3); // left of grid
    expect(ctx.fillRect).not.toHaveBeenCalledWith(5, 4, 3, 3); // above grid
  });

  it('getSpriteOutlineColor falls back when palette is missing', () => {
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    expect(helper.getSpriteOutlineColor()).toBe('#1D2B53');
  });

  it('getSpriteOutlineColor uses game spriteOutlineColor palette index', () => {
    const paletteManager = { getColor: vi.fn((index: number) => `color-${index}`) };
    const gameState = { getGame: () => ({ spriteOutline: true, spriteOutlineColor: 7 }) };
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(makeCtx()),
      null,
      paletteManager,
      gameState
    );
    expect(helper.getSpriteOutlineColorIndex()).toBe(7);
    expect(helper.getSpriteOutlineColor()).toBe('color-7');
    expect(paletteManager.getColor).toHaveBeenCalledWith(7);
  });

  it('drawSprite skips outline when spriteOutline is disabled', () => {
    const ctx = makeCtx();
    const gameState = { getGame: () => ({ spriteOutline: false }) };
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(ctx),
      null,
      null,
      gameState
    );

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
    expect(helper.isSpriteOutlineEnabled()).toBe(false);
  });

  it('drawSprite keeps outline inside bounds and no-ops on empty sprite', () => {
    const ctx = makeCtx();
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(ctx), null);

    // Full-width solid row: no empty in-bounds neighbors for outline
    helper.drawSprite(asCanvasCtx(ctx), [['#abc', '#def']], 0, 0, 2);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.fillRect).not.toHaveBeenCalledWith(-2, 0, 2, 2);
    expect(ctx.fillRect).not.toHaveBeenCalledWith(4, 0, 2, 2);

    const emptyCtx = makeCtx();
    helper.drawSprite(asCanvasCtx(emptyCtx), [], 0, 0, 2);
    expect(emptyCtx.fillRect).not.toHaveBeenCalled();
  });

  it('drawSprite never paints outline outside an 8x8 grid', () => {
    const ctx = makeCtx();
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(ctx),
      null,
      null,
      outlineOnGameState()
    );
    const sprite = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null));
    sprite[0][0] = '#f00';
    sprite[7][7] = '#0f0';

    helper.drawSprite(asCanvasCtx(ctx), sprite, 0, 0, 1);

    for (const call of ctx.fillRect.mock.calls) {
      const [x, y] = call as [number, number, number, number];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + 1).toBeLessThanOrEqual(8);
      expect(y + 1).toBeLessThanOrEqual(8);
    }
  });

  it('tile draw paths apply in-bounds outline around transparent cells', () => {
    const ctx = makeCtx();
    const tilePixels = setPixelGrid('#f00', true);
    const tile = makeTile({ pixels: tilePixels as unknown as TileDefinition['pixels'] });
    const tileManager = { getTile: vi.fn(() => tile) };
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(ctx),
      tileManager,
      null,
      outlineOnGameState()
    );

    helper.drawCustomTile('x', 10, 20, 16);

    // Opaque pixel at (1,1) with step 2: 4 cardinal empty neighbors (outline) + 1 fill
    expect(ctx.fillRect).toHaveBeenCalledTimes(5);
    expect(ctx.fillRect).toHaveBeenCalledWith(12, 22, 2, 2); // fill at (1,1)
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 22, 2, 2); // left outline (0,1)
    expect(ctx.fillRect).toHaveBeenCalledWith(14, 22, 2, 2); // right outline (2,1)
    expect(ctx.fillRect).toHaveBeenCalledWith(12, 20, 2, 2); // above outline (1,0)
    expect(ctx.fillRect).toHaveBeenCalledWith(12, 24, 2, 2); // below outline (1,2)
  });

  it('fully solid tiles produce no outline pixels', () => {
    const ctx = makeCtx();
    const solid = setOpaqueGrid('#0f0');
    const tile = makeTile({ pixels: solid as unknown as TileDefinition['pixels'] });
    const tileManager = { getTile: vi.fn(() => tile) };
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(ctx), tileManager);

    helper.drawCustomTile('solid', 0, 0, 8);

    // 8x8 solid fill, no empty cells for outline
    expect(ctx.fillRect).toHaveBeenCalledTimes(64);
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
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(ctx),
      tileManager,
      null,
      outlineOnGameState()
    );

    helper.drawCustomTile('x', 10, 20, 16);

    expect(tileManager.getTile).toHaveBeenCalledWith('x');
    // 4 outline neighbors + 1 fill for the single opaque pixel
    expect(ctx.fillRect).toHaveBeenCalledTimes(5);
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

    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(makeCtx()),
      null,
      null,
      outlineOnGameState()
    );
    const tile = makeTile({ pixels: setPixelGrid('#0f0', true) as unknown as TileDefinition['pixels'] });

    helper.drawTileOnCanvas(targetCanvas, tile);

    expect(targetCtx.clearRect).toHaveBeenCalledWith(0, 0, 16, 16);
    // 4 outline neighbors + 1 fill for the single opaque pixel
    expect(targetCtx.fillRect).toHaveBeenCalledTimes(5);
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
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(mainCtx),
      tileManager,
      null,
      outlineOnGameState()
    );

    helper.drawTilePreview('tile-1', 4, 6, 16, asCanvasCtx(customCtx));

    expect(tileManager.getTile).toHaveBeenCalledWith('tile-1');
    // 4 outline neighbors + 1 fill for the single opaque pixel
    expect(customCtx.fillRect).toHaveBeenCalledTimes(5);
    expect(customCtx.fillRect).toHaveBeenCalledWith(6, 8, 2, 2);
    expect(mainCtx.fillRect).not.toHaveBeenCalled();

    const noMgr = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(mainCtx), null);
    expect(() => noMgr.drawTilePreview('x', 0, 0, 8)).not.toThrow();
  });

  it('classifies water and lava tiles for visual effects', () => {
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);

    expect(helper.getTileVisualEffect({ category: 'Agua', name: 'Agua Brilhante' })).toBe('water');
    expect(helper.getTileVisualEffect({ category: 'Terreno', name: 'Shiny Water' })).toBe('water');
    expect(helper.getTileVisualEffect({ category: 'Perigo', name: 'Lava Borbulhante' })).toBe('lava');
    expect(helper.getTileVisualEffect({ category: 'Natureza', name: 'Arvore Verde' })).toBe('none');
    expect(helper.getTileVisualEffect({ category: 'Terreno', name: 'Grama' })).toBe('none');
    expect(helper.getTileVisualEffect(null)).toBe('none');
    // Explicit visualEffect overrides name/category heuristics.
    expect(helper.getTileVisualEffect({ category: 'Terreno', name: 'Grama', visualEffect: 'water' })).toBe('water');
    expect(helper.getTileVisualEffect({ category: 'Agua', name: 'Agua', visualEffect: 'none' })).toBe('none');
    expect(helper.getTileVisualEffect({ category: 'Natureza', name: 'Arvore', visualEffect: 'lava' })).toBe('lava');
  });

  it('respects project enableEffects master switch', () => {
    const gameState = { getGame: () => ({ enableEffects: false }) };
    const helper = new RendererCanvasHelper(
      document.createElement('canvas'),
      asCanvasCtx(makeCtx()),
      null,
      null,
      gameState
    );
    expect(helper.isTileEffectsEnabled()).toBe(false);
    expect(helper.getTileVisualEffect({ category: 'Agua', name: 'Water', visualEffect: 'water' })).toBe('none');
    expect(helper.getTileVisualEffect({ category: 'Perigo', name: 'Lava', visualEffect: 'lava' })).toBe('none');
  });

  it('draws water with depth tint, variable alpha body, and surface effects', () => {
    const ctx = makeCtx();
    // Mix deep blue + bright sparkle so luminance-based alpha differs.
    const pixels = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => ((x + y) % 5 === 0 ? '#FFF1E8' : '#29ADFF'))
    );
    const tile = makeTile({
      category: 'Agua',
      name: 'Agua Brilhante',
      pixels: pixels as unknown as TileDefinition['pixels'],
    });
    const tileManager = { getTile: vi.fn(() => tile) };
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(ctx), tileManager);
    vi.spyOn(helper, 'getEffectTimeMs').mockReturnValue(0);

    const alphas: number[] = [];
    Object.defineProperty(ctx, 'globalAlpha', {
      configurable: true,
      get() {
        return (this as { _alpha?: number })._alpha ?? 1;
      },
      set(value: number) {
        (this as { _alpha?: number })._alpha = value;
        alphas.push(value);
      },
    });

    helper.drawCustomTile(5, 0, 0, 16);

    // Depth wash + translucent body (+ optional surface strokes)
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(64);
    // First rect is the wet blue depth tint over the full tile.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 16, 16);
    // Body uses multiple alphas (not a single flat dim).
    const bodyAlphas = alphas.filter((a) => a > 0.2 && a < 1);
    expect(bodyAlphas.length).toBeGreaterThan(8);
    expect(new Set(bodyAlphas.map((a) => a.toFixed(3))).size).toBeGreaterThan(1);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('reflects a sprite faintly and vertically flipped only into water directly below', () => {
    const ctx = makeCtx();
    const water = makeTile({ visualEffect: 'water' });
    const ground = makeTile({ visualEffect: 'none' });
    const map = {
      ground: Array.from({ length: 8 }, () => Array<string | number | null>(8).fill(null)),
      overlay: Array.from({ length: 8 }, () => Array<string | number | null>(8).fill(null)),
    };
    map.ground[4][2] = 'water';
    const tileManager = {
      getTile: vi.fn((id: string | number) => (id === 'water' ? water : ground)),
      getTileMap: vi.fn(() => map),
    };
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    const helper = new RendererCanvasHelper(canvas, asCanvasCtx(ctx), tileManager);
    const sprite = Array.from({ length: 8 }, (_, y) => [y === 0 ? '#top' : y === 7 ? '#bottom' : null]);
    const alphas: number[] = [];
    Object.defineProperty(ctx, 'globalAlpha', {
      configurable: true,
      get() {
        return (this as { _alpha?: number })._alpha ?? 1;
      },
      set(value: number) {
        (this as { _alpha?: number })._alpha = value;
        alphas.push(value);
      },
    });

    helper.drawWaterReflectionForSprite(asCanvasCtx(ctx), sprite, 32, 48, 2, 0, 2, 3);

    expect(ctx.rect).toHaveBeenCalledWith(32, 64, 16, 16);
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 32, 64, 2, 2);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(2, 32, 78, 2, 2);
    expect(alphas).toContain(0.2);

    ctx.fillRect.mockClear();
    map.ground[4][2] = null;
    map.ground[3][2] = 'water';
    helper.drawWaterReflectionForSprite(asCanvasCtx(ctx), sprite, 32, 48, 2, 0, 2, 3);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws lava with glow, wave-lit body, and ridge/shadow overlays', () => {
    const ctx = makeCtx();
    const solid = setOpaqueGrid('#FF004D');
    const tile = makeTile({
      category: 'Perigo',
      name: 'Lava Borbulhante',
      pixels: solid as unknown as TileDefinition['pixels'],
    });
    const tileManager = { getTile: vi.fn(() => tile) };
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(ctx), tileManager);
    vi.spyOn(helper, 'getEffectTimeMs').mockReturnValue(0);

    helper.drawCustomTile(6, 0, 0, 16);

    // Glow underlay + 64 wave-lit body pixels + crest/trough overlay strokes.
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(65);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();

    // Body colors should be modulated (not only the raw palette red).
    const fillStyles = (ctx as TestCtx & { fillStyle: string }).fillStyle;
    expect(typeof fillStyles).toBe('string');

    const field = helper.buildHeightField(8, 8, 0);
    expect(field).toHaveLength(8);
    expect(field[0]).toHaveLength(8);
    // Flowing field is not flat.
    const flat = field.flat();
    expect(Math.max(...flat) - Math.min(...flat)).toBeGreaterThan(0.5);
  });

  it('modulates and mixes colors for wave lighting', () => {
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    expect(helper.parseColor('#29ADFF')).toEqual({ r: 0x29, g: 0xad, b: 0xff });
    expect(helper.colorLuminance('#FFFFFF')).toBeCloseTo(1, 2);
    expect(helper.modulateColor('#808080', 2)).toBe('rgb(255,255,255)');
    expect(helper.mixColors('#000000', '#FFFFFF', 0.5)).toBe('rgb(128,128,128)');
  });

  it('keeps liquid effect phase stable until explicitly advanced', () => {
    const helper = new RendererCanvasHelper(document.createElement('canvas'), asCanvasCtx(makeCtx()), null);
    expect(helper.liquidEffectStep).toBe(0);
    const t0 = helper.getEffectTimeMs();
    // Simulated movement redraws must not change the phase.
    expect(helper.getEffectTimeMs()).toBe(t0);
    expect(helper.getEffectTimeMs()).toBe(t0);

    helper.advanceLiquidEffectPhase();
    const t1 = helper.getEffectTimeMs();
    expect(t1).toBeGreaterThan(t0);
    expect(helper.liquidEffectStep).toBe(1);
    // Still stable across repeated reads after a single advance.
    expect(helper.getEffectTimeMs()).toBe(t1);
  });

});
