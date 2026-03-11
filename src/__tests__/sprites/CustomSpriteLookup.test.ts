import { describe, it, expect } from 'vitest';
import { CustomSpriteLookup } from '../../runtime/domain/sprites/CustomSpriteLookup';
import type { CustomSpriteEntry } from '../../types/gameState';

const makeEntry = (group: CustomSpriteEntry['group'], key: string, variant?: CustomSpriteEntry['variant']): CustomSpriteEntry => ({
    group,
    key,
    variant,
    frames: [[[1, 2], [3, 4]]],
});

describe('CustomSpriteLookup.find', () => {
    it('returns null for an empty list', () => {
        expect(CustomSpriteLookup.find([], 'npc', 'wizard')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(CustomSpriteLookup.find(undefined, 'npc', 'wizard')).toBeNull();
    });

    it('finds by group and key with the default base variant', () => {
        const entries = [makeEntry('npc', 'wizard', 'base')];
        expect(CustomSpriteLookup.find(entries, 'npc', 'wizard')).toBe(entries[0]);
    });

    it('finds by group, key, and an explicit variant', () => {
        const entries = [makeEntry('object', 'switch', 'on')];
        expect(CustomSpriteLookup.find(entries, 'object', 'switch', 'on')).toBe(entries[0]);
    });

    it('does not find an entry when the variant does not match', () => {
        const entries = [makeEntry('object', 'switch', 'on')];
        expect(CustomSpriteLookup.find(entries, 'object', 'switch', 'base')).toBeNull();
    });

    it('treats an entry without a variant as base', () => {
        const entry: CustomSpriteEntry = { group: 'enemy', key: 'slime', frames: [] };
        expect(CustomSpriteLookup.find([entry], 'enemy', 'slime')).toBe(entry);
    });

    it('does not find an entry for a different group', () => {
        const entries = [makeEntry('npc', 'wizard')];
        expect(CustomSpriteLookup.find(entries, 'enemy', 'wizard')).toBeNull();
    });
});

describe('CustomSpriteLookup.upsert', () => {
    it('inserts a new entry into an empty list', () => {
        const entry = makeEntry('npc', 'wizard');
        const result = CustomSpriteLookup.upsert([], entry);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(entry);
    });

    it('replaces an existing entry with the same key', () => {
        const old = makeEntry('npc', 'wizard', 'base');
        const updated: CustomSpriteEntry = { group: 'npc', key: 'wizard', variant: 'base', frames: [[[9]]] };
        const result = CustomSpriteLookup.upsert([old], updated);
        expect(result).toHaveLength(1);
        expect(result[0].frames).toEqual([[[9]]]);
    });

    it('keeps other entries when inserting a new one', () => {
        const a = makeEntry('npc', 'wizard');
        const b = makeEntry('enemy', 'slime');
        const result = CustomSpriteLookup.upsert([a], b);
        expect(result).toHaveLength(2);
    });

    it('does not mutate the original array', () => {
        const original = [makeEntry('npc', 'wizard')];
        const entry = makeEntry('enemy', 'slime');
        CustomSpriteLookup.upsert(original, entry);
        expect(original).toHaveLength(1);
    });
});

describe('CustomSpriteLookup.remove', () => {
    it('removes an existing entry', () => {
        const entry = makeEntry('npc', 'wizard', 'base');
        const result = CustomSpriteLookup.remove([entry], 'npc', 'wizard', 'base');
        expect(result).toHaveLength(0);
    });

    it('is idempotent when the entry does not exist', () => {
        const entry = makeEntry('npc', 'wizard');
        const result = CustomSpriteLookup.remove([entry], 'enemy', 'slime');
        expect(result).toHaveLength(1);
    });

    it('keeps other entries when removing one', () => {
        const a = makeEntry('npc', 'wizard', 'base');
        const b = makeEntry('enemy', 'slime');
        const result = CustomSpriteLookup.remove([a, b], 'npc', 'wizard', 'base');
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(b);
    });

    it('does not mutate the original array', () => {
        const original = [makeEntry('npc', 'wizard', 'base')];
        CustomSpriteLookup.remove(original, 'npc', 'wizard', 'base');
        expect(original).toHaveLength(1);
    });

    it('uses base as the default variant when removing without an explicit variant', () => {
        const entry: CustomSpriteEntry = { group: 'npc', key: 'wizard', frames: [] }; // no variant
        const result = CustomSpriteLookup.remove([entry], 'npc', 'wizard');
        expect(result).toHaveLength(0);
    });
});
