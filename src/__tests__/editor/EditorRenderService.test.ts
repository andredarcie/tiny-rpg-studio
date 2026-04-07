import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorRenderService as EditorRenderServiceType } from '../../editor/modules/EditorRenderService';

type MockFn = ReturnType<typeof vi.fn>;
type CanvasRendererMockInstance = { renderEditor: MockFn };
type TilePanelRendererMockInstance = { renderTileList: MockFn; updateSelectedTilePreview: MockFn };
type NpcRendererMockInstance = { renderNpcs: MockFn; updateNpcForm: MockFn };
type EnemyRendererMockInstance = { renderEnemies: MockFn; renderEnemyCatalog: MockFn };
type WorldRendererMockInstance = { renderWorldGrid: MockFn; renderMapNavigation: MockFn; updateMapPosition: MockFn };
type ObjectRendererMockInstance = { renderObjectCatalog: MockFn; renderObjects: MockFn };
type SkillListInput = Parameters<EditorRenderServiceType['groupSkillsByLevel']>[0];
type SkillListItem = SkillListInput[number];
type VariableDefinitionMock = { id: string; name?: string; color?: string | number };
type GameVariableUsageMock = {
  sprites?: Array<Record<string, unknown>> | unknown;
  enemies?: Array<Record<string, unknown>> | unknown;
  objects?: Array<Record<string, unknown>> | unknown;
};
type DomFixture = {
  projectVariableList: HTMLDivElement;
  projectVariablesContainer: HTMLDivElement;
  projectVariablesToggle: HTMLButtonElement;
  projectSkillsList: HTMLDivElement;
  projectSkillsContainer: HTMLDivElement;
  projectSkillsToggle: HTMLButtonElement;
  projectTestContainer: HTMLDivElement;
  projectTestToggle: HTMLButtonElement;
  projectTestPanel: HTMLDivElement;
  projectTestStartLevel: HTMLSelectElement;
  projectTestSkillList: HTMLDivElement;
  projectTestGodMode: HTMLInputElement;
};
type TestState = {
  variablePanelCollapsed: boolean;
  skillPanelCollapsed: boolean;
  testPanelCollapsed: boolean;
};
type ManagerFixture = {
  domCache: DomFixture;
  gameEngine: {
    getVariableDefinitions: ReturnType<typeof vi.fn<() => VariableDefinitionMock[]>>;
    getGame: ReturnType<typeof vi.fn<() => GameVariableUsageMock>>;
    getTestSettings: ReturnType<typeof vi.fn<() => { startLevel: number; godMode: boolean; skills: unknown }>>;
    getMaxPlayerLevel: ReturnType<typeof vi.fn<() => number>>;
  };
  state: TestState;
};
type BucketMapHack = Map<unknown, unknown> & { __editorRenderBuckets?: boolean };

function skillItem(overrides: Partial<SkillListItem> & Pick<SkillListItem, 'id'>): SkillListItem {
  return { ...overrides } as SkillListItem;
}

const mocks = vi.hoisted(() => {
  const textGet = vi.fn<(key: string, fallback: string) => string | undefined>();
  const textFormat = vi.fn<(key: string, params: Record<string, string | number>, fallback: string) => string>();
  const picoColors = ['#000000', '#FFFFFF'];

  const skillDefinitions = {
    getAll: vi.fn<() => unknown[]>(),
    getById: vi.fn<(id: string) => unknown | null>((id) => ({ id })),
    getDefaultSkillOrder: vi.fn<() => string[]>(() => []),
    DEFAULT_LEVEL_SLOTS: [
      { level: 2, count: 2 },
      { level: 4, count: 1 },
      { level: 6, count: 1 },
      { level: 8, count: 1 },
      { level: 10, count: 1 },
    ],
    LEVEL_SKILLS: {} as Record<string, unknown>
  };

  const canvasInstances: CanvasRendererMockInstance[] = [];
  const tilePanelInstances: TilePanelRendererMockInstance[] = [];
  const npcInstances: NpcRendererMockInstance[] = [];
  const enemyInstances: EnemyRendererMockInstance[] = [];
  const worldInstances: WorldRendererMockInstance[] = [];
  const objectInstances: ObjectRendererMockInstance[] = [];

  return {
    textGet,
    textFormat,
    picoColors,
    skillDefinitions,
    canvasInstances,
    tilePanelInstances,
    npcInstances,
    enemyInstances,
    worldInstances,
    objectInstances
  };
});

vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: {
    get: mocks.textGet,
    format: mocks.textFormat
  }
}));

vi.mock('../../runtime/domain/definitions/TileDefinitions', () => ({
  PICO8_COLORS: mocks.picoColors
}));

vi.mock('../../runtime/domain/definitions/SkillDefinitions', () => ({
  SkillDefinitions: mocks.skillDefinitions
}));

vi.mock('../../editor/modules/renderers/EditorCanvasRenderer', () => ({
  EditorCanvasRenderer: class {
    renderEditor = vi.fn();
    constructor() {
      mocks.canvasInstances.push(this);
    }
  }
}));

vi.mock('../../editor/modules/renderers/EditorTilePanelRenderer', () => ({
  EditorTilePanelRenderer: class {
    renderTileList = vi.fn();
    updateSelectedTilePreview = vi.fn();
    constructor() {
      mocks.tilePanelInstances.push(this);
    }
  }
}));

vi.mock('../../editor/modules/renderers/EditorNpcRenderer', () => ({
  EditorNpcRenderer: class {
    renderNpcs = vi.fn();
    updateNpcForm = vi.fn();
    constructor() {
      mocks.npcInstances.push(this);
    }
  }
}));

vi.mock('../../editor/modules/renderers/EditorEnemyRenderer', () => ({
  EditorEnemyRenderer: class {
    renderEnemies = vi.fn();
    renderEnemyCatalog = vi.fn();
    constructor() {
      mocks.enemyInstances.push(this);
    }
  }
}));

vi.mock('../../editor/modules/renderers/EditorWorldRenderer', () => ({
  EditorWorldRenderer: class {
    renderWorldGrid = vi.fn();
    renderMapNavigation = vi.fn();
    updateMapPosition = vi.fn();
    constructor() {
      mocks.worldInstances.push(this);
    }
  }
}));

vi.mock('../../editor/modules/renderers/EditorObjectRenderer', () => ({
  EditorObjectRenderer: class {
    renderObjectCatalog = vi.fn();
    renderObjects = vi.fn();
    constructor() {
      mocks.objectInstances.push(this);
    }
  }
}));

import { EditorRenderService } from '../../editor/modules/EditorRenderService';

function asEditorManagerFixture(fixture: ManagerFixture): ConstructorParameters<typeof EditorRenderService>[0] {
  return fixture as unknown as ConstructorParameters<typeof EditorRenderService>[0];
}

function createDomFixture(): DomFixture {
  const projectVariableList = document.createElement('div');
  const projectVariablesContainer = document.createElement('div');
  const projectVariablesToggle = document.createElement('button');

  const projectSkillsList = document.createElement('div');
  const projectSkillsContainer = document.createElement('div');
  const projectSkillsToggle = document.createElement('button');

  const projectTestContainer = document.createElement('div');
  const hint = document.createElement('div');
  hint.className = 'project-test__hint';
  projectTestContainer.appendChild(hint);
  const projectTestToggle = document.createElement('button');
  const projectTestPanel = document.createElement('div');
  const projectTestStartLevel = document.createElement('select');
  const projectTestSkillList = document.createElement('div');
  const projectTestGodMode = document.createElement('input');
  projectTestGodMode.type = 'checkbox';

  return {
    projectVariableList,
    projectVariablesContainer,
    projectVariablesToggle,
    projectSkillsList,
    projectSkillsContainer,
    projectSkillsToggle,
    projectTestContainer,
    projectTestToggle,
    projectTestPanel,
    projectTestStartLevel,
    projectTestSkillList,
    projectTestGodMode
  };
}

function createManagerFixture(): ManagerFixture {
  const domCache = createDomFixture();
  const gameEngine: ManagerFixture['gameEngine'] = {
    getVariableDefinitions: vi.fn(() => []),
    getGame: vi.fn(() => ({})),
    getTestSettings: vi.fn(() => ({ startLevel: 1, godMode: false, skills: [] })),
    getMaxPlayerLevel: vi.fn(() => 3)
  };
  const state = {
    variablePanelCollapsed: false,
    skillPanelCollapsed: false,
    testPanelCollapsed: false
  };
  return { domCache, gameEngine, state };
}

function createService(fixture = createManagerFixture()) {
  const service = new EditorRenderService(asEditorManagerFixture(fixture));
  return { service, fixture };
}

