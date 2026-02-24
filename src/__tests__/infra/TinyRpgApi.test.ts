import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTinyRpgApi, setTinyRpgApi, type TinyRpgApi } from '../../runtime/infra/TinyRpgApi';

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
