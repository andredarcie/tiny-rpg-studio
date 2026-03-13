import { describe, expect, it, vi } from 'vitest';
import { Renderer } from '../../runtime/adapters/Renderer';

vi.mock('../../runtime/adapters/renderer/RendererPalette', () => ({
  RendererPalette: class {
    getColor() {
      return '#000';
    }
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererSpriteFactory', () => ({
  RendererSpriteFactory: class {
    getPlayerSprite() {
      return [[null]];
    }
    getNpcSprites() {
      return {};
    }
    getEnemySprites() {
      return {};
    }
    getEnemySprite() {
      return [[null]];
    }
    getObjectSprites() {
      return {};
    }
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererCanvasHelper', () => ({
  RendererCanvasHelper: class {
    getTilePixelSize() {
      return 8;
    }
    drawCustomTile() {}
    drawSprite() {}
    drawTileOnCanvas() {}
    drawTilePreview() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererTileRenderer', () => ({
  RendererTileRenderer: class {
    clearCanvas() {}
    drawBackground() {}
    drawTiles() {}
    drawWalls() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererEntityRenderer', () => ({
  RendererEntityRenderer: class {
    setViewportOffset() {}
    drawObjects() {}
    drawItems() {}
    drawNPCs() {}
    drawEnemies() {}
    drawPlayer() {}
    drawTileIconOnPlayer() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererDialogRenderer', () => ({
  RendererDialogRenderer: class {
    drawDialog() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererHudRenderer', () => ({
  RendererHudRenderer: class {
    drawHUD() {}
    drawInventory() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererEffectsManager', () => ({
  RendererEffectsManager: class {
    drawEdgeFlash() {}
    flashEdge() {}
    showCombatIndicator() {}
    flashScreen() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererTransitionManager', () => ({
  RendererTransitionManager: class {
    isActive() {
      return false;
    }
    start() {
      return true;
    }
    drawFrame() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererOverlayRenderer', () => ({
  RendererOverlayRenderer: class {
    setIntroData() {}
    drawIntroOverlay() {}
    drawLevelUpCelebrationOverlay() {}
    drawPickupOverlay() {}
    drawGameOverScreen() {}
    drawLevelUpOverlayFull() {}
  },
}));

describe('Renderer', () => {
  it('removes reserved HUD space when hideHud is enabled', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const canvas = {
      width: 64,
      height: 132,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const startLoopSpy = vi.spyOn(Renderer.prototype, 'startTileAnimationLoop').mockImplementation(() => {});

    try {
      const renderer = new Renderer(canvas, {
        isGameOver: () => false,
        getGame: () => ({ hideHud: true }),
      }, {
        getAnimationFrameCount: vi.fn(() => 1),
        advanceAnimationFrame: vi.fn(() => 0),
      }, {});

      expect(renderer.canvas.height).toBe(64);
      expect(renderer.gameplayOffsetY).toBe(0);
    } finally {
      startLoopSpy.mockRestore();
    }
  });

  it('advances tile animations and dispatches events', () => {
    vi.useFakeTimers();

    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const canvas = {
      width: 64,
      height: 64,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const tileManager = {
      getAnimationFrameCount: vi.fn(() => 2),
      advanceAnimationFrame: vi.fn(() => 1),
    };

    const gameState = {
      isGameOver: () => false,
      isEditorModeActive: () => false,
    };

    const dispatchEvent = vi.fn();
    const originalDispatchEvent = globalThis.dispatchEvent;
    const originalCustomEvent = globalThis.CustomEvent;
    const originalEvent = globalThis.Event;

    globalThis.dispatchEvent = dispatchEvent;
    globalThis.Event = class Event {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    } as unknown as typeof Event;
    globalThis.CustomEvent = class CustomEvent extends globalThis.Event {
      detail: Record<string, unknown>;
      constructor(type: string, params?: { detail?: Record<string, unknown> }) {
        super(type);
        this.detail = params?.detail ?? {};
      }
    } as unknown as typeof CustomEvent;

    const startLoopSpy = vi.spyOn(Renderer.prototype, 'startTileAnimationLoop').mockImplementation(() => {});

    try {
      const renderer = new Renderer(canvas, gameState, tileManager, {});
      renderer.draw = vi.fn();

      renderer.tickTileAnimation();

      expect(tileManager.advanceAnimationFrame).toHaveBeenCalledTimes(1);
      expect(renderer.draw).toHaveBeenCalledTimes(1);
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
    } finally {
      startLoopSpy.mockRestore();
      globalThis.dispatchEvent = originalDispatchEvent;
      globalThis.CustomEvent = originalCustomEvent;
      globalThis.Event = originalEvent;
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
