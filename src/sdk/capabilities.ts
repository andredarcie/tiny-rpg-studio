import { NPCDefinitions } from '../runtime/domain/definitions/NPCDefinitions';
import { EnemyDefinitions } from '../runtime/domain/definitions/EnemyDefinitions';
import { TileDefinitions } from '../runtime/domain/definitions/TileDefinitions';
import { SkillDefinitions } from '../runtime/domain/definitions/SkillDefinitions';
import { StateEnemyManager } from '../runtime/domain/state/StateEnemyManager';
import { StateObjectManager } from '../runtime/domain/state/StateObjectManager';
import { BASE_TILE_EFFECT_IDS, CUSTOM_TILE_EFFECT_LIMITS } from '../runtime/domain/definitions/customTileEffects';
import { MAX_VARIABLES } from './variables';

export function getBaseCapabilities() {
    return {
        version: 2 as const,
        limits: { roomSize: 8, rooms: 9, variables: MAX_VARIABLES, enemiesPerRoom: StateEnemyManager.MAX_ENEMIES_PER_ROOM,
            objectsPerTypePerRoom: StateObjectManager.MULTI_INSTANCE_LIMIT, customEffects: CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions },
        assets: { npcs: NPCDefinitions.definitions.map(entry => entry.type), enemies: EnemyDefinitions.definitions.map(entry => entry.type),
            objects: StateObjectManager.getPlaceableTypesArray().slice(), tiles: TileDefinitions.TILE_PRESETS.map(entry => entry.id),
            skills: SkillDefinitions.SKILL_DEFINITION_DATA.map(entry => entry.id), baseEffects: [...BASE_TILE_EFFECT_IDS] },
    };
}
export type BaseCapabilities = ReturnType<typeof getBaseCapabilities>;
