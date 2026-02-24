import { describe, it, expect, beforeEach, vi } from 'vitest';

type EnemyDef = { type: string; aliases?: string[] };
type PlacedEnemy = { roomIndex: number; x?: number; y?: number; type?: string };

const mockEnemyDefs = vi.hoisted(() => ({ list: [] as EnemyDef[] }));
vi.mock('../../editor/modules/EditorConstants', () => ({
  EditorConstants: { get ENEMY_DEFINITIONS() { return mockEnemyDefs.list; } }
}));
vi.mock('../../runtime/domain/definitions/EnemyDefinitions', () => ({
  EnemyDefinitions: { getEnemyDefinition: vi.fn(() => null) }
}));
vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: { get: vi.fn(() => '') }
}));

import { EditorEnemyService } from '../../editor/modules/EditorEnemyService';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { TextResources } from '../../runtime/adapters/TextResources';

type EnemyServiceManager = ConstructorParameters<typeof EditorEnemyService>[0];
type EnemyManagerFixture = ReturnType<typeof makeManager>;

function asEnemyServiceManager(manager: EnemyManagerFixture): EnemyServiceManager {
  return manager as unknown as EnemyServiceManager;
}

function makeManager(stateOverrides: Record<string, unknown> = {}) {
  const canvas = document.createElement('canvas');
  const state: Record<string, unknown> = {
    selectedEnemyType: null, activeRoomIndex: 0,
    placingEnemy: false, placingNpc: false, placingObjectType: null,
    ...stateOverrides
  };
  return {
    state,
    selectedEnemyType: null as string | null,
    domCache: { editorCanvas: canvas },
    renderService: {
      renderEnemies: vi.fn(), renderEnemyCatalog: vi.fn(),
      renderWorldGrid: vi.fn(), renderEditor: vi.fn(),
    },
    npcService: { clearSelection: vi.fn() },
    objectService: { togglePlacement: vi.fn() },
    history: { pushCurrentState: vi.fn() },
    gameEngine: {
      getEnemyDefinitions: vi.fn((): PlacedEnemy[] => []),
      getActiveEnemies: vi.fn((): PlacedEnemy[] => []),
      addEnemy: vi.fn(() => 'enemy-new'),
      removeEnemy: vi.fn(),
      setEnemyVariable: vi.fn(() => true),
      renderer: { showCombatIndicator: vi.fn() },
      draw: vi.fn(),
    },
    renderEnemyCatalog: vi.fn(),
    updateJSON: vi.fn(),
  };
}

