/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorInteractionController } from '../../editor/manager/EditorInteractionController';

function makeManager(stateOverrides: Record<string, unknown> = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const container = document.createElement('div');
  Object.defineProperty(container, 'offsetWidth', { value: 320, configurable: true });
  container.appendChild(canvas);
  document.body.appendChild(container);

  const state: Record<string, unknown> = {
    placingNpc: false, placingEnemy: false, placingObjectType: null, ...stateOverrides
  };

  return {
    state,
    editorCanvas: canvas,
    dom: {},
    renderService: { renderEditor: vi.fn(), renderEnemies: vi.fn() },
    npcService: { clearSelection: vi.fn() },
    enemyService: { deactivatePlacement: vi.fn() },
    objectService: { togglePlacement: vi.fn() },
    selectedNpcId: null,
    selectedNpcType: null,
    undo: vi.fn(),
    redo: vi.fn(),
    gameEngine: {},
    get dom_() { return this.dom; },
  };
}

function makeKey(key: string, opts: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, defaultPrevented: false, preventDefault: vi.fn(), ...opts } as unknown as KeyboardEvent;
}

describe('EditorInteractionController', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── handleCanvasResize ──────────────────────────────────────────────────

  it('returns early when editorCanvas is null', () => {
    const mgr = makeManager();
    mgr.editorCanvas = null as any;
    const ctrl = new EditorInteractionController(mgr as any);
    expect(() => ctrl.handleCanvasResize()).not.toThrow();
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
  });

  it('returns early when canvas has no parentElement', () => {
    const canvas = document.createElement('canvas');
    const mgr = makeManager();
    mgr.editorCanvas = canvas;
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleCanvasResize();
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
  });

  it('resizes canvas and calls renderEditor and renderEnemies', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleCanvasResize(true);
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
    expect(mgr.renderService.renderEnemies).toHaveBeenCalled();
  });

  it('skips resize when size is unchanged and force=false', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    // First call sets the size
    ctrl.handleCanvasResize(true);
    vi.clearAllMocks();
    // Second call with same size should skip
    ctrl.handleCanvasResize(false);
    expect(mgr.renderService.renderEditor).not.toHaveBeenCalled();
  });

  it('clamps canvas size to min 128', () => {
    const mgr = makeManager();
    // Container has offsetWidth=320, so size should compute between 128-512
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleCanvasResize(true);
    expect(mgr.editorCanvas!.width).toBeGreaterThanOrEqual(128);
    expect(mgr.editorCanvas!.width).toBeLessThanOrEqual(512);
  });

  // ─── handleKey ──────────────────────────────────────────────────────────

  it('ignores already-defaultPrevented events', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    const ev = { key: 'Escape', defaultPrevented: true, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    ctrl.handleKey(ev);
    expect(mgr.npcService.clearSelection).not.toHaveBeenCalled();
  });

  it('Escape clears npc selection when placingNpc', () => {
    const mgr = makeManager({ placingNpc: true });
    const ctrl = new EditorInteractionController(mgr as any);
    const ev = makeKey('Escape');
    ctrl.handleKey(ev);
    expect(mgr.npcService.clearSelection).toHaveBeenCalled();
    expect((ev.preventDefault as any)).toHaveBeenCalled();
  });

  it('Escape clears npc when selectedNpcId is set', () => {
    const mgr = makeManager();
    (mgr as any).selectedNpcId = 'npc-1';
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('Escape'));
    expect(mgr.npcService.clearSelection).toHaveBeenCalled();
  });

  it('Escape deactivates enemy placement when placingEnemy', () => {
    const mgr = makeManager({ placingEnemy: true });
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('Escape'));
    expect(mgr.enemyService.deactivatePlacement).toHaveBeenCalled();
  });

  it('Escape toggles object placement when placingObjectType', () => {
    const mgr = makeManager({ placingObjectType: 'key' });
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('Escape'));
    expect(mgr.objectService.togglePlacement).toHaveBeenCalledWith('key', true);
  });

  it('Ctrl+Z calls undo', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('z', { ctrlKey: true }));
    expect(mgr.undo).toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z calls redo', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('z', { ctrlKey: true, shiftKey: true }));
    expect(mgr.redo).toHaveBeenCalled();
  });

  it('Ctrl+Y calls redo', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('y', { ctrlKey: true }));
    expect(mgr.redo).toHaveBeenCalled();
  });

  it('Meta+Z calls undo (macOS)', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('z', { metaKey: true }));
    expect(mgr.undo).toHaveBeenCalled();
  });

  it('other keys do nothing', () => {
    const mgr = makeManager();
    const ctrl = new EditorInteractionController(mgr as any);
    ctrl.handleKey(makeKey('Enter'));
    expect(mgr.undo).not.toHaveBeenCalled();
    expect(mgr.redo).not.toHaveBeenCalled();
  });
});


