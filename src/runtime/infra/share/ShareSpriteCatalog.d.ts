import type { CustomSpriteEntry, CustomSpriteVariant } from '../../../types/gameState';
declare class ShareSpriteCatalog {
    private static readonly KNOWN_KEYS;
    static getKeyIndex(group: CustomSpriteEntry['group'], key: string, _variant: CustomSpriteVariant): number;
    static getKeyByIndex(group: CustomSpriteEntry['group'], index: number, _variant: CustomSpriteVariant): string | null;
}
export { ShareSpriteCatalog };
