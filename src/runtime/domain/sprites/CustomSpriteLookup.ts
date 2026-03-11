import type { CustomSpriteEntry, CustomSpriteVariant } from '../../../types/gameState';

export class CustomSpriteLookup {
    static find(
        entries: CustomSpriteEntry[] | undefined,
        group: CustomSpriteEntry['group'],
        key: string,
        variant: CustomSpriteVariant = 'base'
    ): CustomSpriteEntry | null {
        if (!Array.isArray(entries)) return null;
        return (
            entries.find(
                (e) =>
                    e.group === group &&
                    e.key === key &&
                    (e.variant ?? 'base') === variant
            ) ?? null
        );
    }

    static upsert(
        entries: CustomSpriteEntry[],
        entry: CustomSpriteEntry
    ): CustomSpriteEntry[] {
        const variant = entry.variant ?? 'base';
        const idx = entries.findIndex(
            (e) => e.group === entry.group && e.key === entry.key && (e.variant ?? 'base') === variant
        );
        if (idx === -1) return [...entries, entry];
        const next = [...entries];
        next[idx] = entry;
        return next;
    }

    static remove(
        entries: CustomSpriteEntry[],
        group: CustomSpriteEntry['group'],
        key: string,
        variant: CustomSpriteVariant = 'base'
    ): CustomSpriteEntry[] {
        return entries.filter(
            (e) => !(e.group === group && e.key === key && (e.variant ?? 'base') === variant)
        );
    }
}
