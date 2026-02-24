/* eslint-disable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '../../config/GameConfig';
import { RendererTransitionManager } from '../../runtime/adapters/renderer/RendererTransitionManager';

function createCtxMock() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  } as any;
}

function createRendererFixture() {
  const gameState = {
    pauseGame: vi.fn(),
    resumeGame: vi.fn(),
    getCurrentRoom: vi.fn(() => ({ bg: 3 })),
    getPlayer: vi.fn(() => ({ roomIndex: 2 })),
    getGame: vi.fn(() => ({ rooms: [{ bg: 1 }, { bg: 2 }, { bg: 4 }] }))
  };
  const tileManager = {
    getTileMap: vi.fn(() => null),
    getTilePixels: vi.fn(() => null)
  };
  const paletteManager = {
    getColor: vi.fn((idx: number) => `#${idx}`)
  };
  const spriteFactory = {
    getPlayerSprite: vi.fn(() => [[1]] as any),
    turnSpriteHorizontally: vi.fn((sprite: any) => sprite)
  };
  const canvasHelper = {
    drawSprite: vi.fn()
  };
  const renderer = {
    canvas: { width: 128, height: 128 } as HTMLCanvasElement,
    ctx: null,
    gameState,
    tileManager,
    paletteManager,
    spriteFactory,
    canvasHelper,
    entityRenderer: {},
    draw: vi.fn()
  };
  return { renderer, gameState, tileManager, paletteManager, spriteFactory, canvasHelper };
}

describe('RendererTransitionManager', () => {
  let now = 1000;
  let rafQueue: FrameRequestCallback[];
  let rafId = 0;
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    now = 1000;
    rafQueue = [];
    rafId = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      rafId += 1;
      return rafId;
    }) as any);
    cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  it('exposes typed getters and starts inactive', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);

    expect(manager.isActive()).toBe(false);
    expect(manager.transitionGameState).toBe(renderer.gameState);
    expect(manager.transitionTileManager).toBe(renderer.tileManager);
    expect(manager.transitionPalette).toBe(renderer.paletteManager);
    expect(manager.transitionSpriteFactory).toBe(renderer.spriteFactory);
    expect(manager.transitionCanvasHelper).toBe(renderer.canvasHelper);
    expect(manager.transitionRenderer).toBe(renderer as any);
  });

  it('start returns false and calls onComplete when frames are missing', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const onComplete = vi.fn();

    expect(manager.start({ onComplete })).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(false);
  });

  it('start initializes transition, clamps duration, removes player, pauses game and schedules tick', () => {
    const { renderer, gameState } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const fromFrame = document.createElement('canvas');
    const toFrame = document.createElement('canvas');
    const removeSpy = vi.spyOn(manager, 'removePlayerFromFrame');
    manager.transition.rafId = 99;

    const result = manager.start({
      fromFrame,
      toFrame,
      direction: 'left',
      duration: 1,
      playerPath: { from: { x: 1, y: 2 }, to: { x: 3, y: 4 } },
      onComplete: vi.fn()
    });

    expect(result).toBe(true);
    expect(cancelSpy).toHaveBeenCalledWith(99);
    expect(removeSpy).toHaveBeenNthCalledWith(1, fromFrame, { x: 1, y: 2 });
    expect(removeSpy).toHaveBeenNthCalledWith(2, toFrame, { x: 3, y: 4 });
    expect(manager.transition.active).toBe(true);
    expect(manager.transition.direction).toBe('left');
    expect(manager.transition.duration).toBe(GameConfig.transitions.roomMinDuration);
    expect(gameState.pauseGame).toHaveBeenCalledWith('room-transition');
    expect(renderer.draw).toHaveBeenCalledTimes(1);
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('start uses defaults for direction, duration, playerPath and null onComplete', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const fromFrame = document.createElement('canvas');
    const toFrame = document.createElement('canvas');
    vi.spyOn(manager, 'removePlayerFromFrame').mockImplementation(() => {});

    manager.start({ fromFrame, toFrame });

    expect(manager.transition.direction).toBe('right');
    expect(manager.transition.duration).toBe(GameConfig.transitions.roomDuration);
    expect(manager.transition.playerPath).toBeNull();
    expect(manager.transition.onComplete).toBeNull();
  });

  it('scheduleTick stops immediately when inactive, finishes at progress 1, and reschedules otherwise', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);

    manager.scheduleTick();
    const firstTick = rafQueue.shift()!;
    firstTick(0);
    expect(renderer.draw).not.toHaveBeenCalled();

    manager.transition.active = true;
    const finishSpy = vi.spyOn(manager, 'finish').mockImplementation(() => {});
    const progressSpy = vi.spyOn(manager, 'getProgress').mockReturnValue(1);
    manager.scheduleTick();
    rafQueue.shift()!(0);
    expect(finishSpy).toHaveBeenCalledTimes(1);

    finishSpy.mockClear();
    progressSpy.mockReturnValue(0.5);
    manager.scheduleTick();
    rafQueue.shift()!(0);
    expect(renderer.draw).toHaveBeenCalledTimes(1);
    expect(rafSpy).toHaveBeenCalled();
  });

  it('getProgress returns 1 when inactive and clamps active progress', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    expect(manager.getProgress()).toBe(1);

    manager.transition = { active: true, startTime: 1000, duration: 200 } as any;
    now = 900;
    expect(manager.getProgress()).toBe(0);
    now = 1100;
    expect(manager.getProgress()).toBeCloseTo(0.5);
    now = 2000;
    expect(manager.getProgress()).toBe(1);
  });

  it('getProgress uses fallback values when startTime/duration are missing', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    manager.transition = { active: true } as any;

    expect(manager.getProgress()).toBe(0);
  });

  it('drawFrame renders transition for all directions and default, and finishes when complete', () => {
    const { renderer, paletteManager, gameState } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const ctx = createCtxMock();
    const gameplayCanvas = { width: 80, height: 40 };
    const fromFrame = document.createElement('canvas');
    const toFrame = document.createElement('canvas');
    const drawPlayerSpy = vi.spyOn(manager, 'drawTransitionPlayer').mockImplementation(() => {});
    const finishSpy = vi.spyOn(manager, 'finish').mockImplementation(() => {});

    const directions: Array<any> = ['left', 'right', 'up', 'down', 'weird'];
    directions.forEach((direction, idx) => {
      vi.spyOn(manager, 'getProgress').mockReturnValue(idx === directions.length - 1 ? 1 : 0.25);
      manager.transition = { active: true, direction, fromFrame, toFrame } as any;
      manager.drawFrame(ctx as any, gameplayCanvas);
    });

    expect(ctx.save).toHaveBeenCalledTimes(5);
    expect(ctx.restore).toHaveBeenCalledTimes(5);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 80, 40);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(drawPlayerSpy).toHaveBeenCalledTimes(5);
    expect(paletteManager.getColor).toHaveBeenCalledWith(gameState.getCurrentRoom().bg);
    expect(finishSpy).toHaveBeenCalledTimes(1);
  });

  it('drawFrame returns early when inactive', () => {
    const { renderer } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const ctx = createCtxMock();

    manager.drawFrame(ctx as any, { width: 10, height: 10 });

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('drawFrame handles active transition without from/to frames', () => {
    const { renderer, gameState, paletteManager } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const ctx = createCtxMock();
    vi.spyOn(manager, 'getProgress').mockReturnValue(0.5);
    vi.spyOn(manager, 'drawTransitionPlayer').mockImplementation(() => {});
    gameState.getCurrentRoom.mockReturnValue({} as any);
    manager.transition = { active: true, direction: 'right', fromFrame: undefined, toFrame: undefined } as any;

    manager.drawFrame(ctx as any, { width: 32, height: 32 });

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 32, 32);
    expect(paletteManager.getColor).toHaveBeenCalledWith(0);
  });

  it('removePlayerFromFrame handles missing coords/context and repaints tile stack with bg fallbacks', () => {
    const { renderer, paletteManager, gameState } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = 80;
    const ctx = createCtxMock();
    const drawTileStackSpy = vi.spyOn(manager, 'drawTileStackOnContext').mockImplementation(() => {});

    manager.removePlayerFromFrame(frameCanvas, null);
    expect(drawTileStackSpy).not.toHaveBeenCalled();

    vi.spyOn(frameCanvas, 'getContext').mockReturnValueOnce(null);
    manager.removePlayerFromFrame(frameCanvas, { x: 1, y: 1 });
    expect(drawTileStackSpy).not.toHaveBeenCalled();

    vi.spyOn(frameCanvas, 'getContext').mockReturnValue(ctx as any);
    gameState.getGame.mockReturnValueOnce({ rooms: 'bad' as any });
    manager.removePlayerFromFrame(frameCanvas, { x: 99, y: -5, roomIndex: Number.NaN });
    expect(paletteManager.getColor).toHaveBeenCalledWith(0);
    expect(ctx.fillRect).toHaveBeenCalledWith(7 * 10, 0, 10, 10);
    expect(drawTileStackSpy).toHaveBeenLastCalledWith(ctx, 2, 7, 0, 10);

    gameState.getGame.mockReturnValueOnce({ rooms: [{ bg: 'x' as any }] });
    manager.removePlayerFromFrame(frameCanvas, { x: 1.9, y: 2.2, roomIndex: 0 });
    expect(paletteManager.getColor).toHaveBeenCalledWith(0);
  });

  it('drawTransitionPlayer handles missing path, facing calculation and horizontal flip', () => {
    const { renderer, spriteFactory, canvasHelper } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const ctx = createCtxMock();
    manager.transition = { active: true, playerPath: null } as any;

    manager.drawTransitionPlayer(ctx as any, { width: 80, height: 80 }, 0.5);
    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();

    manager.transition.playerPath = { from: { x: 4, y: 4 }, to: { x: 2, y: 6 } } as any;
    manager.drawTransitionPlayer(ctx as any, { width: 80, height: 80 }, 0.5);
    expect(spriteFactory.turnSpriteHorizontally).toHaveBeenCalledTimes(1);
    expect(canvasHelper.drawSprite).toHaveBeenCalledWith(ctx, [[1]], 30, 50, 1.25);

    manager.transition.playerPath = { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, facingLeft: false } as any;
    manager.drawTransitionPlayer(ctx as any, { width: 80, height: 80 }, 0);
    expect(spriteFactory.turnSpriteHorizontally).toHaveBeenCalledTimes(1);

    manager.transition.playerPath = { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, facingLeft: true } as any;
    manager.drawTransitionPlayer(ctx as any, { width: 80, height: 80 }, 0);
    expect(spriteFactory.turnSpriteHorizontally).toHaveBeenCalledTimes(2);
  });

  it('drawTileStackOnContext handles missing map and draws ground/overlay when present', () => {
    const { renderer, tileManager } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const ctx = createCtxMock();
    const drawTileSpy = vi.spyOn(manager, 'drawTilePixelsOnContext').mockImplementation(() => {});

    tileManager.getTileMap.mockReturnValueOnce(null);
    manager.drawTileStackOnContext(ctx as any, 0, 1, 2, 10);
    expect(drawTileSpy).not.toHaveBeenCalled();

    tileManager.getTileMap.mockReturnValueOnce({
      ground: [[null, 'g1']],
      overlay: [[undefined, 'o1']]
    } as any);
    manager.drawTileStackOnContext(ctx as any, 0, 1, 0, 10);
    expect(drawTileSpy).toHaveBeenNthCalledWith(1, ctx, 'g1', 10, 0, 10);
    expect(drawTileSpy).toHaveBeenNthCalledWith(2, ctx, 'o1', 10, 0, 10);
  });

  it('drawTilePixelsOnContext skips missing/transparent pixels and draws colored pixels', () => {
    const { renderer, tileManager } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const ctx = createCtxMock();

    tileManager.getTilePixels.mockReturnValueOnce(null);
    manager.drawTilePixelsOnContext(ctx as any, 'tile-a', 0, 0, 16);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    const pixels = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)) as any[][];
    pixels[0][0] = 'transparent';
    pixels[0][1] = '#ABC';
    pixels[1][0] = '#DEF';
    tileManager.getTilePixels.mockReturnValueOnce(pixels as any);

    manager.drawTilePixelsOnContext(ctx as any, 'tile-b', 4, 8, 16);

    expect(ctx.fillRect).toHaveBeenCalledWith(6, 8, 2, 2);
    expect(ctx.fillRect).toHaveBeenCalledWith(4, 10, 2, 2);
  });

  it('finish cancels raf when present, resumes game and calls callback, and is safe when inactive', () => {
    const { renderer, gameState } = createRendererFixture();
    const manager = new RendererTransitionManager(renderer as any);
    const onComplete = vi.fn();

    manager.finish();
    expect(gameState.resumeGame).not.toHaveBeenCalled();

    manager.transition = { active: true, rafId: 7, onComplete } as any;
    manager.finish();
    expect(cancelSpy).toHaveBeenCalledWith(7);
    expect(gameState.resumeGame).toHaveBeenCalledWith('room-transition');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(false);

    manager.transition = { active: true, rafId: null, onComplete: null } as any;
    manager.finish();
    expect(gameState.resumeGame).toHaveBeenCalledTimes(2);
  });
});


