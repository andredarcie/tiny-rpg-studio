import { NPCDefinitions } from '../../domain/definitions/NPCDefinitions';
import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ItemDefinitions } from '../../domain/definitions/ItemDefinitions';
import type { CustomSpriteEntry, CustomSpriteVariant } from '../../../types/gameState';

type KnownSpriteGroup = Exclude<CustomSpriteEntry['group'], 'tile'>;

class ShareSpriteCatalog {
    private static readonly KNOWN_KEYS: Record<KnownSpriteGroup, string[]> = {
        npc: NPCDefinitions.definitions.map((entry) => entry.type),
        enemy: EnemyDefinitions.definitions.map((entry) => entry.type),
        object: ItemDefinitions.definitions.map((entry) => entry.type),
        player: ['default']
    };

    static getKeyIndex(group: CustomSpriteEntry['group'], key: string, _variant: CustomSpriteVariant): number {
        if (group === 'tile') {
            return -1;
        }
        return ShareSpriteCatalog.KNOWN_KEYS[group].indexOf(key);
    }

    static getKeyByIndex(group: CustomSpriteEntry['group'], index: number, _variant: CustomSpriteVariant): string | null {
        if (group === 'tile') {
            return null;
        }
        return ShareSpriteCatalog.KNOWN_KEYS[group][index] ?? null;
    }
}

export { ShareSpriteCatalog };
