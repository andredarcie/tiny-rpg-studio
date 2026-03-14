type CustomSpriteEntryLike = {
    group: string;
    key: string;
    variant?: string;
    frames: ((number | null)[][])[];
};
type ShareGameData = {
    title?: unknown;
    author?: unknown;
    hideHud?: unknown;
    start?: unknown;
    sprites?: unknown[];
    enemies?: unknown[];
    objects?: unknown[];
    variables?: unknown[];
    rooms?: unknown[];
    tileset?: unknown;
    world?: unknown;
    customPalette?: string[];
    customSprites?: CustomSpriteEntryLike[];
};
declare class ShareEncoder {
    private static readonly CUSTOM_SPRITE_BINARY_VERSION;
    private static readonly GROUP_TO_ID;
    private static packNibblePair;
    private static resolveBaseFrame;
    private static encodeFullFrame;
    private static tryEncodeDeltaFrame;
    private static encodeIndexed8x8DeltaFrame;
    private static encodeCustomSprites;
    static buildShareCode(gameData: ShareGameData | null | undefined): string;
}
export { ShareEncoder };
