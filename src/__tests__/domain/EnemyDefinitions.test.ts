import { describe, it, expect } from 'vitest';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';

describe('EnemyDefinitions', () => {
  it('finds enemy definitions by type and alias', () => {
    const direct = EnemyDefinitions.getEnemyDefinition('skeleton');
    const byAlias = EnemyDefinitions.getEnemyDefinition('skull');

    expect(direct).not.toBeNull();
    expect(byAlias).not.toBeNull();
    expect(direct?.type).toBe('skeleton');
    expect(byAlias?.type).toBe('skeleton');
  });

  it('normalizes unknown types to the default', () => {
    const normalized = EnemyDefinitions.normalizeType('unknown-enemy');
    const fallback = EnemyDefinitions.getDefault()?.type;

    expect(normalized).toBe(fallback ?? 'giant-rat');
  });

  it('returns rewards and miss chance for known enemies', () => {
    expect(EnemyDefinitions.getExperienceReward('giant-rat')).toBeGreaterThan(0);
    expect(EnemyDefinitions.getMissChance('giant-rat')).not.toBeNull();
  });

  it('returns safe defaults for unknown enemies', () => {
    expect(EnemyDefinitions.getExperienceReward('nope')).toBe(0);
    expect(EnemyDefinitions.getMissChance('nope')).toBeNull();
  });
});
