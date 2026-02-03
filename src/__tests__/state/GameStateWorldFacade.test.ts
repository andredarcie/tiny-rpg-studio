import { describe, it, expect, vi } from 'vitest';
import { GameStateWorldFacade } from '../../runtime/domain/state/GameStateWorldFacade';
import type { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import type { GameState } from '../../runtime/domain/GameState';
import type { RoomDefinition } from '../../types/gameState';
import type { TileMap } from '../../runtime/domain/definitions/tileTypes';

describe('GameStateWorldFacade', () => {
  it('delegates world creation helpers to the world manager', () => {
    const worldManager = {
      createEmptyRoom: vi.fn(() => ({ size: 8 } as RoomDefinition)),
      createWorldRooms: vi.fn(() => [{ size: 8 } as RoomDefinition]),
      createEmptyTileMap: vi.fn(() => ({ ground: [], overlay: [] } as TileMap)),
      normalizeRooms: vi.fn(() => [] as RoomDefinition[]),
      normalizeTileMaps: vi.fn(() => [] as TileMap[]),
    } as unknown as StateWorldManager;

    const gameState = {} as GameState;
    const facade = new GameStateWorldFacade(gameState, worldManager);

    facade.createEmptyRoom(8, 1, 2);
    facade.createWorldRooms(2, 3, 8);
    facade.createEmptyTileMap(4);
    facade.normalizeRooms([{ size: 8 }], 4, 2);
    facade.normalizeTileMaps([{ ground: [], overlay: [] }], 4);

    expect(worldManager.createEmptyRoom).toHaveBeenCalledWith(8, 1, 2);
    expect(worldManager.createWorldRooms).toHaveBeenCalledWith(2, 3, 8);
    expect(worldManager.createEmptyTileMap).toHaveBeenCalledWith(4);
    expect(worldManager.normalizeRooms).toHaveBeenCalledWith([{ size: 8 }], 4, 2);
    expect(worldManager.normalizeTileMaps).toHaveBeenCalledWith([{ ground: [], overlay: [] }], 4);
  });
});
