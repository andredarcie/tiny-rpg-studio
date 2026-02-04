import { describe, expect, it } from 'vitest';
import { StateEnemyManager } from '../../runtime/domain/state/StateEnemyManager';
import type { EnemyDefinition } from '../../types/gameState';

const createWorldManager = () => ({
  clampRoomIndex: (value: number) => {
    const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.max(0, Math.min(8, numeric));
  },
  clampCoordinate: (value: number) => {
    const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.max(0, Math.min(7, numeric));
  },
});

describe('StateEnemyManager', () => {
  it('keeps only one boss enemy at a time', () => {
    const game: { enemies: unknown[]; variables: unknown[] } = { enemies: [], variables: [] };
    const state: { enemies: unknown[] } = { enemies: [] };
    const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

    manager.addEnemy({ id: 'boss-1', type: 'dragon', roomIndex: 0, x: 1, y: 1, lastX: 1 });
    manager.addEnemy({ id: 'boss-2', type: 'dragon', roomIndex: 1, x: 2, y: 2, lastX: 2 });

    expect(game.enemies.length).toBe(1);
    expect(state.enemies.length).toBe(1);
    expect((game.enemies[0] as { id: string }).id).toBe('boss-2');
  });

  it('limits enemies per room', () => {
    const game: { enemies: unknown[]; variables: unknown[] } = { enemies: [], variables: [] };
    const state: { enemies: unknown[] } = { enemies: [] };
    const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

    for (let i = 0; i < 6; i += 1) {
      manager.addEnemy({ id: `enemy-${i}`, type: 'giant-rat', roomIndex: 0, x: i, y: 0, lastX: i });
    }

    const rejected = manager.addEnemy({ id: 'enemy-7', type: 'giant-rat', roomIndex: 0, x: 7, y: 0, lastX: 7 });

    expect(rejected).toBe(null);
    expect(game.enemies.length).toBe(6);
  });

  describe('Game Reset Bug - Enemy State Not Cleared', () => {
    it('should reset playerInVision to false when cloning enemies for game restart', () => {
      const game = {
        enemies: [
          {
            id: 'enemy-1',
            type: 'rat',
            roomIndex: 0,
            x: 2,
            y: 2,
            lastX: 2,
            playerInVision: true,
          },
        ] as EnemyDefinition[],
        variables: [],
      };
      const state = { enemies: [] as EnemyDefinition[] };
      const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

      manager.resetRuntime();

      expect(state.enemies.length).toBe(1);
      expect(state.enemies[0].playerInVision).toBe(false);
    });

    it('should reset alertUntil to null when cloning enemies for game restart', () => {
      const game = {
        enemies: [
          {
            id: 'enemy-2',
            type: 'skeleton',
            roomIndex: 1,
            x: 3,
            y: 3,
            lastX: 3,
            alertUntil: 5000,
          },
        ] as EnemyDefinition[],
        variables: [],
      };
      const state = { enemies: [] as EnemyDefinition[] };
      const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

      manager.resetRuntime();

      expect(state.enemies.length).toBe(1);
      expect(state.enemies[0].alertUntil).toBe(null);
    });

    it('should reset alertStart to null when cloning enemies for game restart', () => {
      const game = {
        enemies: [
          {
            id: 'enemy-3',
            type: 'goblin',
            roomIndex: 2,
            x: 4,
            y: 4,
            lastX: 4,
            alertStart: 3000,
          },
        ] as EnemyDefinition[],
        variables: [],
      };
      const state = { enemies: [] as EnemyDefinition[] };
      const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

      manager.resetRuntime();

      expect(state.enemies.length).toBe(1);
      expect(state.enemies[0].alertStart).toBe(null);
    });

    it('should reset all vision and alert state when enemy had all flags set', () => {
      const game = {
        enemies: [
          {
            id: 'enemy-4',
            type: 'dragon',
            roomIndex: 3,
            x: 5,
            y: 5,
            lastX: 5,
            playerInVision: true,
            alertUntil: 10000,
            alertStart: 8000,
          },
        ] as EnemyDefinition[],
        variables: [],
      };
      const state = { enemies: [] as EnemyDefinition[] };
      const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

      manager.resetRuntime();

      const resetEnemy = state.enemies[0];
      expect(resetEnemy.playerInVision).toBe(false);
      expect(resetEnemy.alertUntil).toBe(null);
      expect(resetEnemy.alertStart).toBe(null);
    });

    it('should handle multiple enemies with mixed vision states on reset', () => {
      const game = {
        enemies: [
          {
            id: 'enemy-5',
            type: 'rat',
            roomIndex: 0,
            x: 1,
            y: 1,
            lastX: 1,
            playerInVision: true,
            alertUntil: 2000,
          },
          {
            id: 'enemy-6',
            type: 'skeleton',
            roomIndex: 0,
            x: 3,
            y: 3,
            lastX: 3,
            playerInVision: false,
          },
          {
            id: 'enemy-7',
            type: 'goblin',
            roomIndex: 1,
            x: 5,
            y: 5,
            lastX: 5,
            playerInVision: true,
            alertStart: 1500,
            alertUntil: 3500,
          },
        ] as EnemyDefinition[],
        variables: [],
      };
      const state = { enemies: [] as EnemyDefinition[] };
      const manager = new StateEnemyManager(game as never, state as never, createWorldManager() as never);

      manager.resetRuntime();

      expect(state.enemies.length).toBe(3);
      state.enemies.forEach((enemy) => {
        expect(enemy.playerInVision).toBe(false);
        expect(enemy.alertUntil).toBe(null);
        expect(enemy.alertStart).toBe(null);
      });
    });
  });
});
