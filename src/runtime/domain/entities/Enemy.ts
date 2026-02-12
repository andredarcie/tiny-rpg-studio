type SpriteMatrix = (number | null)[][];

type EnemyDefinitionData = {
    type: string;
    id: string;
    name: string;
    nameKey: string;
    description: string;
    lives: number;
    damage: number;
    missChance: number;
    experience: number;
    hasEyes: boolean;
    sprite: SpriteMatrix;
    aliases?: string[];
    boss?: boolean;
    defeatActivationMessage?: string;
    defeatActivationMessageKey?: string;
    activateVariableOnDefeat?: {
        variableId: string;
        message?: string;
        persist?: boolean;
    };
};

class Enemy {
    type: string;
    id: string;
    name: string;
    nameKey: string;
    description: string;
    lives: number;
    damage: number;
    missChance: number;
    experience: number;
    hasEyes: boolean;
    sprite: SpriteMatrix;
    aliases?: string[];
    boss?: boolean;
    defeatActivationMessage?: string;
    defeatActivationMessageKey?: string;
    activateVariableOnDefeat?: {
        variableId: string;
        message?: string;
        persist?: boolean;
    };

    constructor(data: EnemyDefinitionData) {
        this.type = data.type;
        this.id = data.id;
        this.name = data.name;
        this.nameKey = data.nameKey;
        this.description = data.description;
        this.lives = data.lives;
        this.damage = data.damage;
        this.missChance = data.missChance;
        this.experience = data.experience;
        this.hasEyes = data.hasEyes;
        this.sprite = data.sprite;
        this.aliases = data.aliases;
        this.boss = data.boss;
        this.defeatActivationMessage = data.defeatActivationMessage;
        this.defeatActivationMessageKey = data.defeatActivationMessageKey;
        this.activateVariableOnDefeat = data.activateVariableOnDefeat;
    }

    matchesType(type: string): boolean {
        if (!type) return false;
        if (this.type === type) return true;
        return Array.isArray(this.aliases) && this.aliases.includes(type);
    }

    getExperienceReward(): number {
        const reward = Number(this.experience);
        if (!Number.isFinite(reward)) return 0;
        return Math.max(0, Math.floor(reward));
    }

    getMissChance(): number | null {
        const value = Number(this.missChance);
        if (!Number.isFinite(value)) return null;
        return Math.max(0, Math.min(1, value));
    }
}

export type { EnemyDefinitionData, SpriteMatrix };
export { Enemy };
