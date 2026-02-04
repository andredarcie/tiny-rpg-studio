type TileFrame = string[][];

type TileDefinitionData = {
    id: string | number;
    name: string;
    pixels: TileFrame;
    frames: TileFrame[];
    collision: boolean;
    category: string;
    layouts?: (number | null)[][][]; // Store original numeric layouts for palette regeneration
};

class Tile {
    id: string | number;
    name: string;
    pixels: TileFrame;
    frames: TileFrame[];
    animated: boolean;
    collision: boolean;
    category: string;
    layouts?: (number | null)[][][]; // Store original numeric layouts for palette regeneration

    constructor(data: TileDefinitionData) {
        this.id = data.id;
        this.name = data.name;
        this.pixels = data.pixels;
        this.frames = data.frames;
        this.animated = data.frames.length > 1;
        this.collision = data.collision;
        this.category = data.category;
        this.layouts = data.layouts;
    }
}

export type { TileDefinitionData, TileFrame };
export { Tile };
