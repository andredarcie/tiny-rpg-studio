type TileFrame = string[][];
import type { TileVisualEffectKind } from '../definitions/customTileEffects';

type TileDefinitionData = {
    id: string | number;
    name: string;
    nameKey?: string;
    pixels: TileFrame;
    frames: TileFrame[];
    collision: boolean;
    category: string;
    layouts?: (number | null)[][][]; // Store original numeric layouts for palette regeneration
    /** Explicit liquid visual effect; when unset, renderer falls back to name/category heuristics. */
    visualEffect?: TileVisualEffectKind;
};

class Tile {
    id: string | number;
    name: string;
    nameKey?: string;
    pixels: TileFrame;
    frames: TileFrame[];
    animated: boolean;
    collision: boolean;
    category: string;
    layouts?: (number | null)[][][]; // Store original numeric layouts for palette regeneration
    visualEffect?: TileVisualEffectKind;

    constructor(data: TileDefinitionData) {
        this.id = data.id;
        this.name = data.name;
        this.nameKey = data.nameKey;
        this.pixels = data.pixels;
        this.frames = data.frames;
        this.animated = data.frames.length > 1;
        this.collision = data.collision;
        this.category = data.category;
        this.layouts = data.layouts;
        this.visualEffect = data.visualEffect;
    }
}

export type { TileDefinitionData, TileFrame, TileVisualEffectKind };
export { Tile };
