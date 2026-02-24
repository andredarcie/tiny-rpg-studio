/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockObjDefs = vi.hoisted(() => ({ list: [] as any[] }));
vi.mock('../../editor/modules/EditorConstants', () => ({
  EditorConstants: { get OBJECT_DEFINITIONS() { return mockObjDefs.list; } }
}));
vi.mock('../../runtime/domain/services/ItemCatalog', () => ({
  itemCatalog: { getPlaceableTypes: vi.fn(() => ['key', 'door', 'switch']) }
}));

import { EditorObjectService } from '../../editor/modules/EditorObjectService';
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';

function makeManager(stateOverrides: Record<string, unknown> = {}) {
  const canvas = document.createElement('canvas');
  const buttons: HTMLButtonElement[] = [];
  const state: Record<string, unknown> = {
    selectedObjectType: null, placingObjectType: null,
    placingNpc: false, placingEnemy: false,
    objectCategoryFilter: 'all', playerEndTextUpdateTimer: null,
    ...stateOverrides
  };
  return {
    state,
    selectedObjectType: null as string | null,
    domCache: { editorCanvas: canvas, objectCategoryButtons: buttons },
    renderService: {
      renderObjects: vi.fn(), renderWorldGrid: vi.fn(),
      renderEditor: vi.fn(), renderObjectCatalog: vi.fn(),
    },
    npcService: { clearSelection: vi.fn() },
    enemyService: { deactivatePlacement: vi.fn() },
    history: { pushCurrentState: vi.fn() },
    gameEngine: {
      setObjectPosition: vi.fn(() => ({ type: 'key' })),
      removeObject: vi.fn(),
      setPlayerEndText: vi.fn(),
      draw: vi.fn(),
      gameState: { objectManager: { generateObjectId: vi.fn() } },
    },
    renderObjectCatalog: vi.fn(),
    updateJSON: vi.fn(),
  };
}

