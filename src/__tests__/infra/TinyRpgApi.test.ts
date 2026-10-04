import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTinyRpgApi, setTinyRpgApi, type TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import * as adapter from '../../runtime/infra/BaseRuntimeApi';
import type { GameEngine } from '../../runtime/services/GameEngine';

const createApiStub = (): TinyRpgApi => ({
  exportGameData: vi.fn(),
  importGameData: vi.fn(),
  getState: vi.fn(),
  draw: vi.fn(),
  resetGame: vi.fn(),
  updateTile: vi.fn(),
  setMapTile: vi.fn(),
  getTiles: vi.fn(),
  getTileMap: vi.fn(),
  getTilePresetNames: vi.fn(() => []),
  getVariables: vi.fn(),
  setVariableDefault: vi.fn(),
  addSprite: vi.fn(),
  getSprites: vi.fn(),
  resetNPCs: vi.fn(),
  renderAll: vi.fn(),
});

describe('TinyRpgApi module state', () => {
  it('binds runtime APIs to their own engines and copies inspection data', () => {
    const first = { getState: () => ({ player: { x: 1 } }), tryMove: vi.fn(), destroy: vi.fn() };
    const second = { getState: () => ({ player: { x: 2 } }), tryMove: vi.fn(), destroy: vi.fn() };
    const a = adapter.createBaseRuntimeApi(first as unknown as GameEngine);
    const b = adapter.createBaseRuntimeApi(second as unknown as GameEngine);
    a.tryMove(1, 0);
    expect(first.tryMove).toHaveBeenCalledWith(1, 0);
    expect(second.tryMove).not.toHaveBeenCalled();
    expect(a.getState().player.x).toBe(1);
    expect(b.getState().player.x).toBe(2);
    a.destroy(); a.destroy();
    expect(first.destroy).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    setTinyRpgApi(null);
  });

  it('returns null by default', () => {
    expect(getTinyRpgApi()).toBeNull();
  });

  it('stores and returns the current API instance', () => {
    const api = createApiStub();

    setTinyRpgApi(api);

    expect(getTinyRpgApi()).toBe(api);
  });

  it('replaces a previous API instance and can reset back to null', () => {
    const firstApi = createApiStub();
    const secondApi = createApiStub();

    setTinyRpgApi(firstApi);
    setTinyRpgApi(secondApi);
    expect(getTinyRpgApi()).toBe(secondApi);

    setTinyRpgApi(null);
    expect(getTinyRpgApi()).toBeNull();
  });
});
