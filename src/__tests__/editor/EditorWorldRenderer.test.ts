import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorWorldRenderer } from '../../editor/modules/renderers/EditorWorldRenderer';

type WorldRendererService = ConstructorParameters<typeof EditorWorldRenderer>[0];
type WorldRendererServiceFixture = ReturnType<typeof makeService>;

function asWorldRendererService(service: WorldRendererServiceFixture): WorldRendererService {
  return service as unknown as WorldRendererService;
}

function makeService(stateOverrides: Record<string, unknown> = {}, gameOverrides: Record<string, unknown> = {}) {
  const worldGrid = document.createElement('div');
  const mapPosition = document.createElement('div');
  const worldMetrics = document.createElement('div');

  const upBtn = document.createElement('button') as HTMLButtonElement;
  upBtn.dataset.direction = 'up';
  const downBtn = document.createElement('button') as HTMLButtonElement;
  downBtn.dataset.direction = 'down';
  const leftBtn = document.createElement('button') as HTMLButtonElement;
  leftBtn.dataset.direction = 'left';
  const rightBtn = document.createElement('button') as HTMLButtonElement;
  rightBtn.dataset.direction = 'right';

  const state = { activeRoomIndex: 0, ...stateOverrides };

  const service = {
    manager: {},
    dom: {
      worldGrid,
      mapPosition,
      worldMetrics,
      mapNavButtons: [upBtn, downBtn, leftBtn, rightBtn],
    },
    state,
    gameEngine: {
      getGame: vi.fn(() => ({
        world: { rows: 2, cols: 2 },
        start: { roomIndex: 0 },
        rooms: [{}, {}, {}, {}],
        ...gameOverrides,
      })),
    },
    t: vi.fn<(key: string, fallback?: string) => string>((key: string, fallback = ''): string => fallback || key),
    tf: vi.fn<(_key: string, params?: Record<string, unknown>, fallback?: string) => string>(
      (_key: string, params: Record<string, unknown> = {}, fallback = ''): string => fallback || `${params.col},${params.row}`
    ),
  };

  return service;
}

function getMetricValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.world-metric-value')).map(el => el.textContent || '');
}

function renderMetrics(gameOverrides: Record<string, unknown> = {}) {
  const svc = makeService({}, gameOverrides);
  const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
  renderer.renderWorldMetrics();
  return { svc, values: getMetricValues(svc.dom.worldMetrics) };
}

const METRIC = { NPCs: 0, Enemies: 1, Items: 2, Objects: 3, Endings: 4, CondDialogs: 5, VariablesInUse: 6, RoomsWithTiles: 7, PaintedTiles: 8, Walls: 9, DialogWords: 10, CustomSprites: 11 };

