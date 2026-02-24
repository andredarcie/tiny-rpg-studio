
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorCanvasRenderer } from '../../editor/modules/renderers/EditorCanvasRenderer';

type EditorCanvasService = ConstructorParameters<typeof EditorCanvasRenderer>[0];
type CanvasCtxMock = Pick<
  CanvasRenderingContext2D,
  'clearRect' | 'fillRect' | 'strokeRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'save' | 'restore'
> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
};
type TileMapMock = { ground?: (string | number | null)[][]; overlay?: (string | number | null)[][] };
type ObjectMock = { type: string; roomIndex: number; x: number; y: number; variableId?: string | null };
type NpcMock = {
  type: string;
  roomIndex: number;
  x: number;
  y: number;
  placed?: boolean;
  conditionVariableId?: string | null;
  rewardVariableId?: string | null;
  conditionalRewardVariableId?: string | null;
};
type EnemyMock = { type: string; roomIndex: number; x: number; y: number; defeatVariableId?: string | null };
type VariableMock = { id: string; color?: string | null };
type RendererMock = {
  drawObjectSprite: ReturnType<typeof vi.fn>;
  drawSprite: ReturnType<typeof vi.fn>;
  npcSprites: Record<string, (string | null)[][]>;
  enemySprites: Record<string, (string | null)[][]>;
  enemySprite: (string | null)[][];
};
type CanvasGameEngineFixture = {
  getTileMap: ReturnType<typeof vi.fn<() => TileMapMock>>;
  getObjectsForRoom: ReturnType<typeof vi.fn<() => ObjectMock[]>>;
  getSprites: ReturnType<typeof vi.fn<() => NpcMock[]>>;
  getActiveEnemies: ReturnType<typeof vi.fn<() => EnemyMock[]>>;
  getVariableDefinitions: ReturnType<typeof vi.fn<() => VariableMock[]>>;
  tileManager: {
    getTile: ReturnType<typeof vi.fn>;
    getTilePixels: ReturnType<typeof vi.fn<() => (string | null)[][]>>;
  };
  renderer: RendererMock;
};
type TestService = {
  manager: {
    ectx: CanvasCtxMock | null;
    selectedTileId: string | number | null;
    selectedNpcType: string | null;
    selectedNpcId: string | null;
    gameEngine: CanvasGameEngineFixture;
  };
  dom: { editorCanvas: HTMLCanvasElement | null };
  state: { activeRoomIndex: number };
  gameEngine: CanvasGameEngineFixture;
  t: ReturnType<typeof vi.fn>;
  tf: ReturnType<typeof vi.fn>;
  resolvePicoColor: ReturnType<typeof vi.fn>;
};

function asEditorCanvasService(service: TestService): EditorCanvasService {
  return service as unknown as EditorCanvasService;
}

function asCanvasCtx(ctx: CanvasCtxMock): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
}

function makeCtx(): CanvasCtxMock {
  return {
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    save: vi.fn(), restore: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    globalAlpha: 1,
  };
}

function makeCanvas(width = 160, height = 160) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeService(overrides: Record<string, unknown> = {}) {
  const ctx = makeCtx();
  const canvas = makeCanvas();
  const tileManager = {
    getTile: vi.fn((id: unknown) => id != null ? { id, pixels: [] } : null),
    getTilePixels: vi.fn((): string[][] => Array.from({ length: 8 }, () => Array<string>(8).fill('#FF0000'))),
  };

  const manager: TestService['manager'] = {
    ectx: ctx,
    selectedTileId: null,
    selectedNpcType: null,
    selectedNpcId: null,
    gameEngine: {
      getTileMap: vi.fn((): TileMapMock => ({ ground: [], overlay: [] })),
      getObjectsForRoom: vi.fn((): ObjectMock[] => []),
      getSprites: vi.fn((): NpcMock[] => []),
      getActiveEnemies: vi.fn((): EnemyMock[] => []),
      getVariableDefinitions: vi.fn((): VariableMock[] => []),
      tileManager,
      renderer: {
        drawObjectSprite: vi.fn(),
        drawSprite: vi.fn(),
        npcSprites: { default: [['#FF0000']] },
        enemySprites: {},
        enemySprite: [['#0000FF']],
      },
    },
    ...overrides,
  };

  const service: TestService = {
    manager,
    dom: { editorCanvas: canvas },
    state: { activeRoomIndex: 0 },
    gameEngine: manager.gameEngine,
    t: vi.fn<(_key: string, fallback?: string) => string>((_key: string, fallback = ''): string => fallback),
    tf: vi.fn<(_key: string, _params?: Record<string, unknown>, fallback?: string) => string>(
      (_key: string, _params: Record<string, unknown> = {}, fallback = ''): string => fallback
    ),
    resolvePicoColor: vi.fn((color: string): string => color),
  };

  return { service, ctx, canvas, manager };
}

