import { describe, it, expect } from 'vitest';
import { ItemCatalog } from '../../runtime/domain/services/ItemCatalog';
import { Item } from '../../runtime/domain/entities/Item';
import { ITEM_TYPES } from '../../runtime/domain/definitions/ItemDefinitions';

const sprite = [[0]] as (number | null)[][];

const makeItem = (type: keyof typeof ITEM_TYPES, options?: { order?: number; tags?: string[]; swordDurability?: number }) =>
  new Item({
    type: ITEM_TYPES[type],
    id: `object-${type}`,
    name: type,
    nameKey: `objects.${type}`,
    behavior: {
      order: options?.order,
      tags: options?.tags,
      swordDurability: options?.swordDurability,
    },
    sprite,
  });

describe('ItemCatalog', () => {
  it('supports tags lookup helpers', () => {
    const catalog = new ItemCatalog([
      makeItem('KEY', { tags: ['placeable', 'collectible', 'hide-when-collected'] }),
      makeItem('DOOR', { tags: ['placeable', 'door', 'locked-door', 'hide-when-opened'] }),
    ]);

    expect(catalog.getTags(ITEM_TYPES.KEY)).toContain('collectible');
    expect(catalog.hasTag(ITEM_TYPES.KEY, 'collectible')).toBe(true);
    expect(catalog.hasTag(ITEM_TYPES.KEY, 'missing')).toBe(false);
    expect(catalog.getTypesByTag('door')).toEqual([ITEM_TYPES.DOOR]);
    expect(catalog.isCollectible(ITEM_TYPES.KEY)).toBe(true);
    expect(catalog.shouldHideWhenCollected(ITEM_TYPES.KEY)).toBe(true);
    expect(catalog.isDoor(ITEM_TYPES.DOOR)).toBe(true);
    expect(catalog.isLockedDoor(ITEM_TYPES.DOOR)).toBe(true);
    expect(catalog.shouldHideWhenOpened(ITEM_TYPES.DOOR)).toBe(true);
  });

  it('orders types by explicit order, then fallback order', () => {
    const catalog = new ItemCatalog([
      makeItem('SWORD', { order: 30 }),
      makeItem('KEY', { order: 10 }),
      makeItem('DOOR'),
    ]);

    expect(catalog.getEditorTypeOrder()).toEqual([
      ITEM_TYPES.KEY,
      ITEM_TYPES.SWORD,
      ITEM_TYPES.DOOR,
    ]);
  });

  it('falls back to default lists when tags are missing', () => {
    const catalog = new ItemCatalog([makeItem('KEY')]);

    const placeables = catalog.getPlaceableTypes();
    const collectibles = catalog.getCollectibleTypes();

    expect(placeables).toContain(ITEM_TYPES.DOOR);
    expect(placeables).toContain(ITEM_TYPES.PLAYER_START);
    expect(collectibles).toContain(ITEM_TYPES.KEY);
    expect(collectibles).toContain(ITEM_TYPES.SWORD);
  });

  it('returns sword durability values when available', () => {
    const catalog = new ItemCatalog([
      makeItem('SWORD', { tags: ['collectible'], swordDurability: 5 }),
      makeItem('KEY', { tags: ['collectible'] }),
    ]);

    expect(catalog.getSwordDurability(ITEM_TYPES.SWORD)).toBe(5);
    expect(catalog.getSwordDurability(ITEM_TYPES.KEY)).toBeNull();
  });
});
