
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../editor/modules/EditorConstants', () => ({
  EditorConstants: {
    get ENEMY_DEFINITIONS() {
      return mockData.enemyDefinitions;
    }
  }
}));

vi.mock('../../runtime/adapters/renderer/RendererConstants', () => ({
  RendererConstants: {
    DEFAULT_PALETTE: ['#000000', '#FF0000', '#00FF00', '#0000FF']
  }
}));

import { EditorEnemyRenderer } from '../../editor/modules/renderers/EditorEnemyRenderer';

type EnemyRendererService = ConstructorParameters<typeof EditorEnemyRenderer>[0];
type EnemyOverlayEnemy = Parameters<EditorEnemyRenderer['renderEnemyOverlay']>[0][number];
type EnemyDefinitionInput = Parameters<EditorEnemyRenderer['drawEnemyPreview']>[1];
type EnemyDisplayNameDefinition = NonNullable<Parameters<EditorEnemyRenderer['getEnemyDisplayName']>[0]>;
type EnemyGameDataMock = { world?: { rows?: number; cols?: number } } & Record<string, unknown>;
type PreviewCtxMock = Pick<CanvasRenderingContext2D, 'clearRect' | 'fillRect'> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
};
type SpriteMatrix = (string | null)[][];

function asEnemyRendererService(service: ReturnType<typeof createFixture>['service']): EnemyRendererService {
  return service as unknown as EnemyRendererService;
}

function asCanvasElement(value: unknown): HTMLCanvasElement {
  return value as HTMLCanvasElement;
}

function asCanvasCtx(ctx: PreviewCtxMock): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
}

function enemyDef(overrides: Partial<EnemyDefinitionInput> & Pick<EnemyDefinitionInput, 'type'>): EnemyDefinitionInput {
  return {
    ...overrides,
    type: overrides.type
  } as unknown as EnemyDefinitionInput;
}

function enemyNameDef(overrides: Partial<EnemyDisplayNameDefinition>): EnemyDisplayNameDefinition {
  return {
    type: 'goblin',
    id: 'enemy-goblin',
    lives: 1,
    damage: 1,
    missChance: 0,
    experience: 1,
    sprite: null,
    name: 'Enemy',
    nameKey: null,
    description: '',
    descriptionKey: null,
    ...overrides
  } as EnemyDisplayNameDefinition;
}

function catalogEnemyDef(
  overrides: Partial<EnemyDefinitionInput> & Pick<EnemyDefinitionInput, 'type'>
): EnemyDefinitionInput {
  const { type, ...rest } = overrides;
  return {
    id: `enemy-${type}`,
    type,
    name: 'Enemy',
    nameKey: null,
    description: '',
    descriptionKey: null,
    boss: false,
    lives: 1,
    damage: 1,
    missChance: 0,
    experience: 1,
    sprite: null,
    ...rest
  } as unknown as EnemyDefinitionInput;
}

const mockData = vi.hoisted(() => ({
  enemyDefinitions: [] as EnemyDefinitionInput[]
}));

function makeEnemy(overrides: Partial<{
  id: string; type: string; roomIndex: number; x: number; y: number;
  defeatVariableId: string; deathStartTime: number | null; lastX: number;
}> = {}): EnemyOverlayEnemy {
  return {
    id: overrides.id ?? 'e1',
    type: overrides.type ?? 'goblin',
    roomIndex: overrides.roomIndex ?? 1,
    x: overrides.x ?? 2,
    y: overrides.y ?? 3,
    lastX: overrides.lastX ?? 2,
    defeatVariableId: overrides.defeatVariableId ?? '',
    deathStartTime: overrides.deathStartTime ?? null
  };
}

