import { describe, expect, it } from 'vitest';
import { GameState } from '../runtime/domain/GameState';
import { EnemyDefinitions } from '../runtime/domain/definitions/EnemyDefinitions';

describe('respawnable enemies', () => {
  it.each([
    [false, false, []], [true, false, ['rat']],
    [false, true, ['dragon']], [true, true, ['rat', 'dragon']],
  ])('restores selected categories with settings %s/%s', (normal, bosses, expected) => {
    const state = new GameState();
    state.game.enemies = [
      { id: 'rat', type: 'rat', roomIndex: 1, x: 2, y: 3, lastX: 2 },
      { id: 'dragon', type: 'dragon', roomIndex: 1, x: 4, y: 5, lastX: 4 },
    ];
    state.game.respawnableEnemies = normal;
    state.game.respawnableBosses = bosses;
    state.state.enemies = [];
    state.respawnEnemiesInRoom(1);
    expect(state.getEnemies().map(enemy => enemy.id)).toEqual(expected);
    expect(state.getEnemies().every(enemy => (enemy.lives ?? 0) > 0)).toBe(true);
    for (const enemy of state.getEnemies()) {
      const authored = state.game.enemies.find(entry => entry.id === enemy.id);
      expect(enemy).toMatchObject({ x: authored?.x, y: authored?.y, lastX: authored?.x });
      expect(enemy.lives).toBe(EnemyDefinitions.getEnemyDefinition(enemy.type)?.lives);
    }
    state.respawnEnemiesInRoom(1);
    expect(state.getEnemies()).toHaveLength(expected.length);
  });

  it('keeps living and dying instances, and defaults invalid imported settings off', () => {
    const state = new GameState();
    state.game.respawnableEnemies = true;
    state.game.enemies = [
      { id: 'living', type: 'giant-rat', roomIndex: 1, x: 2, y: 3, lastX: 2 },
      { id: 'dying', type: 'giant-rat', roomIndex: 1, x: 4, y: 5, lastX: 4 },
    ];
    const living = { ...state.game.enemies[0], x: 6, lives: 0.5 };
    const dying = { ...state.game.enemies[1], lives: 0, deathStartTime: 100 };
    state.state.enemies = [living, dying];
    expect(state.respawnEnemiesInRoom(1)).toBe(0);
    expect(state.getEnemies()).toEqual([living, dying]);
    const data = { ...(state.exportGameData() as Record<string, unknown>), respawnableEnemies: 'true', respawnableBosses: 1 };
    state.importGameData(data as never);
    expect(state.game.respawnableEnemies).toBe(false);
    expect(state.game.respawnableBosses).toBe(false);
  });
});
