import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorWorldService } from '../../editor/modules/EditorWorldService';

type WorldServiceManager = ConstructorParameters<typeof EditorWorldService>[0];
type WorldServiceManagerFixture = ReturnType<typeof makeManager>;

function asWorldServiceManager(mgr: WorldServiceManagerFixture): WorldServiceManager {
  return mgr as unknown as WorldServiceManager;
}

function makeManager(stateOverrides: Record<string, unknown> = {}, gameOverrides: Record<string, unknown> = {}) {
  const state = {
    activeRoomIndex: 0, placingNpc: false, selectedNpcId: null, selectedNpcType: null,
    placingEnemy: false, ...stateOverrides,
  };
  return {
    state,
    domCache: {},
    gameEngine: {
      getGame: vi.fn(() => ({
        rooms: [{}, {}, {}, {}], // 4 rooms default
        world: { rows: 2, cols: 2 },
        ...gameOverrides,
      })),
    },
    npcService: { clearSelection: vi.fn() },
    enemyService: { deactivatePlacement: vi.fn() },
    renderService: {
      renderWorldGrid: vi.fn(), renderObjects: vi.fn(), renderEditor: vi.fn(),
      renderEnemies: vi.fn(), renderNpcs: vi.fn(),
    },
    renderObjectCatalog: vi.fn(),
  };
}

describe('EditorWorldService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── setActiveRoom ───────────────────────────────────────────────────────

  it('returns early for non-finite index', () => {
    const mgr = makeManager();
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(NaN);
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
  });

  it('returns early when target equals current room', () => {
    const mgr = makeManager({ activeRoomIndex: 1 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(1);
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
  });

  it('sets activeRoomIndex and triggers renders', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(2);
    expect(mgr.state.activeRoomIndex).toBe(2);
    expect(mgr.renderService.renderWorldGrid).toHaveBeenCalled();
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
    expect(mgr.renderService.renderEnemies).toHaveBeenCalled();
    expect(mgr.renderService.renderNpcs).toHaveBeenCalled();
    expect(mgr.renderObjectCatalog).toHaveBeenCalled();
  });

  it('clamps index to valid range', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(99);
    expect(mgr.state.activeRoomIndex).toBe(3); // 4 rooms → max index 3
  });

  it('clamps negative index to 0', () => {
    const mgr = makeManager({ activeRoomIndex: 2 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(-5);
    expect(mgr.state.activeRoomIndex).toBe(0);
  });

  it('clears npc selection when placingNpc is true', () => {
    const mgr = makeManager({ activeRoomIndex: 0, placingNpc: true });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(1);
    expect(mgr.npcService.clearSelection).toHaveBeenCalled();
  });

  it('clears npc selection when selectedNpcId is set', () => {
    const mgr = makeManager({ activeRoomIndex: 0, selectedNpcId: 'npc-1' });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(1);
    expect(mgr.npcService.clearSelection).toHaveBeenCalled();
  });

  it('deactivates enemy placement when placingEnemy', () => {
    const mgr = makeManager({ activeRoomIndex: 0, placingEnemy: true });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom(1);
    expect(mgr.enemyService.deactivatePlacement).toHaveBeenCalled();
  });

  it('accepts string index', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.setActiveRoom('2');
    expect(mgr.state.activeRoomIndex).toBe(2);
  });

  // ─── moveActiveRoom ──────────────────────────────────────────────────────

  it('returns early for null/undefined direction', () => {
    const mgr = makeManager({ activeRoomIndex: 2 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom(null);
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
  });

  it('moves down from room 0 in 2x2 grid → room 2', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('down');
    expect(mgr.state.activeRoomIndex).toBe(2); // row 0 → row 1 → index 2
  });

  it('moves right from room 0 in 2x2 grid → room 1', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('right');
    expect(mgr.state.activeRoomIndex).toBe(1);
  });

  it('moves up from room 2 in 2x2 grid → room 0', () => {
    const mgr = makeManager({ activeRoomIndex: 2 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('up');
    expect(mgr.state.activeRoomIndex).toBe(0);
  });

  it('moves left from room 1 in 2x2 grid → room 0', () => {
    const mgr = makeManager({ activeRoomIndex: 1 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('left');
    expect(mgr.state.activeRoomIndex).toBe(0);
  });

  it('ignores move that goes out of bounds (up from row 0)', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('up');
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
    expect(mgr.state.activeRoomIndex).toBe(0);
  });

  it('ignores move that goes out of bounds (right from last col)', () => {
    const mgr = makeManager({ activeRoomIndex: 1 }); // col 1 in 2-col grid
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('right');
    expect(mgr.state.activeRoomIndex).toBe(1);
  });

  it('handles case-insensitive direction', () => {
    const mgr = makeManager({ activeRoomIndex: 0 });
    const svc = new EditorWorldService(asWorldServiceManager(mgr));
    svc.moveActiveRoom('RIGHT');
    expect(mgr.state.activeRoomIndex).toBe(1);
  });
});


