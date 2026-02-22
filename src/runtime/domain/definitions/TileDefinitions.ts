
import { Tile } from '../entities/Tile';
import type { TileDefinitionData, TileFrame } from '../entities/Tile';

/**
 * TileDefinitions centraliza a paleta PICO-8 e os tiles padrão.
 */
class TileDefinitions {
    static PICO8_COLORS = Object.freeze([
        "#000000",
        "#1D2B53",
        "#7E2553",
        "#008751",
        "#AB5236",
        "#5F574F",
        "#C2C3C7",
        "#FFF1E8",
        "#FF004D",
        "#FFA300",
        "#FFFF27",
        "#00E756",
        "#29ADFF",
        "#83769C",
        "#FF77A8",
        "#FFCCAA"
    ]);

    static createTile(
        id: number,
        name: string,
        layouts: (number | null)[][][] | (number | null)[][],
        collision = false,
        category = 'Diversos',
        palette?: string[]
    ) {
        const layoutList = Array.isArray(layouts) ? layouts.filter(Boolean) : [layouts];
        const frames = (layoutList.length ? layoutList : [this.createEmptyLayout()])
            .map((layout) => this.toPixels(layout as (number | null)[][], palette));
        const data: TileDefinitionData = {
            id,
            name,
            pixels: frames[0] as TileFrame,
            frames: frames as TileFrame[],
            collision,
            category,
            layouts: layoutList as (number | null)[][][]
        };
        return new Tile(data);
    }

    static createEmptyLayout() {
        return Array.from({ length: 8 }, () => Array(8).fill(null) as null[]);
    }

    static toPixels(layout: (number | null)[][], palette?: string[]): TileFrame {
        const colors = palette || this.PICO8_COLORS;
        return layout.map((row) =>
            row.map((value) => (value === null ? 'transparent' : (colors[value] ?? 'transparent')))
        );
    }

    static tile(
        index: number,
        name: string,
        layout: (number | null)[][],
        collision = false,
        category = 'Diversos',
        alternateLayout: (number | null)[][] | null = null
    ) {
        const layouts = [layout];
        if (Array.isArray(alternateLayout)) {
            layouts.push(alternateLayout);
        }
        return this.createTile(index, name, layouts, collision, category);
    }

    static TILE_PRESETS: Tile[] = [
        this.tile(0, 'Grama Vibrante', [
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ]
        ], false, 'Terreno'),

