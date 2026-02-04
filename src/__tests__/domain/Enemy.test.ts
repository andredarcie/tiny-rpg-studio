import { describe, it, expect } from 'vitest';
import { Enemy } from '../../runtime/domain/entities/Enemy';

describe('Enemy', () => {
  const sprite = [[0]] as (number | null)[][];

  it('matches type and aliases', () => {
    const enemy = new Enemy({
      type: 'goblin',
      id: 'enemy-goblin',
      name: 'Goblin',
      nameKey: 'enemy.goblin',
      description: 'test',
      damage: 1,
      missChance: 0.2,
      experience: 3,
      hasEyes: true,
      aliases: ['green'],
      sprite,
    });

    expect(enemy.matchesType('goblin')).toBe(true);
    expect(enemy.matchesType('green')).toBe(true);
    expect(enemy.matchesType('')).toBe(false);
    expect(enemy.matchesType('orc')).toBe(false);
  });

  it('normalizes experience reward values', () => {
    const enemy = new Enemy({
      type: 'goblin',
      id: 'enemy-goblin',
      name: 'Goblin',
      nameKey: 'enemy.goblin',
      description: 'test',
      damage: 1,
      missChance: 0.2,
      experience: 3.9,
      hasEyes: true,
      sprite,
    });

    expect(enemy.getExperienceReward()).toBe(3);

    const negative = new Enemy({
      type: 'bad',
      id: 'enemy-bad',
      name: 'Bad',
      nameKey: 'enemy.bad',
      description: 'test',
      damage: 1,
      missChance: 0.2,
      experience: -2,
      hasEyes: true,
      sprite,
    });

    expect(negative.getExperienceReward()).toBe(0);
  });

  it('clamps miss chance to [0, 1] and handles invalid values', () => {
    const enemy = new Enemy({
      type: 'goblin',
      id: 'enemy-goblin',
      name: 'Goblin',
      nameKey: 'enemy.goblin',
      description: 'test',
      damage: 1,
      missChance: 2,
      experience: 3,
      hasEyes: true,
      sprite,
    });

    expect(enemy.getMissChance()).toBe(1);

    const negative = new Enemy({
      type: 'bad',
      id: 'enemy-bad',
      name: 'Bad',
      nameKey: 'enemy.bad',
      description: 'test',
      damage: 1,
      missChance: -0.5,
      experience: 3,
      hasEyes: true,
      sprite,
    });

    expect(negative.getMissChance()).toBe(0);

    const invalid = new Enemy({
      type: 'nan',
      id: 'enemy-nan',
      name: 'NaN',
      nameKey: 'enemy.nan',
      description: 'test',
      damage: 1,
      missChance: Number.NaN,
      experience: 3,
      hasEyes: true,
      sprite,
    });

    expect(invalid.getMissChance()).toBeNull();
  });
});
