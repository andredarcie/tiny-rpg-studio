import { Enemy } from '../entities/Enemy';
import type { EnemyDefinitionData } from '../entities/Enemy';
import type { EnemyDefinition } from '../../../types/gameState';
type EnemyTypeInput = string | null | undefined;
/**
 * EnemyDefinitions centralizes the enemies available in the editor.
 */
declare class EnemyDefinitions {
    static ENEMY_DEFINITION_DATA: EnemyDefinitionData[];
    static ENEMY_DEFINITIONS: Enemy[];
    static get definitions(): Enemy[];
    static getDefault(): Enemy | null;
    static getEnemyDefinition(type: EnemyTypeInput): Enemy | null;
    static normalizeType(type: EnemyTypeInput): string;
    static getExperienceReward(type: EnemyTypeInput): number;
    static getMissChance(type: EnemyTypeInput): number | null;
    /**
     * Checks if an enemy instance is currently in the death animation.
     * @param enemy - The enemy runtime state to check
     * @returns true if the enemy is dying (death animation in progress), false otherwise
     */
    static isDying(enemy: EnemyDefinition): boolean;
}
export { EnemyDefinitions };
