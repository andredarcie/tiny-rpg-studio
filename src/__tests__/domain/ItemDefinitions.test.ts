import { describe, it, expect } from 'vitest';
import { ITEM_TYPES, ItemDefinitions } from '../../runtime/domain/definitions/ItemDefinitions';

describe('ItemDefinitions', () => {
  it('exposes the item type constants', () => {
    expect(ItemDefinitions.TYPES).toBe(ITEM_TYPES);
  });

  it('returns item definitions by type', () => {
    const key = ItemDefinitions.getItemDefinition(ITEM_TYPES.KEY);

    expect(key).not.toBeNull();
    expect(key?.type).toBe(ITEM_TYPES.KEY);
  });

  it('returns null for unknown item types', () => {
    const unknown = ItemDefinitions.getItemDefinition('unknown' as typeof ITEM_TYPES.KEY);

    expect(unknown).toBeNull();
  });
});
