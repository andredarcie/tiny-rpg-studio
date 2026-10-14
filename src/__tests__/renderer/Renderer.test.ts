import { describe, expect, it, vi } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
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
    advanceLiquidEffectPhase() {
      return 0;
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
    attackTelegraph = null;
    setViewportOffset() {}
    drawObjects() {}
    drawItems() {}
    drawNPCs() {}
    drawEnemies() {}
    drawPlayer() {}
    drawRemotePlayers() {}
    drawAllEnemyLivesMarkers() {}
    drawFlyingLifeSquares() {}
    drawTileIconOnPlayer() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererDialogRenderer', () => ({
  RendererDialogRenderer: class {
    drawDialog() {}
    setViewportOffset() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererLevelUpOverlay', () => ({
  RendererLevelUpOverlay: class {
    setChoiceHandler() {}
    setBottomReserve() {}
    draw() {}
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

vi.mock('../../runtime/adapters/renderer/RendererCombatAnimator', () => ({
  RendererCombatAnimator: class {},
}));

vi.mock('../../runtime/adapters/renderer/RendererCameraShake', () => ({
  RendererCameraShake: class {
    getCurrentOffset() {
      return { x: 0, y: 0 };
    }
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererFloatingText', () => ({
  RendererFloatingText: class {
    draw() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererParticleSystem', () => ({
  RendererParticleSystem: class {
    draw() {}
  },
}));

vi.mock('../../runtime/adapters/renderer/RendererAttackTelegraph', () => ({
  RendererAttackTelegraph: class {},
}));

vi.mock('../../runtime/adapters/renderer/RendererSwordSwing', () => ({
  RendererSwordSwing: class {
    draw() {}
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

  it('keeps the HUD inventory visible after leveling up with a sword equipped', () => {
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
      height: 132,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const startLoopSpy = vi.spyOn(Renderer.prototype, 'startTileAnimationLoop').mockImplementation(() => {});

    try {
      const gameState = new GameState();
      gameState.setSwordType('sword');
      gameState.setSwordDurability(5);
      gameState.addExperience(gameState.getExperienceToNext());
      gameState.hideLevelUpCelebration();

      expect(gameState.getSwordType()).toBe('sword');
      expect(gameState.isLevelUpOverlayActive()).toBe(true);

      const renderer = new Renderer(canvas, gameState, {
        getAnimationFrameCount: vi.fn(() => 1),
        advanceAnimationFrame: vi.fn(() => 0),
      }, {});
      renderer.hudRenderer.drawInventory = vi.fn();

      renderer.draw();

      expect(renderer.hudRenderer.drawInventory).toHaveBeenCalled();
    } finally {
      startLoopSpy.mockRestore();
    }
  });
});

import { DEFAULT_HUD_PRESENTATION } from '../../runtime/adapters/renderer/HudPresentation';
it.each([64,128,256])('keeps overlay scale and HUD offsets at width %i, collapses hidden bars, and honors hideHud', (width) => {
  const ctx = { imageSmoothingEnabled:true } as unknown as CanvasRenderingContext2D;
  const canvas = { width,height:width,getContext:() => ctx } as unknown as HTMLCanvasElement;
  const game = {hideHud:false};
  const spy = vi.spyOn(Renderer.prototype,'startTileAnimationLoop').mockImplementation(() => {});
  const drawSpy = vi.spyOn(Renderer.prototype,'draw').mockImplementation(() => {});
  try {
    const renderer = new Renderer(canvas,{isGameOver:() => false,getGame:() => game}, {getAnimationFrameCount:() => 1,advanceAnimationFrame:() => 0},{});
    const colors = Array.from({length:16}, () => '#aaa');
    expect(renderer.getHudResources({customPalette:colors}).hearts.full[3][6]).toBe(7);
    expect(renderer.getHudResources({customPalette:colors}).palette).toEqual(colors);
    const defaultHeight = canvas.height;
    const presentation = structuredClone(DEFAULT_HUD_PRESENTATION);
    const remove = renderer.registerHudPresentation('hud-plus',() => presentation);
    const layout = () => (renderer as unknown as {applyCanvasLayout():void}).applyCanvasLayout();
    layout(); expect(canvas.height).toBe(defaultHeight);
    presentation.mode = 'overlay'; layout();
    expect(canvas.height).toBe(width);
    expect(renderer.gameplayOffsetY).toBe(0);
    expect(renderer.inventoryOffsetY + renderer.inventoryBarHeight).toBe(width);
    expect(renderer.totalHudHeight).toBe(0);
    presentation.mode = 'bars'; presentation.visible = {health:false,level:false,xp:false,minimap:false,items:true,gear:true}; layout();
    expect(renderer.hudBarHeight).toBe(0);
    expect(canvas.height).toBe(width + renderer.inventoryBarHeight);
    presentation.visible.items = false; presentation.visible.gear = false; layout(); expect(canvas.height).toBe(width);
    remove(); layout(); expect(canvas.height).toBe(defaultHeight);
    game.hideHud = true; layout(); expect(canvas.height).toBe(width); expect(renderer.gameplayOffsetY).toBe(0);
  } finally { spy.mockRestore(); drawSpy.mockRestore(); }
});

it('excludes overlay HUD from transition snapshots and restores it after capture', () => {
  const ctx = {imageSmoothingEnabled:false,clearRect:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),fillRect:vi.fn(),strokeRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D;
  const canvas = {width:128,height:128,getContext:() => ctx} as unknown as HTMLCanvasElement;
  const loop = vi.spyOn(Renderer.prototype,'startTileAnimationLoop').mockImplementation(() => {});
  const bufferContext = vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx);
  try {
    const renderer = new Renderer(canvas,new GameState(),{getAnimationFrameCount:() => 1,advanceAnimationFrame:() => 0},{});
    renderer.registerHudPresentation('hud-plus',() => ({...DEFAULT_HUD_PRESENTATION,mode:'overlay'}));
    const top = vi.spyOn(renderer.hudRenderer,'drawHUD').mockImplementation(() => {});
    const bottom = vi.spyOn(renderer.hudRenderer,'drawInventory').mockImplementation(() => {});
    const drawImage = vi.mocked(ctx.drawImage).mockImplementation(() => {expect(top).not.toHaveBeenCalled();expect(bottom).not.toHaveBeenCalled();});
    const draw = vi.spyOn(renderer,'draw');
    const buffer = renderer.captureGameplayFrame();
    expect(buffer).not.toBeNull(); expect(drawImage).toHaveBeenCalled();
    expect(draw.mock.calls).toEqual([[false],[]]);
    expect(top).toHaveBeenCalledTimes(1);expect(bottom).toHaveBeenCalledTimes(1);
  } finally {loop.mockRestore(); bufferContext.mockRestore();}
});
