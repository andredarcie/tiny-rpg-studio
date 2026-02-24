import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { RendererEntityRenderer } from '../../runtime/adapters/renderer/RendererEntityRenderer';

type SpriteMatrix = (string | null)[][];
type RendererEntityCtor = ConstructorParameters<typeof RendererEntityRenderer>;
type EntityRendererGameState = RendererEntityCtor[0];
type EntityRendererTileManager = RendererEntityCtor[1];
type EntityRendererSpriteFactory = RendererEntityCtor[2];
type EntityRendererCanvasHelper = RendererEntityCtor[3];
type EntityRendererPalette = RendererEntityCtor[4];
type EnemyAlertState = Parameters<RendererEntityRenderer['drawEnemyAlert']>[1];
type EnemyDefinitionResult = NonNullable<ReturnType<typeof EnemyDefinitions.getEnemyDefinition>>;

type EnemyLike = {
  id?: string;
  roomIndex: number;
  x: number;
  y: number;
  lastX?: number;
  type: string;
  lives?: number;
  alertUntil?: number | null;
  alertStart?: number | null;
  deathStartTime?: number | null;
};

type CtxMock = Pick<
  CanvasRenderingContext2D,
  'save' | 'restore' | 'fillRect' | 'strokeRect' | 'translate' | 'rotate' | 'fillText'
> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

type EntityRendererPrivateAccess = {
  getFlashColor(entityId: string): string | null;
  applyFlashOverlay(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number): void;
  flashStates: Map<string, { color: string; startTime: number; duration: number }>;
  flyingLifeSquares: Array<{ opacity: number }>;
};

function sprite(id = 1): SpriteMatrix {
  return [[String(id)]];
}

function asCanvasCtx(ctx: CtxMock): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
}

function asEntityRendererAccess(renderer: RendererEntityRenderer): EntityRendererPrivateAccess {
  return renderer as unknown as EntityRendererPrivateAccess;
}

function alertEnemy(overrides: Partial<EnemyAlertState>): EnemyAlertState {
  return {
    roomIndex: 0,
    x: 0,
    y: 0,
    type: 'rat',
    ...overrides
  };
}

function createCtx(): CtxMock {
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
  };
}