function createFixture() {
  const enemiesList = document.createElement('div');
  const enemyTypes = document.createElement('div');
  const editorCanvas = document.createElement('canvas');
  const canvasWrapper = document.createElement('div');
  canvasWrapper.appendChild(editorCanvas);
  document.body.appendChild(canvasWrapper);

  const populateVariableSelect = vi.fn();
  const removeEnemy = vi.fn();

  const manager = {
    selectedEnemyType: 'goblin',
    npcService: { populateVariableSelect },
    enemyService: { removeEnemy }
  };

  const paletteManager = {
    getActivePalette: vi.fn(() => ['#000000'])
  };

  const spriteFactory = {
    mapPixels: vi.fn((sprite: unknown) => sprite)
  };

  const gameEngine = {
    getActiveEnemies: vi.fn((): EnemyOverlayEnemy[] => []),
    getGame: vi.fn((): EnemyGameDataMock => ({ world: { rows: 2, cols: 3 } })),
    renderer: {
      enemySprites: {} as Record<string, SpriteMatrix>,
      enemySprite: null as SpriteMatrix | null,
      paletteManager,
      spriteFactory
    },
    gameState: {
      worldManager: { roomSize: 10 }
    }
  };

  const t = vi.fn<(key: string, fallback?: string) => string>((key: string, fallback = ''): string => fallback || key);
  const tf = vi.fn<(_key: string, _params: Record<string, string | number>, fallback?: string) => string>(
    (_key: string, _params: Record<string, string | number>, fallback = ''): string => fallback || _key
  );

  const service = {
    manager,
    dom: { enemiesList, enemyTypes, editorCanvas },
    state: { activeRoomIndex: 1 },
    gameEngine,
    t,
    tf
  };

  return { service, manager, gameEngine, t, tf, enemiesList, enemyTypes, editorCanvas, canvasWrapper };
}

