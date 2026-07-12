import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { RendererHudRenderer } from '../../runtime/adapters/renderer/RendererHudRenderer';

type SpriteMatrix = (string | null)[][];

type CtxMock = {
  canvas: { width: number; height: number };
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  textAlign: string;
  textBaseline: string;
};

function asCanvasCtx(ctx: CtxMock): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
}

function sprite(id = 1): SpriteMatrix {
  return [[String(id)]];
}

function createCtx(width = 128): CtxMock {
  return {
    canvas: { width, height: 64 },
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
}

type GameStateOverrides = {
  swordType?: string | null;
  swordDurability?: number;
  isGameOver?: boolean;
  keys?: number;
  maxKeys?: number;
  hasBoots?: boolean;
  hasArmor?: boolean;
};

function makeFixture(overrides: GameStateOverrides = {}) {
  const {
    swordType = null,
    swordDurability = 0,
    isGameOver = false,
    keys = 0,
    maxKeys = 9,
    hasBoots = false,
    hasArmor = false,
  } = overrides;

  const gameState = {
    isGameOver: vi.fn(() => isGameOver),
    getMaxLives: vi.fn(() => 3),
    getLives: vi.fn(() => 3),
    getMaxKeys: vi.fn(() => maxKeys),
    getKeys: vi.fn(() => keys),
    getDamageShield: vi.fn(() => 0),
    getDamageShieldMax: vi.fn(() => 0),
    getSwordType: vi.fn(() => swordType),
    getSwordDurability: vi.fn(() => swordDurability),
    hasBoots: vi.fn(() => hasBoots),
    hasArmor: vi.fn(() => hasArmor),
    getLevel: vi.fn(() => 1),
    getGame: vi.fn(() => ({ world: { rows: 1, cols: 1 } })),
    getPlayer: vi.fn(() => ({ roomIndex: 0 })),
    getExperienceToNext: vi.fn(() => 10),
    getExperience: vi.fn(() => 0),
  };

  const canvasHelper = {
    getTilePixelSize: vi.fn(() => 16),
    drawSprite: vi.fn(),
  };

  const objectSprites: Record<string, SpriteMatrix> = {
    [ITEM_TYPES.SWORD]: sprite(1),
    [ITEM_TYPES.SWORD_WOOD]: sprite(2),
    [ITEM_TYPES.SWORD_BRONZE]: sprite(3),
    [ITEM_TYPES.KEY]: sprite(4),
    [ITEM_TYPES.BOOTS]: sprite(5),
    [ITEM_TYPES.ARMOR]: sprite(6),
  };

  const entityRenderer = {
    canvasHelper,
    spriteFactory: {
      getObjectSprites: vi.fn(() => objectSprites),
    },
  };

  const paletteManager = {
    getColor: vi.fn((index: number): string => {
      if (index === 6) return '#C2C3C7';
      return '#FFFFFF';
    }),
  };

  const renderer = new RendererHudRenderer(
    gameState as never,
    entityRenderer as never,
    paletteManager as never,
  );

  return { renderer, gameState, canvasHelper, paletteManager, objectSprites };
}

describe('RendererHudRenderer sword durability markers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── drawSwordDurabilityMarkers ───────────────────────────────────────────

  describe('drawSwordDurabilityMarkers', () => {
    it('draws nothing when durability is 0 or negative', () => {
      const { renderer } = makeFixture();
      const ctx = createCtx();

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 10, 20, 16, 0);
      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 10, 20, 16, -3);

      expect(ctx.fillRect).not.toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('draws nothing when durability is non-finite', () => {
      const { renderer } = makeFixture();
      const ctx = createCtx();

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 10, 20, 16, Number.NaN);
      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 10, 20, 16, Number.POSITIVE_INFINITY);

      expect(ctx.fillRect).not.toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('draws one square per remaining durability hit', () => {
      const { renderer } = makeFixture();
      const ctx = createCtx();

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 0, 20, 16, 3);

      expect(ctx.fillRect).toHaveBeenCalledTimes(3);
      expect(ctx.strokeRect).toHaveBeenCalledTimes(3);
    });

    it('floors fractional durability to whole squares', () => {
      const { renderer } = makeFixture();
      const ctx = createCtx();

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 0, 20, 16, 2.9);

      expect(ctx.fillRect).toHaveBeenCalledTimes(2);
      expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
    });

    it('places squares above the sword icon and centers them horizontally', () => {
      const { renderer } = makeFixture();
      const ctx = createCtx();
      const px = 40;
      const py = 30;
      const iconSize = 16;
      const durability = 3;

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), px, py, iconSize, durability);

      const size = Math.max(3, Math.floor(iconSize / 5));
      const gap = Math.max(2, Math.floor(size * 0.4));
      const totalWidth = durability * size + (durability - 1) * gap;
      const expectedStartX = Math.round(px + iconSize / 2 - totalWidth / 2);
      const expectedStartY = Math.round(py - size - gap * 2);

      // First square at the computed top-center origin
      expect(ctx.fillRect).toHaveBeenNthCalledWith(1, expectedStartX, expectedStartY, size, size);
      // Subsequent squares step to the right
      expect(ctx.fillRect).toHaveBeenNthCalledWith(
        2,
        expectedStartX + (size + gap),
        expectedStartY,
        size,
        size,
      );
      // Squares sit strictly above the icon top edge
      expect(expectedStartY + size).toBeLessThanOrEqual(py);
    });

    it('uses palette color 6 for fill with black stroke (enemy-lives style)', () => {
      const { renderer, paletteManager } = makeFixture();
      const ctx = createCtx();

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 0, 20, 16, 1);

      expect(paletteManager.getColor).toHaveBeenCalledWith(6);
      expect(ctx.fillStyle).toBe('#C2C3C7');
      expect(ctx.strokeStyle).toBe('#000000');
    });

    it('falls back to light gray when palette color is missing', () => {
      const { renderer, paletteManager } = makeFixture();
      vi.mocked(paletteManager.getColor).mockReturnValue('');
      const ctx = createCtx();

      renderer.drawSwordDurabilityMarkers(asCanvasCtx(ctx), 0, 20, 16, 1);

      expect(ctx.fillStyle).toBe('#C2C3C7');
      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });
  });

  // ─── drawInventory integration ────────────────────────────────────────────

  describe('drawInventory (sword durability visual)', () => {
    it('does not draw durability markers when no sword is equipped', () => {
      const { renderer } = makeFixture({ swordType: null, swordDurability: 5 });
      const ctx = createCtx();
      const markerSpy = vi.spyOn(renderer, 'drawSwordDurabilityMarkers');

      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });

      expect(markerSpy).not.toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled(); // inventory background only
    });

    it('does not draw markers when sword type has no sprite', () => {
      const { renderer } = makeFixture({ swordType: 'unknown-sword', swordDurability: 3 });
      const ctx = createCtx();
      const markerSpy = vi.spyOn(renderer, 'drawSwordDurabilityMarkers');

      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });

      expect(markerSpy).not.toHaveBeenCalled();
    });

    it('draws the sword sprite and durability markers when equipped', () => {
      const { renderer, canvasHelper, gameState } = makeFixture({
        swordType: ITEM_TYPES.SWORD_WOOD,
        swordDurability: 3,
      });
      const ctx = createCtx();
      const markerSpy = vi.spyOn(renderer, 'drawSwordDurabilityMarkers');

      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });

      expect(canvasHelper.drawSprite).toHaveBeenCalled();
      expect(markerSpy).toHaveBeenCalledTimes(1);
      expect(markerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.any(Number),
        16, // equipSize = tile pixel size
        3,
      );
      expect(gameState.getSwordDurability).toHaveBeenCalled();
    });

    it('passes current remaining durability so squares decline as the sword is used', () => {
      const { renderer, gameState } = makeFixture({
        swordType: ITEM_TYPES.SWORD,
        swordDurability: 5,
      });
      const ctx = createCtx();
      const markerSpy = vi.spyOn(renderer, 'drawSwordDurabilityMarkers');

      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });
      expect(markerSpy).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), expect.any(Number), 16, 5);

      vi.mocked(gameState.getSwordDurability).mockReturnValue(2);
      markerSpy.mockClear();
      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });
      expect(markerSpy).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), expect.any(Number), 16, 2);

      vi.mocked(gameState.getSwordDurability).mockReturnValue(0);
      markerSpy.mockClear();
      // drawInventory still calls the helper with 0; the helper itself no-ops for <= 0
      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });
      expect(markerSpy).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), expect.any(Number), 16, 0);
    });

    it('renders one fillRect square per remaining hit when durability declines', () => {
      const { renderer, gameState } = makeFixture({
        swordType: ITEM_TYPES.SWORD_BRONZE,
        swordDurability: 4,
      });
      const ctx = createCtx();

      // Capture only marker squares by spying after inventory bg fill
      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });
      // Background fillRect (1) + 4 durability squares
      const fillsAfterFull = ctx.fillRect.mock.calls.length;
      expect(fillsAfterFull).toBeGreaterThanOrEqual(5);

      vi.mocked(gameState.getSwordDurability).mockReturnValue(1);
      const ctx2 = createCtx();
      renderer.drawInventory(asCanvasCtx(ctx2), { width: 128, height: 32, padding: 2 });
      // Background (1) + 1 durability square
      expect(ctx2.fillRect).toHaveBeenCalledTimes(2);
      expect(ctx2.strokeRect).toHaveBeenCalledTimes(1);
    });

    it('does not draw markers during game over (inventory early return)', () => {
      const { renderer } = makeFixture({
        swordType: ITEM_TYPES.SWORD,
        swordDurability: 3,
        isGameOver: true,
      });
      const ctx = createCtx();
      const markerSpy = vi.spyOn(renderer, 'drawSwordDurabilityMarkers');

      renderer.drawInventory(asCanvasCtx(ctx), { width: 128, height: 32, padding: 2 });

      expect(markerSpy).not.toHaveBeenCalled();
    });

    it('positions markers using the sword icon coordinates in the inventory bar', () => {
      const { renderer } = makeFixture({
        swordType: ITEM_TYPES.SWORD,
        swordDurability: 2,
      });
      const ctx = createCtx(128);
      const markerSpy = vi.spyOn(renderer, 'drawSwordDurabilityMarkers');
      const padding = 2;
      const width = 128;
      const height = 32;
      const tileSize = 16;
      const equipSize = tileSize;
      const equipY = padding + Math.max(0, Math.round((height - padding * 2 - equipSize) / 2));
      const equipX = width - padding - equipSize;

      renderer.drawInventory(asCanvasCtx(ctx), { width, height, padding });

      expect(markerSpy).toHaveBeenCalledWith(expect.anything(), equipX, equipY, equipSize, 2);
    });
  });
});
