import { describe, it, expect } from 'vitest';
import { ShareSpriteCatalog } from '../../runtime/infra/share/ShareSpriteCatalog';

// Cast helper: 'player' is not yet in the group union type — these tests define the desired
// behaviour and are expected to FAIL until the implementation is complete.
type AnyGroup = Parameters<typeof ShareSpriteCatalog.getKeyIndex>[0];

describe('ShareSpriteCatalog - player group', () => {
    it('returns index 0 for key default in player group', () => {
        const index = ShareSpriteCatalog.getKeyIndex('player' as AnyGroup, 'default', 'base');
        expect(index).toBe(0);
    });

    it('returns key default by index 0 in player group', () => {
        const key = ShareSpriteCatalog.getKeyByIndex('player' as AnyGroup, 0, 'base');
        expect(key).toBe('default');
    });

    it('returns null for out-of-range index in player group', () => {
        const key = ShareSpriteCatalog.getKeyByIndex('player' as AnyGroup, 99, 'base');
        expect(key).toBeNull();
    });
});