function makeFixture() {
  const game = {
    objects: [] as Array<Record<string, unknown>>,
    items: [] as Array<Record<string, unknown>>,
    sprites: [] as Array<Record<string, unknown>>
  };
  const player: { roomIndex: number; x: number; y: number; lastX?: number } = { roomIndex: 1, x: 2, y: 3, lastX: 1 };
  const enemies: EnemyLike[] = [];

  const gameState: EntityRendererGameState = {
    getGame: vi.fn(() => game) as unknown as EntityRendererGameState['getGame'],
    getPlayer: vi.fn(() => player) as EntityRendererGameState['getPlayer'],
    getEnemies: vi.fn(() => enemies) as NonNullable<EntityRendererGameState['getEnemies']>,
    isVariableOn: vi.fn(() => false) as NonNullable<EntityRendererGameState['isVariableOn']>,
    hasSkill: vi.fn(() => false) as NonNullable<EntityRendererGameState['hasSkill']>
  };
  const spriteFactory: EntityRendererSpriteFactory = {
    getObjectSprites: vi.fn(() => ({} as Record<string, SpriteMatrix | undefined>)) as EntityRendererSpriteFactory['getObjectSprites'],
    getNpcSprites: vi.fn(() => ({ default: sprite(9) })) as EntityRendererSpriteFactory['getNpcSprites'],
    getEnemySprite: vi.fn(() => sprite(7)) as EntityRendererSpriteFactory['getEnemySprite'],
    getPlayerSprite: vi.fn(() => sprite(5)) as EntityRendererSpriteFactory['getPlayerSprite'],
    turnSpriteHorizontally: vi.fn((s: SpriteMatrix) => s) as EntityRendererSpriteFactory['turnSpriteHorizontally']
  };
  const canvasHelper: EntityRendererCanvasHelper = {
    getTilePixelSize: vi.fn(() => 16) as EntityRendererCanvasHelper['getTilePixelSize'],
    drawSprite: vi.fn() as EntityRendererCanvasHelper['drawSprite']
  };
  const paletteManager: EntityRendererPalette = {
    getColor: vi.fn((i: number) => `#${i}`) as EntityRendererPalette['getColor']
  };
  const tileManager: EntityRendererTileManager = {};

  const renderer = new RendererEntityRenderer(
    gameState,
    tileManager,
    spriteFactory,
    canvasHelper,
    paletteManager
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
    const entityRenderer = asEntityRendererAccess(renderer);

    renderer.flashEntity('enemy-1', '#F00', 100);
    expect(entityRenderer.getFlashColor('enemy-1')).toBe('#F00');

    now = 1200;
    expect(entityRenderer.getFlashColor('enemy-1')).toBeNull();
    expect(entityRenderer.flashStates.has('enemy-1')).toBe(false);
    expect(entityRenderer.getFlashColor('missing')).toBeNull();
  });

  it('flashEntity uses default duration when not provided', () => {
    const { renderer } = makeFixture();
    const entityRenderer = asEntityRendererAccess(renderer);

    renderer.flashEntity('enemy-default', '#0FF');

    expect(entityRenderer.flashStates.get('enemy-default')?.duration).toEqual(expect.any(Number));
  });

  it('applies flash overlay with expected canvas operations', () => {
    const { renderer } = makeFixture();
    const ctx = createCtx();

    asEntityRendererAccess(renderer).applyFlashOverlay(asCanvasCtx(ctx), '#ABC', 1, 2, 3);

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
    vi.mocked(spriteFactory.getObjectSprites).mockReturnValue(objectSprites);
    vi.spyOn(renderer, 'getFloatingOffset').mockReturnValue(2);
    const isVariableOn = gameState.isVariableOn as NonNullable<EntityRendererGameState['isVariableOn']>;
    vi.mocked(isVariableOn).mockReturnValue(true);
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

    renderer.drawObjects(asCanvasCtx(ctx));

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
    const switchOnSprite = objectSprites[`${ITEM_TYPES.SWITCH}--on`];
    expect(canvasHelper.drawSprite).toHaveBeenNthCalledWith(1, ctx, switchOnSprite, 32, 48, 2);
    expect(canvasHelper.drawSprite).toHaveBeenNthCalledWith(2, ctx, objectSprites.collectible, 48, 66, 2);
  });

  it('drawObjects handles hideWhenVariableOpen false path when variableId missing', () => {
    const { renderer, game, player, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 1;
    vi.mocked(spriteFactory.getObjectSprites).mockReturnValue({ visible: sprite(1) });
    game.objects = [{ roomIndex: 1, x: 0, y: 0, type: 'visible', hideWhenVariableOpen: true }];

    renderer.drawObjects(asCanvasCtx(ctx));

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
  });

  it('drawObjects handles non-array object list and switch-on fallback sprite', () => {
    const { renderer, game, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();

    game.objects = 'bad' as unknown as Array<Record<string, unknown>>;
    renderer.drawObjects(asCanvasCtx(ctx));
    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();

    game.objects = [{ roomIndex: 1, x: 0, y: 0, type: ITEM_TYPES.SWITCH, on: true }];
    vi.mocked(spriteFactory.getObjectSprites).mockReturnValue({ [ITEM_TYPES.SWITCH]: sprite(2) });
    renderer.drawObjects(asCanvasCtx(ctx));
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

    renderer.drawItems(asCanvasCtx(ctx));

    expect(paletteManager.getColor).toHaveBeenCalledWith(2);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(canvasHelper.getTilePixelSize).toHaveBeenCalled();
  });

  it('drawNPCs skips invalid entries and uses default sprite plus horizontal adjustment', () => {
    const { renderer, game, player, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.roomIndex = 1;
    player.x = 1;
    vi.mocked(spriteFactory.getNpcSprites).mockReturnValue({
      default: sprite(9),
      villager: sprite(2)
    });
    const adjustSpy = vi.spyOn(renderer, 'adjustSpriteHorizontally').mockReturnValue(sprite(2));
    game.sprites = [
      { placed: false, roomIndex: 1, x: 0, y: 0, type: 'villager' },
      { placed: true, roomIndex: 2, x: 0, y: 0, type: 'villager' },
      { placed: true, roomIndex: 1, x: 2, y: 3, type: 'villager' },
      { placed: true, roomIndex: 1, x: 3, y: 4, type: 'missing' }
    ];

    renderer.drawNPCs(asCanvasCtx(ctx));

    expect(adjustSpy).toHaveBeenCalledTimes(2);
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
  });

  it('drawNPCs skips npc when neither typed nor default sprite exists', () => {
    const { renderer, game, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    vi.mocked(spriteFactory.getNpcSprites).mockReturnValue({});
    game.sprites = [{ placed: true, roomIndex: 1, x: 1, y: 1, type: 'none' }];

    renderer.drawNPCs(asCanvasCtx(ctx));

    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();
  });

  it('drawEnemies handles no enemy list and empty list', () => {
    const { renderer, gameState } = makeFixture();
    const ctx = createCtx();
    const getEnemies = gameState.getEnemies as NonNullable<EntityRendererGameState['getEnemies']>;
    vi.mocked(getEnemies)
      .mockImplementationOnce(() => undefined as unknown as EnemyLike[])
      .mockImplementationOnce(() => []);
    expect(() => renderer.drawEnemies(asCanvasCtx(ctx))).not.toThrow();
    expect(() => renderer.drawEnemies(asCanvasCtx(ctx))).not.toThrow();
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
    vi.mocked(spriteFactory.getEnemySprite).mockImplementation((type: string | null) => (type === 'ghost' ? null : sprite(3)));
    vi.spyOn(renderer, 'adjustSpriteHorizontally').mockReturnValue(sprite(3));
    const alertSpy = vi.spyOn(renderer, 'drawEnemyAlert').mockImplementation(() => {});
    const overlaySpy = vi.spyOn(asEntityRendererAccess(renderer), 'applyFlashOverlay').mockImplementation(() => {});
    renderer.attackTelegraph = {
      applyWindupOffset: vi.fn((_id: string, x: number, y: number) => ({ x: x + 1, y: y + 2 }))
    };
    renderer.flashEntity('e1', '#F00', 1000);

    renderer.drawEnemies(asCanvasCtx(ctx));

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
    expect(overlaySpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const attackTelegraph = renderer.attackTelegraph;
    expect(attackTelegraph.applyWindupOffset).toHaveBeenCalledWith('e1', 32, 48);
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
      applyWindupOffset: vi.fn((_id: string, x: number, y: number) => ({ x, y }))
    };

    renderer.drawEnemies(asCanvasCtx(ctx));

    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
    expect(ctx.translate).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
  });

  it('drawEnemies normal render path skips flash overlay when no flash is active', () => {
    const { renderer, enemies, canvasHelper } = makeFixture();
    const ctx = createCtx();
    const overlaySpy = vi.spyOn(asEntityRendererAccess(renderer), 'applyFlashOverlay').mockImplementation(() => {});
    const alertSpy = vi.spyOn(renderer, 'drawEnemyAlert').mockImplementation(() => {});
    enemies.push({ id: 'e2', roomIndex: 1, x: 1, y: 1, type: 'rat' });

    renderer.drawEnemies(asCanvasCtx(ctx));

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
    renderer.drawAllEnemyLivesMarkers(asCanvasCtx(ctx));

    player.roomIndex = 1;
    enemies.push(
      { roomIndex: 2, x: 1, y: 1, type: 'a' },
      { roomIndex: 1, x: 1, y: 1, type: 'b', deathStartTime: 1 },
      { id: 'ok', roomIndex: 1, x: 2, y: 3, type: 'c', lives: 4 },
      { roomIndex: 1, x: 3, y: 4, type: 'd' }
    );

    renderer.drawAllEnemyLivesMarkers(asCanvasCtx(ctx));

    expect(markerSpy).toHaveBeenCalledTimes(2);
    expect(markerSpy).toHaveBeenNthCalledWith(1, ctx, 34, 49, 16, 4);
    expect(markerSpy).toHaveBeenNthCalledWith(2, ctx, 50, 65, 16, 1);
    expect(telegraph.applyWindupOffset).toHaveBeenCalled();
  });

  it('drawPlayer handles no sprite, stealth fade, flash overlay and no-fade path', () => {
    const { renderer, spriteFactory, canvasHelper, gameState } = makeFixture();
    const ctx = createCtx();
    const overlaySpy = vi.spyOn(asEntityRendererAccess(renderer), 'applyFlashOverlay').mockImplementation(() => {});

    vi.mocked(spriteFactory.getPlayerSprite).mockReturnValueOnce(null);
    renderer.drawPlayer(asCanvasCtx(ctx));
    expect(canvasHelper.drawSprite).not.toHaveBeenCalled();

    vi.mocked(spriteFactory.getPlayerSprite).mockReturnValue(sprite(5));
    vi.spyOn(renderer, 'shouldFadePlayerForStealth').mockReturnValueOnce(true).mockReturnValueOnce(false);
    renderer.flashEntity('player', '#0F0', 1000);
    renderer.drawPlayer(asCanvasCtx(ctx));
    renderer.drawPlayer(asCanvasCtx(ctx));

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(2);
    expect(overlaySpy).toHaveBeenCalledTimes(2);
    expect(gameState.getPlayer).toHaveBeenCalled();
  });

  it('drawPlayer uses player.x fallback when lastX is undefined and skips flash overlay when absent', () => {
    const { renderer, player, canvasHelper } = makeFixture();
    const ctx = createCtx();
    player.lastX = undefined;
    const adjustSpy = vi.spyOn(renderer, 'adjustSpriteHorizontally');
    const overlaySpy = vi.spyOn(asEntityRendererAccess(renderer), 'applyFlashOverlay').mockImplementation(() => {});

    renderer.drawPlayer(asCanvasCtx(ctx));

    expect(adjustSpy).toHaveBeenCalledWith(player.x, player.x, expect.anything());
    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
    expect(overlaySpy).not.toHaveBeenCalled();
  });

  it('drawTileIconOnPlayer returns early without sprite and draws icon when available', () => {
    const { renderer, spriteFactory, canvasHelper } = makeFixture();
    const ctx = createCtx();
    vi.mocked(spriteFactory.getObjectSprites).mockReturnValueOnce({}).mockReturnValueOnce({ icon: sprite(3) });

    renderer.drawTileIconOnPlayer(asCanvasCtx(ctx), 'icon');
    renderer.drawTileIconOnPlayer(asCanvasCtx(ctx), 'icon');

    expect(canvasHelper.drawSprite).toHaveBeenCalledTimes(1);
  });

  it('utility methods adjustSpriteHorizontally, getFloatingOffset and getNow behave correctly', () => {
    const { renderer, spriteFactory } = makeFixture();
    const s = sprite(1);
    expect(renderer.adjustSpriteHorizontally(1, 2, s)).toBe(s);
    expect(spriteFactory.turnSpriteHorizontally).toHaveBeenCalledWith(s);
    expect(renderer.adjustSpriteHorizontally(3, 2, s)).toBe(s);
    expect(renderer.getFloatingOffset(1, 2, 16)).toEqual(expect.any(Number));

    const perfSpy = vi.spyOn(globalThis, 'performance', 'get').mockReturnValue(undefined as unknown as Performance);
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
    expect(renderer.getNow()).toBe(12345);
    dateSpy.mockRestore();
    perfSpy.mockRestore();
  });

  it('getEnemyDamage checks direct, normalized and fallback paths', () => {
    const { renderer } = makeFixture();
    const getSpy = vi.spyOn(EnemyDefinitions, 'getEnemyDefinition');
    const normSpy = vi.spyOn(EnemyDefinitions, 'normalizeType');

    getSpy.mockReturnValueOnce({ damage: 0 } as unknown as EnemyDefinitionResult);
    expect(renderer.getEnemyDamage('a')).toBe(1);

    getSpy.mockReturnValueOnce(null).mockReturnValueOnce({ damage: 5 } as unknown as EnemyDefinitionResult);
    normSpy.mockReturnValueOnce('norm');
    expect(renderer.getEnemyDamage('b')).toBe(5);

    getSpy.mockReturnValueOnce(null).mockReturnValueOnce({ damage: NaN } as unknown as EnemyDefinitionResult);
    normSpy.mockReturnValueOnce('norm2');
    expect(renderer.getEnemyDamage('c')).toBe(1);
  });

  it('shouldFadePlayerForStealth handles no skill and matching low-damage enemy', () => {
    const { renderer, gameState, enemies, player } = makeFixture();
    player.roomIndex = 1;
    const hasSkill = gameState.hasSkill as NonNullable<EntityRendererGameState['hasSkill']>;
    vi.mocked(hasSkill).mockReturnValueOnce(false).mockReturnValueOnce(true);
    enemies.push({ roomIndex: 2, x: 0, y: 0, type: 'dragon' }, { roomIndex: 1, x: 0, y: 0, type: 'rat' });
    vi.spyOn(renderer, 'getEnemyDamage').mockReturnValue(2);

    expect(renderer.shouldFadePlayerForStealth()).toBe(false);
    expect(renderer.shouldFadePlayerForStealth()).toBe(true);
  });

  it('shouldFadePlayerForStealth uses empty enemy list when getEnemies returns undefined', () => {
    const { renderer, gameState } = makeFixture();
    const hasSkill = gameState.hasSkill as NonNullable<EntityRendererGameState['hasSkill']>;
    const getEnemies = gameState.getEnemies as NonNullable<EntityRendererGameState['getEnemies']>;
    vi.mocked(hasSkill).mockReturnValue(true);
    vi.mocked(getEnemies).mockImplementation(() => undefined as unknown as EnemyLike[]);

    expect(renderer.shouldFadePlayerForStealth()).toBe(false);
  });

  it('drawEnemyLivesMarkers handles dead enemies and draws markers with fallback fill', () => {
    const { renderer, paletteManager } = makeFixture();
    const ctx = createCtx();
    vi.mocked(paletteManager.getColor).mockReturnValue('');

    renderer.drawEnemyLivesMarkers(asCanvasCtx(ctx), 0, 0, 16, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    renderer.drawEnemyLivesMarkers(asCanvasCtx(ctx), 10, 20, 16, 2.8);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
  });

  it('spawnFlyingLifeSquare and drawFlyingLifeSquares animate, fade and remove completed squares', () => {
    const { renderer, paletteManager } = makeFixture();
    const ctx = createCtx();
    vi.mocked(paletteManager.getColor).mockReturnValue('');

    renderer.spawnFlyingLifeSquare(10, 20, 16, 1);
    const entityRenderer = asEntityRendererAccess(renderer);
    expect(entityRenderer.flyingLifeSquares).toHaveLength(1);

    now = 1100;
    renderer.drawFlyingLifeSquares(asCanvasCtx(ctx));
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(entityRenderer.flyingLifeSquares[0]).toBeDefined();
    if (!entityRenderer.flyingLifeSquares[0]) throw new Error('flying square missing');
    expect(entityRenderer.flyingLifeSquares[0].opacity).toBeLessThan(1);

    now = 2000;
    renderer.drawFlyingLifeSquares(asCanvasCtx(ctx));
    expect(entityRenderer.flyingLifeSquares).toHaveLength(0);
  });

  it('drawEnemyAlert handles invalid timings, expiry and draws alert with fallback color', () => {
    const { renderer, paletteManager } = makeFixture();
    const ctx = createCtx();
    vi.mocked(paletteManager.getColor).mockReturnValue('');

    renderer.drawEnemyAlert(asCanvasCtx(ctx), alertEnemy({ alertStart: null, alertUntil: 2 }), 0, 0, 16);
    renderer.drawEnemyAlert(asCanvasCtx(ctx), alertEnemy({ alertStart: 0, alertUntil: null }), 0, 0, 16);
    renderer.drawEnemyAlert(asCanvasCtx(ctx), alertEnemy({ alertStart: 0, alertUntil: 1 }), 0, 0, 16);

    now = 3000;
    renderer.drawEnemyAlert(asCanvasCtx(ctx), alertEnemy({ alertStart: 2000, alertUntil: 2500 }), 0, 0, 16);
    expect(ctx.fillText).not.toHaveBeenCalled();

    now = 2200;
    renderer.drawEnemyAlert(asCanvasCtx(ctx), alertEnemy({ alertStart: 2000, alertUntil: 2600 }), 10, 20, 16);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('!', 18, 12);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('cleanupEnemyLabels is a no-op', () => {
    const { renderer } = makeFixture();
    expect(() => renderer.cleanupEnemyLabels()).not.toThrow();
  });
});


