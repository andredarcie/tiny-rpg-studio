import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  installPwaUpdateChecks: vi.fn(),
  GameEngineCtor: vi.fn(function GameEngineMock() {
    return {
      exportGameData: vi.fn(),
      importGameData: vi.fn(),
      getState: vi.fn(),
      draw: vi.fn(),
      resetGame: vi.fn(),
      updateTile: vi.fn(),
      setMapTile: vi.fn(),
      getTiles: vi.fn(() => []),
      getTileMap: vi.fn(() => []),
      getTilePresetNames: vi.fn(() => []),
      getVariableDefinitions: vi.fn(() => []),
      setVariableDefault: vi.fn(),
      addSprite: vi.fn(),
      getSprites: vi.fn(() => []),
      npcManager: { resetNPCs: vi.fn() },
    };
  }),
}));

vi.mock('../../pwa/installPwaUpdateChecks', () => ({
  installPwaUpdateChecks: mocks.installPwaUpdateChecks,
}));

vi.mock('../../runtime/services/GameEngine', () => ({
  GameEngine: mocks.GameEngineCtor,
}));

vi.mock('../../editor/modules/EditorExportService', () => ({
  EditorExportService: vi.fn(),
}));

vi.mock('../../editor/modules/ExploreModal', () => ({
  ExploreModal: vi.fn(),
}));

vi.mock('../../editor/modules/DevlogModal', () => ({
  DevlogModal: vi.fn(),
}));

vi.mock('../../editor/modules/AboutModal', () => ({
  AboutModal: vi.fn(),
}));

vi.mock('../../analytics/loadAnalytics', () => ({
  loadAnalyticsWhenIdle: vi.fn(),
}));

import { TinyRPGApplication } from '../../main';
import { installPwaUpdateChecks } from '../../pwa/installPwaUpdateChecks';

describe('TinyRPGApplication PWA update startup', () => {
  beforeEach(() => {
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
    vi.clearAllMocks();
    vi.spyOn(TinyRPGApplication, 'setupTabs').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'loadSharedGameIfAvailable').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindResetButton').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindFullscreenButton').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindBackgroundMusicVolumeControl').mockImplementation(() => {});
    vi.spyOn(TinyRPGApplication, 'bindLanguageSelector').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('installs PWA update checks after the app boot path is ready', () => {
    TinyRPGApplication.initializeApplication();

    expect(installPwaUpdateChecks).toHaveBeenCalledTimes(1);
    const options = vi.mocked(installPwaUpdateChecks).mock.calls[0]?.[0];
    expect(typeof options?.dirtyState?.hasUnsavedChanges).toBe('function');
    expect(typeof options?.dirtyState?.saveBeforeUpdate).toBe('function');
  });
});
