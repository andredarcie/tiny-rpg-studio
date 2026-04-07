
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

    // Level slot structure: how many skills appear at each level milestone.
    static DEFAULT_LEVEL_SLOTS: Array<{ level: number; count: number }> = [
        { level: 2, count: 2 },
        { level: 4, count: 1 },
        { level: 6, count: 1 },
        { level: 8, count: 1 },
        { level: 10, count: 1 },
    ];

    static getAll(): Skill[] {
        return this.SKILLS;
    }

    /** Returns the default flat skill order derived from LEVEL_SKILLS and DEFAULT_LEVEL_SLOTS. */
    static getDefaultSkillOrder(): string[] {
        const flat: string[] = [];
        for (const slot of this.DEFAULT_LEVEL_SLOTS) {
            const ids = (this.LEVEL_SKILLS[slot.level] || []) as string[];
            flat.push(...ids);
        }
        return flat;
    }

    /** Remaps skills to level slots according to a custom order. */
    static getLevelSkillsForOrder(skillOrder: string[]): Partial<Record<number, string[]>> {
        const result: Partial<Record<number, string[]>> = {};
        let index = 0;
        for (const slot of this.DEFAULT_LEVEL_SLOTS) {
            const ids = skillOrder.slice(index, index + slot.count).filter((id) => !!this.getById(id));
            if (ids.length) {
                result[slot.level] = ids;
            }
            index += slot.count;
        }
        return result;
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

    static buildQueueForLevel(level: number, carryover: string[] = [], owned: string[] = [], skillOrder?: string[]): string[] {
        const normalizedCarry = Array.isArray(carryover) ? carryover : [];
        const ownedSet = new Set(Array.isArray(owned) ? owned : []);
        const levelSkillMap = skillOrder ? this.getLevelSkillsForOrder(skillOrder) : this.LEVEL_SKILLS;
        const numeric = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
        const list = levelSkillMap[numeric] || [];
        const base: string[] = [];
        (Array.isArray(list) ? list : []).forEach((id) => {
            if (typeof id !== 'string' || !id) return;
            if (!this.getById(id)) return;
            if (!base.includes(id)) base.push(id);
        });
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
            const fallback = skillOrder
                ? skillOrder.filter((id) => this.getById(id) && !ownedSet.has(id))
                : this.getAll().filter((skill) => !ownedSet.has(skill.id)).map((s) => s.id);
            fallback.forEach((id) => {
                if (!queue.includes(id)) queue.push(id);
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
