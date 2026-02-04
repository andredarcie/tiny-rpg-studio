import { describe, it, expect, vi } from 'vitest';
import { GameStateDataFacade } from '../../runtime/domain/state/GameStateDataFacade';
import type { StateDataManager } from '../../runtime/domain/state/StateDataManager';
import type { GameState } from '../../runtime/domain/GameState';

describe('GameStateDataFacade', () => {
  it('delegates export to the data manager', () => {
    const dataManager = {
      exportGameData: vi.fn(() => ({ ok: true })),
    } as unknown as StateDataManager;
    const gameState = {} as GameState;

    const facade = new GameStateDataFacade(gameState, dataManager);

    expect(facade.exportGameData()).toEqual({ ok: true });
    expect(dataManager.exportGameData).toHaveBeenCalledTimes(1);
  });

  it('imports game data and refreshes managers/state', () => {
    const dataManager = {
      importGameData: vi.fn(),
    } as unknown as StateDataManager;

    const enemyManager = { setGame: vi.fn() };
    const itemManager = { setGame: vi.fn() };
    const objectManager = { setGame: vi.fn() };
    const variableManager = { setGame: vi.fn() };

    const gameState = {
      game: { title: 'Game' },
      enemyManager,
      itemManager,
      objectManager,
      variableManager,
      ensureDefaultVariables: vi.fn(),
      resetGame: vi.fn(),
    } as unknown as GameState;

    const facade = new GameStateDataFacade(gameState, dataManager);
    const payload = { title: 'New' };

    facade.importGameData(payload);

    expect(dataManager.importGameData).toHaveBeenCalledWith(payload);
    expect(enemyManager.setGame).toHaveBeenCalledWith(gameState.game);
    expect(itemManager.setGame).toHaveBeenCalledWith(gameState.game);
    expect(objectManager.setGame).toHaveBeenCalledWith(gameState.game);
    expect(variableManager.setGame).toHaveBeenCalledWith(gameState.game);
    expect(gameState.ensureDefaultVariables).toHaveBeenCalledTimes(1);
    expect(gameState.resetGame).toHaveBeenCalledTimes(1);
  });
});