describe('EditorEnemyRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mockData.enemyDefinitions = [];
  });

  // ─── renderEnemies ────────────────────────────────────────────────────────

  it('returns early from renderEnemies when list element is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.enemiesList = null as unknown as HTMLDivElement;
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    expect(() => renderer.renderEnemies()).not.toThrow();
  });

  it('renders nothing when no enemies exist in active room', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemies();

    expect(fixture.enemiesList.children).toHaveLength(0);
  });

  it('renders nothing when enemies are non-boss types', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'goblin', boss: false, lives: 3 })];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy({ type: 'goblin' })]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemies();

    expect(fixture.enemiesList.children).toHaveLength(0);
  });

  it('renders boss enemy items with label, variable select and remove button', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'dragon', boss: true, lives: 10, name: 'Dragão' })];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([
      makeEnemy({ id: 'b1', type: 'dragon', roomIndex: 1, x: 4, y: 5, defeatVariableId: 'v1' })
    ]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemies();

    const items = fixture.enemiesList.querySelectorAll('.enemy-item');
    expect(items).toHaveLength(1);
    expect(fixture.enemiesList.textContent).toContain('Dragão');
    expect(fixture.enemiesList.textContent).toContain('Vida: 10');
    expect(fixture.enemiesList.querySelectorAll('.enemy-remove')).toHaveLength(1);
    expect(fixture.enemiesList.querySelectorAll('.enemy-variable-select')).toHaveLength(1);
    expect(fixture.manager.npcService.populateVariableSelect).toHaveBeenCalledWith(
      expect.any(HTMLSelectElement),
      'v1'
    );
  });

  it('resolves enemy type via aliases', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [
      catalogEnemyDef({ type: 'boss_main', boss: true, lives: 5, aliases: ['dragon_alt'], name: 'Boss' })
    ];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([
      makeEnemy({ type: 'dragon_alt', roomIndex: 1 })
    ]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemies();

    const items = fixture.enemiesList.querySelectorAll('.enemy-item');
    expect(items).toHaveLength(1);
    expect(fixture.enemiesList.textContent).toContain('Boss');
  });

  it('renders boss without lives info when lives is not finite', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'dragon', boss: true, lives: Infinity, name: 'Dragão' })];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy({ type: 'dragon' })]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemies();

    expect(fixture.enemiesList.textContent).not.toContain('Vida:');
  });

  it('filters enemies to active room only', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'dragon', boss: true, lives: 5, name: 'Dragão' })];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([
      makeEnemy({ id: 'r1', type: 'dragon', roomIndex: 1 }),
      makeEnemy({ id: 'r2', type: 'dragon', roomIndex: 2 })
    ]);
    fixture.service.state.activeRoomIndex = 1;
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemies();

    expect(fixture.enemiesList.querySelectorAll('.enemy-item')).toHaveLength(1);
  });

  // ─── renderEnemyCatalog ───────────────────────────────────────────────────

  it('returns early from renderEnemyCatalog when container is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.enemyTypes = null as unknown as HTMLDivElement;
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    expect(() => renderer.renderEnemyCatalog()).not.toThrow();
  });

  it('returns early from renderEnemyCatalog when definitions are empty', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [];
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyCatalog();

    expect(fixture.enemyTypes.querySelectorAll('.enemy-card')).toHaveLength(0);
  });

  it('renders enemy cards with correct structure and selection state', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [
      catalogEnemyDef({ type: 'goblin', boss: false, lives: 3, damage: 1, name: 'Goblin' }),
      catalogEnemyDef({ type: 'dragon', boss: true, lives: 10, damage: 5, name: 'Dragão' })
    ];
    fixture.manager.selectedEnemyType = 'goblin';
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyCatalog();

    const cards = fixture.enemyTypes.querySelectorAll('.enemy-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].classList.contains('selected')).toBe(true);
    expect(cards[1].classList.contains('selected')).toBe(false);
    expect(cards[1].classList.contains('boss')).toBe(true);
    expect(fixture.enemyTypes.querySelector('.enemy-boss-badge')).not.toBeNull();
    expect(fixture.enemyTypes.querySelectorAll('canvas.enemy-preview')).toHaveLength(2);
  });

  it('renders "?" for non-finite lives and damage in catalog', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [
      catalogEnemyDef({ type: 'ghost', boss: false, lives: NaN, damage: Infinity, name: 'Ghost' })
    ];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyCatalog();

    expect(fixture.enemyTypes.querySelector('.enemy-stat-lives')?.textContent).toBe('?');
    expect(fixture.enemyTypes.querySelector('.enemy-stat-damage')?.textContent).toBe('?');
  });

  // ─── drawEnemyPreview ─────────────────────────────────────────────────────

  it('returns early from drawEnemyPreview for non-canvas element', () => {
    const fixture = createFixture();
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    expect(() => renderer.drawEnemyPreview(asCanvasElement({}), enemyDef({ type: 'goblin', sprite: undefined }))).not.toThrow();
  });

  it('returns early from drawEnemyPreview when getContext returns null', () => {
    const fixture = createFixture();
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);

    expect(() => renderer.drawEnemyPreview(canvas, enemyDef({ type: 'goblin', sprite: undefined }))).not.toThrow();
  });

  it('draws sprite pixels when enemySprites contains matching type', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites['goblin'] = [
      ['#FF0000', null],
      [null, '#00FF00']
    ];
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx: PreviewCtxMock = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true };
    vi.spyOn(canvas, 'getContext').mockReturnValue(asCanvasCtx(ctx));

    renderer.drawEnemyPreview(canvas, enemyDef({ type: 'goblin', sprite: undefined }));

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 56, 56);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });

  it('falls back to enemySprite when type not found in enemySprites', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites = {};
    fixture.gameEngine.renderer.enemySprite = [['#AABBCC']];
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx: PreviewCtxMock = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true };
    vi.spyOn(canvas, 'getContext').mockReturnValue(asCanvasCtx(ctx));

    renderer.drawEnemyPreview(canvas, enemyDef({ type: 'orc', sprite: undefined }));

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('maps definition sprite via spriteFactory when no cached sprite exists', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites = {};
    fixture.gameEngine.renderer.enemySprite = undefined as unknown as SpriteMatrix | null;
    fixture.gameEngine.renderer.spriteFactory.mapPixels.mockReturnValue([['#112233']]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx: PreviewCtxMock = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true };
    vi.spyOn(canvas, 'getContext').mockReturnValue(asCanvasCtx(ctx));

    renderer.drawEnemyPreview(canvas, enemyDef({ type: 'orc', sprite: [[0, 1]] }));

    expect(fixture.gameEngine.renderer.spriteFactory.mapPixels).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('skips draw when sprite is not an array', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites = {};
    fixture.gameEngine.renderer.enemySprite = undefined as unknown as SpriteMatrix | null;
    fixture.gameEngine.renderer.spriteFactory.mapPixels.mockReturnValue(null);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx: PreviewCtxMock = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true };
    vi.spyOn(canvas, 'getContext').mockReturnValue(asCanvasCtx(ctx));

    renderer.drawEnemyPreview(canvas, enemyDef({ type: 'orc', sprite: [[0]] }));

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  // ─── getEnemyDisplayName ──────────────────────────────────────────────────

  it('returns default name when definition is null', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((_key: string, fallback = '') => fallback || 'Inimigo');
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const result = renderer.getEnemyDisplayName(null);

    expect(result).toBe('Inimigo');
  });

  it('uses definition name when nameKey is absent', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((_key: string, fallback = '') => fallback);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const result = renderer.getEnemyDisplayName(enemyNameDef({ name: 'Goblin' }), 'fallback');

    expect(result).toBe('Goblin');
  });

  it('uses nameKey for translation when present', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((key: string, fallback = '') => key === 'enemy.goblin' ? 'Goblin Traduzido' : fallback);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const result = renderer.getEnemyDisplayName(enemyNameDef({ name: 'Goblin', nameKey: 'enemy.goblin' }));

    expect(result).toBe('Goblin Traduzido');
  });

  it('strips invalid characters from display name', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((_key: string, fallback = '') => fallback);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const result = renderer.getEnemyDisplayName(enemyNameDef({ name: 'Goblin!@#$%' }));

    expect(result).not.toContain('@');
    expect(result).not.toContain('#');
    expect(result).toContain('Goblin');
  });

  // ─── getEnemyCountProgress ────────────────────────────────────────────────

  it('calculates count progress based on world dimensions', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy(), makeEnemy({ id: 'e2' })]);
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 2, cols: 3 } });
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const { currentCount, totalCount, ratio } = renderer.getEnemyCountProgress();

    expect(currentCount).toBe(2);
    expect(totalCount).toBe(36); // 2*3 rooms * 6 max per room
    expect(ratio).toBeCloseTo(2 / 36);
  });

  it('defaults rows and cols to 3x3 when world is missing', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    fixture.gameEngine.getGame.mockReturnValue({});
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const { totalCount } = renderer.getEnemyCountProgress();

    expect(totalCount).toBe(54); // 3*3 rooms * 6
  });

  it('clamps ratio between 0 and 1', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue(
      Array.from({ length: 60 }, (_, i) => makeEnemy({ id: `e${i}` }))
    );
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 1, cols: 1 } });
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    const { ratio } = renderer.getEnemyCountProgress();

    expect(ratio).toBe(1);
  });

  // ─── renderEnemyCountProgress ─────────────────────────────────────────────

  it('returns early when parent is null', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    expect(() => renderer.renderEnemyCountProgress(null)).not.toThrow();
  });

  it('renders xp-block with label, value and fill bar', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy(), makeEnemy({ id: 'e2' })]);
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 1, cols: 1 } });
    fixture.tf.mockImplementation((_key: string, params: Record<string, string | number>, _fallback = '') =>
      `${params.current} / ${params.total}`
    );
    const parent = document.createElement('div');
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyCountProgress(parent);

    const block = parent.querySelector('.enemy-xp-block');
    expect(block).not.toBeNull();
    expect(parent.querySelector('.enemy-xp-fill')).not.toBeNull();
    expect(parent.querySelector('.enemy-xp-value')?.textContent).toContain('2');
  });

  it('removes existing xp-block before re-rendering', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 1, cols: 1 } });
    const parent = document.createElement('div');
    const oldBlock = document.createElement('div');
    oldBlock.className = 'enemy-xp-block';
    parent.appendChild(oldBlock);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyCountProgress(parent);

    expect(parent.querySelectorAll('.enemy-xp-block')).toHaveLength(1);
  });

  it('inserts block before beforeNode when they share the same parent', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 1, cols: 1 } });
    const parent = document.createElement('div');
    const beforeNode = document.createElement('div');
    parent.appendChild(beforeNode);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyCountProgress(parent, beforeNode);

    const children = Array.from(parent.children);
    const xpBlock = parent.querySelector('.enemy-xp-block');
    expect(xpBlock).not.toBeNull();
    if (!xpBlock) throw new Error('xp block missing');
    expect(children.indexOf(xpBlock)).toBeLessThan(children.indexOf(beforeNode));
  });

  // ─── renderEnemyOverlay ───────────────────────────────────────────────────

  it('returns early when canvas is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.editorCanvas = null as unknown as HTMLCanvasElement;
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    expect(() => renderer.renderEnemyOverlay([], 1)).not.toThrow();
  });

  it('removes existing overlay when no room enemies exist', () => {
    const fixture = createFixture();
    const canvas = fixture.service.dom.editorCanvas;
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);

    const existingOverlay = document.createElement('div');
    existingOverlay.className = 'enemy-overlay';
    wrapper.appendChild(existingOverlay);

    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyOverlay([], 1);

    expect(wrapper.querySelector('.enemy-overlay')).toBeNull();
  });

  it('creates overlay and renders remove buttons for room enemies', () => {
    const fixture = createFixture();
    const canvas = fixture.service.dom.editorCanvas;
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);

    const enemies: EnemyOverlayEnemy[] = [makeEnemy({ id: 'a', roomIndex: 1, x: 1, y: 1 })];
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    renderer.renderEnemyOverlay(enemies, 1);

    const overlay = wrapper.querySelector('.enemy-overlay');
    expect(overlay).not.toBeNull();
    if (!overlay) throw new Error('overlay missing');
    const buttons = overlay.querySelectorAll('.enemy-overlay-remove');
    expect(buttons).toHaveLength(1);
  });

  it('calls removeEnemy when overlay button is clicked', () => {
    const fixture = createFixture();
    const canvas = fixture.service.dom.editorCanvas;
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);

    const enemy = makeEnemy({ id: 'enemy-click', roomIndex: 1 });
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    renderer.renderEnemyOverlay([enemy] as EnemyOverlayEnemy[], 1);

    const btn = wrapper.querySelector('.enemy-overlay-remove') as HTMLButtonElement;
    btn.click();

    expect(fixture.manager.enemyService.removeEnemy).toHaveBeenCalledWith('enemy-click');
  });

  it('handles non-array enemies gracefully in renderEnemyOverlay', () => {
    const fixture = createFixture();
    const canvas = fixture.service.dom.editorCanvas;
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));

    expect(() => renderer.renderEnemyOverlay(null as unknown as EnemyOverlayEnemy[], 1)).not.toThrow();
    expect(wrapper.querySelector('.enemy-overlay')).toBeNull();
  });
});

