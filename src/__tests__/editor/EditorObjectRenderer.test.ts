/* eslint-disable */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockData = vi.hoisted(() => ({
  objectDefinitions: [] as any[],
  playerEndTextLimit: 80 as number | string,
  itemDefinitionMap: new Map<string, any>()
}));

vi.mock('../../editor/modules/EditorConstants', () => ({
  EditorConstants: {
    get OBJECT_DEFINITIONS() {
      return mockData.objectDefinitions;
    }
  }
}));

vi.mock('../../runtime/domain/state/StateObjectManager', () => ({
  StateObjectManager: {
    get PLAYER_END_TEXT_LIMIT() {
      return mockData.playerEndTextLimit;
    }
  }
}));

vi.mock('../../runtime/domain/definitions/ItemDefinitions', () => ({
  ItemDefinitions: {
    getItemDefinition: vi.fn((type: string) => mockData.itemDefinitionMap.get(type) ?? null)
  }
}));

import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { EditorObjectRenderer } from '../../editor/modules/renderers/EditorObjectRenderer';


function makeSwordDef({
  isSword = true,
  damage = null,
  durability = null
}: { isSword?: boolean; damage?: number | null; durability?: number | null }) {
  return {
    hasTag: vi.fn((tag: string) => (tag === 'sword' ? isSword : false)),
    getSwordDamage: vi.fn(() => damage),
    getSwordDurability: vi.fn(() => durability)
  };
}

function createFixture() {
  const objectTypes = document.createElement('div');
  const objectsList = document.createElement('div');

  const updateCategoryButtons = vi.fn();
  const updatePlayerEndText = vi.fn();
  const populateVariableSelect = vi.fn((select: HTMLSelectElement, selected: string) => {
    const values = ['', 'var-1', 'var-2'];
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value || 'none';
      if (value === selected) option.selected = true;
      select.appendChild(option);
    });
  });

  const manager = {
    objectService: { updateCategoryButtons, updatePlayerEndText },
    npcService: { populateVariableSelect },
    selectedObjectType: ITEM_TYPES.KEY,
    updateJSON: vi.fn(),
    history: { pushCurrentState: vi.fn() }
  };

  const gameEngine = {
    getObjectsForRoom: vi.fn((): any[] => []),
    setObjectVariable: vi.fn(),
    isVariableOn: vi.fn(() => false),
    renderer: {
      drawObjectSprite: vi.fn()
    }
  };

  const worldRenderer = { renderWorldGrid: vi.fn() };
  const renderEditor = vi.fn();
  const t = vi.fn((key: string, fallback = '') => `t:${key}${fallback ? `|${fallback}` : ''}`);
  const tf = vi.fn((key: string, params: Record<string, string | number>) => `tf:${key}:${JSON.stringify(params)}`);

  const service = {
    manager,
    dom: { objectTypes, objectsList },
    state: { activeRoomIndex: 1, objectCategoryFilter: 'all' },
    gameEngine,
    worldRenderer,
    renderEditor,
    t,
    tf
  };

  return { service, manager, gameEngine, worldRenderer, renderEditor, t, tf };
}