describe('EditorObjectService', () => {
  let manager: ReturnType<typeof makeManager>;
  let service: EditorObjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockObjDefs.list = [];
    manager = makeManager();
    service = new EditorObjectService(manager as any);
  });

  describe('normalizeType', () => {
    it('returns null for null input', () => {
      expect(service.normalizeType(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.normalizeType('')).toBeNull();
    });

    it('returns type when found in OBJECT_DEFINITIONS', () => {
      mockObjDefs.list = [{ type: 'key' }];
      expect(service.normalizeType('key')).toBe('key');
    });

    it('falls back to itemCatalog placeableTypes when not in definitions', () => {
      mockObjDefs.list = [];
      vi.mocked(itemCatalog.getPlaceableTypes).mockReturnValue(['key', 'door', 'switch']);
      expect(service.normalizeType('door')).toBe('door');
    });

    it('returns null for unknown type not in definitions or catalog', () => {
      mockObjDefs.list = [];
      vi.mocked(itemCatalog.getPlaceableTypes).mockReturnValue(['key', 'door', 'switch']);
      expect(service.normalizeType('unknown-thing')).toBeNull();
    });
  });

  describe('togglePlacement', () => {
    it('forceOff when not placing returns early', () => {
      manager.state.placingObjectType = null;
      service.togglePlacement(null, true);
      expect(manager.renderObjectCatalog).not.toHaveBeenCalled();
    });

    it('forceOff when placing clears state', () => {
      manager.state.placingObjectType = 'key';
      service.togglePlacement('key', true);
      expect(manager.state.placingObjectType).toBeNull();
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
    });

    it('same type deactivates placement', () => {
      mockObjDefs.list = [{ type: 'key' }];
      manager.state.placingObjectType = 'key';
      service.togglePlacement('key');
      expect(manager.state.placingObjectType).toBeNull();
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
    });

    it('new type calls selectObjectType', () => {
      mockObjDefs.list = [{ type: 'door' }];
      manager.state.placingObjectType = null;
      const selectSpy = vi.spyOn(service, 'selectObjectType');
      service.togglePlacement('door');
      expect(selectSpy).toHaveBeenCalledWith('door');
    });
  });

  describe('placeObjectAt', () => {
    it('skips when setObjectPosition returns null', () => {
      manager.gameEngine.setObjectPosition = vi.fn(() => null as any);
      service.placeObjectAt('key', { x: 1, y: 1 }, 0);
      expect(manager.renderService.renderObjects).not.toHaveBeenCalled();
    });

    it('calls full render chain on success', () => {
      service.placeObjectAt('key', { x: 1, y: 1 }, 0);
      expect(manager.renderService.renderObjects).toHaveBeenCalled();
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
      expect(manager.renderService.renderWorldGrid).toHaveBeenCalled();
      expect(manager.renderService.renderEditor).toHaveBeenCalled();
      expect(manager.gameEngine.draw).toHaveBeenCalled();
      expect(manager.updateJSON).toHaveBeenCalled();
      expect(manager.history.pushCurrentState).toHaveBeenCalled();
    });
  });

  describe('removeObject', () => {
    it('clears placement when type matches current placingObjectType', () => {
      manager.state.placingObjectType = 'key';
      const toggleSpy = vi.spyOn(service, 'togglePlacement');
      service.removeObject('key', 0);
      expect(toggleSpy).toHaveBeenCalledWith('key', true);
    });

    it('calls render chain', () => {
      service.removeObject('key', 0);
      expect(manager.gameEngine.removeObject).toHaveBeenCalledWith('key', 0);
      expect(manager.renderService.renderObjects).toHaveBeenCalled();
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
      expect(manager.renderService.renderWorldGrid).toHaveBeenCalled();
      expect(manager.renderService.renderEditor).toHaveBeenCalled();
      expect(manager.gameEngine.draw).toHaveBeenCalled();
      expect(manager.updateJSON).toHaveBeenCalled();
      expect(manager.history.pushCurrentState).toHaveBeenCalled();
    });
  });

  describe('selectObjectType', () => {
    it('returns early when normalizeType returns null', () => {
      service.selectObjectType(null);
      expect(manager.selectedObjectType).toBeNull();
    });

    it('sets selectedObjectType on manager', () => {
      mockObjDefs.list = [{ type: 'key' }];
      service.selectObjectType('key');
      expect(manager.selectedObjectType).toBe('key');
    });

    it('calls activatePlacement with normalized type', () => {
      mockObjDefs.list = [{ type: 'key' }];
      const activateSpy = vi.spyOn(service, 'activatePlacement');
      service.selectObjectType('key');
      expect(activateSpy).toHaveBeenCalledWith('key');
    });
  });

  describe('activatePlacement', () => {
    it('returns early when no type resolved', () => {
      service.activatePlacement(null);
      expect(manager.npcService.clearSelection).not.toHaveBeenCalled();
    });

    it('clears npc selection', () => {
      mockObjDefs.list = [{ type: 'key' }];
      service.activatePlacement('key');
      expect(manager.npcService.clearSelection).toHaveBeenCalled();
    });

    it('deactivates enemy placement when active', () => {
      mockObjDefs.list = [{ type: 'key' }];
      manager.state.placingEnemy = true;
      service.activatePlacement('key');
      expect(manager.enemyService.deactivatePlacement).toHaveBeenCalled();
    });

    it('sets cursor to crosshair and placingObjectType', () => {
      mockObjDefs.list = [{ type: 'key' }];
      service.activatePlacement('key');
      expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair');
      expect(manager.state.placingObjectType).toBe('key');
    });

    it('calls renderObjectCatalog', () => {
      mockObjDefs.list = [{ type: 'key' }];
      service.activatePlacement('key');
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
    });
  });

  describe('clearSelection', () => {
    it('returns false when nothing selected', () => {
      manager.selectedObjectType = null;
      manager.state.placingObjectType = null;
      expect(service.clearSelection()).toBe(false);
    });

    it('clears state and selectedObjectType', () => {
      manager.selectedObjectType = 'key';
      service.clearSelection();
      expect(manager.selectedObjectType).toBeNull();
      expect(manager.state.placingObjectType).toBeNull();
    });

    it('calls renderObjectCatalog when render is true (default)', () => {
      manager.selectedObjectType = 'key';
      service.clearSelection({ render: true });
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
    });

    it('skips renderObjectCatalog when render is false', () => {
      manager.selectedObjectType = 'key';
      service.clearSelection({ render: false });
      expect(manager.renderObjectCatalog).not.toHaveBeenCalled();
    });
  });

  describe('updatePlayerEndText', () => {
    it('calls setPlayerEndText and updateJSON', () => {
      service.updatePlayerEndText(0, 'The end');
      expect(manager.gameEngine.setPlayerEndText).toHaveBeenCalledWith(0, 'The end');
      expect(manager.updateJSON).toHaveBeenCalled();
    });

    it('schedules a timer for history push', () => {
      vi.useFakeTimers();
      service.updatePlayerEndText(0, 'The end');
      expect(manager.state.playerEndTextUpdateTimer).not.toBeNull();
      vi.runAllTimers();
      expect(manager.history.pushCurrentState).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('setCategoryFilter', () => {
    it('returns early when category is empty string', () => {
      service.setCategoryFilter('');
      expect(manager.renderObjectCatalog).not.toHaveBeenCalled();
    });

    it('sets objectCategoryFilter on state', () => {
      service.setCategoryFilter('weapons');
      expect(manager.state.objectCategoryFilter).toBe('weapons');
    });

    it('calls renderObjectCatalog after setting filter', () => {
      service.setCategoryFilter('weapons');
      expect(manager.renderObjectCatalog).toHaveBeenCalled();
    });
  });

  describe('updateCategoryButtons', () => {
    it('does nothing when no buttons in array', () => {
      manager.domCache.objectCategoryButtons = [];
      expect(() => service.updateCategoryButtons()).not.toThrow();
    });

    it('toggles active class and aria-pressed based on current filter', () => {
      manager.state.objectCategoryFilter = 'weapons';
      const btn1 = document.createElement('button');
      btn1.dataset.objectCategoryFilter = 'weapons';
      const btn2 = document.createElement('button');
      btn2.dataset.objectCategoryFilter = 'armor';
      manager.domCache.objectCategoryButtons = [btn1, btn2];

      service.updateCategoryButtons();

      expect(btn1.classList.contains('active')).toBe(true);
      expect(btn1.getAttribute('aria-pressed')).toBe('true');
      expect(btn2.classList.contains('active')).toBe(false);
      expect(btn2.getAttribute('aria-pressed')).toBe('false');
    });
  });
});