describe('EditorCanvasRenderer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── renderEditor ────────────────────────────────────────────────────────

  it('returns early when ctx is null', () => {
    const { service } = makeService();
    service.manager.ectx = null;
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(() => renderer.renderEditor()).not.toThrow();
    expect(service.gameEngine.getTileMap).not.toHaveBeenCalled();
  });

  it('returns early when editorCanvas is null', () => {
    const { service } = makeService();
    service.dom.editorCanvas = null;
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(() => renderer.renderEditor()).not.toThrow();
    expect(service.gameEngine.getTileMap).not.toHaveBeenCalled();
  });

  it('calls clearRect at start', () => {
    const { service, ctx } = makeService();
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.renderEditor();
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 160, 160);
  });

  it('calls getTileMap with active room index', () => {
    const { service } = makeService();
    service.state.activeRoomIndex = 2;
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.renderEditor();
    expect(service.gameEngine.getTileMap).toHaveBeenCalledWith(2);
  });

  it('draws grid lines (stroke calls)', () => {
    const { service, ctx } = makeService();
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.renderEditor();
    // 9 vertical + 9 horizontal = 18 sets of beginPath/moveTo/lineTo/stroke
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('uses fillStyle #141414 for null ground tile', () => {
    const { service, ctx } = makeService();
    vi.mocked(service.gameEngine.getTileMap).mockReturnValue({
      ground: [[null, null]], overlay: []
    });
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.renderEditor();
    expect(ctx.fillStyle).toBe('#141414');
  });

  it('calls drawEntities', () => {
    const { service } = makeService();
    service.gameEngine.getObjectsForRoom.mockReturnValue([]);
    service.gameEngine.getSprites.mockReturnValue([]);
    service.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.renderEditor();
    expect(service.gameEngine.getObjectsForRoom).toHaveBeenCalled();
  });

  // ─── drawEntities ────────────────────────────────────────────────────────

  it('returns early from drawEntities when ctx is null', () => {
    const { service } = makeService();
    service.manager.ectx = null;
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(() => renderer.drawEntities(20)).not.toThrow();
  });

  it('draws object sprites for objects in current room', () => {
    const { service } = makeService();
    service.state.activeRoomIndex = 1;
    service.gameEngine.getObjectsForRoom.mockReturnValue([
      { type: 'key', roomIndex: 1, x: 2, y: 3, variableId: null },
    ]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawEntities(20);
    expect(service.gameEngine.renderer.drawObjectSprite).toHaveBeenCalledWith(
      service.manager.ectx, 'key', 40, 60, expect.any(Number)
    );
  });

  it('draws placed npcs in current room', () => {
    const { service } = makeService();
    service.state.activeRoomIndex = 0;
    service.gameEngine.getSprites.mockReturnValue([
      { type: 'default', roomIndex: 0, x: 1, y: 1, placed: true },
    ]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawEntities(20);
    expect(service.gameEngine.renderer.drawSprite).toHaveBeenCalled();
  });

  it('skips npcs in different rooms', () => {
    const { service } = makeService();
    service.state.activeRoomIndex = 0;
    service.gameEngine.getSprites.mockReturnValue([
      { type: 'default', roomIndex: 2, x: 1, y: 1, placed: true },
    ]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawEntities(20);
    expect(service.gameEngine.renderer.drawSprite).not.toHaveBeenCalled();
  });

  it('draws enemy sprites for enemies in current room', () => {
    const { service } = makeService();
    service.state.activeRoomIndex = 0;
    service.gameEngine.getActiveEnemies.mockReturnValue([
      { type: 'giant-rat', roomIndex: 0, x: 3, y: 4 },
    ]);
    service.gameEngine.renderer.enemySprites = { 'giant-rat': [['#FF0000']] };
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawEntities(20);
    expect(service.gameEngine.renderer.drawSprite).toHaveBeenCalled();
  });

  it('skips sprite draw when sprite is not an array', () => {
    const { service } = makeService();
    service.gameEngine.getSprites.mockReturnValue([
      { type: 'unknown-type', roomIndex: 0, x: 0, y: 0, placed: true },
    ]);
    // unknown-type not in npcSprites, falls back to default which is an array
    // Let's override default to not be an array
    service.gameEngine.renderer.npcSprites = {};
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(() => renderer.drawEntities(20)).not.toThrow();
  });

  // ─── drawVariableOutline ─────────────────────────────────────────────────

  it('skips drawVariableOutline when all variableIds have no color', () => {
    const { service, ctx } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawVariableOutline(asCanvasCtx(ctx), 0, 0, 20, ['var-1']);
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it('draws single outline for 1 variable with color', () => {
    const { service, ctx } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([
      { id: 'var-1', color: '#FF0000' },
    ]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawVariableOutline(asCanvasCtx(ctx), 0, 0, 20, ['var-1']);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
  });

  it('draws two outlines for 2 variables with colors', () => {
    const { service, ctx } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([
      { id: 'var-1', color: '#FF0000' },
      { id: 'var-2', color: '#00FF00' },
    ]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawVariableOutline(asCanvasCtx(ctx), 0, 0, 20, ['var-1', 'var-2']);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
  });

  it('draws three outlines for 3 variables with colors', () => {
    const { service, ctx } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([
      { id: 'var-1', color: '#FF0000' },
      { id: 'var-2', color: '#00FF00' },
      { id: 'var-3', color: '#0000FF' },
    ]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawVariableOutline(asCanvasCtx(ctx), 0, 0, 20, ['var-1', 'var-2', 'var-3']);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(3);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  // ─── drawTile ───────────────────────────────────────────────────────────

  it('skips drawTile when tile not found', () => {
    const { service, ctx } = makeService();
    service.gameEngine.tileManager.getTile.mockReturnValue(null);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawTile(asCanvasCtx(ctx), 99, 0, 0, 20);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('skips drawTile when pixels not an array', () => {
    const { service, ctx } = makeService();
    service.gameEngine.tileManager.getTilePixels.mockReturnValue(null as unknown as string[][]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawTile(asCanvasCtx(ctx), 1, 0, 0, 20);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws each non-transparent pixel', () => {
    const { service, ctx } = makeService();
    const pixels: (string | null)[][] = [
      ['#FF0000', 'transparent'],
      [null, '#00FF00'],
    ];
    service.gameEngine.tileManager.getTilePixels.mockReturnValue(pixels);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    renderer.drawTile(asCanvasCtx(ctx), 1, 0, 0, 16);
    // fillRect for '#FF0000' and '#00FF00', not for transparent/null
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });

  // ─── getVariableColor ───────────────────────────────────────────────────

  it('returns null when variable not found', () => {
    const { service } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(renderer.getVariableColor('unknown')).toBeNull();
  });

  it('returns null when variable has no color', () => {
    const { service } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([{ id: 'v1', color: null }]);
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(renderer.getVariableColor('v1')).toBeNull();
  });

  it('returns resolved color string', () => {
    const { service } = makeService();
    service.gameEngine.getVariableDefinitions.mockReturnValue([{ id: 'v1', color: '#FF0000' }]);
    service.resolvePicoColor.mockReturnValue('#FF0000');
    const renderer = new EditorCanvasRenderer(asEditorCanvasService(service));
    expect(renderer.getVariableColor('v1')).toBe('#FF0000');
  });
});


