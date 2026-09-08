import { EnemyDefinitions } from './EnemyDefinitions';

const MAX_ENEMY_EXPERIENCE = 16;

function normalizeEnemyExperienceOverride(type: string | null | undefined, value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined;
    const capped = Math.min(value, MAX_ENEMY_EXPERIENCE);
    return capped === EnemyDefinitions.getExperienceReward(EnemyDefinitions.normalizeType(type))
        ? undefined
        : capped;
}

function getEnemyExperienceReward(type: string | null | undefined, override: unknown): number {
    return normalizeEnemyExperienceOverride(type, override)
        ?? EnemyDefinitions.getExperienceReward(EnemyDefinitions.normalizeType(type));
}

export { getEnemyExperienceReward, MAX_ENEMY_EXPERIENCE, normalizeEnemyExperienceOverride };