describe('EditorWorldRenderer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── renderWorldGrid ─────────────────────────────────────────────────────

  it('returns early when worldGrid is null', () => {
    const svc = makeService();
    svc.dom.worldGrid = null as unknown as HTMLDivElement;
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    expect(() => renderer.renderWorldGrid()).not.toThrow();
    expect(svc.gameEngine.getGame).not.toHaveBeenCalled();
  });

  it('creates correct number of world cells', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    const cells = svc.dom.worldGrid.querySelectorAll('.world-cell');
    expect(cells.length).toBe(4); // 2 rows × 2 cols
  });

  it('marks active room with "active" class', () => {
    const svc = makeService({ activeRoomIndex: 2 });
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    const activeCells = svc.dom.worldGrid.querySelectorAll('.world-cell.active');
    expect(activeCells.length).toBe(1);
    expect((activeCells[0] as HTMLElement).dataset.roomIndex).toBe('2');
  });

  it('marks start room with "start" class and badge', () => {
    const svc = makeService({}, { start: { roomIndex: 1 } });
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    const startCells = svc.dom.worldGrid.querySelectorAll('.world-cell.start');
    expect(startCells.length).toBe(1);
    expect((startCells[0] as HTMLElement).dataset.roomIndex).toBe('1');
  });

  it('assigns data-room-index to each cell', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    const cells = svc.dom.worldGrid.querySelectorAll('[data-room-index]');
    expect(cells.length).toBe(4);
    const indices = Array.from(cells).map((c) => Number((c as HTMLElement).dataset.roomIndex));
    expect(indices).toEqual([0, 1, 2, 3]);
  });

  it('sets --world-cols CSS variable', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    expect(svc.dom.worldGrid.style.getPropertyValue('--world-cols')).toBe('2');
  });

  it('renders 1x1 grid when world config missing', () => {
    const svc = makeService({}, { world: undefined });
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    const cells = svc.dom.worldGrid.querySelectorAll('.world-cell');
    expect(cells.length).toBe(1);
  });

  it('calls tf for each cell title', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    expect(svc.tf).toHaveBeenCalledTimes(4);
  });

  it('clears grid before rendering', () => {
    const svc = makeService();
    svc.dom.worldGrid.innerHTML = '<div id="old-child">old</div>';
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderWorldGrid();
    expect(svc.dom.worldGrid.querySelector('#old-child')).toBeNull();
  });

  // ─── renderMapNavigation ─────────────────────────────────────────────────

  it('disables up button when in top row', () => {
    const svc = makeService({ activeRoomIndex: 0 }); // row 0
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderMapNavigation();
    const [upBtn] = svc.dom.mapNavButtons as HTMLButtonElement[];
    expect(upBtn.disabled).toBe(true);
  });

  it('disables left button when in first column', () => {
    const svc = makeService({ activeRoomIndex: 0 }); // col 0
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderMapNavigation();
    const leftBtn = (svc.dom.mapNavButtons as HTMLButtonElement[])[2];
    expect(leftBtn.disabled).toBe(true);
  });

  it('enables down button from top row in 2x2 grid', () => {
    const svc = makeService({ activeRoomIndex: 0 });
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderMapNavigation();
    const downBtn = (svc.dom.mapNavButtons as HTMLButtonElement[])[1];
    expect(downBtn.disabled).toBe(false);
  });

  it('enables right button from first column', () => {
    const svc = makeService({ activeRoomIndex: 0 });
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderMapNavigation();
    const rightBtn = (svc.dom.mapNavButtons as HTMLButtonElement[])[3];
    expect(rightBtn.disabled).toBe(false);
  });

  it('disables all buttons from last cell in 1x1 grid', () => {
    const svc = makeService({}, { world: { rows: 1, cols: 1 }, rooms: [{}] });
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderMapNavigation();
    const buttons = svc.dom.mapNavButtons as HTMLButtonElement[];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('does nothing when mapNavButtons is empty', () => {
    const svc = makeService();
    svc.dom.mapNavButtons = [];
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    expect(() => renderer.renderMapNavigation()).not.toThrow();
  });

  // ─── renderGameMinimap ────────────────────────────────────────────────────

  it('returns early when mapPosition is null', () => {
    const svc = makeService();
    svc.dom.mapPosition = null as unknown as HTMLDivElement;
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    expect(() => renderer.renderGameMinimap(1, 1)).not.toThrow();
  });

  it('creates 9 minimap cells (3x3)', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderGameMinimap(2, 1);
    const cells = svc.dom.mapPosition.querySelectorAll('.game-minimap-cell');
    expect(cells.length).toBe(9);
  });

  it('marks active cell with game-minimap-cell-active class', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderGameMinimap(1, 2);
    const activeCells = svc.dom.mapPosition.querySelectorAll('.game-minimap-cell-active');
    expect(activeCells.length).toBe(1);
    const activeCell = activeCells[0] as HTMLElement;
    expect(activeCell.dataset.mmRow).toBe('2');
    expect(activeCell.dataset.mmCol).toBe('1');
  });

  it('renderGameMinimap with null coords marks no cell active', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
    renderer.renderGameMinimap(null, null);
    const activeCells = svc.dom.mapPosition.querySelectorAll('.game-minimap-cell-active');
    expect(activeCells.length).toBe(0);
  });

  // ─── renderWorldMetrics ───────────────────────────────────────────────────

  describe('renderWorldMetrics', () => {
    it('returns early when worldMetrics container is null', () => {
      const svc = makeService();
      svc.dom.worldMetrics = null as unknown as HTMLDivElement;
      const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
      expect(() => renderer.renderWorldMetrics()).not.toThrow();
    });

    it('renders title and 12 metric rows', () => {
      const { svc } = renderMetrics();
      expect(svc.dom.worldMetrics.querySelector('.world-metrics-title')).not.toBeNull();
      expect(svc.dom.worldMetrics.querySelectorAll('.world-metric-row').length).toBe(12);
    });

    it('each metric row has a tooltip (title attribute)', () => {
      const { svc } = renderMetrics();
      const rows = Array.from(svc.dom.worldMetrics.querySelectorAll('.world-metric-row'));
      expect(rows.every(row => (row as HTMLElement).title.length > 0)).toBe(true);
    });

    it('clears previous content before re-rendering', () => {
      const svc = makeService();
      svc.dom.worldMetrics.innerHTML = '<div id="stale">old</div>';
      const renderer = new EditorWorldRenderer(asWorldRendererService(svc));
      renderer.renderWorldMetrics();
      expect(svc.dom.worldMetrics.querySelector('#stale')).toBeNull();
    });

    // ── NPCs ──────────────────────────────────────────────────────────────────

    it('NPCs: counts only placed sprites', () => {
      const { values } = renderMetrics({
        sprites: [
          { placed: true, text: '' },
          { placed: true, text: '' },
          { placed: false, text: '' },
        ],
      });
      expect(values[METRIC.NPCs]).toBe('2');
    });

    it('NPCs: returns 0 when no sprites are placed', () => {
      const { values } = renderMetrics({ sprites: [{ placed: false }] });
      expect(values[METRIC.NPCs]).toBe('0');
    });

    // ── Enemies ───────────────────────────────────────────────────────────────

    it('Enemies: counts all entries in the enemies array', () => {
      const { values } = renderMetrics({ enemies: [{}, {}, {}] });
      expect(values[METRIC.Enemies]).toBe('3');
    });

    it('Enemies: returns 0 for empty array', () => {
      const { values } = renderMetrics({ enemies: [] });
      expect(values[METRIC.Enemies]).toBe('0');
    });

    // ── Items ─────────────────────────────────────────────────────────────────

    it('Items: counts all entries in the items array', () => {
      const { values } = renderMetrics({ items: [{}, {}] });
      expect(values[METRIC.Items]).toBe('2');
    });

    // ── Objects ───────────────────────────────────────────────────────────────

    it('Objects: excludes player-end and player-start from count', () => {
      const { values } = renderMetrics({
        objects: [
          { type: 'switch' },
          { type: 'door' },
          { type: 'player-end' },
          { type: 'player-start' },
        ],
      });
      expect(values[METRIC.Objects]).toBe('2');
    });

    it('Objects: returns 0 when only special objects exist', () => {
      const { values } = renderMetrics({
        objects: [{ type: 'player-end' }, { type: 'player-start' }],
      });
      expect(values[METRIC.Objects]).toBe('0');
    });

    // ── Endings ───────────────────────────────────────────────────────────────

    it('Endings: counts only player-end objects', () => {
      const { values } = renderMetrics({
        objects: [
          { type: 'player-end' },
          { type: 'player-end' },
          { type: 'switch' },
        ],
      });
      expect(values[METRIC.Endings]).toBe('2');
    });

    it('Endings: returns 0 when no player-end objects exist', () => {
      const { values } = renderMetrics({ objects: [{ type: 'switch' }] });
      expect(values[METRIC.Endings]).toBe('0');
    });

    // ── Conditional dialogs ───────────────────────────────────────────────────

    it('Cond. dialogs: counts placed sprites with non-empty conditionText', () => {
      const { values } = renderMetrics({
        sprites: [
          { placed: true, conditionText: 'If variable is on, say this.' },
          { placed: true, conditionText: 'Another branch.' },
          { placed: true, conditionText: '' },
          { placed: false, conditionText: 'Should not count.' },
        ],
      });
      expect(values[METRIC.CondDialogs]).toBe('2');
    });

    it('Cond. dialogs: whitespace-only conditionText does not count', () => {
      const { values } = renderMetrics({
        sprites: [{ placed: true, conditionText: '   ' }],
      });
      expect(values[METRIC.CondDialogs]).toBe('0');
    });

    // ── Variables in use ──────────────────────────────────────────────────────

    it('Variables in use: counts unique IDs across NPCs, enemies, and objects', () => {
      const { values } = renderMetrics({
        sprites: [
          { placed: true, conditionVariableId: 'var-1', rewardVariableId: 'var-2' },
          { placed: true, conditionalRewardVariableId: 'var-3' },
        ],
        enemies: [{ defeatVariableId: 'var-4' }],
        objects: [{ type: 'switch', variableId: 'var-5' }],
      });
      expect(values[METRIC.VariablesInUse]).toBe('5');
    });

    it('Variables in use: deduplicates the same variable ID used in multiple places', () => {
      const { values } = renderMetrics({
        sprites: [{ placed: true, conditionVariableId: 'var-1', rewardVariableId: 'var-1' }],
        enemies: [{ defeatVariableId: 'var-1' }],
        objects: [{ type: 'switch', variableId: 'var-1' }],
      });
      expect(values[METRIC.VariablesInUse]).toBe('1');
    });

    it('Variables in use: ignores null and undefined variable IDs', () => {
      const { values } = renderMetrics({
        sprites: [{ placed: true, conditionVariableId: null, rewardVariableId: undefined }],
        enemies: [{ defeatVariableId: null }],
      });
      expect(values[METRIC.VariablesInUse]).toBe('0');
    });

    // ── Rooms with tiles ──────────────────────────────────────────────────────

    it('Rooms with tiles: counts rooms with at least one non-default ground tile', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [
            { ground: [[2, 1], [1, 1]], overlay: [[null, null], [null, null]] },
            { ground: [[1, 1], [1, 1]], overlay: [[null, null], [null, null]] },
          ],
        },
      });
      expect(values[METRIC.RoomsWithTiles]).toBe('1');
    });

    it('Rooms with tiles: counts rooms with at least one non-null overlay tile', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [
            { ground: [[1, 1]], overlay: [[5, null]] },
            { ground: [[1, 1]], overlay: [[null, null]] },
          ],
        },
      });
      expect(values[METRIC.RoomsWithTiles]).toBe('1');
    });

    it('Rooms with tiles: returns 0 when all rooms have only default tiles', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [
            { ground: [[1, 1]], overlay: [[null]] },
          ],
        },
      });
      expect(values[METRIC.RoomsWithTiles]).toBe('0');
    });

    // ── Painted tiles ─────────────────────────────────────────────────────────

    it('Painted tiles: counts ground tiles that differ from the default tile ID', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [{ ground: [[2, 3, 1], [1, 4, 1]], overlay: [[null, null, null], [null, null, null]] }],
        },
      });
      expect(values[METRIC.PaintedTiles]).toBe('3');
    });

    it('Painted tiles: counts non-null overlay tiles', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [{ ground: [[1, 1]], overlay: [[5, null]] }],
        },
      });
      expect(values[METRIC.PaintedTiles]).toBe('1');
    });

    it('Painted tiles: sums ground and overlay painted tiles across all rooms', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [
            { ground: [[2, 1]], overlay: [[6, null]] },
            { ground: [[1, 3]], overlay: [[null, 7]] },
          ],
        },
      });
      expect(values[METRIC.PaintedTiles]).toBe('4');
    });

    it('Painted tiles: returns 0 for a fresh map with only default tiles', () => {
      const { values } = renderMetrics({
        tileset: {
          tiles: [{ id: 1 }],
          maps: [{ ground: [[1, 1], [1, 1]], overlay: [[null, null], [null, null]] }],
        },
      });
      expect(values[METRIC.PaintedTiles]).toBe('0');
    });

    // ── Walls ─────────────────────────────────────────────────────────────────

    it('Walls: counts true values across all room wall grids', () => {
      const { values } = renderMetrics({
        rooms: [
          { walls: [[true, false], [false, true]] },
          { walls: [[true, false], [false, false]] },
        ],
      });
      expect(values[METRIC.Walls]).toBe('3');
    });

    it('Walls: returns 0 when no walls are painted', () => {
      const { values } = renderMetrics({
        rooms: [{ walls: [[false, false], [false, false]] }],
      });
      expect(values[METRIC.Walls]).toBe('0');
    });

    it('Walls: returns 0 when rooms array is empty', () => {
      const { values } = renderMetrics({ rooms: [] });
      expect(values[METRIC.Walls]).toBe('0');
    });

    // ── Dialog words ──────────────────────────────────────────────────────────

    it('Dialog words: counts words in NPC text fields', () => {
      const { values } = renderMetrics({
        sprites: [
          { placed: true, text: 'Hello world', conditionText: '' },
          { placed: true, text: 'Goodbye', conditionText: 'Only if variable.' },
        ],
      });
      expect(values[METRIC.DialogWords]).toBe('6');
    });

    it('Dialog words: counts both text and conditionText for each sprite', () => {
      const { values } = renderMetrics({
        sprites: [{ placed: true, text: 'one two three', conditionText: 'four five' }],
      });
      expect(values[METRIC.DialogWords]).toBe('5');
    });

    it('Dialog words: counts words from unplaced sprites too', () => {
      const { values } = renderMetrics({
        sprites: [{ placed: false, text: 'one two' }],
      });
      expect(values[METRIC.DialogWords]).toBe('2');
    });

    it('Dialog words: returns 0 when all texts are empty', () => {
      const { values } = renderMetrics({
        sprites: [{ placed: true, text: '', conditionText: '' }],
      });
      expect(values[METRIC.DialogWords]).toBe('0');
    });

    // ── Custom sprites ────────────────────────────────────────────────────────

    it('Custom sprites: counts entries in customSprites array', () => {
      const { values } = renderMetrics({ customSprites: [{}, {}, {}] });
      expect(values[METRIC.CustomSprites]).toBe('3');
    });

    it('Custom sprites: returns 0 when customSprites is absent', () => {
      const { values } = renderMetrics({ customSprites: undefined });
      expect(values[METRIC.CustomSprites]).toBe('0');
    });
  });
});