describe('EditorRenderService', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mocks.textGet.mockImplementation((_key, fallback) => fallback);
    mocks.textFormat.mockImplementation((_key, params, fallback) => {
      if (Object.keys(params).length) {
        return `${fallback}:${JSON.stringify(params)}`;
      }
      return fallback;
    });
    mocks.picoColors.splice(0, mocks.picoColors.length, '#000000', '#FFFFFF', '#FF00FF');
    mocks.skillDefinitions.getAll.mockReturnValue([]);
    mocks.skillDefinitions.LEVEL_SKILLS = {};
    mocks.canvasInstances.length = 0;
    mocks.tilePanelInstances.length = 0;
    mocks.npcInstances.length = 0;
    mocks.enemyInstances.length = 0;
    mocks.worldInstances.length = 0;
    mocks.objectInstances.length = 0;
  });

  it('constructs renderer modules, registers animation listener and callback rerenders', () => {
    const addEventSpy = vi.spyOn(globalThis, 'addEventListener');
    const { service } = createService();

    expect(mocks.canvasInstances).toHaveLength(1);
    expect(mocks.tilePanelInstances).toHaveLength(1);
    expect(mocks.npcInstances).toHaveLength(1);
    expect(mocks.enemyInstances).toHaveLength(1);
    expect(mocks.worldInstances).toHaveLength(1);
    expect(mocks.objectInstances).toHaveLength(1);
    expect(addEventSpy).toHaveBeenCalledWith('tile-animation-frame', expect.any(Function));

    const renderEditorSpy = vi.spyOn(service, 'renderEditor');
    const previewSpy = vi.spyOn(service, 'updateSelectedTilePreview');
    service.handleTileAnimationFrame();
    expect(renderEditorSpy).toHaveBeenCalledTimes(1);
    expect(previewSpy).toHaveBeenCalledTimes(1);
  });

  it('translates keys and formats values with fallback behavior', () => {
    const { service } = createService();

    mocks.textGet.mockReturnValueOnce('Translated');
    expect(service.t('abc', 'fallback')).toBe('Translated');

    mocks.textGet.mockReturnValueOnce('');
    expect(service.t('abc', 'fallback')).toBe('fallback');

    mocks.textGet.mockReturnValueOnce('');
    expect(service.t('abc')).toBe('abc');
    expect(service.t('')).toBe('');

    mocks.textFormat.mockReturnValue('fmt');
    expect(service.tf('k', { value: 2 }, 'fb')).toBe('fmt');
    expect(mocks.textFormat).toHaveBeenCalledWith('k', { value: 2 }, 'fb');
  });

  it('resolves pico colors for empty palette, integers, strings and invalid inputs', () => {
    const { service } = createService();

    mocks.picoColors.splice(0, mocks.picoColors.length);
    expect(service.resolvePicoColor(null)).toBe('#000000');
    expect(service.resolvePicoColor('#123456')).toBe('#123456');

    mocks.picoColors.splice(0, mocks.picoColors.length, '#000000', '#ABCDEF');
    expect(service.picoPalette).toEqual(['#000000', '#ABCDEF']);
    expect(service.resolvePicoColor(1)).toBe('#ABCDEF');
    expect(service.resolvePicoColor(99)).toBe('#000000');
    expect(service.resolvePicoColor({} as unknown as string | number | null)).toBe('#000000');
    expect(service.resolvePicoColor(' abcdef ')).toBe('#ABCDEF');
    expect(service.resolvePicoColor('')).toBe('#000000');
    expect(service.resolvePicoColor('#ff00ff')).toBe('#000000');
  });

  it('delegates render/update methods to renderer modules and exposes manager getters', () => {
    const fixture = createManagerFixture();
    const { service } = createService(fixture);

    expect(service.dom).toBe(fixture.domCache);
    expect(service.gameEngine).toBe(fixture.gameEngine);
    expect(service.state).toBe(fixture.state);
    expect(service.textResources).toBeDefined();

    service.renderEditor();
    service.renderTileList();
    service.renderNpcs();
    service.updateNpcForm();
    service.renderEnemies();
    service.renderEnemyCatalog();
    service.renderObjectCatalog();
    service.renderObjects();
    service.renderWorldGrid();
    service.renderMapNavigation();
    service.updateMapPosition(2, 3);
    service.updateSelectedTilePreview();

    expect(mocks.canvasInstances[0].renderEditor).toHaveBeenCalled();
    expect(mocks.tilePanelInstances[0].renderTileList).toHaveBeenCalled();
    expect(mocks.tilePanelInstances[0].updateSelectedTilePreview).toHaveBeenCalled();
    expect(mocks.npcInstances[0].renderNpcs).toHaveBeenCalled();
    expect(mocks.npcInstances[0].updateNpcForm).toHaveBeenCalled();
    expect(mocks.enemyInstances[0].renderEnemies).toHaveBeenCalled();
    expect(mocks.enemyInstances[0].renderEnemyCatalog).toHaveBeenCalled();
    expect(mocks.objectInstances[0].renderObjectCatalog).toHaveBeenCalled();
    expect(mocks.objectInstances[0].renderObjects).toHaveBeenCalled();
    expect(mocks.worldInstances[0].renderWorldGrid).toHaveBeenCalled();
    expect(mocks.worldInstances[0].renderMapNavigation).toHaveBeenCalledTimes(2);
    expect(mocks.worldInstances[0].updateMapPosition).toHaveBeenCalledWith(2, 3);
  });

  it('renders variable usage empty state and handles missing optional UI parts', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectVariablesToggle = null as unknown as HTMLButtonElement;
    fixture.domCache.projectVariablesContainer = null as unknown as HTMLDivElement;
    fixture.gameEngine.getVariableDefinitions.mockReturnValue([]);
    const { service } = createService(fixture);

    service.renderVariableUsage();

    expect(fixture.domCache.projectVariableList.children).toHaveLength(1);
    expect(fixture.domCache.projectVariableList.textContent).toContain('Nenhuma');
  });

  it('renders variable usage toggle text when panel is expanded', () => {
    const fixture = createManagerFixture();
    fixture.state.variablePanelCollapsed = false;
    fixture.gameEngine.getVariableDefinitions.mockReturnValue([{ id: 'v1' }]);
    const { service } = createService(fixture);

    service.renderVariableUsage();

    expect(fixture.domCache.projectVariablesToggle.textContent).toContain('0/1');
    expect(fixture.domCache.projectVariablesContainer.classList.contains('is-collapsed')).toBe(false);
  });

  it('returns early in renderVariableUsage when list is missing', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectVariableList = null as unknown as HTMLDivElement;
    const { service } = createService(fixture);

    expect(() => service.renderVariableUsage()).not.toThrow();
  });

  it('renders variable usage list with used and unused badges and collapsed state', () => {
    const fixture = createManagerFixture();
    fixture.state.variablePanelCollapsed = true;
    fixture.gameEngine.getVariableDefinitions.mockReturnValue([
      { id: 'var-1', name: 'Alpha', color: '#ffffff' },
      { id: 'var-2', name: '', color: 1 },
      { id: 'var-3' },
      { id: 'var-4', name: 'Unused' }
    ]);
    fixture.gameEngine.getGame.mockReturnValue({
      sprites: [
        { conditionVariableId: ' var-1 ', rewardVariableId: 'missing', activateVariableId: 123 },
        { conditionalRewardVariableId: 'var-2', alternativeRewardVariableId: null }
      ],
      enemies: [{ defeatVariableId: 'var-2' }],
      objects: [{ variableId: 'var-3' }]
    });
    const { service } = createService(fixture);

    service.renderVariableUsage();

    expect(fixture.domCache.projectVariablesContainer.classList.contains('is-collapsed')).toBe(true);
    expect(fixture.domCache.projectVariablesToggle.textContent).toContain('3/4');
    expect(fixture.domCache.projectVariableList.querySelectorAll('.project-variable-item')).toHaveLength(4);
    expect(fixture.domCache.projectVariableList.querySelectorAll('.project-variable-badge.in-use')).toHaveLength(3);
    expect(fixture.domCache.projectVariableList.querySelectorAll('.project-variable-badge.unused')).toHaveLength(1);
    expect(fixture.domCache.projectVariableList.textContent).toContain('Alpha');
    expect(fixture.domCache.projectVariableList.textContent).toContain('var-2');
  });

  it('collects variable usage only for valid trimmed string ids', () => {
    const fixture = createManagerFixture();
    fixture.gameEngine.getVariableDefinitions.mockReturnValue([{ id: 'ok' }, { id: 'also' }]);
    fixture.gameEngine.getGame.mockReturnValue({
      sprites: [{ conditionVariableId: ' ok ', rewardVariableId: '', activateVariableId: 10 }],
      enemies: [{ defeatVariableId: 'also' }],
      objects: [{ variableId: 'missing' }]
    });
    const { service } = createService(fixture);

    expect(Array.from(service.collectVariableUsage()).sort()).toEqual(['also', 'ok']);
  });

  it('handles missing arrays in collectVariableUsage', () => {
    const fixture = createManagerFixture();
    fixture.gameEngine.getVariableDefinitions.mockReturnValue([{ id: 'ok' }]);
    fixture.gameEngine.getGame.mockReturnValue({ sprites: 'x', enemies: null, objects: 1 });
    const { service } = createService(fixture);

    expect(service.collectVariableUsage().size).toBe(0);
  });

  it('builds skill level map ignoring invalid entries and keeping lowest level', () => {
    mocks.skillDefinitions.LEVEL_SKILLS = {
      '3': ['fire', 123, 'wind'],
      '1': ['fire'],
      bad: ['shadow'],
      '2': null
    };
    const { service } = createService();

    const map = service.buildSkillLevelMap();

    expect(map.get('fire')).toBe(1);
    expect(map.get('wind')).toBe(3);
    expect(map.has('shadow')).toBe(false);
  });

  it('groups skills by level and places unknown skills last', () => {
    const { service } = createService();
    const grouped = service.groupSkillsByLevel(
      [skillItem({ id: 'b', name: 'B' }), skillItem({ id: 'x', name: 'X' }), skillItem({ id: 'a', name: 'A' })],
      new Map([
        ['a', 1],
        ['b', 2]
      ])
    );

    expect(grouped.map((g) => g.level)).toEqual([1, 2, null]);
    expect(grouped[0].items[0].id).toBe('a');
    expect(grouped[1].items[0].id).toBe('b');
    expect(grouped[2].items[0].id).toBe('x');
  });

  it('handles defensive empty bucket reads in groupSkillsByLevel', () => {
    const { service } = createService();
    const originalGet = Map.prototype.get;
    const originalSet = Map.prototype.set;
    let forcedMisses = 0;

    const setSpy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
      value: unknown
    ) {
      if (Array.isArray(value)) {
        (this as BucketMapHack).__editorRenderBuckets = true;
      }
      return originalSet.call(this, key, value);
    });
    const getSpy = vi.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<unknown, unknown>, key: unknown) {
      if ((this as BucketMapHack).__editorRenderBuckets && forcedMisses < 2) {
        forcedMisses += 1;
        return undefined;
      }
      return originalGet.call(this, key) as unknown;
    });

    const grouped = service.groupSkillsByLevel([skillItem({ id: 'x' })], new Map());

    expect(grouped).toHaveLength(1);
    expect(grouped[0].items).toEqual([]);

    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it('returns early in renderSkillList when list is missing', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectSkillsList = null as unknown as HTMLDivElement;
    const { service } = createService(fixture);

    expect(() => service.renderSkillList()).not.toThrow();
  });

  it('renders skill panel toggle and stops when collapsed', () => {
    const fixture = createManagerFixture();
    fixture.state.skillPanelCollapsed = true;
    const { service } = createService(fixture);

    service.renderSkillList();

    expect(fixture.domCache.projectSkillsContainer.classList.contains('is-collapsed')).toBe(true);
    expect(fixture.domCache.projectSkillsToggle.textContent).toContain('Skills');
    expect(fixture.domCache.projectSkillsList.children).toHaveLength(0);
  });

  it('renders empty skill list state', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectSkillsToggle = null as unknown as HTMLButtonElement;
    fixture.domCache.projectSkillsContainer = null as unknown as HTMLDivElement;
    mocks.skillDefinitions.getAll.mockReturnValue([]);
    const { service } = createService(fixture);

    service.renderSkillList();

    expect(fixture.domCache.projectSkillsList.textContent).toContain('Nenhuma');
  });

  it('renders flat reorderable skill list with drag handles and level badges', () => {
    const fixture = createManagerFixture();
    const healSkill = { id: 'heal', icon: '❤️', nameKey: 'skill.heal', descriptionKey: 'skill.heal.desc' };
    const mysterySkill = { id: 'mystery', icon: '✨', nameKey: 'skill.mystery', descriptionKey: 'skill.mystery.desc' };
    mocks.skillDefinitions.getAll.mockReturnValue([healSkill, mysterySkill]);
    mocks.skillDefinitions.getById.mockImplementation((id: string) =>
      id === 'heal' ? healSkill : id === 'mystery' ? mysterySkill : null
    );
    mocks.skillDefinitions.getDefaultSkillOrder.mockReturnValue(['heal', 'mystery']);
    mocks.skillDefinitions.DEFAULT_LEVEL_SLOTS = [{ level: 2, count: 2 }];
    mocks.textGet.mockImplementation((key, fallback) => `T:${key}:${fallback}`);
    mocks.textFormat.mockImplementation((key, params, fallback) => `F:${key}:${params.value}:${fallback}`);
    const { service } = createService(fixture);

    service.renderSkillList();

    const items = fixture.domCache.projectSkillsList.querySelectorAll('.project-skill-item[data-skill-id]');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.project-skill-drag-handle')).not.toBeNull();
    expect(items[0].querySelector('.project-skill-level-badge')?.textContent).toContain('2');
    expect(fixture.domCache.projectSkillsList.textContent).toContain('T:skill.heal:heal');
    expect(fixture.domCache.projectSkillsList.textContent).toContain('T:skill.heal.desc:');
    expect(fixture.domCache.projectSkillsList.textContent).toContain('T:skill.mystery:mystery');
  });

  it('returns early in renderTestTools when required nodes are missing', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectTestContainer = null as unknown as HTMLDivElement;
    const { service } = createService(fixture);

    expect(() => service.renderTestTools()).not.toThrow();
  });

  it('renders test tools panel with empty skills, hint, options and god mode', () => {
    const fixture = createManagerFixture();
    fixture.state.testPanelCollapsed = true;
    fixture.gameEngine.getTestSettings.mockReturnValue({
      startLevel: 2,
      godMode: true,
      skills: 'invalid'
    });
    fixture.gameEngine.getMaxPlayerLevel.mockReturnValue(4);
    mocks.skillDefinitions.getAll.mockReturnValue([]);
    const { service } = createService(fixture);

    service.renderTestTools();

    expect(fixture.domCache.projectTestContainer.classList.contains('is-collapsed')).toBe(true);
    expect(fixture.domCache.projectTestToggle.textContent).toContain('Ajuda');
    expect(fixture.domCache.projectTestContainer.querySelector('.project-test__hint')?.textContent).toContain('URL');
    expect(fixture.domCache.projectTestStartLevel.querySelectorAll('option')).toHaveLength(4);
    expect(
      (fixture.domCache.projectTestStartLevel.querySelector('option[value="2"]') as HTMLOptionElement | null)
        ?.selected
    ).toBe(true);
    expect(fixture.domCache.projectTestGodMode.checked).toBe(true);
    expect(fixture.domCache.projectTestSkillList.textContent).toContain('Nenhuma');
  });

  it('renders test tools without skill list section when skillList is missing', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectTestSkillList = null as unknown as HTMLDivElement;
    const { service } = createService(fixture);

    expect(() => service.renderTestTools()).not.toThrow();
  });

  it('renders test tools skill checklist and handles missing optional controls', () => {
    const fixture = createManagerFixture();
    fixture.domCache.projectTestStartLevel = null as unknown as HTMLSelectElement;
    fixture.domCache.projectTestGodMode = null as unknown as HTMLInputElement;
    fixture.domCache.projectTestContainer = document.createElement('div');
    fixture.domCache.projectTestSkillList = document.createElement('div');
    fixture.gameEngine.getTestSettings.mockReturnValue({
      startLevel: 1,
      godMode: false,
      skills: ['heal']
    });
    mocks.skillDefinitions.getAll.mockReturnValue([
      { id: 'heal', icon: '', nameKey: 's.heal', name: '' },
      { id: '', icon: '', nameKey: 's.empty', name: '' },
      { id: 'dash', icon: 'D', name: '' },
      { id: '', icon: 'E', name: '' }
    ]);
    mocks.textGet.mockImplementation((key, fallback) => `${key}|${fallback}`);
    const { service } = createService(fixture);

    service.renderTestTools();

    const checkboxes = fixture.domCache.projectTestSkillList.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(4);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[0] as HTMLInputElement).dataset.skillId).toBe('heal');
    expect(fixture.domCache.projectTestSkillList.textContent).toContain('s.heal|heal');
    expect(fixture.domCache.projectTestSkillList.textContent).toContain('s.empty|');
    expect(fixture.domCache.projectTestSkillList.textContent).toContain('dash');
  });
});


