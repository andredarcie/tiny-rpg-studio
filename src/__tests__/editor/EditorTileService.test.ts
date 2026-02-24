/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorTileService } from '../../editor/modules/EditorTileService';

function makeManager(stateOverrides: Record<string, unknown> = {}) {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: vi.fn(() => ({ left: 0, top: 0, width: 160, height: 160 }))
  });
  const state: Record<string, unknown> = {
    mapPainting: false, skipMapHistory: false, selectedTileId: null,
    activeRoomIndex: 0, placingNpc: false, placingEnemy: false,
    placingObjectType: null, ...stateOverrides
  };
  return {
    state,
    domCache: { editorCanvas: canvas },
    renderService: {
      renderEditor: vi.fn(), renderTileList: vi.fn(), updateSelectedTilePreview: vi.fn(),
    },
    gameEngine: { setMapTile: vi.fn(), draw: vi.fn() },
    npcService: { placeNpcAt: vi.fn() },
    enemyService: { placeEnemyAt: vi.fn() },
    objectService: { placeObjectAt: vi.fn() },
    history: { pushCurrentState: vi.fn() },
    updateJSON: vi.fn(),
  };
}

function makePointer(clientX = 80, clientY = 80, pointerId = 1) {
  return { clientX, clientY, pointerId, preventDefault: vi.fn() } as unknown as PointerEvent;
}

