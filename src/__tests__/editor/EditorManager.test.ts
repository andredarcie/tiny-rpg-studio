/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../editor/modules/EditorDomCache', () => ({
  EditorDomCache: class { editorCanvas = null; }
}));
vi.mock('../../editor/modules/EditorHistoryManager', () => ({
  EditorHistoryManager: class { pushCurrentState = vi.fn(); undo = vi.fn(); redo = vi.fn(); snapshot = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorRenderService', () => ({
  EditorRenderService: class {
    renderTileList = vi.fn(); renderWorldGrid = vi.fn(); renderNpcs = vi.fn();
    renderEnemyCatalog = vi.fn(); renderEnemies = vi.fn(); renderObjectCatalog = vi.fn();
    renderObjects = vi.fn(); renderEditor = vi.fn(); updateSelectedTilePreview = vi.fn();
  }
}));
vi.mock('../../editor/modules/EditorPaletteService', () => ({
  EditorPaletteService: class { initialize = vi.fn(); renderPaletteGrid = vi.fn(); syncPaletteState = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorNavIcons', () => ({
  EditorNavIcons: class { renderAll = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorTileService', () => ({
  EditorTileService: class {
    clearSelection = vi.fn(() => false);
    startPaint = vi.fn(); continuePaint = vi.fn(); finishPaint = vi.fn();
  }
}));
vi.mock('../../editor/modules/EditorShareService', () => ({
  EditorShareService: class {}
}));
vi.mock('../../editor/modules/EditorNpcService', () => ({
  EditorNpcService: class {
    clearSelection = vi.fn(() => false); addNpc = vi.fn(); removeSelectedNpc = vi.fn();
    updateNpcSelection = vi.fn(); updateNpcText = vi.fn(); updateNpcConditionalText = vi.fn();
    handleConditionVariableChange = vi.fn(); handleRewardVariableChange = vi.fn();
    handleConditionalRewardVariableChange = vi.fn();
  }
}));
vi.mock('../../editor/modules/EditorEnemyService', () => ({
  EditorEnemyService: class { clearSelection = vi.fn(() => false); removeEnemy = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorObjectService', () => ({
  EditorObjectService: class { clearSelection = vi.fn(() => false); removeObject = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorVariableService', () => ({
  EditorVariableService: class { toggle = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorWorldService', () => ({
  EditorWorldService: class { setActiveRoom = vi.fn(); }
}));
vi.mock('../../editor/modules/EditorShareService', () => ({
  EditorShareService: class {
    generateShareableUrl = vi.fn(() => Promise.resolve());
    saveGame = vi.fn();
    loadGameFile = vi.fn();
  }
}));
vi.mock('../../editor/manager/EditorEventBinder', () => ({
  EditorEventBinder: class { bind = vi.fn(); }
}));
vi.mock('../../editor/manager/EditorUIController', () => ({
  EditorUIController: class {
    syncUI = vi.fn(); updateMobilePanels = vi.fn(); handleLanguageChange = vi.fn();
    toggleVariablePanel = vi.fn(); toggleSkillPanel = vi.fn(); toggleTestPanel = vi.fn();
    setTestStartLevel = vi.fn(); setTestSkills = vi.fn(); setGodMode = vi.fn();
    setActiveMobilePanel = vi.fn(); updateGameMetadata = vi.fn(); updateJSON = vi.fn();
    refreshNpcLocalizedText = vi.fn();
  }
}));
vi.mock('../../editor/manager/EditorInteractionController', () => ({
  EditorInteractionController: class { handleCanvasResize = vi.fn(); handleKey = vi.fn(); }
}));

import { EditorManager } from '../../editor/EditorManager';

function makeGameEngine(overrides: Record<string, unknown> = {}) {
  return {
    tileManager: { ensureDefaultTiles: vi.fn() },
    getTiles: vi.fn(() => [{ id: 'tile-1' }]),
    getGame: vi.fn(() => ({ start: { roomIndex: 0 }, rooms: [{}] })),
    npcManager: { ensureDefaultNPCs: vi.fn() },
    setCustomPalette: vi.fn(),
    resetPaletteToDefault: vi.fn(),
    importGameData: vi.fn(),
    draw: vi.fn(),
    getSprites: vi.fn(() => []),
    ...overrides,
  } as any;
}

describe('EditorManager', () => {
  let gameEngine: ReturnType<typeof makeGameEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    gameEngine = makeGameEngine();
  });

  it('instantiates without throwing', () => {
    expect(() => new EditorManager(gameEngine)).not.toThrow();
  });

  it('exposes gameEngine reference', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.gameEngine).toBe(gameEngine);
  });

  it('calls ensureDefaultTiles during initialize', () => {
    new EditorManager(gameEngine);
    expect(gameEngine.tileManager.ensureDefaultTiles).toHaveBeenCalledTimes(1);
  });

  it('calls ensureDefaultNPCs during initialize', () => {
    new EditorManager(gameEngine);
    expect(gameEngine.npcManager.ensureDefaultNPCs).toHaveBeenCalledTimes(1);
  });

  it('calls paletteService.initialize during initialize', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.paletteService.initialize).toHaveBeenCalledTimes(1);
  });

  it('calls eventBinder.bind during construction', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.eventBinder.bind).toHaveBeenCalledTimes(1);
  });

  it('calls history.pushCurrentState during initialize', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.history.pushCurrentState).toHaveBeenCalledTimes(1);
  });

  it('sets selectedTileId from first tile returned by getTiles', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.selectedTileId).toBe('tile-1');
  });

  it('selectedTileId stays null when getTiles returns empty array', () => {
    gameEngine.getTiles.mockReturnValue([]);
    const mgr = new EditorManager(gameEngine);
    expect(mgr.selectedTileId).toBeNull();
  });

  it('adds language-changed event listener to document', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    new EditorManager(gameEngine);
    expect(spy).toHaveBeenCalledWith('language-changed', expect.any(Function));
  });

  it('renderAll delegates to all renderService methods', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.renderAll();
    expect(mgr.renderService.renderTileList).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderWorldGrid).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderNpcs).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderEnemyCatalog).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderEnemies).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderObjectCatalog).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderObjects).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.renderEditor).toHaveBeenCalledTimes(1);
    expect(mgr.renderService.updateSelectedTilePreview).toHaveBeenCalledTimes(1);
  });

  it('dom getter returns domCache', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.dom).toBe(mgr.domCache);
  });

  it('historyManager getter returns history', () => {
    const mgr = new EditorManager(gameEngine);
    expect(mgr.historyManager).toBe(mgr.history);
  });

  it('state accessors get and set correctly', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.placingNpc = true;
    expect(mgr.placingNpc).toBe(true);
    mgr.placingEnemy = true;
    expect(mgr.placingEnemy).toBe(true);
    mgr.mapPainting = true;
    expect(mgr.mapPainting).toBe(true);
    mgr.selectedObjectType = 'key';
    expect(mgr.selectedObjectType).toBe('key');
    mgr.selectedEnemyType = 'goblin';
    expect(mgr.selectedEnemyType).toBe('goblin');
    mgr.activeRoomIndex = 2;
    expect(mgr.activeRoomIndex).toBe(2);
  });

  it('desselectAllAndRender returns false when nothing was selected', () => {
    const mgr = new EditorManager(gameEngine);
    const result = mgr.desselectAllAndRender();
    expect(result).toBe(false);
  });

  it('desselectAllAndRender renders affected sections when something clears', () => {
    const mgr = new EditorManager(gameEngine);
    (mgr.tileService.clearSelection as any).mockReturnValue(true);
    (mgr.npcService.clearSelection as any).mockReturnValue(true);
    vi.clearAllMocks();
    const result = mgr.desselectAllAndRender();
    expect(result).toBe(true);
    expect(mgr.renderService.renderTileList).toHaveBeenCalled();
    expect(mgr.renderService.renderNpcs).toHaveBeenCalled();
  });

  it('delegated render methods each call through to renderService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.renderEditor();
    expect(mgr.renderService.renderEditor).toHaveBeenCalledTimes(1);
    mgr.renderTileList();
    expect(mgr.renderService.renderTileList).toHaveBeenCalledTimes(1);
    mgr.renderNpcs();
    expect(mgr.renderService.renderNpcs).toHaveBeenCalledTimes(1);
    mgr.renderEnemies();
    expect(mgr.renderService.renderEnemies).toHaveBeenCalledTimes(1);
    mgr.renderEnemyCatalog();
    expect(mgr.renderService.renderEnemyCatalog).toHaveBeenCalledTimes(1);
    mgr.renderObjectCatalog();
    expect(mgr.renderService.renderObjectCatalog).toHaveBeenCalledTimes(1);
    mgr.renderObjects();
    expect(mgr.renderService.renderObjects).toHaveBeenCalledTimes(1);
    mgr.updateSelectedTilePreview();
    expect(mgr.renderService.updateSelectedTilePreview).toHaveBeenCalledTimes(1);
  });

  it('activeRoomIndex is clamped to valid room range', () => {
    gameEngine.getGame.mockReturnValue({ start: { roomIndex: 99 }, rooms: [{}, {}] });
    const mgr = new EditorManager(gameEngine);
    expect(mgr.activeRoomIndex).toBe(1); // clamped to rooms.length-1
  });

  it('activeRoomIndex defaults to 0 when start is missing', () => {
    gameEngine.getGame.mockReturnValue({ rooms: [{}] });
    const mgr = new EditorManager(gameEngine);
    expect(mgr.activeRoomIndex).toBe(0);
  });

  // ─── History delegation ───────────────────────────────────────────────────

  it('undo delegates to history.undo', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.undo();
    expect(mgr.history.undo).toHaveBeenCalledTimes(1);
  });

  it('redo delegates to history.redo', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.redo();
    expect(mgr.history.redo).toHaveBeenCalledTimes(1);
  });

  it('pushHistory delegates to history.pushCurrentState', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.pushHistory();
    expect(mgr.history.pushCurrentState).toHaveBeenCalledTimes(1);
  });

  // ─── UI controller delegation ─────────────────────────────────────────────

  it('toggleVariablePanel delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.toggleVariablePanel();
    expect(mgr.uiController.toggleVariablePanel).toHaveBeenCalledTimes(1);
  });

  it('toggleSkillPanel delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.toggleSkillPanel();
    expect(mgr.uiController.toggleSkillPanel).toHaveBeenCalledTimes(1);
  });

  it('toggleTestPanel delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.toggleTestPanel();
    expect(mgr.uiController.toggleTestPanel).toHaveBeenCalledTimes(1);
  });

  it('setTestStartLevel delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.setTestStartLevel(3);
    expect(mgr.uiController.setTestStartLevel).toHaveBeenCalledWith(3);
  });

  it('setTestSkills delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.setTestSkills(['heal', 'fire']);
    expect(mgr.uiController.setTestSkills).toHaveBeenCalledWith(['heal', 'fire']);
  });

  it('setGodMode delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.setGodMode(true);
    expect(mgr.uiController.setGodMode).toHaveBeenCalledWith(true);
  });

  it('setActiveMobilePanel delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.setActiveMobilePanel('tiles');
    expect(mgr.uiController.setActiveMobilePanel).toHaveBeenCalledWith('tiles');
  });

  it('updateGameMetadata delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.updateGameMetadata();
    expect(mgr.uiController.updateGameMetadata).toHaveBeenCalledTimes(1);
  });

  it('updateJSON delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.updateJSON();
    expect(mgr.uiController.updateJSON).toHaveBeenCalledTimes(1);
  });

  it('handleLanguageChange delegates to uiController and paletteService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.handleLanguageChange();
    expect(mgr.uiController.handleLanguageChange).toHaveBeenCalledTimes(1);
    expect(mgr.paletteService.syncPaletteState).toHaveBeenCalledTimes(1);
  });

  it('refreshNpcLocalizedText delegates to uiController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.refreshNpcLocalizedText();
    expect(mgr.uiController.refreshNpcLocalizedText).toHaveBeenCalledTimes(1);
  });

  // ─── Interaction controller delegation ───────────────────────────────────

  it('handleKey delegates to interactionController', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    mgr.handleKey(ev);
    expect(mgr.interactionController.handleKey).toHaveBeenCalledWith(ev);
  });

  it('renderWorldGrid delegates to renderService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.renderWorldGrid();
    expect(mgr.renderService.renderWorldGrid).toHaveBeenCalledTimes(1);
  });

  // ─── NPC delegation ───────────────────────────────────────────────────────

  it('addNPC delegates to npcService.addNpc', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.addNPC();
    expect(mgr.npcService.addNpc).toHaveBeenCalledTimes(1);
  });

  it('removeSelectedNpc delegates to npcService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.removeSelectedNpc();
    expect(mgr.npcService.removeSelectedNpc).toHaveBeenCalledTimes(1);
  });

  it('updateNpcSelection delegates with current selectedNpcType and selectedNpcId', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.selectedNpcType = 'mage';
    mgr.selectedNpcId = 'npc-5';
    vi.clearAllMocks();
    mgr.updateNpcSelection();
    expect(mgr.npcService.updateNpcSelection).toHaveBeenCalledWith('mage', 'npc-5');
  });

  it('updateNpcText returns early when dom.npcText is missing', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    expect(() => mgr.updateNpcText()).not.toThrow();
    expect(mgr.npcService.updateNpcText).not.toHaveBeenCalled();
  });

  it('updateNpcConditionalText returns early when dom.npcConditionalText is missing', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    expect(() => mgr.updateNpcConditionalText()).not.toThrow();
    expect(mgr.npcService.updateNpcConditionalText).not.toHaveBeenCalled();
  });

  it('handleNpcConditionVariableChange returns early when dom element missing', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    expect(() => mgr.handleNpcConditionVariableChange()).not.toThrow();
  });

  it('handleNpcRewardVariableChange returns early when dom element missing', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    expect(() => mgr.handleNpcRewardVariableChange()).not.toThrow();
  });

  it('handleNpcConditionalRewardVariableChange returns early when dom element missing', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    expect(() => mgr.handleNpcConditionalRewardVariableChange()).not.toThrow();
  });

  // ─── Enemy/Object delegation ──────────────────────────────────────────────

  it('removeEnemy delegates to enemyService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.removeEnemy('enemy-1');
    expect(mgr.enemyService.removeEnemy).toHaveBeenCalledWith('enemy-1');
  });

  it('removeObject delegates to objectService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.removeObject('chest', 0);
    expect(mgr.objectService.removeObject).toHaveBeenCalledWith('chest', 0);
  });

  it('toggleVariableDefault delegates to variableService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.toggleVariableDefault('var-1');
    expect(mgr.variableService.toggle).toHaveBeenCalledWith('var-1', null);
  });

  it('toggleVariableDefault passes nextValue to variableService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.toggleVariableDefault('var-2', true);
    expect(mgr.variableService.toggle).toHaveBeenCalledWith('var-2', true);
  });

  // ─── World delegation ─────────────────────────────────────────────────────

  it('setActiveRoom delegates to worldService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.setActiveRoom(2);
    expect(mgr.worldService.setActiveRoom).toHaveBeenCalledWith(2);
  });

  // ─── Share delegation ─────────────────────────────────────────────────────

  it('generateShareableUrl delegates to shareService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.generateShareableUrl();
    expect(mgr.shareService.generateShareableUrl).toHaveBeenCalledTimes(1);
  });

  it('saveGame delegates to shareService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.saveGame();
    expect(mgr.shareService.saveGame).toHaveBeenCalledTimes(1);
  });

  it('loadGameFile delegates to shareService', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    const ev = new Event('change');
    mgr.loadGameFile(ev);
    expect(mgr.shareService.loadGameFile).toHaveBeenCalledWith(ev);
  });

  // ─── Tile painting delegation ─────────────────────────────────────────────

  it('startMapPaint delegates to tileService.startPaint', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    const ev = new Event('pointerdown') as PointerEvent;
    mgr.startMapPaint(ev);
    expect(mgr.tileService.startPaint).toHaveBeenCalledWith(ev);
  });

  it('continueMapPaint delegates to tileService.continuePaint', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    const ev = new Event('pointermove') as PointerEvent;
    mgr.continueMapPaint(ev);
    expect(mgr.tileService.continuePaint).toHaveBeenCalledWith(ev);
  });

  it('finishMapPaint delegates to tileService.finishPaint', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    const ev = new Event('pointerup') as PointerEvent;
    mgr.finishMapPaint(ev);
    expect(mgr.tileService.finishPaint).toHaveBeenCalledWith(ev);
  });

  // ─── desselectAllAndRender – enemy and object paths ───────────────────────

  it('desselectAllAndRender renders enemy catalog when enemy cleared', () => {
    const mgr = new EditorManager(gameEngine);
    (mgr.enemyService.clearSelection as any).mockReturnValue(true);
    vi.clearAllMocks();
    mgr.desselectAllAndRender();
    expect(mgr.renderService.renderEnemyCatalog).toHaveBeenCalled();
  });

  it('desselectAllAndRender renders object catalog when object cleared', () => {
    const mgr = new EditorManager(gameEngine);
    (mgr.objectService.clearSelection as any).mockReturnValue(true);
    vi.clearAllMocks();
    mgr.desselectAllAndRender();
    expect(mgr.renderService.renderObjectCatalog).toHaveBeenCalled();
  });

  // ─── State accessors ──────────────────────────────────────────────────────

  it('selectedNpcId getter and setter', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.selectedNpcId = 'npc-abc';
    expect(mgr.selectedNpcId).toBe('npc-abc');
  });

  it('selectedNpcType getter and setter', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.selectedNpcType = 'healer';
    expect(mgr.selectedNpcType).toBe('healer');
  });

  it('placingObjectType getter and setter', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.placingObjectType = 'chest';
    expect(mgr.placingObjectType).toBe('chest');
  });

  // ─── restore() ────────────────────────────────────────────────────────────

  it('restore calls importGameData and draw', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.restore({ foo: 'bar' });
    expect(gameEngine.importGameData).toHaveBeenCalledWith({ foo: 'bar' });
    expect(gameEngine.draw).toHaveBeenCalled();
  });

  it('restore calls renderAll', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.restore({});
    expect(mgr.renderService.renderTileList).toHaveBeenCalled();
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
  });

  it('restore pushes history by default', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.restore({});
    expect(mgr.history.pushCurrentState).toHaveBeenCalledTimes(1);
  });

  it('restore with skipHistory does not push history', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.restore({}, { skipHistory: true });
    expect(mgr.history.pushCurrentState).not.toHaveBeenCalled();
  });

  it('restore with customPalette calls setCustomPalette', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.restore({ customPalette: ['#ff0000', '#00ff00'] });
    expect(gameEngine.setCustomPalette).toHaveBeenCalledWith(['#ff0000', '#00ff00']);
    expect(gameEngine.resetPaletteToDefault).not.toHaveBeenCalled();
  });

  it('restore without customPalette calls resetPaletteToDefault', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.restore({});
    expect(gameEngine.resetPaletteToDefault).toHaveBeenCalledTimes(1);
  });

  it('restore resets selectedTileId when current tile not found in new tiles', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.selectedTileId = 'non-existent';
    vi.clearAllMocks();
    mgr.restore({});
    expect(mgr.selectedTileId).toBe('tile-1');
  });

  it('restore clears selectedNpcId when npc not found in sprites', () => {
    const mgr = new EditorManager(gameEngine);
    mgr.selectedNpcId = 'npc-missing';
    vi.clearAllMocks();
    mgr.restore({});
    expect(mgr.selectedNpcId).toBeNull();
    expect(mgr.placingNpc).toBe(false);
  });

  // ─── createNewGame() ──────────────────────────────────────────────────────

  it('createNewGame calls restore with a valid game structure', () => {
    const mgr = new EditorManager(gameEngine);
    vi.clearAllMocks();
    mgr.createNewGame();
    expect(gameEngine.importGameData).toHaveBeenCalled();
    const data = (gameEngine.importGameData as any).mock.calls[0][0];
    expect(data.title).toBe('Novo Jogo');
    expect(data.rooms).toHaveLength(1);
    expect(data.sprites).toEqual([]);
  });
});


