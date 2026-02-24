/* eslint-disable */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockData = vi.hoisted(() => ({
  enemyDefinitions: [] as any[]
}));

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

function makeEnemy(overrides: Partial<{
  id: string; type: string; roomIndex: number; x: number; y: number;
  defeatVariableId: string; deathStartTime: number | null;
}> = {}) {
  return {
    id: overrides.id ?? 'e1',
    type: overrides.type ?? 'goblin',
    roomIndex: overrides.roomIndex ?? 1,
    x: overrides.x ?? 2,
    y: overrides.y ?? 3,
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
    mapPixels: vi.fn((sprite: any) => sprite)
  };

  const gameEngine = {
    getActiveEnemies: vi.fn((): any[] => []),
    getGame: vi.fn(() => ({ world: { rows: 2, cols: 3 } })),
    renderer: {
      enemySprites: {} as Record<string, any>,
      enemySprite: null as any,
      paletteManager,
      spriteFactory
    },
    gameState: {
      worldManager: { roomSize: 10 }
    }
  };

  const t = vi.fn((key: string, fallback = '') => fallback || key);
  const tf = vi.fn((_key: string, _params: Record<string, string | number>, fallback = '') => fallback || _key);

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
    fixture.service.dom.enemiesList = null as any;
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    expect(() => renderer.renderEnemies()).not.toThrow();
  });

  it('renders nothing when no enemies exist in active room', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemies();

    expect(fixture.enemiesList.children).toHaveLength(0);
  });

  it('renders nothing when enemies are non-boss types', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [{ type: 'goblin', boss: false, lives: 3 }];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy({ type: 'goblin' })]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemies();

    expect(fixture.enemiesList.children).toHaveLength(0);
  });

  it('renders boss enemy items with label, variable select and remove button', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [{ type: 'dragon', boss: true, lives: 10, name: 'Dragão' }];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([
      makeEnemy({ id: 'b1', type: 'dragon', roomIndex: 1, x: 4, y: 5, defeatVariableId: 'v1' })
    ]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

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
      { type: 'boss_main', boss: true, lives: 5, aliases: ['dragon_alt'], name: 'Boss' }
    ];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([
      makeEnemy({ type: 'dragon_alt', roomIndex: 1 })
    ]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemies();

    const items = fixture.enemiesList.querySelectorAll('.enemy-item');
    expect(items).toHaveLength(1);
    expect(fixture.enemiesList.textContent).toContain('Boss');
  });

  it('renders boss without lives info when lives is not finite', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [{ type: 'dragon', boss: true, lives: Infinity, name: 'Dragão' }];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy({ type: 'dragon' })]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemies();

    expect(fixture.enemiesList.textContent).not.toContain('Vida:');
  });

  it('filters enemies to active room only', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [{ type: 'dragon', boss: true, lives: 5, name: 'Dragão' }];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([
      makeEnemy({ id: 'r1', type: 'dragon', roomIndex: 1 }),
      makeEnemy({ id: 'r2', type: 'dragon', roomIndex: 2 })
    ]);
    fixture.service.state.activeRoomIndex = 1;
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemies();

    expect(fixture.enemiesList.querySelectorAll('.enemy-item')).toHaveLength(1);
  });

  // ─── renderEnemyCatalog ───────────────────────────────────────────────────

  it('returns early from renderEnemyCatalog when container is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.enemyTypes = null as any;
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    expect(() => renderer.renderEnemyCatalog()).not.toThrow();
  });

  it('returns early from renderEnemyCatalog when definitions are empty', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [];
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemyCatalog();

    expect(fixture.enemyTypes.querySelectorAll('.enemy-card')).toHaveLength(0);
  });

  it('renders enemy cards with correct structure and selection state', () => {
    const fixture = createFixture();
    mockData.enemyDefinitions = [
      { type: 'goblin', boss: false, lives: 3, damage: 1, name: 'Goblin' },
      { type: 'dragon', boss: true, lives: 10, damage: 5, name: 'Dragão' }
    ];
    fixture.manager.selectedEnemyType = 'goblin';
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

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
      { type: 'ghost', boss: false, lives: NaN, damage: Infinity, name: 'Ghost' }
    ];
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemyCatalog();

    expect(fixture.enemyTypes.querySelector('.enemy-stat-lives')?.textContent).toBe('?');
    expect(fixture.enemyTypes.querySelector('.enemy-stat-damage')?.textContent).toBe('?');
  });

  // ─── drawEnemyPreview ─────────────────────────────────────────────────────

  it('returns early from drawEnemyPreview for non-canvas element', () => {
    const fixture = createFixture();
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    expect(() => renderer.drawEnemyPreview({} as any, { type: 'goblin', sprite: null } as any)).not.toThrow();
  });

  it('returns early from drawEnemyPreview when getContext returns null', () => {
    const fixture = createFixture();
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);

    expect(() => renderer.drawEnemyPreview(canvas, { type: 'goblin', sprite: null } as any)).not.toThrow();
  });

  it('draws sprite pixels when enemySprites contains matching type', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites['goblin'] = [
      ['#FF0000', null],
      [null, '#00FF00']
    ];
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true } as any;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    renderer.drawEnemyPreview(canvas, { type: 'goblin', sprite: null } as any);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 56, 56);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });

  it('falls back to enemySprite when type not found in enemySprites', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites = {};
    fixture.gameEngine.renderer.enemySprite = [['#AABBCC']];
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true } as any;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    renderer.drawEnemyPreview(canvas, { type: 'orc', sprite: null } as any);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('maps definition sprite via spriteFactory when no cached sprite exists', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites = {};
    fixture.gameEngine.renderer.enemySprite = null;
    fixture.gameEngine.renderer.spriteFactory.mapPixels.mockReturnValue([['#112233']]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true } as any;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    renderer.drawEnemyPreview(canvas, { type: 'orc', sprite: [[0, 1]] } as any);

    expect(fixture.gameEngine.renderer.spriteFactory.mapPixels).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('skips draw when sprite is not an array', () => {
    const fixture = createFixture();
    fixture.gameEngine.renderer.enemySprites = {};
    fixture.gameEngine.renderer.enemySprite = null;
    fixture.gameEngine.renderer.spriteFactory.mapPixels.mockReturnValue(null);
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: true } as any;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    renderer.drawEnemyPreview(canvas, { type: 'orc', sprite: [[0]] } as any);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  // ─── getEnemyDisplayName ──────────────────────────────────────────────────

  it('returns default name when definition is null', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((_key: string, fallback = '') => fallback || 'Inimigo');
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const result = renderer.getEnemyDisplayName(null);

    expect(result).toBe('Inimigo');
  });

  it('uses definition name when nameKey is absent', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((_key: string, fallback = '') => fallback);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const result = renderer.getEnemyDisplayName({ name: 'Goblin' } as any, 'fallback');

    expect(result).toBe('Goblin');
  });

  it('uses nameKey for translation when present', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((key: string, fallback = '') => key === 'enemy.goblin' ? 'Goblin Traduzido' : fallback);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const result = renderer.getEnemyDisplayName({ name: 'Goblin', nameKey: 'enemy.goblin' } as any);

    expect(result).toBe('Goblin Traduzido');
  });

  it('strips invalid characters from display name', () => {
    const fixture = createFixture();
    fixture.t.mockImplementation((_key: string, fallback = '') => fallback);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const result = renderer.getEnemyDisplayName({ name: 'Goblin!@#$%' } as any);

    expect(result).not.toContain('@');
    expect(result).not.toContain('#');
    expect(result).toContain('Goblin');
  });

  // ─── getEnemyCountProgress ────────────────────────────────────────────────

  it('calculates count progress based on world dimensions', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy(), makeEnemy({ id: 'e2' })]);
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 2, cols: 3 } });
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const { currentCount, totalCount, ratio } = renderer.getEnemyCountProgress();

    expect(currentCount).toBe(2);
    expect(totalCount).toBe(36); // 2*3 rooms * 6 max per room
    expect(ratio).toBeCloseTo(2 / 36);
  });

  it('defaults rows and cols to 3x3 when world is missing', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    fixture.gameEngine.getGame.mockReturnValue({} as any);
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const { totalCount } = renderer.getEnemyCountProgress();

    expect(totalCount).toBe(54); // 3*3 rooms * 6
  });

  it('clamps ratio between 0 and 1', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue(
      Array.from({ length: 60 }, (_, i) => makeEnemy({ id: `e${i}` }))
    );
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 1, cols: 1 } });
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    const { ratio } = renderer.getEnemyCountProgress();

    expect(ratio).toBe(1);
  });

  // ─── renderEnemyCountProgress ─────────────────────────────────────────────

  it('returns early when parent is null', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([]);
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    expect(() => renderer.renderEnemyCountProgress(null)).not.toThrow();
  });

  it('renders xp-block with label, value and fill bar', () => {
    const fixture = createFixture();
    fixture.gameEngine.getActiveEnemies.mockReturnValue([makeEnemy(), makeEnemy({ id: 'e2' })]);
    fixture.gameEngine.getGame.mockReturnValue({ world: { rows: 1, cols: 1 } });
    fixture.tf.mockImplementation((_key: string, params: any, _fallback: string) =>
      `${params.current} / ${params.total}`
    );
    const parent = document.createElement('div');
    const renderer = new EditorEnemyRenderer(fixture.service as any);

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
    const renderer = new EditorEnemyRenderer(fixture.service as any);

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
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemyCountProgress(parent, beforeNode);

    const children = Array.from(parent.children);
    expect(children.indexOf(parent.querySelector('.enemy-xp-block')!))
      .toBeLessThan(children.indexOf(beforeNode));
  });

  // ─── renderEnemyOverlay ───────────────────────────────────────────────────

  it('returns early when canvas is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.editorCanvas = null as any;
    const renderer = new EditorEnemyRenderer(fixture.service as any);
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

    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemyOverlay([], 1);

    expect(wrapper.querySelector('.enemy-overlay')).toBeNull();
  });

  it('creates overlay and renders remove buttons for room enemies', () => {
    const fixture = createFixture();
    const canvas = fixture.service.dom.editorCanvas;
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);

    const enemies = [makeEnemy({ id: 'a', roomIndex: 1, x: 1, y: 1 })] as any[];
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    renderer.renderEnemyOverlay(enemies, 1);

    const overlay = wrapper.querySelector('.enemy-overlay');
    expect(overlay).not.toBeNull();
    const buttons = overlay!.querySelectorAll('.enemy-overlay-remove');
    expect(buttons).toHaveLength(1);
  });

  it('calls removeEnemy when overlay button is clicked', () => {
    const fixture = createFixture();
    const canvas = fixture.service.dom.editorCanvas;
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);

    const enemy = makeEnemy({ id: 'enemy-click', roomIndex: 1 });
    const renderer = new EditorEnemyRenderer(fixture.service as any);
    renderer.renderEnemyOverlay([enemy] as any[], 1);

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
    const renderer = new EditorEnemyRenderer(fixture.service as any);

    expect(() => renderer.renderEnemyOverlay(null as any, 1)).not.toThrow();
    expect(wrapper.querySelector('.enemy-overlay')).toBeNull();
  });
});