describe('EditorTileService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── getTileFromEvent ───────────────────────────────────────────────────────

  it('returns null when canvas is missing', () => {
    const mgr = makeManager();
    (mgr.domCache as any).editorCanvas = null;
    const svc = new EditorTileService(mgr as any);
    expect(svc.getTileFromEvent(makePointer())).toBeNull();
  });

  it('returns null when rect has no size', () => {
    const mgr = makeManager();
    (mgr.domCache.editorCanvas.getBoundingClientRect as any).mockReturnValue({ left: 0, top: 0, width: 0, height: 0 });
    const svc = new EditorTileService(mgr as any);
    expect(svc.getTileFromEvent(makePointer())).toBeNull();
  });

  it('returns null when pointer is outside canvas bounds', () => {
    const svc = new EditorTileService(makeManager() as any);
    expect(svc.getTileFromEvent(makePointer(-1, 0))).toBeNull();
    expect(svc.getTileFromEvent(makePointer(0, -1))).toBeNull();
    expect(svc.getTileFromEvent(makePointer(200, 0))).toBeNull();
  });

  it('returns correct tile coords for center of canvas', () => {
    const svc = new EditorTileService(makeManager() as any);
    // canvas 160x160, pointer at (80,80) → relX=0.5, relY=0.5 → tile (4,4)
    const coord = svc.getTileFromEvent(makePointer(80, 80));
    expect(coord).toEqual({ x: 4, y: 4 });
  });

  it('clamps tile coords to max 7', () => {
    const svc = new EditorTileService(makeManager() as any);
    const coord = svc.getTileFromEvent(makePointer(159, 159));
    expect(coord!.x).toBe(7);
    expect(coord!.y).toBe(7);
  });

  it('returns tile (0,0) for pointer at top-left', () => {
    const svc = new EditorTileService(makeManager() as any);
    expect(svc.getTileFromEvent(makePointer(0, 0))).toEqual({ x: 0, y: 0 });
  });

  // ─── clearSelection ─────────────────────────────────────────────────────────

  it('clearSelection returns false when no tile selected', () => {
    const svc = new EditorTileService(makeManager() as any);
    expect(svc.clearSelection()).toBe(false);
  });

  it('clearSelection clears tile and calls render methods', () => {
    const mgr = makeManager({ selectedTileId: 'tile-1' });
    const svc = new EditorTileService(mgr as any);
    const result = svc.clearSelection();
    expect(result).toBe(true);
    expect(mgr.state.selectedTileId).toBeNull();
    expect(mgr.renderService.renderTileList).toHaveBeenCalled();
    expect(mgr.renderService.updateSelectedTilePreview).toHaveBeenCalled();
  });

  it('clearSelection with render:false skips render calls', () => {
    const mgr = makeManager({ selectedTileId: 'tile-1' });
    const svc = new EditorTileService(mgr as any);
    svc.clearSelection({ render: false });
    expect(mgr.renderService.renderTileList).not.toHaveBeenCalled();
  });

  // ─── startPaint ─────────────────────────────────────────────────────────────

  it('startPaint returns early when canvas is missing', () => {
    const mgr = makeManager();
    (mgr.domCache as any).editorCanvas = null;
    const svc = new EditorTileService(mgr as any);
    expect(() => svc.startPaint(makePointer())).not.toThrow();
    expect(mgr.state.mapPainting).toBe(false);
  });

  it('startPaint sets mapPainting, calls preventDefault and setPointerCapture', () => {
    const mgr = makeManager({ selectedTileId: 'tile-1' });
    const canvas = mgr.domCache.editorCanvas;
    canvas.setPointerCapture = vi.fn();
    const svc = new EditorTileService(mgr as any);
    const ev = makePointer(80, 80, 5);
    svc.startPaint(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(mgr.state.mapPainting).toBe(true);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(5);
  });

  // ─── continuePaint ──────────────────────────────────────────────────────────

  it('continuePaint skips when not painting', () => {
    const mgr = makeManager({ mapPainting: false });
    const svc = new EditorTileService(mgr as any);
    svc.continuePaint(makePointer());
    expect(mgr.gameEngine.setMapTile).not.toHaveBeenCalled();
  });

  it('continuePaint applies paint when mapPainting is true', () => {
    const mgr = makeManager({ mapPainting: true, selectedTileId: 'tile-1' });
    const svc = new EditorTileService(mgr as any);
    svc.continuePaint(makePointer(80, 80));
    expect(mgr.gameEngine.setMapTile).toHaveBeenCalled();
  });

  // ─── finishPaint ────────────────────────────────────────────────────────────

  it('finishPaint returns early when not painting', () => {
    const mgr = makeManager({ mapPainting: false });
    const svc = new EditorTileService(mgr as any);
    svc.finishPaint(makePointer());
    expect(mgr.history.pushCurrentState).not.toHaveBeenCalled();
  });

  it('finishPaint releases pointer capture and commits history', () => {
    const mgr = makeManager({ mapPainting: true });
    const canvas = mgr.domCache.editorCanvas;
    canvas.hasPointerCapture = vi.fn(() => true);
    canvas.releasePointerCapture = vi.fn();
    const svc = new EditorTileService(mgr as any);
    svc.finishPaint(makePointer(80, 80, 3));
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(3);
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
    expect(mgr.history.pushCurrentState).toHaveBeenCalled();
  });

  it('finishPaint skips history when skipMapHistory is true', () => {
    const mgr = makeManager({ mapPainting: true, skipMapHistory: true });
    mgr.domCache.editorCanvas.hasPointerCapture = vi.fn(() => false);
    const svc = new EditorTileService(mgr as any);
    svc.finishPaint(makePointer());
    expect(mgr.history.pushCurrentState).not.toHaveBeenCalled();
    expect(mgr.state.skipMapHistory).toBe(false);
  });

  // ─── applyPaint routing ─────────────────────────────────────────────────────

  it('applyPaint routes to placeNpcAt when placingNpc', () => {
    const mgr = makeManager({ placingNpc: true, mapPainting: true });
    const svc = new EditorTileService(mgr as any);
    svc.applyPaint(makePointer(80, 80));
    expect(mgr.npcService.placeNpcAt).toHaveBeenCalledWith({ x: 4, y: 4 });
    expect(mgr.state.skipMapHistory).toBe(true);
  });

  it('applyPaint routes to placeEnemyAt when placingEnemy', () => {
    const mgr = makeManager({ placingEnemy: true });
    const svc = new EditorTileService(mgr as any);
    svc.applyPaint(makePointer(80, 80));
    expect(mgr.enemyService.placeEnemyAt).toHaveBeenCalledWith({ x: 4, y: 4 });
  });

  it('applyPaint routes to placeObjectAt when placingObjectType', () => {
    const mgr = makeManager({ placingObjectType: 'key', activeRoomIndex: 2 });
    const svc = new EditorTileService(mgr as any);
    svc.applyPaint(makePointer(80, 80));
    expect(mgr.objectService.placeObjectAt).toHaveBeenCalledWith('key', { x: 4, y: 4 }, 2);
  });

  it('applyPaint skips when no tile selected and not placing anything', () => {
    const mgr = makeManager({ selectedTileId: null });
    const svc = new EditorTileService(mgr as any);
    svc.applyPaint(makePointer(80, 80));
    expect(mgr.gameEngine.setMapTile).not.toHaveBeenCalled();
  });

  it('applyPaint paints tile when selectedTileId is set', () => {
    const mgr = makeManager({ selectedTileId: 'tile-grass', activeRoomIndex: 1 });
    const svc = new EditorTileService(mgr as any);
    svc.applyPaint(makePointer(80, 80));
    expect(mgr.gameEngine.setMapTile).toHaveBeenCalledWith(4, 4, 'tile-grass', 1);
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
  });

  it('applyPaint returns early when getTileFromEvent returns null', () => {
    const mgr = makeManager({ selectedTileId: 'tile-1' });
    (mgr.domCache.editorCanvas.getBoundingClientRect as any).mockReturnValue({ left: 0, top: 0, width: 0, height: 0 });
    const svc = new EditorTileService(mgr as any);
    svc.applyPaint(makePointer());
    expect(mgr.gameEngine.setMapTile).not.toHaveBeenCalled();
  });
});


