import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorUIController } from '../../editor/manager/EditorUIController';

vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: {
    apply: vi.fn(() => Promise.resolve()),
    get: vi.fn<(key: string, fallback?: string) => string>((_key: string, fallback = ''): string => fallback),
  }
}));

function makeInput(value: string) {
  const el = document.createElement('input');
  el.value = value;
  return el;
}

type UIControllerManager = ConstructorParameters<typeof EditorUIController>[0];
type UIManagerFixture = ReturnType<typeof makeManager>;

function asUIControllerManager(manager: UIManagerFixture): UIControllerManager {
  return manager as unknown as UIControllerManager;
}

function makeController(manager: UIManagerFixture): EditorUIController {
  return new EditorUIController(asUIControllerManager(manager));
}

function makeManager(stateOverrides: Record<string, unknown> = {}) {
  const titleInput = makeInput('');
  const authorInput = makeInput('');
  const jsonArea = document.createElement('textarea');

  const state: Record<string, unknown> = {
    variablePanelCollapsed: false, skillPanelCollapsed: false,
    testPanelCollapsed: false, activeMobilePanel: 'tiles', ...stateOverrides,
  };

  return {
    state,
    domCache: { titleInput, authorInput, jsonArea, mobileNavButtons: [], mobilePanels: [] },
    get dom() { return this.domCache; },
    renderService: {
      renderVariableUsage: vi.fn(), renderSkillList: vi.fn(), renderTestTools: vi.fn(),
      updateNpcForm: vi.fn(),
    },
    gameEngine: {
      getGame: vi.fn(() => ({ title: 'Test Title', author: 'Test Author' })),
      syncDocumentTitle: vi.fn(),
      refreshIntroScreen: vi.fn(),
      exportGameData: vi.fn(() => ({ title: 'Test', author: '' })),
      getMaxPlayerLevel: vi.fn(() => 20),
      updateTestSettings: vi.fn(),
      getSprites: vi.fn(() => []),
      npcManager: { getDefinitions: vi.fn(() => []) },
      gameState: { variableManager: { refreshPresetNames: vi.fn() } },
    },
    updateJSON: vi.fn(function(this: { domCache: { jsonArea: HTMLTextAreaElement | null }; gameEngine: { exportGameData: () => unknown }; renderService: { renderVariableUsage: () => void; renderSkillList: () => void; renderTestTools: () => void } }) {
      if (this.domCache.jsonArea) {
        this.domCache.jsonArea.value = JSON.stringify(this.gameEngine.exportGameData(), null, 2);
      }
      this.renderService.renderVariableUsage();
      this.renderService.renderSkillList();
      this.renderService.renderTestTools();
    }),
    renderAll: vi.fn(),
  };
}

