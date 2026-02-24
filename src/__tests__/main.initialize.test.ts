import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockEngine = {
  exportGameData: ReturnType<typeof vi.fn>;
  importGameData: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  draw: ReturnType<typeof vi.fn>;
  resetGame: ReturnType<typeof vi.fn>;
  updateTile: ReturnType<typeof vi.fn>;
  setMapTile: ReturnType<typeof vi.fn>;
  getTiles: ReturnType<typeof vi.fn>;
  getTileMap: ReturnType<typeof vi.fn>;
  getTilePresetNames: ReturnType<typeof vi.fn>;
  getVariableDefinitions: ReturnType<typeof vi.fn>;
  setVariableDefault: ReturnType<typeof vi.fn>;
  addSprite: ReturnType<typeof vi.fn>;
  getSprites: ReturnType<typeof vi.fn>;
  npcManager: { resetNPCs: ReturnType<typeof vi.fn> };
  tryMove: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const engine: MockEngine = {
    exportGameData: vi.fn(() => ({ title: 'Game' })),
    importGameData: vi.fn(),
    getState: vi.fn(() => ({ hp: 10 })),
    draw: vi.fn(),
    resetGame: vi.fn(),
    updateTile: vi.fn(),
    setMapTile: vi.fn(),
    getTiles: vi.fn(() => []),
    getTileMap: vi.fn(() => []),
    getTilePresetNames: vi.fn(() => ['default']),
    getVariableDefinitions: vi.fn(() => []),
    setVariableDefault: vi.fn(),
    addSprite: vi.fn(),
    getSprites: vi.fn(() => []),
    npcManager: { resetNPCs: vi.fn() },
    tryMove: vi.fn(),
  };

  const editorManagerInstance = {
    renderAll: vi.fn(),
  };

  return {
    engine,
    editorManagerInstance,
    GameEngineCtor: vi.fn(function GameEngineMock() { return engine; }),
    EditorManagerCtor: vi.fn(function EditorManagerMock() { return editorManagerInstance; }),
    EditorExportServiceCtor: vi.fn(function EditorExportServiceMock() { return {}; }),
    textGet: vi.fn<(key: string, fallback?: string) => string>((key: string, fallback = ''): string => fallback || key),
    textLocale: vi.fn(() => 'en-US'),
    textSetLocale: vi.fn(() => true),
  };
});

vi.mock('../runtime/services/GameEngine', () => ({
  GameEngine: mocks.GameEngineCtor,
}));

vi.mock('../editor/EditorManager', () => ({
  EditorManager: mocks.EditorManagerCtor,
}));

vi.mock('../editor/modules/EditorExportService', () => ({
  EditorExportService: mocks.EditorExportServiceCtor,
}));

vi.mock('../runtime/adapters/TextResources', () => ({
  TextResources: {
    get: (...args: [string, string?]) => mocks.textGet(...args),
    getLocale: () => mocks.textLocale(),
    setLocale: (...args: [string]) => mocks.textSetLocale(...args),
  },
}));

async function importMainModule() {
  vi.resetModules();
  return import('../main');
}

async function importApiModule() {
  return import('../runtime/infra/TinyRpgApi');
}

