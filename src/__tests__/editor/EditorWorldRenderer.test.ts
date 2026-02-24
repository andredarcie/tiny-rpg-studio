/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorWorldRenderer } from '../../editor/modules/renderers/EditorWorldRenderer';

function makeService(stateOverrides: Record<string, unknown> = {}, gameOverrides: Record<string, unknown> = {}) {
  const worldGrid = document.createElement('div');
  const mapPosition = document.createElement('div');

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
    t: vi.fn((key: string, fallback = '') => fallback || key),
    tf: vi.fn((_key: string, params: Record<string, unknown> = {}, fallback = '') => {
      return fallback || `${params.col},${params.row}`;
    }),
  };

  return service;
}

describe('EditorWorldRenderer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── renderWorldGrid ─────────────────────────────────────────────────────

  it('returns early when worldGrid is null', () => {
    const svc = makeService();
    (svc.dom as any).worldGrid = null;
    const renderer = new EditorWorldRenderer(svc as any);
    expect(() => renderer.renderWorldGrid()).not.toThrow();
    expect(svc.gameEngine.getGame).not.toHaveBeenCalled();
  });

  it('creates correct number of world cells', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    const cells = svc.dom.worldGrid.querySelectorAll('.world-cell');
    expect(cells.length).toBe(4); // 2 rows × 2 cols
  });

  it('marks active room with "active" class', () => {
    const svc = makeService({ activeRoomIndex: 2 });
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    const activeCells = svc.dom.worldGrid.querySelectorAll('.world-cell.active');
    expect(activeCells.length).toBe(1);
    expect((activeCells[0] as HTMLElement).dataset.roomIndex).toBe('2');
  });

  it('marks start room with "start" class and badge', () => {
    const svc = makeService({}, { start: { roomIndex: 1 } });
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    const startCells = svc.dom.worldGrid.querySelectorAll('.world-cell.start');
    expect(startCells.length).toBe(1);
    expect((startCells[0] as HTMLElement).dataset.roomIndex).toBe('1');
  });

  it('assigns data-room-index to each cell', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    const cells = svc.dom.worldGrid.querySelectorAll('[data-room-index]');
    expect(cells.length).toBe(4);
    const indices = Array.from(cells).map((c) => Number((c as HTMLElement).dataset.roomIndex));
    expect(indices).toEqual([0, 1, 2, 3]);
  });

  it('sets --world-cols CSS variable', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    expect(svc.dom.worldGrid.style.getPropertyValue('--world-cols')).toBe('2');
  });

  it('renders 1x1 grid when world config missing', () => {
    const svc = makeService({}, { world: undefined });
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    const cells = svc.dom.worldGrid.querySelectorAll('.world-cell');
    expect(cells.length).toBe(1);
  });

  it('calls tf for each cell title', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    expect(svc.tf).toHaveBeenCalledTimes(4);
  });

  it('clears grid before rendering', () => {
    const svc = makeService();
    svc.dom.worldGrid.innerHTML = '<div id="old-child">old</div>';
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderWorldGrid();
    expect(svc.dom.worldGrid.querySelector('#old-child')).toBeNull();
  });

  // ─── renderMapNavigation ─────────────────────────────────────────────────

  it('disables up button when in top row', () => {
    const svc = makeService({ activeRoomIndex: 0 }); // row 0
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderMapNavigation();
    const [upBtn] = svc.dom.mapNavButtons as HTMLButtonElement[];
    expect(upBtn.disabled).toBe(true);
  });

  it('disables left button when in first column', () => {
    const svc = makeService({ activeRoomIndex: 0 }); // col 0
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderMapNavigation();
    const leftBtn = (svc.dom.mapNavButtons as HTMLButtonElement[])[2];
    expect(leftBtn.disabled).toBe(true);
  });

  it('enables down button from top row in 2x2 grid', () => {
    const svc = makeService({ activeRoomIndex: 0 });
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderMapNavigation();
    const downBtn = (svc.dom.mapNavButtons as HTMLButtonElement[])[1];
    expect(downBtn.disabled).toBe(false);
  });

  it('enables right button from first column', () => {
    const svc = makeService({ activeRoomIndex: 0 });
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderMapNavigation();
    const rightBtn = (svc.dom.mapNavButtons as HTMLButtonElement[])[3];
    expect(rightBtn.disabled).toBe(false);
  });

  it('disables all buttons from last cell in 1x1 grid', () => {
    const svc = makeService({}, { world: { rows: 1, cols: 1 }, rooms: [{}] });
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderMapNavigation();
    const buttons = svc.dom.mapNavButtons as HTMLButtonElement[];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('does nothing when mapNavButtons is empty', () => {
    const svc = makeService();
    svc.dom.mapNavButtons = [] as any;
    const renderer = new EditorWorldRenderer(svc as any);
    expect(() => renderer.renderMapNavigation()).not.toThrow();
  });

  // ─── renderGameMinimap ────────────────────────────────────────────────────

  it('returns early when mapPosition is null', () => {
    const svc = makeService();
    (svc.dom as any).mapPosition = null;
    const renderer = new EditorWorldRenderer(svc as any);
    expect(() => renderer.renderGameMinimap(1, 1)).not.toThrow();
  });

  it('creates 9 minimap cells (3x3)', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderGameMinimap(2, 1);
    const cells = svc.dom.mapPosition.querySelectorAll('.game-minimap-cell');
    expect(cells.length).toBe(9);
  });

  it('marks active cell with game-minimap-cell-active class', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderGameMinimap(1, 2);
    const activeCells = svc.dom.mapPosition.querySelectorAll('.game-minimap-cell-active');
    expect(activeCells.length).toBe(1);
    const activeCell = activeCells[0] as HTMLElement;
    expect(activeCell.dataset.mmRow).toBe('2');
    expect(activeCell.dataset.mmCol).toBe('1');
  });

  it('renderGameMinimap with null coords marks no cell active', () => {
    const svc = makeService();
    const renderer = new EditorWorldRenderer(svc as any);
    renderer.renderGameMinimap(null, null);
    const activeCells = svc.dom.mapPosition.querySelectorAll('.game-minimap-cell-active');
    expect(activeCells.length).toBe(0);
  });
});