describe('EditorObjectRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mockData.objectDefinitions = [];
    mockData.playerEndTextLimit = 80;
    mockData.itemDefinitionMap = new Map();
  });

  it('returns early in renderObjectCatalog when container is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.objectTypes = null as any;
    const renderer = new EditorObjectRenderer(fixture.service as any);

    expect(() => renderer.renderObjectCatalog()).not.toThrow();
    expect(fixture.manager.objectService.updateCategoryButtons).not.toHaveBeenCalled();
  });

  it('returns early in renderObjectCatalog for invalid/empty definitions', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);

    mockData.objectDefinitions = null as any;
    renderer.renderObjectCatalog();
    expect(fixture.manager.objectService.updateCategoryButtons).toHaveBeenCalledTimes(1);
    expect(fixture.service.dom.objectTypes.children).toHaveLength(0);

    mockData.objectDefinitions = [];
    renderer.renderObjectCatalog();
    expect(fixture.manager.objectService.updateCategoryButtons).toHaveBeenCalledTimes(2);
  });

  it('renders object catalog with selection, placed markers and sword stats', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    mockData.objectDefinitions = [
      { type: ITEM_TYPES.KEY, name: 'Key Local' },
      { type: ITEM_TYPES.SWORD, nameKey: 'obj.sword', name: 'Sword' },
      { type: ITEM_TYPES.DOOR, name: 'Door' }
    ];
    mockData.itemDefinitionMap.set(ITEM_TYPES.SWORD, makeSwordDef({ damage: 7, durability: 9 }));
    mockData.itemDefinitionMap.set(ITEM_TYPES.KEY, makeSwordDef({ isSword: false }));
    fixture.gameEngine.getObjectsForRoom.mockReturnValue([{ type: ITEM_TYPES.SWORD }, { type: ITEM_TYPES.DOOR }]);

    renderer.renderObjectCatalog();

    const cards = fixture.service.dom.objectTypes.querySelectorAll('.object-type-card');
    expect(cards).toHaveLength(3);
    expect(cards[0].classList.contains('selected')).toBe(true);
    expect(cards[1].classList.contains('placed')).toBe(true);
    expect(cards[2].classList.contains('placed')).toBe(true);
    expect(fixture.service.dom.objectTypes.querySelectorAll('canvas.object-type-preview')).toHaveLength(3);
    expect(fixture.service.dom.objectTypes.textContent).toContain('t:objects.info.placed');
    expect(fixture.service.dom.objectTypes.textContent).toContain('t:objects.info.available');
    expect(fixture.service.dom.objectTypes.querySelector('.object-type-stats')).not.toBeNull();
    expect(fixture.service.dom.objectTypes.querySelector('.object-stat-separator')?.textContent).toBe('⚔');
  });

  it('filters catalog by swords category and handles stats partial/null cases', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    fixture.service.state.objectCategoryFilter = 'swords';
    mockData.objectDefinitions = [
      { type: ITEM_TYPES.SWORD_BRONZE, name: 'Bronze' },
      { type: ITEM_TYPES.SWORD_WOOD, name: 'Wood' },
      { type: ITEM_TYPES.KEY, name: 'Key' }
    ];
    mockData.itemDefinitionMap.set(ITEM_TYPES.SWORD_BRONZE, makeSwordDef({ damage: 4, durability: null }));
    mockData.itemDefinitionMap.set(ITEM_TYPES.SWORD_WOOD, makeSwordDef({ damage: null, durability: null }));
    mockData.itemDefinitionMap.set(ITEM_TYPES.KEY, makeSwordDef({ isSword: false }));

    renderer.renderObjectCatalog();

    const cards = fixture.service.dom.objectTypes.querySelectorAll('.object-type-card');
    expect(cards).toHaveLength(2);
    expect((cards[0] as HTMLElement).dataset.type).toBe(ITEM_TYPES.SWORD_BRONZE);
    expect(fixture.service.dom.objectTypes.querySelector('.object-stat-damage')?.textContent).toBe('4');
    expect(fixture.service.dom.objectTypes.querySelector('.object-stat-separator')).toBeNull();
  });

  it('renders catalog with non-sword custom category as pass-through', () => {
    const fixture = createFixture();
    fixture.service.state.objectCategoryFilter = 'misc';
    const renderer = new EditorObjectRenderer(fixture.service as any);
    mockData.objectDefinitions = [{ type: ITEM_TYPES.KEY, name: 'Key' }];

    renderer.renderObjectCatalog();

    expect(fixture.service.dom.objectTypes.querySelectorAll('.object-type-card')).toHaveLength(1);
  });

  it('defaults catalog category to all and handles missing room objects', () => {
    const fixture = createFixture();
    fixture.service.state.objectCategoryFilter = undefined as any;
    fixture.gameEngine.getObjectsForRoom.mockReturnValue(undefined as any);
    mockData.objectDefinitions = [{ type: ITEM_TYPES.KEY, name: 'Key' }];
    const renderer = new EditorObjectRenderer(fixture.service as any);

    renderer.renderObjectCatalog();

    expect(fixture.service.dom.objectTypes.querySelectorAll('.object-type-card')).toHaveLength(1);
    expect(fixture.service.dom.objectTypes.querySelector('.object-type-card')?.classList.contains('placed')).toBe(false);
  });

  it('renders catalog sword stats with durability-only branch', () => {
    const fixture = createFixture();
    fixture.service.state.objectCategoryFilter = 'swords';
    mockData.objectDefinitions = [{ type: ITEM_TYPES.SWORD_WOOD, name: 'Wood' }];
    mockData.itemDefinitionMap.set(ITEM_TYPES.SWORD_WOOD, makeSwordDef({ damage: null, durability: 3 }));
    const renderer = new EditorObjectRenderer(fixture.service as any);

    renderer.renderObjectCatalog();

    expect(fixture.service.dom.objectTypes.querySelector('.object-stat-damage')).toBeNull();
    expect(fixture.service.dom.objectTypes.querySelector('.object-stat-durability')?.textContent).toBe('3');
  });

  it('returns early in renderObjects when list is missing', () => {
    const fixture = createFixture();
    fixture.service.dom.objectsList = null as any;
    const renderer = new EditorObjectRenderer(fixture.service as any);

    expect(() => renderer.renderObjects()).not.toThrow();
  });

  it('renders object cards, statuses and interactive controls', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    mockData.objectDefinitions = [
      { type: ITEM_TYPES.KEY, name: 'Key Def' },
      { type: ITEM_TYPES.PLAYER_END, nameKey: 'objects.end.named', name: 'Ending' }
    ];
    fixture.gameEngine.isVariableOn.mockReturnValueOnce(false);
    fixture.gameEngine.getObjectsForRoom.mockReturnValue([
      { type: ITEM_TYPES.SWITCH, roomIndex: 1, x: 1, y: 2, variableId: 'var-1', on: true },
      { type: ITEM_TYPES.DOOR_VARIABLE, roomIndex: 1, x: 2, y: 3, variableId: 'var-2' },
      { type: ITEM_TYPES.DOOR, roomIndex: 1, x: 3, y: 4, opened: true },
      { type: ITEM_TYPES.KEY, roomIndex: 1, x: 4, y: 5, collected: true },
      { type: ITEM_TYPES.LIFE_POTION, roomIndex: 1, x: 5, y: 6, collected: true },
      { type: ITEM_TYPES.XP_SCROLL, roomIndex: 1, x: 6, y: 7, collected: true },
      { type: ITEM_TYPES.SWORD, roomIndex: 1, x: 7, y: 8, collected: true },
      { type: ITEM_TYPES.SWORD_BRONZE, roomIndex: 1, x: 8, y: 9, collected: true },
      { type: ITEM_TYPES.SWORD_WOOD, roomIndex: 1, x: 9, y: 10, collected: true },
      { type: ITEM_TYPES.PLAYER_END, roomIndex: 1, x: 10, y: 11, endingText: 'bye' },
      { type: ITEM_TYPES.PLAYER_START, roomIndex: 1, x: 11, y: 12 }
    ] as any[]);

    renderer.renderObjects();

    const cards = fixture.service.dom.objectsList.querySelectorAll('.object-card');
    expect(cards).toHaveLength(11);
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.doorOpened');
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.keyCollected');
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.potionCollected');
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.scrollUsed');
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.swordBroken');
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.gameEnd');
    expect(fixture.service.dom.objectsList.textContent).toContain('t:objects.status.startMarker');
    expect(fixture.service.dom.objectsList.querySelectorAll('.object-remove')).toHaveLength(10);
    expect(fixture.service.dom.objectsList.querySelector('.object-config-textarea')?.getAttribute('maxlength')).toBe('80');
    expect(fixture.service.dom.objectsList.querySelector('.object-config-textarea')?.getAttribute('placeholder')).toContain('objects.end.placeholder');
    expect(fixture.tf).toHaveBeenCalledWith('objects.end.hint', { max: 80 }, '');

    const selects = fixture.service.dom.objectsList.querySelectorAll('select.object-config-select');
    expect(selects).toHaveLength(2);
    (selects[0] as HTMLSelectElement).value = 'var-2';
    selects[0].dispatchEvent(new Event('change'));
    expect(fixture.gameEngine.setObjectVariable).toHaveBeenCalledWith(ITEM_TYPES.SWITCH, 1, 'var-2');
    expect(fixture.worldRenderer.renderWorldGrid).toHaveBeenCalled();
    expect(fixture.renderEditor).toHaveBeenCalled();
    expect(fixture.manager.updateJSON).toHaveBeenCalled();
    expect(fixture.manager.history.pushCurrentState).toHaveBeenCalled();

    const textarea = fixture.service.dom.objectsList.querySelector('textarea.object-config-textarea') as HTMLTextAreaElement;
    textarea.value = 'The end';
    textarea.dispatchEvent(new Event('input'));
    expect(fixture.manager.objectService.updatePlayerEndText).toHaveBeenCalledWith(1, 'The end');
  });

  it('uses fallback player end text limit when constant is not numeric', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    mockData.playerEndTextLimit = 'x';
    fixture.gameEngine.getObjectsForRoom.mockReturnValue([
      { type: ITEM_TYPES.PLAYER_END, roomIndex: 1, x: 0, y: 0, endingText: '' }
    ] as any[]);

    renderer.renderObjects();

    expect(fixture.service.dom.objectsList.querySelector('textarea')?.getAttribute('maxlength')).toBe('40');
    expect(fixture.tf).toHaveBeenCalledWith('objects.end.hint', { max: 40 }, '');
  });

  it('uses empty fallback variable ids and missing room objects in renderObjects', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    fixture.gameEngine.getObjectsForRoom.mockReturnValueOnce(undefined as any).mockReturnValueOnce([
      { type: ITEM_TYPES.DOOR_VARIABLE, roomIndex: 1, x: 0, y: 0 }
    ] as any[]);

    renderer.renderObjects();
    expect(fixture.service.dom.objectsList.children).toHaveLength(0);

    renderer.renderObjects();
    expect(fixture.manager.npcService.populateVariableSelect).toHaveBeenCalledWith(expect.any(HTMLSelectElement), '');
    expect(fixture.gameEngine.isVariableOn).toHaveBeenCalledWith('');
  });

  it('drawObjectPreview returns early for invalid canvas and null context', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);

    expect(() => renderer.drawObjectPreview({} as any, ITEM_TYPES.KEY)).not.toThrow();

    const canvas = document.createElement('canvas');
    const getContextSpy = vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    renderer.drawObjectPreview(canvas, ITEM_TYPES.KEY);
    expect(getContextSpy).toHaveBeenCalledWith('2d');
    expect(fixture.gameEngine.renderer.drawObjectSprite).not.toHaveBeenCalled();
  });

  it('drawObjectPreview draws using renderer when canvas context exists', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: true
    } as any;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    renderer.drawObjectPreview(canvas, ITEM_TYPES.KEY);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 48, 48);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 48, 48);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(fixture.gameEngine.renderer.drawObjectSprite).toHaveBeenCalledWith(ctx, ITEM_TYPES.KEY, 0, 0, 6);
  });

  it('getObjectLabel prioritizes nameKey and explicit name', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);

    expect(renderer.getObjectLabel('custom', [{ type: 'custom', nameKey: 'k.name', name: 'Fallback' }])).toBe(
      't:k.name|Fallback'
    );
    expect(renderer.getObjectLabel('custom2', [{ type: 'custom2', name: 'Explicit' }])).toBe('Explicit');
  });

  it('getObjectLabel uses type as fallback when nameKey exists without name', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);

    expect(renderer.getObjectLabel('custom3', [{ type: 'custom3', nameKey: 'k.only' }])).toBe('t:k.only|custom3');
  });

  it('getObjectLabel covers built-in object types and default fallback', () => {
    const fixture = createFixture();
    const renderer = new EditorObjectRenderer(fixture.service as any);
    const defs: any[] = [];
    const cases = [
      ITEM_TYPES.DOOR,
      ITEM_TYPES.DOOR_VARIABLE,
      ITEM_TYPES.PLAYER_START,
      ITEM_TYPES.PLAYER_END,
      ITEM_TYPES.SWITCH,
      ITEM_TYPES.KEY,
      ITEM_TYPES.LIFE_POTION,
      ITEM_TYPES.SWORD,
      ITEM_TYPES.SWORD_BRONZE,
      ITEM_TYPES.SWORD_WOOD,
      ITEM_TYPES.XP_SCROLL
    ];

    cases.forEach((type) => {
      const label = renderer.getObjectLabel(type, defs);
      expect(label.startsWith('t:objects.label.')).toBe(true);
    });
    expect(renderer.getObjectLabel('unknown-type', defs)).toBe('unknown-type');
  });
});


