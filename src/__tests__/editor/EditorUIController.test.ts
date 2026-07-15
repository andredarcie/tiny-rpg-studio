import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorUIController } from '../../editor/manager/EditorUIController';

vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: {
    apply: vi.fn(() => Promise.resolve()),
    get: vi.fn<(key: string, fallback?: string) => string>((_key: string, fallback = ''): string => fallback),
    format: vi.fn<(key: string, params?: Record<string, unknown>, fallback?: string) => string>(
      (_key: string, _params?: Record<string, unknown>, fallback = ''): string => fallback,
    ),
  }
}));

function makeInput(value: string) {
  const el = document.createElement('input');
  el.value = value;
  return el;
}

type EditorGameFixture = {
  title: string;
  author: string;
  hideHud: boolean;
  spriteOutline?: boolean;
  spriteOutlineColor?: number;
  disableSkills: boolean;
  disablePixelFont?: boolean;
  backgroundMusicVideoId?: string;
  online?: { enabled: boolean; spawnPoints?: Array<{ role: string; roomIndex: number; x: number; y: number }> };
  start?: { roomIndex: number; x: number; y: number };
  backgroundMusicVolume?: number;
};

type BackgroundMusicEngineFixture = {
  syncFromGame: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

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
  const projectHideHud = document.createElement('input');
  projectHideHud.type = 'checkbox';
  const projectSpriteOutline = document.createElement('input');
  projectSpriteOutline.type = 'checkbox';
  projectSpriteOutline.checked = true;
  const projectSpriteOutlineColor = document.createElement('select');
  const projectDisableSkills = document.createElement('input');
  projectDisableSkills.type = 'checkbox';
  const projectBackgroundMusicUrl = makeInput('');
  const projectOnlineControls = document.createElement('div');
  const onlineP2SpawnLabel = document.createElement('span');
  const projectBackgroundMusicVolume = makeInput('');
  projectBackgroundMusicVolume.type = 'range';
  const projectBackgroundMusicVolumeValue = document.createElement('span');
  const jsonArea = document.createElement('textarea');
  const projectTabDevelopment = document.createElement('button');
  projectTabDevelopment.dataset.projectTabButton = 'development';
  const projectTabTesting = document.createElement('button');
  projectTabTesting.dataset.projectTabButton = 'testing';
  const projectPanelDevelopment = document.createElement('div');
  projectPanelDevelopment.dataset.projectTabPanel = 'development';
  const projectPanelTesting = document.createElement('div');
  projectPanelTesting.dataset.projectTabPanel = 'testing';

  const state: Record<string, unknown> = {
    variablePanelCollapsed: false, skillPanelCollapsed: false,
    testPanelCollapsed: false, activeMobilePanel: 'tiles', activeProjectTab: 'development', ...stateOverrides,
  };

  return {
    state,
    domCache: {
      titleInput,
      authorInput,
      projectHideHud,
      projectSpriteOutline,
      projectSpriteOutlineColor,
      projectDisableSkills,
      projectBackgroundMusicUrl,
      projectOnlineControls,
      onlineP2SpawnLabel,
      projectBackgroundMusicVolume,
      projectBackgroundMusicVolumeValue,
      jsonArea,
      projectTabButtons: [projectTabDevelopment, projectTabTesting],
      projectTabPanels: [projectPanelDevelopment, projectPanelTesting],
      mobileNavButtons: [] as HTMLButtonElement[],
      mobilePanels: [] as HTMLElement[],
    },
    get dom() { return this.domCache; },
    renderService: {
      renderVariableUsage: vi.fn(), renderSkillList: vi.fn(), renderTestTools: vi.fn(),
      renderEditor: vi.fn(),
      renderTileList: vi.fn(),
      updateSelectedTilePreview: vi.fn(),
      renderObjectCatalog: vi.fn(),
      renderObjects: vi.fn(),
      updateNpcForm: vi.fn(),
    },
    gameEngine: {
      getGame: vi.fn<() => EditorGameFixture>(() => ({
        title: 'Test Title',
        author: 'Test Author',
        hideHud: false,
        spriteOutline: true,
        spriteOutlineColor: 1,
        disableSkills: false,
        backgroundMusicVideoId: undefined,
        backgroundMusicVolume: 100,
      })),
      backgroundMusicEngine: {
        syncFromGame: vi.fn(),
        stop: vi.fn(),
      } as BackgroundMusicEngineFixture,
      syncDocumentTitle: vi.fn(),
      refreshIntroScreen: vi.fn(),
      exportGameData: vi.fn(() => ({ title: 'Test', author: '' })),
      getMaxPlayerLevel: vi.fn(() => 20),
      updateTestSettings: vi.fn(),
      setHideHud: vi.fn(),
      setSpriteOutline: vi.fn(),
      setSpriteOutlineColor: vi.fn(),
      getCustomPalette: vi.fn(() => undefined),
      setDisableSkills: vi.fn(),
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
    renderObjectCatalog: vi.fn(),
    objectService: { togglePlacement: vi.fn() },
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
    const game: EditorGameFixture = { title: '', author: '', hideHud: false, disableSkills: false };
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

  it('setHideHud updates engine state and JSON', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setHideHud(true);
    expect(mgr.gameEngine.setHideHud).toHaveBeenCalledWith(true);
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
  });

  it('setSpriteOutline updates engine state, JSON, and editor views', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setSpriteOutline(false);
    expect(mgr.gameEngine.setSpriteOutline).toHaveBeenCalledWith(false);
    expect(mgr.domCache.projectSpriteOutlineColor.disabled).toBe(true);
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
    expect(mgr.renderService.renderTileList).toHaveBeenCalled();
    expect(mgr.renderService.updateSelectedTilePreview).toHaveBeenCalled();
    expect(mgr.renderService.renderObjectCatalog).toHaveBeenCalled();
    expect(mgr.renderService.renderObjects).toHaveBeenCalled();
  });

  it('setSpriteOutlineColor updates engine state, JSON, and editor views', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setSpriteOutlineColor(5);
    expect(mgr.gameEngine.setSpriteOutlineColor).toHaveBeenCalledWith(5);
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
    expect(mgr.renderService.renderTileList).toHaveBeenCalled();
    expect(mgr.renderService.updateSelectedTilePreview).toHaveBeenCalled();
    expect(mgr.renderService.renderObjectCatalog).toHaveBeenCalled();
    expect(mgr.renderService.renderObjects).toHaveBeenCalled();
  });

  it('setDisableSkills updates engine state and JSON', () => {
    const mgr = makeManager();
    const ctrl = makeController(mgr);
    ctrl.setDisableSkills(true);
    expect(mgr.gameEngine.setDisableSkills).toHaveBeenCalledWith(true);
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
  });

  it('setBackgroundMusicUrl normalizes a YouTube URL into the stored video id', () => {
    const mgr = makeManager();
    const game: EditorGameFixture = {
      title: 'Music',
      author: 'Dev',
      hideHud: false,
      disableSkills: false,
      backgroundMusicVideoId: undefined
    };
    mgr.gameEngine.getGame.mockReturnValue(game);
    const ctrl = makeController(mgr);

    (ctrl as unknown as { setBackgroundMusicUrl: (url: string) => void })
      .setBackgroundMusicUrl('https://www.youtube.com/watch?v=t0ihNLLZNi0');

    expect(game.backgroundMusicVideoId).toBe('t0ihNLLZNi0');
    expect(mgr.gameEngine.backgroundMusicEngine.syncFromGame).toHaveBeenCalledWith(game);
    expect(mgr.gameEngine.refreshIntroScreen).toHaveBeenCalled();
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
  });

  it('setBackgroundMusicUrl keeps playback stopped while in editor mode', () => {
    document.body.classList.add('editor-mode');
    const mgr = makeManager();
    const game: EditorGameFixture = {
      title: 'Music',
      author: 'Dev',
      hideHud: false,
      disableSkills: false,
      backgroundMusicVideoId: undefined
    };
    mgr.gameEngine.getGame.mockReturnValue(game);
    mgr.gameEngine.backgroundMusicEngine.stop = vi.fn();
    const ctrl = makeController(mgr);

    (ctrl as unknown as { setBackgroundMusicUrl: (url: string) => void })
      .setBackgroundMusicUrl('https://www.youtube.com/watch?v=t0ihNLLZNi0');

    expect(mgr.gameEngine.backgroundMusicEngine.stop).toHaveBeenCalled();
    document.body.classList.remove('editor-mode');
  });

  it('setOnlineEnabled creates the player 2 spawn beside player 1', () => {
    const mgr = makeManager();
    const game: EditorGameFixture = {
      title: 'Online',
      author: 'Dev',
      hideHud: false,
      disableSkills: false,
      online: { enabled: false },
      start: { roomIndex: 2, x: 4, y: 5 }
    };
    mgr.gameEngine.getGame.mockReturnValue(game);
    const ctrl = makeController(mgr);

    ctrl.setOnlineEnabled(true);

    expect(game.online).toEqual({
      enabled: true,
      spawnPoints: [{ role: 'p2', roomIndex: 2, x: 5, y: 5 }]
    });
    expect(mgr.domCache.projectOnlineControls.style.display).toBe('block');
    expect(mgr.domCache.onlineP2SpawnLabel.textContent).toBe('sala 2 (5, 5)');
    expect(mgr.renderObjectCatalog).toHaveBeenCalled();
    expect(mgr.renderService.renderEditor).toHaveBeenCalled();
  });

  it('setBackgroundMusicVolume normalizes, persists and syncs preview without starting editor playback', () => {
    document.body.classList.add('editor-mode');
    const mgr = makeManager();
    const game: EditorGameFixture = {
      title: 'Music',
      author: 'Dev',
      hideHud: false,
      disableSkills: false,
      backgroundMusicVideoId: 't0ihNLLZNi0',
      backgroundMusicVolume: 100,
    };
    mgr.gameEngine.getGame.mockReturnValue(game);
    const ctrl = makeController(mgr);

    (ctrl as unknown as { setBackgroundMusicVolume: (value: number) => void })
      .setBackgroundMusicVolume(140);

    expect(game.backgroundMusicVolume).toBe(100);
    expect(mgr.gameEngine.backgroundMusicEngine.syncFromGame).toHaveBeenCalledWith(game);
    expect(mgr.gameEngine.backgroundMusicEngine.stop).toHaveBeenCalled();
    expect(mgr.domCache.projectBackgroundMusicVolume.value).toBe('100');
    expect(mgr.domCache.projectBackgroundMusicVolumeValue.textContent).toBe('100%');
    expect(mgr.renderService.renderVariableUsage).toHaveBeenCalled();
    document.body.classList.remove('editor-mode');
  });

  // ─── syncUI ──────────────────────────────────────────────────────────

  it('syncUI sets title/author inputs from game and calls updateJSON', () => {
    const mgr = makeManager();
    mgr.gameEngine.getGame.mockReturnValue({
      title: 'My RPG',
      author: 'Dev',
      hideHud: true,
      spriteOutline: false,
      disableSkills: true,
      backgroundMusicVideoId: 't0ihNLLZNi0',
      backgroundMusicVolume: 73,
    });
    const ctrl = makeController(mgr);
    ctrl.syncUI();
    expect(mgr.domCache.titleInput.value).toBe('My RPG');
    expect(mgr.domCache.authorInput.value).toBe('Dev');
    expect(mgr.domCache.projectHideHud.checked).toBe(true);
    expect(mgr.domCache.projectSpriteOutline.checked).toBe(false);
    expect(mgr.domCache.projectDisableSkills.checked).toBe(true);
    expect(mgr.domCache.projectBackgroundMusicUrl.value).toBe('https://www.youtube.com/watch?v=t0ihNLLZNi0');
    expect(mgr.domCache.projectBackgroundMusicVolume.value).toBe('73');
    expect(mgr.domCache.projectBackgroundMusicVolumeValue.textContent).toBe('73%');
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

  it('setActiveProjectTab updates project tab state and classes', () => {
    const mgr = makeManager({ activeProjectTab: 'development' });
    const ctrl = makeController(mgr);
    ctrl.setActiveProjectTab('testing');
    expect(mgr.state.activeProjectTab).toBe('testing');
    expect(mgr.domCache.projectTabButtons[0].classList.contains('active')).toBe(false);
    expect(mgr.domCache.projectTabButtons[1].classList.contains('active')).toBe(true);
    expect(mgr.domCache.projectTabPanels[0].hidden).toBe(true);
    expect(mgr.domCache.projectTabPanels[1].hidden).toBe(false);
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