describe('TinyRPGApplication.initializeApplication / boot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).__TINY_RPG_EXPORT_MODE;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).__TINY_RPG_EXPORT_MODE;
  });

  it('initializeApplication returns early when #game-canvas is missing or invalid', async () => {
    document.body.innerHTML = `<div id="game-canvas"></div>`;
    const { TinyRPGApplication } = await importMainModule();
    const setupTabsSpy = vi.spyOn(TinyRPGApplication, 'setupTabs').mockImplementation(() => {});

    TinyRPGApplication.initializeApplication();

    expect(setupTabsSpy).toHaveBeenCalledTimes(1);
    expect(mocks.GameEngineCtor).not.toHaveBeenCalled();
    expect(mocks.EditorManagerCtor).not.toHaveBeenCalled();
  });

  it('initializeApplication wires engine/api/services and resets game on non-initial tab activations', async () => {
    document.body.innerHTML = `<canvas id="game-canvas"></canvas>`;
    const { TinyRPGApplication } = await importMainModule();
    const { getTinyRpgApi } = await importApiModule();

    const loadSharedSpy = vi.spyOn(TinyRPGApplication, 'loadSharedGameIfAvailable').mockImplementation(() => {});
    const bindResetSpy = vi.spyOn(TinyRPGApplication, 'bindResetButton').mockImplementation(() => {});
    const bindTouchSpy = vi.spyOn(TinyRPGApplication, 'bindTouchPad').mockImplementation(() => {});
    const bindLangSpy = vi.spyOn(TinyRPGApplication, 'bindLanguageSelector').mockImplementation(() => {});
    const setupTabsSpy = vi.spyOn(TinyRPGApplication, 'setupTabs').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    TinyRPGApplication.initializeApplication();

    expect(setupTabsSpy).toHaveBeenCalledTimes(1);
    expect(mocks.GameEngineCtor).toHaveBeenCalledTimes(1);
    expect(loadSharedSpy).toHaveBeenCalledWith(mocks.engine);
    expect(mocks.EditorManagerCtor).toHaveBeenCalledWith(mocks.engine);
    expect(mocks.EditorExportServiceCtor).toHaveBeenCalledTimes(1);
    expect(bindResetSpy).toHaveBeenCalledWith(mocks.engine);
    expect(bindTouchSpy).toHaveBeenCalledWith(mocks.engine);
    expect(bindLangSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled();

    const api = getTinyRpgApi();
    expect(api).not.toBeNull();
    if (!api) throw new Error('TinyRpgApi not set');
    expect(api.exportGameData()).toEqual({ title: 'Game' });
    api.importGameData({ foo: 'bar' });
    api.getState();
    api.draw();
    api.resetGame();
    api.updateTile('1', { a: 1 });
    api.setMapTile(1, 2, 3);
    api.getTiles();
    api.getTileMap();
    api.getTilePresetNames();
    api.getVariables();
    api.setVariableDefault(42, 'x');
    api.addSprite({ id: 'npc' });
    api.getSprites();
    api.resetNPCs();
    api.renderAll();

    expect(mocks.engine.importGameData).toHaveBeenCalledWith({ foo: 'bar' });
    expect(mocks.engine.getState).toHaveBeenCalled();
    expect(mocks.engine.updateTile).toHaveBeenCalledWith('1', { a: 1 });
    expect(mocks.engine.setVariableDefault).toHaveBeenCalledWith('42', 'x');
    expect(mocks.engine.npcManager.resetNPCs).toHaveBeenCalled();
    expect(mocks.editorManagerInstance.renderAll).toHaveBeenCalled();

    document.dispatchEvent(new CustomEvent('game-tab-activated', { detail: { initial: true } }));
    document.dispatchEvent(new CustomEvent('editor-tab-activated', { detail: { initial: true } }));
    const resetsAfterInitial = mocks.engine.resetGame.mock.calls.length;
    document.dispatchEvent(new CustomEvent('game-tab-activated', { detail: { initial: false } }));
    document.dispatchEvent(new CustomEvent('editor-tab-activated', { detail: { initial: false } }));
    expect(mocks.engine.resetGame.mock.calls.length).toBe(resetsAfterInitial + 2);
  });

  it('initializeApplication skips EditorManager in export mode and api.renderAll is safe', async () => {
    document.body.innerHTML = `<canvas id="game-canvas"></canvas>`;
    (globalThis as Record<string, unknown>).__TINY_RPG_EXPORT_MODE = true;
    const { TinyRPGApplication } = await importMainModule();
    const { getTinyRpgApi } = await importApiModule();
    vi.spyOn(TinyRPGApplication, 'setupTabs').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'loadSharedGameIfAvailable').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindResetButton').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindTouchPad').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindLanguageSelector').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    TinyRPGApplication.initializeApplication();

    expect(mocks.EditorManagerCtor).not.toHaveBeenCalled();
    const api = getTinyRpgApi();
    expect(api).not.toBeNull();
    api?.renderAll();
    expect(mocks.editorManagerInstance.renderAll).not.toHaveBeenCalled();
  });

  it('boot registers DOMContentLoaded handler that initializes app and responsive canvas', async () => {
    const { TinyRPGApplication } = await importMainModule();
    const initSpy = vi.spyOn(TinyRPGApplication, 'initializeApplication').mockImplementation(() => {});
    const responsiveSpy = vi.spyOn(TinyRPGApplication, 'setupResponsiveCanvas').mockImplementation(() => {});

    TinyRPGApplication.boot();
    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(initSpy).toHaveBeenCalled();
    expect(responsiveSpy).toHaveBeenCalled();
  });
});