        this.tile(1, 'Grama Alta', [
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3, 11,  3,  3 ],
            [  3,  3,  3,  3, 11,  3, 11,  3 ],
            [  3, 11,  3,  3,  3,  3,  3,  3 ],
            [ 11,  3, 11,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ]
        ], false, 'Terreno', [
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3, 11,  3 ],
            [  3,  3,  3,  3,  3, 11,  3, 11 ],
            [  3,  3, 11,  3,  3,  3,  3,  3 ],
            [  3, 11,  3, 11,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ]
        ]),

        this.tile(2, 'Trilha de Terra', [
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  4,  9,  4,  4,  4,  4,  4,  4 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  4,  4,  4,  4,  4,  4,  9,  4 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  4,  4,  4,  9,  4,  4,  4,  4 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ]
        ], false, 'Terreno'),

        this.tile(3, 'Cascalho', [
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  5,  5,  3,  3,  3,  3,  3 ],
            [  5,  6,  6,  5,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  5,  3,  3 ],
            [  3,  3,  3,  3,  5,  6,  5,  3 ],
            [  3,  3,  3,  5,  6,  6,  5,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ],
            [  3,  3,  3,  3,  3,  3,  3,  3 ]
        ], false, 'Terreno'),

        this.tile(4, 'Areia Macia', [
            [15, 15, 15, 15, 15, 15, 15, 15],
            [15, 15, 10, 15, 15, 10, 15, 15],
            [15, 15, 15, 15, 15, 15, 15, 15],
            [15, 10, 15, 15, 15, 15, 10, 15],
            [15, 15, 15, 15, 15, 15, 15, 15],
            [15, 15, 10, 15, 15, 10, 15, 15],
            [15, 15, 15, 15, 15, 15, 15, 15],
            [15, 10, 15, 15, 15, 15, 10, 15]
        ], false, 'Terreno'),

        this.tile(16, 'Piso de madeira', [
            [  5,  5,  4,  4,  5,  5,  4,  4 ],
            [  5,  5,  4,  4,  5,  5,  4,  4 ],
            [  4,  4,  5,  5,  4,  4,  5,  5 ],
            [  4,  4,  5,  5,  4,  4,  5,  5 ],
            [  5,  5,  4,  4,  5,  5,  4,  4 ],
            [  5,  5,  4,  4,  5,  5,  4,  4 ],
            [  4,  4,  5,  5,  4,  4,  5,  5 ],
            [  4,  4,  5,  5,  4,  4,  5,  5 ]
        ], false, 'Terreno'),

        this.tile(17, 'Piso de pedra', [
            [ 13,  5,  5,  5,  5, 13,  5,  5 ],
            [  5,  5, 13,  5,  5,  5, 13,  5 ],
            [  5, 13,  5, 13,  5,  5,  5,  5 ],
            [  5,  5,  5, 13,  5,  5,  5,  5 ],
            [  5,  5,  5,  5,  5,  5,  5, 13 ],
            [  5,  5,  5,  5,  5,  5,  5, 13 ],
            [ 13,  5,  5,  5, 13,  5,  5,  5 ],
            [ 13,  5,  5,  5,  5, 13,  5, 13 ]
        ], false, 'Terreno'),

        this.tile(5, 'Agua Brilhante', [
            [ 12, 12, 12, 12, 12, 12, 12,  7 ],
            [ 12,  7, 12, 12, 12, 12, 12, 12 ],
            [  7,  6,  7, 12, 12, 12, 12, 12 ],
            [ 12, 12, 12, 12, 12, 12, 12, 12 ],
            [ 12, 12, 12, 12, 12,  7, 12, 12 ],
            [ 12, 12, 12, 12,  7, 12,  7,  6 ],
            [ 12,  7, 12, 12, 12, 12, 12, 12 ],
            [ 12, 12, 12, 12, 12, 12, 12, 12 ]
        ], true, 'Agua', [
            [ 12, 12, 12, 12, 12, 12, 12, 12 ],
            [ 12,  7, 12, 12, 12, 12,  7, 12 ],
            [ 12, 12, 12, 12, 12,  7, 12,  7 ],
            [ 12, 12,  6,  7, 12, 12, 12, 12 ],
            [  7, 12, 12, 12, 12, 12, 12, 12 ],
            [ 12,  7, 12, 12, 12, 12, 12,  7 ],
            [ 12, 12, 12, 12,  6,  7, 12, 12 ],
            [ 12, 12, 12, 12, 12, 12, 12, 12 ]
        ]),

        this.tile(6, 'Lava Borbulhante', [
            [ 10, 10,  8,  8,  8,  8,  9,  8 ],
            [  8, 10,  9, 10,  9,  9,  8,  8 ],
            [  9,  9, 10,  9,  9, 10,  9, 10 ],
            [  8,  8,  8,  8,  9, 10, 10,  8 ],
            [  8,  8,  8,  8,  8,  8,  8,  8 ],
            [  8,  9, 10,  8,  8, 10,  9,  8 ],
            [  8, 10,  9, 10,  9, 10,  8,  8 ],
            [ 10,  8,  8,  8,  8,  8,  9,  8 ]
        ], true, 'Perigo', [
            [  9, 10,  8,  8, 10,  8,  9,  8 ],
            [  8,  9, 10,  9,  9, 10,  8,  8 ],
            [  9, 10,  9, 10,  9, 10,  9,  8 ],
            [  8,  8, 10,  8,  9,  9, 10,  8 ],
            [  8,  8,  8,  8,  8,  9,  8,  8 ],
            [  8, 10,  9,  8, 10,  8,  9,  8 ],
            [ 10,  9, 10,  9, 10,  9,  8,  8 ],
            [ 10,  8,  8,  9,  8,  8, 10,  8 ]
        ]),

        this.tile(7, 'Pedra Grande', [
            [ null, null, null, null, null, null, null, null ],
            [ null, null, null, null,  5, null, null, null ],
            [ null, null, null,  5,  7,  5, null, null ],
            [ null, null,  5, 13,  6,  7,  5, null ],
            [ null,  5, 13,  6,  6,  6,  5, null ],
            [ null,  5, 13,  6,  6,  6,  7,  5 ],
            [ null,  5, 13,  6,  6,  6,  6,  5 ],
            [ null, null, null, null, null, null, null, null ]
        ], true, 'Natureza'),

        this.tile(8, 'Arvore Verde', [
            [ null, null,  1,  1,  1,  1, null, null ],
            [ null,  1, 11, 11, 11, 11,  1, null ],
            [  1, 11,  3, 11, 11, 11, 11,  1 ],
            [  1, 11, 11, 11, 11,  3, 11,  1 ],
            [  1, 11, 11, 11, 11, 11, 11,  1 ],
            [ null,  1,  1,  4,  4,  1,  1, null ],
            [ null, null, null,  4,  4, null, null, null ],
            [ null, null,  4,  4,  4,  4, null, null ]
        ], true, 'Natureza'),

        this.tile(9, 'Arbusto Denso', [
            [ null, null, null, null, null, null, null, null ],
            [ null, null, null, null, null, null, null, null ],
            [ null, null, null, null, null, null, null, null ],
            [ null, null,  1,  1,  1,  1, null, null ],
            [ null,  1, 11, 11, 11, 11,  1, null ],
            [  1, 11, 11, 11, 11,  3, 11,  1 ],
            [  1, 11,  3, 11, 11, 11, 11,  1 ],
            [  1,  1,  1,  1,  1,  1,  1,  1 ]
        ], true, 'Natureza'),

        this.tile(10, 'Parede de Pedra', [
            [  6,  7,  6,  5, 13,  5, 13,  6 ],
            [  5, 13,  6,  6,  6,  5,  5,  5 ],
            [  5,  5,  6,  7,  6,  5,  5, 13 ],
            [  6,  5,  5,  5, 13,  6,  6,  7 ],
            [  6,  6, 13,  5,  5,  7,  6,  6 ],
            [ 13,  5,  7, 13,  5,  5,  6,  5 ],
            [  5,  6,  6,  6,  7, 13, 13,  5 ],
            [  7,  6,  6, 13,  5,  5,  5,  6 ]
        ], true, 'Construcoes'),

        this.tile(11, 'Parede de Madeira', [
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ]
        ], true, 'Construcoes'),

        this.tile(12, 'Telhado Classico', [
            [  2,  2,  8,  8,  2,  2,  8,  8 ],
            [  8,  8, 14, 14,  8,  8, 14, 14 ],
            [  8,  8,  2,  2,  8,  8,  2,  2 ],
            [ 14, 14,  8,  8, 14, 14,  8,  8 ],
            [  2,  2,  8,  8,  2,  2,  8,  8 ],
            [  8,  8, 14, 14,  8,  8, 14, 14 ],
            [  8,  8,  2,  2,  8,  8,  2,  2 ],
            [ 14, 14,  8,  8, 14, 14,  8,  8 ]
        ], true, 'Construcoes'),

        this.tile(13, 'Porta de Madeira', [
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  4,  9,  9,  9,  9,  9,  9,  4 ],
            [  4,  9,  9,  9,  9,  9,  9,  4 ],
            [  4,  9,  9,  9,  9,  9,  9,  4 ],
            [  4,  9,  9,  9,  9, 10,  9,  4 ],
            [  4,  9,  9,  9,  9,  9,  9,  4 ],
            [  4,  9,  9,  9,  9,  9,  9,  4 ],
            [  4,  9,  9,  9,  9,  9,  9,  4 ]
        ], false, 'Construcoes'),

        this.tile(14, 'Janela Azul', [
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  9,  9,  5,  5,  5,  5,  9,  9 ],
            [  9,  9,  5, 12,  7,  5,  9,  9 ],
            [  9,  9,  5, 12, 12,  5,  9,  9 ],
            [  9,  9,  5,  5,  5,  5,  9,  9 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ],
            [  9,  9,  9,  9,  9,  9,  9,  9 ],
            [  4,  4,  4,  4,  4,  4,  4,  4 ]
        ], true, 'Construcoes'),

        this.tile(15, 'Tocha de Parede', [
            [ null, null, null,  7, null, null, null, null ],
            [ null, null, null, 10,  7, null, null, null ],
            [ null, null, 10, 10, 10, null, null, null ],
            [ null, null, 10,  8, 10, null, null, null ],
            [ null, null, null,  4, null, null, null, null ],
            [ null, null, null,  4, null, null, null, null ],
            [ null, null, null, null, null, null, null, null ],
            [ null, null, null, null, null, null, null, null ]
        ], true, 'Decoracao')
    ];

    static get presets() {
        return this.TILE_PRESETS;
    }
}

const PICO8_COLORS = TileDefinitions.PICO8_COLORS;
const TILE_PRESETS = TileDefinitions.TILE_PRESETS;

export { PICO8_COLORS, TILE_PRESETS, TileDefinitions };
