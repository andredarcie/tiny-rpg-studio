import { Skill } from '../entities/Skill';
import type { SkillDefinitionData } from '../entities/Skill';
/**
 * SkillDefinitions centralizes the available level-up skills.
 */
declare class SkillDefinitions {
    static SKILL_DEFINITION_DATA: SkillDefinitionData[];
    static SKILLS: Skill[];
    static LEVEL_SKILLS: Partial<Record<number, string[]>>;
    static getAll(): Skill[];
    static getById(id: string | null | undefined): Skill | null;
    static getSkillsForLevel(level: number): string[];
    static buildQueueForLevel(level: number, carryover?: string[], owned?: string[]): string[];
    static pickRandom(count?: number, exclude?: string[]): Skill[];
    static shuffle(list: Skill[]): Skill[];
}
export { SkillDefinitions };