// sprite-edit-btn

describe('EditorEnemyRenderer - sprite-edit-btn', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mockData.enemyDefinitions = [];
  });

  function createFixtureWithCustomSprites(customSprites: unknown[] = []) {
    const fixture = createFixture();
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 2, cols: 3 }, customSprites });
    return fixture;
  }

  it('enemy cards render .sprite-edit-btn with data-edit-group="enemy"', () => {
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'goblin' })];
    const fixture = createFixtureWithCustomSprites();
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    renderer.renderEnemyCatalog();
    const editBtn = fixture.enemyTypes.querySelector('.sprite-edit-btn');
    expect(editBtn).toBeTruthy();
    expect((editBtn as HTMLElement).dataset.editGroup).toBe('enemy');
    expect((editBtn as HTMLElement).dataset.editKey).toBe('goblin');
  });

  it('.sprite-edit-btn adds the is-custom class when the enemy has a customSprites entry', () => {
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'goblin' })];
    const fixture = createFixtureWithCustomSprites([
      { group: 'enemy', key: 'goblin', variant: 'base', frames: [[[0]]] },
    ]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    renderer.renderEnemyCatalog();
    const editBtn = fixture.enemyTypes.querySelector('.sprite-edit-btn');
    expect(editBtn).toBeTruthy();
    expect((editBtn as HTMLElement).classList.contains('is-custom')).toBe(true);
  });

  it('.sprite-edit-btn does not add the is-custom class when the enemy has no custom entry', () => {
    mockData.enemyDefinitions = [catalogEnemyDef({ type: 'goblin' })];
    const fixture = createFixtureWithCustomSprites([]);
    const renderer = new EditorEnemyRenderer(asEnemyRendererService(fixture.service));
    renderer.renderEnemyCatalog();
    const editBtn = fixture.enemyTypes.querySelector('.sprite-edit-btn');
    expect(editBtn).toBeTruthy();
    expect((editBtn as HTMLElement).classList.contains('is-custom')).toBe(false);
  });
});