describe('EditorEnemyService', () => {
  let manager: ReturnType<typeof makeManager>;
  let service: EditorEnemyService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnemyDefs.list = [];
    manager = makeManager();
    service = new EditorEnemyService(asEnemyServiceManager(manager));
  });

  describe('activatePlacement', () => {
    it('returns early when no definition found', () => {
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(null);
      manager.selectedEnemyType = null;
      service.activatePlacement();
      expect(manager.state.placingEnemy).toBe(false);
    });

    it('returns early when already placing', () => {
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.selectedEnemyType = 'giant-rat';
      manager.state.placingEnemy = true;
      service.activatePlacement();
      expect(manager.npcService.clearSelection).not.toHaveBeenCalled();
    });

    it('clears npc and object selection when activating', () => {
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.selectedEnemyType = 'giant-rat';
      manager.state.placingObjectType = 'key';
      service.activatePlacement();
      expect(manager.npcService.clearSelection).toHaveBeenCalled();
      expect(manager.objectService.togglePlacement).toHaveBeenCalledWith('key', true);
    });

    it('sets cursor to crosshair and updates state', () => {
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.selectedEnemyType = 'giant-rat';
      service.activatePlacement();
      expect(manager.state.placingEnemy).toBe(true);
      expect(manager.state.placingNpc).toBe(false);
      expect(manager.state.placingObjectType).toBeNull();
      expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair');
    });
  });

  describe('deactivatePlacement', () => {
    it('returns early when not placing', () => {
      manager.state.placingEnemy = false;
      service.deactivatePlacement();
      expect(manager.domCache.editorCanvas.style.cursor).not.toBe('default');
    });

    it('resets placingEnemy to false', () => {
      manager.state.placingEnemy = true;
      service.deactivatePlacement();
      expect(manager.state.placingEnemy).toBe(false);
    });

    it('resets cursor to default when no other placement active', () => {
      manager.state.placingEnemy = true;
      manager.state.placingNpc = false;
      manager.state.placingObjectType = null;
      service.deactivatePlacement();
      expect(manager.domCache.editorCanvas.style.cursor).toBe('default');
    });

    it('does not reset cursor when another placement is active', () => {
      manager.state.placingEnemy = true;
      manager.state.placingNpc = true;
      manager.domCache.editorCanvas.style.cursor = 'crosshair';
      service.deactivatePlacement();
      expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair');
    });
  });

  describe('placeEnemyAt', () => {
    it('skips when tile already occupied', () => {
      manager.gameEngine.getEnemyDefinitions = vi.fn(() => [
        { roomIndex: 0, x: 2, y: 3, type: 'giant-rat' }
      ]);
      service.placeEnemyAt({ x: 2, y: 3 });
      expect(manager.gameEngine.addEnemy).not.toHaveBeenCalled();
    });

    it('shows feedback and skips when room is at limit of 6', () => {
      manager.gameEngine.getEnemyDefinitions = vi.fn(() => []);
      const sixEnemies = Array.from({ length: 6 }, () => ({ roomIndex: 0 }));
      manager.gameEngine.getActiveEnemies = vi.fn(() => sixEnemies);
      const showFeedback = vi.spyOn(service, 'showEnemyLimitFeedback').mockImplementation(() => {});
      service.placeEnemyAt({ x: 1, y: 1 });
      expect(showFeedback).toHaveBeenCalled();
      expect(manager.gameEngine.addEnemy).not.toHaveBeenCalled();
    });

    it('skips render chain when addEnemy returns null', () => {
      manager.gameEngine.addEnemy = vi.fn<() => string | null>(() => null);
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.state.selectedEnemyType = 'giant-rat';
      service.placeEnemyAt({ x: 1, y: 1 });
      expect(manager.renderService.renderEnemies).not.toHaveBeenCalled();
    });

    it('calls full render chain on success', () => {
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.selectedEnemyType = 'giant-rat';
      manager.state.selectedEnemyType = 'giant-rat';
      service.placeEnemyAt({ x: 1, y: 1 });
      expect(manager.renderService.renderEnemies).toHaveBeenCalled();
      expect(manager.renderService.renderEnemyCatalog).toHaveBeenCalled();
      expect(manager.renderService.renderWorldGrid).toHaveBeenCalled();
      expect(manager.renderService.renderEditor).toHaveBeenCalled();
      expect(manager.gameEngine.draw).toHaveBeenCalled();
      expect(manager.updateJSON).toHaveBeenCalled();
      expect(manager.history.pushCurrentState).toHaveBeenCalled();
    });
  });

  describe('removeEnemy', () => {
    it('calls gameEngine.removeEnemy and full render chain', () => {
      service.removeEnemy('enemy-1');
      expect(manager.gameEngine.removeEnemy).toHaveBeenCalledWith('enemy-1');
      expect(manager.renderService.renderEnemies).toHaveBeenCalled();
      expect(manager.renderService.renderEnemyCatalog).toHaveBeenCalled();
      expect(manager.renderService.renderWorldGrid).toHaveBeenCalled();
      expect(manager.renderService.renderEditor).toHaveBeenCalled();
      expect(manager.gameEngine.draw).toHaveBeenCalled();
      expect(manager.updateJSON).toHaveBeenCalled();
      expect(manager.history.pushCurrentState).toHaveBeenCalled();
    });
  });

  describe('handleEnemyVariableChange', () => {
    it('normalizes empty string variableId to null', () => {
      service.handleEnemyVariableChange('enemy-1', '   ');
      expect(manager.gameEngine.setEnemyVariable).toHaveBeenCalledWith('enemy-1', null);
    });

    it('normalizes null variableId to null', () => {
      service.handleEnemyVariableChange('enemy-1', null);
      expect(manager.gameEngine.setEnemyVariable).toHaveBeenCalledWith('enemy-1', null);
    });

    it('does not render when setEnemyVariable returns false', () => {
      manager.gameEngine.setEnemyVariable = vi.fn(() => false);
      service.handleEnemyVariableChange('enemy-1', 'var-1');
      expect(manager.renderService.renderEnemies).not.toHaveBeenCalled();
    });

    it('calls render chain on success', () => {
      service.handleEnemyVariableChange('enemy-1', 'var-1');
      expect(manager.renderService.renderEnemies).toHaveBeenCalled();
      expect(manager.renderService.renderWorldGrid).toHaveBeenCalled();
      expect(manager.renderService.renderEditor).toHaveBeenCalled();
      expect(manager.updateJSON).toHaveBeenCalled();
      expect(manager.history.pushCurrentState).toHaveBeenCalled();
    });
  });

  describe('selectEnemyType', () => {
    it('returns early when no definition found', () => {
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(null);
      service.selectEnemyType('unknown-type');
      expect(manager.renderEnemyCatalog).not.toHaveBeenCalled();
    });

    it('does not call renderEnemyCatalog when same type already selected', () => {
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.selectedEnemyType = 'giant-rat';
      manager.state.selectedEnemyType = 'giant-rat';
      service.selectEnemyType('giant-rat');
      expect(manager.renderEnemyCatalog).not.toHaveBeenCalled();
    });

    it('updates selectedEnemyType and calls renderEnemyCatalog for new type', () => {
      const def: EnemyDef = { type: 'wolf' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      manager.selectedEnemyType = null;
      service.selectEnemyType('wolf');
      expect(manager.selectedEnemyType).toBe('wolf');
      expect(manager.renderEnemyCatalog).toHaveBeenCalled();
    });

    it('calls activatePlacement after type update', () => {
      const def: EnemyDef = { type: 'wolf' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      const activate = vi.spyOn(service, 'activatePlacement');
      manager.selectedEnemyType = null;
      service.selectEnemyType('wolf');
      expect(activate).toHaveBeenCalled();
    });
  });

  describe('clearSelection', () => {
    it('returns false when nothing is selected', () => {
      manager.selectedEnemyType = null;
      manager.state.placingEnemy = false;
      const result = service.clearSelection();
      expect(result).toBe(false);
    });

    it('clears selectedEnemyType', () => {
      manager.selectedEnemyType = 'giant-rat';
      service.clearSelection();
      expect(manager.selectedEnemyType).toBeNull();
    });

    it('calls renderEnemyCatalog when render is true (default)', () => {
      manager.selectedEnemyType = 'giant-rat';
      service.clearSelection({ render: true });
      expect(manager.renderEnemyCatalog).toHaveBeenCalled();
    });

    it('skips renderEnemyCatalog when render is false', () => {
      manager.selectedEnemyType = 'giant-rat';
      service.clearSelection({ render: false });
      expect(manager.renderEnemyCatalog).not.toHaveBeenCalled();
    });
  });

  describe('getEnemyDefinition', () => {
    it('returns definition from EnemyDefinitions when found', () => {
      const def: EnemyDef = { type: 'giant-rat' };
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(def);
      const result = service.getEnemyDefinition('giant-rat');
      expect(result).toBe(def);
    });

    it('falls back to ENEMY_DEFINITIONS list by type', () => {
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(null);
      const fallbackDef: EnemyDef = { type: 'wolf' };
      mockEnemyDefs.list = [fallbackDef];
      const result = service.getEnemyDefinition('wolf');
      expect(result).toBe(fallbackDef);
    });

    it('falls back to aliases when type not found directly', () => {
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(null);
      const fallbackDef: EnemyDef = { type: 'wolf', aliases: ['grey-wolf'] };
      mockEnemyDefs.list = [fallbackDef];
      const result = service.getEnemyDefinition('grey-wolf');
      expect(result).toBe(fallbackDef);
    });

    it('returns null when nothing found', () => {
      vi.mocked(EnemyDefinitions.getEnemyDefinition).mockReturnValue(null);
      mockEnemyDefs.list = [];
      const result = service.getEnemyDefinition('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('showEnemyLimitFeedback', () => {
    it('uses DOM indicator when container exists', () => {
      const container = document.createElement('div');
      container.className = 'editor-map-wrapper';
      document.body.appendChild(container);
      vi.mocked(TextResources.get).mockReturnValue('Max enemies reached');

      service.showEnemyLimitFeedback();

      const indicator = container.querySelector('.combat-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toBe('Max enemies reached');
      document.body.removeChild(container);
    });

    it('falls back to renderer.showCombatIndicator when no container', () => {
      document.querySelectorAll('.editor-map-wrapper').forEach(el => el.remove());
      vi.mocked(TextResources.get).mockReturnValue('');

      service.showEnemyLimitFeedback();

      expect(manager.gameEngine.renderer.showCombatIndicator).toHaveBeenCalledWith(
        'Max enemies reached',
        { duration: 700 }
      );
    });
  });

  describe('getEnemyLimitMessage', () => {
    it('returns TextResources value when set', () => {
      vi.mocked(TextResources.get).mockReturnValue('Limite atingido');
      expect(service.getEnemyLimitMessage()).toBe('Limite atingido');
    });

    it('returns default string when TextResources returns empty', () => {
      vi.mocked(TextResources.get).mockReturnValue('');
      expect(service.getEnemyLimitMessage()).toBe('Max enemies reached');
    });
  });
});


