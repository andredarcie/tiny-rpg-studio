import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { ItemDefinitions } from '../../runtime/domain/definitions/ItemDefinitions';
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';
import type { ItemDefinitionData } from '../../runtime/domain/entities/Item';
import type { EnemyDefinitionData } from '../../runtime/domain/entities/Enemy';

class EditorConstants {
    private static _objectDefinitions: ItemDefinitionData[] | null = null;
    private static _enemyDefinitions: EnemyDefinitionData[] | null = null;

    static get OBJECT_DEFINITIONS(): ItemDefinitionData[] {
        if (!this._objectDefinitions) {
            this._objectDefinitions = ItemDefinitions.definitions;
        }
        return this._objectDefinitions;
    }

    static get ENEMY_DEFINITIONS(): EnemyDefinitionData[] {
        if (!this._enemyDefinitions) {
            this._enemyDefinitions = EnemyDefinitions.definitions;
        }
        return this._enemyDefinitions;
    }

    static get OBJECT_TYPE_ORDER(): string[] {
        return itemCatalog.getEditorTypeOrder();
    }
}

export { EditorConstants };
