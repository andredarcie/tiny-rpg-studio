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
declare class Enemy {
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
    constructor(data: EnemyDefinitionData);
    matchesType(type: string): boolean;
    getExperienceReward(): number;
    getMissChance(): number | null;
}
export type { EnemyDefinitionData, SpriteMatrix };
export { Enemy };
