/* eslint-disable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { RendererEntityRenderer } from '../../runtime/adapters/renderer/RendererEntityRenderer';

function sprite(id = 1) {
  return [[id]] as any;
}

function createCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  } as any;
}

function makeFixture() {
  const game = {
    objects: [] as any[],
    items: [] as any[],
    sprites: [] as any[]
  };
  const player = { roomIndex: 1, x: 2, y: 3, lastX: 1 };
  const enemies: any[] = [];

  const gameState = {
    getGame: vi.fn(() => game),
    getPlayer: vi.fn(() => player),
    getEnemies: vi.fn(() => enemies),
    isVariableOn: vi.fn(() => false),
    hasSkill: vi.fn(() => false)
  };
  const spriteFactory = {
    getObjectSprites: vi.fn(() => ({})),
    getNpcSprites: vi.fn(() => ({ default: sprite(9) })),
    getEnemySprite: vi.fn(() => sprite(7)),
    getPlayerSprite: vi.fn(() => sprite(5)),
    turnSpriteHorizontally: vi.fn((s: any) => s)
  };
  const canvasHelper = {
    getTilePixelSize: vi.fn(() => 16),
    drawSprite: vi.fn()
  };
  const paletteManager = {
    getColor: vi.fn((i: number) => `#${i}`)
  };
  const tileManager = {};

  const renderer = new RendererEntityRenderer(
    gameState as any,
    tileManager as any,
    spriteFactory as any,
    canvasHelper as any,
    paletteManager as any
  );

  return { renderer, game, player, enemies, gameState, spriteFactory, canvasHelper, paletteManager };
}

describe('RendererEntityRenderer', () => {
  let now = 1000;

  beforeEach(() => {
    vi.restoreAllMocks();
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  it('sets viewport offset clamped to non-negative finite values', () => {
    const { renderer } = makeFixture();
    renderer.setViewportOffset(12);
    expect(renderer.viewportOffsetY).toBe(12);
    renderer.setViewportOffset(-3);
    expect(renderer.viewportOffsetY).toBe(0);
    renderer.setViewportOffset(Number.NaN);
    expect(renderer.viewportOffsetY).toBe(0);
  });

  it('flashEntity stores flash state and getFlashColor expires it', () => {
    const { renderer } = makeFixture();
    const anyRenderer = renderer as any;

    renderer.flashEntity('enemy-1', '#F00', 100);
    expect(anyRenderer.getFlashColor('enemy-1')).toBe('#F00');

    now = 1200;
    expect(anyRenderer.getFlashColor('enemy-1')).toBeNull();
    expect(anyRenderer.flashStates.has('enemy-1')).toBe(false);
    expect(anyRenderer.getFlashColor('missing')).toBeNull();
  });

  it('flashEntity uses default duration when not provided', () => {
    const { renderer } = makeFixture();
    const anyRenderer = renderer as any;

    renderer.flashEntity('enemy-default', '#0FF');

    expect(anyRenderer.flashStates.get('enemy-default')?.duration).toEqual(expect.any(Number));
  });

  it('applies flash overlay with expected canvas operations', () => {
    const { renderer } = makeFixture();
    const ctx = createCtx();

    (renderer as any).applyFlashOverlay(ctx, '#ABC', 1, 2, 3);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(1, 2, 3, 3);
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.globalCompositeOperation).toBe('lighten');
    expect(ctx.fillStyle).toBe('#ABC');
  });

  it('drawObjects skips hidden cases and draws switch-on and floating collectibles', () => {
    const { renderer, game, player, gameState, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 2;
    const objectSprites = {
      [ITEM_TYPES.KEY]: sprite(1),
      [ITEM_TYPES.SWITCH]: sprite(2),
      [`${ITEM_TYPES.SWITCH}--on`]: sprite(3),
      visible: sprite(4),
      collectible: sprite(5)
    };
    spriteFactory.getObjectSprites.mockReturnValue(objectSprites);
    vi.spyOn(renderer, 'getFloatingOffset').mockReturnValue(2);
    gameState.isVariableOn.mockReturnValue(true);
    game.objects = [
      { roomIndex: 1, x: 0, y: 0, type: 'visible' }, // wrong room
      { roomIndex: 2, x: 1, y: 1, type: 'visible', hiddenInRuntime: true },
      { roomIndex: 2, x: 1, y: 1, type: 'visible', hideWhenCollected: true, collected: true },
      { roomIndex: 2, x: 1, y: 1, type: 'visible', hideWhenOpened: true, opened: true },
      { roomIndex: 2, x: 1, y: 1, type: 'visible', hideWhenVariableOpen: true, variableId: 'v1' },
      { roomIndex: 2, x: 2, y: 3, type: ITEM_TYPES.SWITCH, on: true },
      { roomIndex: 2, x: 3, y: 4, type: 'collectible', isCollectible: true, collected: false },
      { roomIndex: 2, x: 4, y: 5, type: 'missing' }
    ];

    renderer.drawObjects(ctx as any);

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
    expect(canvasHelper.drawSprite).toHaveBeenNthCalledWith(1, ctx, objectSprites[`${ITEM_TYPES.SWITCH}--on`], 32, 48, 2);
    expect(canvasHelper.drawSprite).toHaveBeenNthCalledWith(2, ctx, objectSprites.collectible, 48, 66, 2);
  });

  it('drawObjects handles hideWhenVariableOpen false path when variableId missing', () => {
    const { renderer, game, player, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 1;
    spriteFactory.getObjectSprites.mockReturnValue({ visible: sprite(1) });
    game.objects = [{ roomIndex: 1, x: 0, y: 0, type: 'visible', hideWhenVariableOpen: true }];

    renderer.drawObjects(ctx as any);

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
  });

  it('drawObjects handles non-array object list and switch-on fallback sprite', () => {
    const { renderer, game, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();

    game.objects = 'bad' as any;
    renderer.drawObjects(ctx as any);
    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();

    game.objects = [{ roomIndex: 1, x: 0, y: 0, type: ITEM_TYPES.SWITCH, on: true }];
    spriteFactory.getObjectSprites.mockReturnValue({ [ITEM_TYPES.SWITCH]: sprite(2) });
    renderer.drawObjects(ctx as any);
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
  });

  it('drawItems draws only items in current room that are not collected', () => {
    const { renderer, game, player, canvasHelper, paletteManager } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 3;
    game.items = [
      { roomIndex: 3, x: 1, y: 2, collected: false },
      { roomIndex: 3, x: 2, y: 3, collected: true },
      { roomIndex: 4, x: 3, y: 4, collected: false }
    ];

    renderer.drawItems(ctx as any);

    expect(paletteManager.getColor).toHaveBeenCalledWith(2);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(canvasHelper.getTilePixelSize).toHaveBeenCalled();
  });

  it('drawNPCs skips invalid entries and uses default sprite plus horizontal adjustment', () => {
    const { renderer, game, player, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 1;
    player.x = 1;
    spriteFactory.getNpcSprites.mockReturnValue({
      default: sprite(9),
      villager: sprite(2)
    } as any);
    const adjustSpy = vi.spyOn(renderer, 'adjustSpriteHorizontally').mockReturnValue(sprite(2));
    game.sprites = [
      { placed: false, roomIndex: 1, x: 0, y: 0, type: 'villager' },
      { placed: true, roomIndex: 2, x: 0, y: 0, type: 'villager' },
      { placed: true, roomIndex: 1, x: 2, y: 3, type: 'villager' },
      { placed: true, roomIndex: 1, x: 3, y: 4, type: 'missing' }
    ];

    renderer.drawNPCs(ctx as any);

    expect(adjustSpy).toHaveBeenCalledTimes(2);
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
  });

  it('drawNPCs skips npc when neither typed nor default sprite exists', () => {
    const { renderer, game, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    spriteFactory.getNpcSprites.mockReturnValue({} as any);
    game.sprites = [{ placed: true, roomIndex: 1, x: 1, y: 1, type: 'none' }];

    renderer.drawNPCs(ctx as any);

    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();
  });

  it('drawEnemies handles no enemy list and empty list', () => {
    const { renderer, gameState } = makeFixture();
    const ctx = createCtx();
    gameState.getEnemies.mockReturnValueOnce(undefined as any).mockReturnValueOnce([]);
    expect(() => renderer.drawEnemies(ctx as any)).not.toThrow();
    expect(() => renderer.drawEnemies(ctx as any)).not.toThrow();
  });

  it('drawEnemies covers room mismatch, missing sprite, normal draw, flash, alert and attack telegraph', () => {
    const { renderer, enemies, player, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 1;
    enemies.push(
      { id: 'skip-room', roomIndex: 2, x: 0, y: 0, type: 'rat' },
      { id: 'skip-sprite', roomIndex: 1, x: 1, y: 1, type: 'ghost' },
      { id: 'e1', roomIndex: 1, x: 2, y: 3, lastX: 3, type: 'rat', alertStart: 900, alertUntil: 2000 }
    );
    (spriteFactory.getEnemySprite as any).mockImplementation((type: string) => (type === 'ghost' ? null : sprite(3)));
    vi.spyOn(renderer, 'adjustSpriteHorizontally').mockReturnValue(sprite(3));
    const alertSpy = vi.spyOn(renderer, 'drawEnemyAlert').mockImplementation(() => {});
    const overlaySpy = vi.spyOn(renderer as any, 'applyFlashOverlay').mockImplementation(() => {});
    renderer.attackTelegraph = {
      applyWindupOffset: vi.fn((_id, x, y) => ({ x: x + 1, y: y + 2 }))
    };
    renderer.flashEntity('e1', '#F00', 1000);

    renderer.drawEnemies(ctx as any);

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
    expect(overlaySpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(renderer.attackTelegraph.applyWindupOffset).toHaveBeenCalledWith('e1', 32, 48);
  });

  it('drawEnemies covers dying animation phases and fallback enemy id', () => {
    const { renderer, enemies, player, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 1;
    enemies.push(
      { roomIndex: 1, x: 1, y: 1, type: 'rat', deathStartTime: 900 }, // elapsed 100 -> phase 1
      { roomIndex: 1, x: 2, y: 2, type: 'rat', deathStartTime: 400 } // elapsed 600 -> phase 2
    );
    renderer.attackTelegraph = {
      applyWindupOffset: vi.fn((_id, x, y) => ({ x, y }))
    };

    renderer.drawEnemies(ctx as any);

    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
    expect(ctx.translate).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
  });

  it('drawEnemies normal render path skips flash overlay when no flash is active', () => {
    const { renderer, enemies, canvasHelper } = makeFixture();
    const ctx = createCtx();
    const overlaySpy = vi.spyOn(renderer as any, 'applyFlashOverlay').mockImplementation(() => {});
    const alertSpy = vi.spyOn(renderer, 'drawEnemyAlert').mockImplementation(() => {});
    enemies.push({ id: 'e2', roomIndex: 1, x: 1, y: 1, type: 'rat' });

    renderer.drawEnemies(ctx as any);

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
    expect(overlaySpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('drawAllEnemyLivesMarkers handles skip paths and draws with telegraph/default lives', () => {
    const { renderer, enemies, player } = makeFixture();
    const ctx = createCtx();
    const markerSpy = vi.spyOn(renderer, 'drawEnemyLivesMarkers').mockImplementation(() => {});
    const telegraph = { applyWindupOffset: vi.fn((_id: string, x: number, y: number) => ({ x: x + 2, y: y + 1 })) };
    renderer.attackTelegraph = telegraph;

    // no enemies
    renderer.drawAllEnemyLivesMarkers(ctx as any);

    player.roomIndex = 1;
    enemies.push(
      { roomIndex: 2, x: 1, y: 1, type: 'a' },
      { roomIndex: 1, x: 1, y: 1, type: 'b', deathStartTime: 1 },
      { id: 'ok', roomIndex: 1, x: 2, y: 3, type: 'c', lives: 4 },
      { roomIndex: 1, x: 3, y: 4, type: 'd' }
    );

    renderer.drawAllEnemyLivesMarkers(ctx as any);

    expect(markerSpy).toHaveBeenCalledTimes(2);
    expect(markerSpy).toHaveBeenNthCalledWith(1, ctx, 34, 49, 16, 4);
    expect(markerSpy).toHaveBeenNthCalledWith(2, ctx, 50, 65, 16, 1);
    expect(telegraph.applyWindupOffset).toHaveBeenCalled();
  });

  it('drawPlayer handles no sprite, stealth fade, flash overlay and no-fade path', () => {
    const { renderer, spriteFactory, canvasHelper, gameState } = makeFixture();
    const ctx = createCtx();
    const overlaySpy = vi.spyOn(renderer as any, 'applyFlashOverlay').mockImplementation(() => {});

    spriteFactory.getPlayerSprite.mockReturnValueOnce(null);
    renderer.drawPlayer(ctx as any);
    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();

    spriteFactory.getPlayerSprite.mockReturnValue(sprite(5));
    vi.spyOn(renderer, 'shouldFadePlayerForStealth').mockReturnValueOnce(true).mockReturnValueOnce(false);
    renderer.flashEntity('player', '#0F0', 1000);
    renderer.drawPlayer(ctx as any);
    renderer.drawPlayer(ctx as any);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
    expect(overlaySpy).toHaveBeenCalledTimes(2);
    expect(gameState.getPlayer).toHaveBeenCalled();
  });

  it('drawPlayer uses player.x fallback when lastX is undefined and skips flash overlay when absent', () => {
    const { renderer, player, canvasHelper } = makeFixture();
    const ctx = createCtx();
    (player as any).lastX = undefined;
    const adjustSpy = vi.spyOn(renderer, 'adjustSpriteHorizontally');
    const overlaySpy = vi.spyOn(renderer as any, 'applyFlashOverlay').mockImplementation(() => {});

    renderer.drawPlayer(ctx as any);

    expect(adjustSpy).toHaveBeenCalledWith(player.x, player.x, expect.anything());
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
    expect(overlaySpy).not.toHaveBeenCalled();
  });

  it('drawTileIconOnPlayer returns early without sprite and draws icon when available', () => {
    const { renderer, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    spriteFactory.getObjectSprites.mockReturnValueOnce({}).mockReturnValueOnce({ icon: sprite(3) });

    renderer.drawTileIconOnPlayer(ctx as any, 'icon');
    renderer.drawTileIconOnPlayer(ctx as any, 'icon');

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
  });

  it('utility methods adjustSpriteHorizontally, getFloatingOffset and getNow behave correctly', () => {
    const { renderer, spriteFactory } = makeFixture();
    const s = sprite(1);
    expect(renderer.adjustSpriteHorizontally(1, 2, s)).toBe(s);
    expect(spriteFactory.turnSpriteHorizontally).toHaveBeenCalledWith(s);
    expect(renderer.adjustSpriteHorizontally(3, 2, s)).toBe(s);
    expect(renderer.getFloatingOffset(1, 2, 16)).toEqual(expect.any(Number));

    const perfSpy = vi.spyOn(globalThis as any, 'performance', 'get').mockReturnValue(undefined);
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
    expect(renderer.getNow()).toBe(12345);
    dateSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it('getEnemyDamage checks direct, normalized and fallback paths', () => {
    const { renderer } = makeFixture();
    const getSpy = vi.spyOn(EnemyDefinitions, 'getEnemyDefinition');
    const normSpy = vi.spyOn(EnemyDefinitions, 'normalizeType');

    getSpy.mockReturnValueOnce({ damage: 0 } as any);
    expect(renderer.getEnemyDamage('a')).toBe(1);

    getSpy.mockReturnValueOnce(null).mockReturnValueOnce({ damage: 5 } as any);
    normSpy.mockReturnValueOnce('norm');
    expect(renderer.getEnemyDamage('b')).toBe(5);

    getSpy.mockReturnValueOnce(null).mockReturnValueOnce({ damage: NaN } as any);
    normSpy.mockReturnValueOnce('norm2');
    expect(renderer.getEnemyDamage('c')).toBe(1);
  });

  it('shouldFadePlayerForStealth handles no skill and matching low-damage enemy', () => {
    const { renderer, gameState, enemies, player } = makeFixture();
    player.roomIndex = 1;
    gameState.hasSkill.mockReturnValueOnce(false).mockReturnValueOnce(true);
    enemies.push({ roomIndex: 2, type: 'dragon' }, { roomIndex: 1, type: 'rat' });
    vi.spyOn(renderer, 'getEnemyDamage').mockReturnValue(2);

    expect(renderer.shouldFadePlayerForStealth()).toBe(false);
    expect(renderer.shouldFadePlayerForStealth()).toBe(true);
  });

  it('shouldFadePlayerForStealth uses empty enemy list when getEnemies returns undefined', () => {
    const { renderer, gameState } = makeFixture();
    gameState.hasSkill.mockReturnValue(true);
    gameState.getEnemies.mockReturnValue(undefined as any);

    expect(renderer.shouldFadePlayerForStealth()).toBe(false);
  });

  it('drawEnemyLivesMarkers handles dead enemies and draws markers with fallback fill', () => {
    const { renderer, paletteManager } = makeFixture();
    const ctx = createCtx();
    paletteManager.getColor.mockReturnValue('');

    renderer.drawEnemyLivesMarkers(ctx as any, 0, 0, 16, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    renderer.drawEnemyLivesMarkers(ctx as any, 10, 20, 16, 2.8);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
  });

  it('spawnFlyingLifeSquare and drawFlyingLifeSquares animate, fade and remove completed squares', () => {
    const { renderer, paletteManager } = makeFixture();
    const ctx = createCtx();
    paletteManager.getColor.mockReturnValue('');

    renderer.spawnFlyingLifeSquare(10, 20, 16, 1);
    const anyRenderer = renderer as any;
    expect(anyRenderer.flyingLifeSquares).toHaveLength(1);

    now = 1100;
    renderer.drawFlyingLifeSquares(ctx as any);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(anyRenderer.flyingLifeSquares[0].opacity).toBeLessThan(1);

    now = 2000;
    renderer.drawFlyingLifeSquares(ctx as any);
    expect(anyRenderer.flyingLifeSquares).toHaveLength(0);
  });

  it('drawEnemyAlert handles invalid timings, expiry and draws alert with fallback color', () => {
    const { renderer, paletteManager } = makeFixture();
    const ctx = createCtx();
    paletteManager.getColor.mockReturnValue('');

    renderer.drawEnemyAlert(ctx as any, { alertStart: null, alertUntil: 2 } as any, 0, 0, 16);
    renderer.drawEnemyAlert(ctx as any, { alertStart: 0, alertUntil: null } as any, 0, 0, 16);
    renderer.drawEnemyAlert(ctx as any, { alertStart: 0, alertUntil: 1 } as any, 0, 0, 16);

    now = 3000;
    renderer.drawEnemyAlert(ctx as any, { alertStart: 2000, alertUntil: 2500 } as any, 0, 0, 16);
    expect(ctx.fillText).not.toHaveBeenCalled();

    now = 2200;
    renderer.drawEnemyAlert(ctx as any, { alertStart: 2000, alertUntil: 2600 } as any, 10, 20, 16);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('!', 18, 12);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('cleanupEnemyLabels is a no-op', () => {
    const { renderer } = makeFixture();
    expect(() => renderer.cleanupEnemyLabels()).not.toThrow();
  });
});


