
import { Skill } from '../entities/Skill';
import type { SkillDefinitionData } from '../entities/Skill';

/**
 * SkillDefinitions centralizes the available level-up skills.
 */
class SkillDefinitions {
    static SKILL_DEFINITION_DATA: SkillDefinitionData[] = [
        {
            id: 'keyless-doors',
            nameKey: 'skills.keylessDoors.name',
            descriptionKey: 'skills.keylessDoors.desc',
            icon: '🔑'
        },
        {
            id: 'charisma',
            nameKey: 'skills.charisma.name',
            descriptionKey: 'skills.charisma.desc',
            icon: '🗣️'
        },
        {
            id: 'necromancer',
            nameKey: 'skills.necromancer.name',
            descriptionKey: 'skills.necromancer.desc',
            icon: '☠️'
        },
        {
            id: 'stealth',
            nameKey: 'skills.stealth.name',
            descriptionKey: 'skills.stealth.desc',
            icon: '🕶️'
        },
        {
            id: 'lava-walker',
            nameKey: 'skills.lavaWalker.name',
            descriptionKey: 'skills.lavaWalker.desc',
            icon: '🔥'
        },
        {
            id: 'potion-master',
            nameKey: 'skills.potionMaster.name',
            descriptionKey: 'skills.potionMaster.desc',
            icon: '🧪'
        },
    ];

    static SKILLS: Skill[] = SkillDefinitions.SKILL_DEFINITION_DATA.map((entry) => new Skill(entry));

    static LEVEL_SKILLS: Partial<Record<number, string[]>> = {
        2: ['necromancer', 'charisma'],
        4: ['stealth'],
        6: ['potion-master'],
        8: ['lava-walker'],
        10: ['keyless-doors']
    };

    static getAll(): Skill[] {
        return this.SKILLS;
    }

    static getById(id: string | null | undefined): Skill | null {
        if (typeof id !== 'string' || !id) return null;
        return this.SKILLS.find((skill) => skill.id === id) || null;
    }

    static getSkillsForLevel(level: number): string[] {
        const numeric = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
        const list = this.LEVEL_SKILLS[numeric] || [];
        if (!Array.isArray(list)) return [];
        const unique: string[] = [];
        list.forEach((id) => {
            if (typeof id !== 'string' || !id) return;
            if (!this.getById(id)) return;
            if (!unique.includes(id)) {
                unique.push(id);
            }
        });
        return unique;
    }

    static buildQueueForLevel(level: number, carryover: string[] = [], owned: string[] = []): string[] {
        const normalizedCarry = Array.isArray(carryover) ? carryover : [];
        const ownedSet = new Set(Array.isArray(owned) ? owned : []);
        const base = this.getSkillsForLevel(level);
        const queue: string[] = [];
        [...normalizedCarry, ...base].forEach((id) => {
            if (typeof id !== 'string' || !id) return;
            if (ownedSet.has(id)) return;
            if (!this.getById(id)) return;
            if (!queue.includes(id)) {
                queue.push(id);
            }
        });
        if (!queue.length) {
            this.getAll().forEach((skill) => {
                if (!ownedSet.has(skill.id) && !queue.includes(skill.id)) {
                    queue.push(skill.id);
                }
            });
        }
        return queue;
    }

    static pickRandom(count = 2, exclude: string[] = []) {
        const normalized = Array.isArray(exclude) ? exclude : [];
        const pool = this.getAll().filter((skill) => !normalized.includes(skill.id));
        if (!pool.length) return [];
        const shuffled = this.shuffle(pool);
        return shuffled.slice(0, Math.max(1, Math.min(count, shuffled.length)));
    }

    static shuffle(list: Skill[]): Skill[] {
        const arr = Array.isArray(list) ? list.slice() : [];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

export { SkillDefinitions };
