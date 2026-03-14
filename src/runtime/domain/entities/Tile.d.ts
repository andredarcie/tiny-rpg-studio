type TileFrame = string[][];
type TileDefinitionData = {
    id: string | number;
    name: string;
    pixels: TileFrame;
    frames: TileFrame[];
    collision: boolean;
    category: string;
    layouts?: (number | null)[][][];
};
declare class Tile {
    id: string | number;
    name: string;
    pixels: TileFrame;
    frames: TileFrame[];
    animated: boolean;
    collision: boolean;
    category: string;
    layouts?: (number | null)[][][];
    constructor(data: TileDefinitionData);
}
export type { TileDefinitionData, TileFrame };
export { Tile };