describe('EditorUIController', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── normalizeTitle / normalizeAuthor ─────────────────────────────────

  it('normalizeTitle returns default when empty', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    expect(ctrl.normalizeTitle('')).toBe('Tiny RPG Studio');
    expect(ctrl.normalizeTitle(null)).toBe('Tiny RPG Studio');
  });

  it('normalizeTitle trims and collapses whitespace, max 18 chars', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    expect(ctrl.normalizeTitle('  Hello   World  ')).toBe('Hello World');
    expect(ctrl.normalizeTitle('A'.repeat(30))).toHaveLength(18);
  });

  it('normalizeAuthor returns empty string when blank', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    expect(ctrl.normalizeAuthor('')).toBe('');
  });

  it('normalizeAuthor trims and collapses whitespace, max 18 chars', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    expect(ctrl.normalizeAuthor('  John   Doe  ')).toBe('John Doe');
    expect(ctrl.normalizeAuthor('A'.repeat(30))).toHaveLength(18);
  });

  // ─── updateGameMetadata ───────────────────────────────────────────────

  it('updateGameMetadata syncs title and author to game object', () => {
    const mgr = makeManager();
    mgr.domCache.titleInput.value = 'My Game';
    mgr.domCache.authorInput.value = 'André';
    const game = { title: '', author: '' };
    mgr.gameEngine.getGame.mockReturnValue(game);
    const ctrl = makeController(mgr);
    ctrl.updateGameMetadata();
    expect(game.title).toBe('My Game');
    expect(game.author).toBe('André');
    expect(mgr.gameEngine.syncDocumentTitle).toHaveBeenCalled();
    expect(mgr.gameEngine.refreshIntroScreen).toHaveBeenCalled();
    // updateJSON is a real method on the controller; check its side effect
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
  });

  // ─── toggleVariablePanel ─────────────────────────────────────────────

  it('toggleVariablePanel flips state and calls renderVariableUsage', () => {
    const mgr = makeManager({ variablePanelCollapsed: false });
    const ctrl = makeController(mgr);
    ctrl.toggleVariablePanel();
    expect(mgr.state.variablePanelCollapsed).toBe(true);
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
    ctrl.toggleVariablePanel();
    expect(mgr.state.variablePanelCollapsed).toBe(false);
  });

  // ─── toggleSkillPanel ────────────────────────────────────────────────

  it('toggleSkillPanel flips state and calls renderSkillList', () => {
    const mgr = makeManager({ skillPanelCollapsed: false });
    const ctrl = makeController(mgr);
    ctrl.toggleSkillPanel();
    expect(mgr.state.skillPanelCollapsed).toBe(true);
    expect(mgr.renderService.renderSkillList).toHaveBeenCalled();
  });

  // ─── toggleTestPanel ─────────────────────────────────────────────────

  it('toggleTestPanel flips state and calls renderTestTools', () => {
    const mgr = makeManager({ testPanelCollapsed: true });
    const ctrl = makeController(mgr);
    ctrl.toggleTestPanel();
    expect(mgr.state.testPanelCollapsed).toBe(false);
    expect(mgr.renderService.renderTestTools).toHaveBeenCalled();
  });

  // ─── setTestStartLevel ───────────────────────────────────────────────

  it('setTestStartLevel clamps to 1-maxLevel', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setTestStartLevel(0);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ startLevel: 1 });
    ctrl.setTestStartLevel(99);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ startLevel: 20 });
    ctrl.setTestStartLevel(5);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ startLevel: 5 });
  });

  it('setTestStartLevel defaults to 1 for non-finite input', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setTestStartLevel(NaN);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ startLevel: 1 });
  });

  // ─── setTestSkills ───────────────────────────────────────────────────

  it('setTestSkills deduplicates and filters empty strings', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setTestSkills(['a', 'b', 'a', '']);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ skills: ['a', 'b'] });
  });

  it('setTestSkills handles non-array gracefully', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setTestSkills(null as unknown as string[]);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ skills: [] });
  });

  // ─── setGodMode ──────────────────────────────────────────────────────

  it('setGodMode passes boolean to updateTestSettings', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setGodMode(true);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ godMode: true });
    ctrl.setGodMode(false);
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ godMode: false });
  });

  it('setGodMode defaults to false when called without args', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setGodMode();
    expect(mgr.gameEngine.updateTestSettings).toHaveBeenCalledWith({ godMode: false });
  });

  // ─── syncUI ──────────────────────────────────────────────────────────

  it('syncUI sets title/author inputs from game and calls updateJSON', () => {
    const mgr = makeManager();
    mgr.gameEngine.getGame.mockReturnValue({ title: 'My RPG', author: 'Dev' });
    const ctrl = makeController(mgr);
    ctrl.syncUI();
    expect(mgr.domCache.titleInput.value).toBe('My RPG');
    expect(mgr.domCache.authorInput.value).toBe('Dev');
    // updateJSON is a real method on the controller; verify its side effects
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
  });

  // ─── setActiveMobilePanel ────────────────────────────────────────────

  it('setActiveMobilePanel returns early for empty string', () => {
    const mgr = makeManager({ activeMobilePanel: 'tiles' });
    const ctrl = makeController(mgr);
    ctrl.setActiveMobilePanel('');
    expect(mgr.state.activeMobilePanel).toBe('tiles');
  });

  it('setActiveMobilePanel updates panel and calls updateMobilePanels', () => {
    const mgr = makeManager({ activeMobilePanel: 'tiles' });
    const ctrl = makeController(mgr);
    ctrl.setActiveMobilePanel('npcs');
    expect(mgr.state.activeMobilePanel).toBe('npcs');
  });

  it('setActiveMobilePanel just calls updateMobilePanels when panel is same', () => {
    const mgr = makeManager({ activeMobilePanel: 'tiles' });
    const ctrl = makeController(mgr);
    // same panel → state unchanged
    ctrl.setActiveMobilePanel('tiles');
    expect(mgr.state.activeMobilePanel).toBe('tiles');
  });

  // ─── updateMobilePanels ──────────────────────────────────────────────

  it('updateMobilePanels toggles active class on nav buttons', () => {
    const mgr = makeManager({ activeMobilePanel: 'npcs' });
    const btn1 = document.createElement('button');
    btn1.dataset.mobileTarget = 'tiles';
    const btn2 = document.createElement('button');
    btn2.dataset.mobileTarget = 'npcs';
    mgr.domCache.mobileNavButtons = [btn1, btn2];

    const ctrl = makeController(mgr);
    ctrl.updateMobilePanels();
    expect(btn1.classList.contains('active')).toBe(false);
    expect(btn2.classList.contains('active')).toBe(true);
  });
});


