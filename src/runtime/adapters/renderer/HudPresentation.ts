export type HeartMatrix = (number | null)[][];
export type HudSprite = (string | null)[][];
export type HudPart = 'health' | 'level' | 'xp' | 'minimap' | 'items' | 'gear';
export type HudResources = { palette: string[]; hearts: { full: HeartMatrix; empty: HeartMatrix } };
export type HudPresentation = {
    visible: Record<HudPart, boolean>;
    mode: 'bars' | 'overlay';
    scale?: number;
    inventoryOpacity?: number;
    hearts?: { full: HudSprite; empty: HudSprite };
};
export type HudPresentationProvider = (input: HudResources & { data: unknown }) => HudPresentation;
export const DEFAULT_HUD_PRESENTATION: HudPresentation = {
    visible: { health: true, level: true, xp: true, minimap: true, items: true, gear: true }, mode: 'bars',
};
export const DEFAULT_HEARTS: HudResources['hearts'] = {
    full: [
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,8,8,null,8,8,null],
        [null,8,8,8,8,8,7,8],
        [null,8,8,8,8,8,8,8],
        [null,null,8,8,8,8,8,null],
        [null,null,null,8,8,8,null,null],
        [null,null,null,null,8,null,null,null],
    ],
    empty: [
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,8,8,null,8,8,null],
        [null,8,null,null,8,null,null,8],
        [null,8,null,null,null,null,null,8],
        [null,null,8,null,null,null,8,null],
        [null,null,null,8,null,8,null,null],
        [null,null,null,null,8,null,null,null],
    ],
};
