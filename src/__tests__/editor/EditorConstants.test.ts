import { describe, it, expect } from 'vitest';
import { EditorConstants } from '../../editor/modules/EditorConstants';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { ItemDefinitions } from '../../runtime/domain/definitions/ItemDefinitions';
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';

describe('EditorConstants', () => {
  it('should expose object definitions and cache the reference', () => {
    const first = EditorConstants.OBJECT_DEFINITIONS;
    const second = EditorConstants.OBJECT_DEFINITIONS;

    expect(first).toBe(ItemDefinitions.definitions);
    expect(second).toBe(first);
  });

  it('should expose enemy definitions and cache the reference', () => {
    const first = EditorConstants.ENEMY_DEFINITIONS;
    const second = EditorConstants.ENEMY_DEFINITIONS;

    expect(first).toBe(EnemyDefinitions.definitions);
    expect(second).toBe(first);
  });

  it('should expose the object type order from the item catalog', () => {
    const order = EditorConstants.OBJECT_TYPE_ORDER;

    expect(order).toEqual(itemCatalog.getEditorTypeOrder());
    expect(order.length).toBeGreaterThan(0);
  });
});
