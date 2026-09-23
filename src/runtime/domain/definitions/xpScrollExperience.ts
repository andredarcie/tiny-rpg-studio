import { GameConfig } from '../../../config/GameConfig';

const DEFAULT_XP_SCROLL_EXPERIENCE = Math.max(1, Math.floor(GameConfig.player.experienceBase * 0.5));

function normalizeXpScrollExperienceOverride(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined;
    return value === DEFAULT_XP_SCROLL_EXPERIENCE ? undefined : value;
}

export { DEFAULT_XP_SCROLL_EXPERIENCE, normalizeXpScrollExperienceOverride };
