export interface PaletteColor {
    name: string;
    hex: string;
    pico8Index?: number;
}

export interface PalettePreset {
    name: string;
    description: string;
    colors: PaletteColor[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
    {
        name: 'PICO-8',
        description: 'Original 16-color palette from the PICO-8 fantasy console, designed to enforce strong visual identity, high contrast, and creative constraints inspired by 8-bit era hardware.',
        colors: [
            { name: 'black', hex: '#000000' },
            { name: 'dark blue', hex: '#1D2B53' },
            { name: 'dark purple', hex: '#7E2553' },
            { name: 'dark green', hex: '#008751' },
            { name: 'brown', hex: '#AB5236' },
            { name: 'dark gray', hex: '#5F574F' },
            { name: 'light gray', hex: '#C2C3C7' },
            { name: 'off white', hex: '#FFF1E8' },
            { name: 'red', hex: '#FF004D' },
            { name: 'orange', hex: '#FFA300' },
            { name: 'yellow', hex: '#FFEC27' },
            { name: 'green', hex: '#00E436' },
            { name: 'blue', hex: '#29ADFF' },
            { name: 'lavender', hex: '#83769C' },
            { name: 'pink', hex: '#FF77A8' },
            { name: 'peach', hex: '#FFCCAA' }
        ]
    },
    {
        name: 'PICO-8 \u2192 Game Boy Green',
        description: 'A luminance-preserving adaptation of the PICO-8 palette mapped to monochromatic green tones, inspired by the original Nintendo Game Boy LCD display. Each index keeps its original visual role to allow seamless palette swapping.',
        colors: [
            { name: 'near black green', hex: '#0B1A0B', pico8Index: 0 },
            { name: 'very dark green (cool)', hex: '#162616', pico8Index: 1 },
            { name: 'very dark green (warm)', hex: '#1F3320', pico8Index: 2 },
            { name: 'deep green', hex: '#254225', pico8Index: 3 },
            { name: 'dark olive green', hex: '#3A5A3A', pico8Index: 4 },
            { name: 'dark desaturated green', hex: '#4E6A4E', pico8Index: 5 },
            { name: 'mid neutral green', hex: '#6F8F6F', pico8Index: 6 },
            { name: 'base light green', hex: '#9BBC9B', pico8Index: 7 },
            { name: 'high contrast green', hex: '#5F9F5F', pico8Index: 8 },
            { name: 'vivid olive green', hex: '#7FBF7F', pico8Index: 9 },
            { name: 'warm light green', hex: '#B7D87A', pico8Index: 10 },
            { name: 'bright green accent', hex: '#6FD96F', pico8Index: 11 },
            { name: 'cool light green', hex: '#7FBFB0', pico8Index: 12 },
            { name: 'muted pale green', hex: '#8FA38F', pico8Index: 13 },
            { name: 'soft highlight green', hex: '#A8D0A8', pico8Index: 14 },
            { name: 'near white green', hex: '#DFF5DF', pico8Index: 15 }
        ]
    },
    {
        name: 'PICO-8 \u2192 Grayscale',
        description: 'A strict grayscale conversion of the PICO-8 palette based on relative luminance. Designed to preserve contrast, hierarchy, and gameplay readability when switching to a black-and-white aesthetic.',
        colors: [
            { name: 'absolute black', hex: '#000000', pico8Index: 0 },
            { name: 'very dark gray (cool)', hex: '#1A1A1A', pico8Index: 1 },
            { name: 'very dark gray (warm)', hex: '#222222', pico8Index: 2 },
            { name: 'deep dark gray', hex: '#2B2B2B', pico8Index: 3 },
            { name: 'dark warm gray', hex: '#3A3A3A', pico8Index: 4 },
            { name: 'graphite gray', hex: '#4A4A4A', pico8Index: 5 },
            { name: 'mid gray', hex: '#6A6A6A', pico8Index: 6 },
            { name: 'base light gray', hex: '#8A8A8A', pico8Index: 7 },
            { name: 'highlight gray', hex: '#9F9F9F', pico8Index: 8 },
            { name: 'warm light gray', hex: '#B0B0B0', pico8Index: 9 },
            { name: 'very light gray', hex: '#C8C8C8', pico8Index: 10 },
            { name: 'near white accent', hex: '#D6D6D6', pico8Index: 11 },
            { name: 'cool light gray', hex: '#B8B8B8', pico8Index: 12 },
            { name: 'neutral light gray', hex: '#A0A0A0', pico8Index: 13 },
            { name: 'pearl gray', hex: '#E0E0E0', pico8Index: 14 },
            { name: 'pure white', hex: '#FFFFFF', pico8Index: 15 }
        ]
    },
    {
        name: 'DawnBringer DB16',
        description: 'A widely used 16-color palette created by DawnBringer, designed for professional pixel art with balanced hue distribution, natural ramps, and strong material definition.',
        colors: [
            { name: 'near black', hex: '#140C1C', pico8Index: 0 },
            { name: 'dark wine', hex: '#442434', pico8Index: 2 },
            { name: 'dark blue', hex: '#30346D', pico8Index: 1 },
            { name: 'dark gray', hex: '#4E4A4E', pico8Index: 5 },
            { name: 'brown', hex: '#854C30', pico8Index: 4 },
            { name: 'dark green', hex: '#346524', pico8Index: 3 },
            { name: 'red', hex: '#D04648', pico8Index: 8 },
            { name: 'mid gray', hex: '#757161', pico8Index: 6 },
            { name: 'blue', hex: '#597DCE', pico8Index: 12 },
            { name: 'orange', hex: '#D27D2C', pico8Index: 9 },
            { name: 'blue gray', hex: '#8595A1', pico8Index: 13 },
            { name: 'light green', hex: '#6DAA2C', pico8Index: 11 },
            { name: 'beige', hex: '#D2AA99', pico8Index: 15 },
            { name: 'cyan', hex: '#6DC2CA', pico8Index: 14 },
            { name: 'yellow', hex: '#DAD45E', pico8Index: 10 },
            { name: 'near white', hex: '#DEEED6', pico8Index: 7 }
        ]
    },
    {
        name: 'ENDESGA 16',
        description: 'A modern high-contrast 16-color palette by Endesga, optimized for readability, dynamic lighting, and fast-moving pixel art in games.',
        colors: [
            { name: 'light brown', hex: '#E4A672', pico8Index: 15 },
            { name: 'brown', hex: '#B86F50', pico8Index: 4 },
            { name: 'dark brown', hex: '#743F39', pico8Index: 5 },
            { name: 'dark purple', hex: '#3F2832', pico8Index: 2 },
            { name: 'dark red', hex: '#9E2835', pico8Index: 8 },
            { name: 'red', hex: '#E53B44', pico8Index: 8 },
            { name: 'orange', hex: '#FB922B', pico8Index: 9 },
            { name: 'yellow', hex: '#FFE762', pico8Index: 10 },
            { name: 'green', hex: '#63C64D', pico8Index: 11 },
            { name: 'dark green', hex: '#327345', pico8Index: 3 },
            { name: 'dark teal', hex: '#193D3F', pico8Index: 1 },
            { name: 'blue gray', hex: '#4F6781', pico8Index: 13 },
            { name: 'light blue gray', hex: '#AFBFD2', pico8Index: 6 },
            { name: 'white', hex: '#FFFFFF', pico8Index: 7 },
            { name: 'cyan', hex: '#2CE8F4', pico8Index: 12 },
            { name: 'blue', hex: '#0484D1', pico8Index: 12 }
        ]
    },
    {
        name: 'Sweetie 16',
        description: 'A soft, pastel-oriented 16-color palette designed for cozy, narrative-driven pixel art, offering smooth transitions and gentle contrast.',
        colors: [
            { name: 'midnight blue', hex: '#1A1C2C', pico8Index: 0 },
            { name: 'purple', hex: '#5D275D', pico8Index: 2 },
            { name: 'dark red', hex: '#B13E53', pico8Index: 8 },
            { name: 'coral', hex: '#EF7D57', pico8Index: 15 },
            { name: 'warm yellow', hex: '#FFCD75', pico8Index: 10 },
            { name: 'light green', hex: '#A7F070', pico8Index: 11 },
            { name: 'green', hex: '#38B764', pico8Index: 3 },
            { name: 'teal', hex: '#257179', pico8Index: 12 },
            { name: 'dark blue', hex: '#29366F', pico8Index: 1 },
            { name: 'blue', hex: '#3B5DC9', pico8Index: 12 },
            { name: 'light blue', hex: '#41A6F6', pico8Index: 13 },
            { name: 'light cyan', hex: '#73EFF7', pico8Index: 7 },
            { name: 'ice white', hex: '#F4F4F4', pico8Index: 7 },
            { name: 'light blue gray', hex: '#94B0C2', pico8Index: 6 },
            { name: 'blue gray', hex: '#566C86', pico8Index: 5 },
            { name: 'dark blue gray', hex: '#333C57', pico8Index: 5 }
        ]
    },
    {
        name: 'Commodore 64 (Lospec)',
        description: 'The canonical 16-color palette of the Commodore 64 home computer (1982), as curated by Lospec. Known for its soft, earthy tones and distinctive analog color feel.',
        colors: [
            { name: 'black', hex: '#000000', pico8Index: 0 },
            { name: 'white', hex: '#FFFFFF', pico8Index: 7 },
            { name: 'red', hex: '#9F4E44', pico8Index: 8 },
            { name: 'cyan', hex: '#6ABFC6', pico8Index: 12 },
            { name: 'purple', hex: '#A057A3', pico8Index: 2 },
            { name: 'green', hex: '#5CAB5E', pico8Index: 11 },
            { name: 'blue', hex: '#50459B', pico8Index: 1 },
            { name: 'yellow', hex: '#C9D487', pico8Index: 10 },
            { name: 'orange', hex: '#A1683C', pico8Index: 9 },
            { name: 'brown', hex: '#6D5412', pico8Index: 4 },
            { name: 'light red', hex: '#CB7E75', pico8Index: 14 },
            { name: 'dark gray', hex: '#626262', pico8Index: 5 },
            { name: 'gray', hex: '#898989', pico8Index: 6 },
            { name: 'light green', hex: '#9AE29B', pico8Index: 11 },
            { name: 'light blue', hex: '#887ECB', pico8Index: 13 },
            { name: 'light gray', hex: '#ADADAD', pico8Index: 6 }
        ]
    },
    {
        name: 'Default EGA 16-color',
        description: 'The standard 16-color palette of the IBM Enhanced Graphics Adapter (EGA), widely used in DOS games and PC software during the late 1980s and early 1990s.',
        colors: [
            { name: 'black', hex: '#000000', pico8Index: 0 },
            { name: 'blue', hex: '#0000AA', pico8Index: 1 },
            { name: 'green', hex: '#00AA00', pico8Index: 3 },
            { name: 'cyan', hex: '#00AAAA', pico8Index: 12 },
            { name: 'red', hex: '#AA0000', pico8Index: 8 },
            { name: 'magenta', hex: '#AA00AA', pico8Index: 2 },
            { name: 'brown', hex: '#AA5500', pico8Index: 4 },
            { name: 'light gray', hex: '#AAAAAA', pico8Index: 6 },
            { name: 'dark gray', hex: '#555555', pico8Index: 5 },
            { name: 'light blue', hex: '#5555FF', pico8Index: 13 },
            { name: 'light green', hex: '#55FF55', pico8Index: 11 },
            { name: 'light cyan', hex: '#55FFFF', pico8Index: 12 },
            { name: 'light red', hex: '#FF5555', pico8Index: 14 },
            { name: 'light magenta', hex: '#FF55FF', pico8Index: 14 },
            { name: 'yellow', hex: '#FFFF55', pico8Index: 10 },
            { name: 'white', hex: '#FFFFFF', pico8Index: 7 }
        ]
    },
    {
        name: 'NES 16 (Curated)',
        description: 'A curated 16-color selection inspired by the Nintendo Entertainment System (NES) hardware palette. Designed to capture the characteristic saturation and contrast of classic NES games.',
        colors: [
            { name: 'black', hex: '#000000', pico8Index: 0 },
            { name: 'dark blue', hex: '#00177D', pico8Index: 1 },
            { name: 'dark purple', hex: '#2A006A', pico8Index: 2 },
            { name: 'dark green', hex: '#005F00', pico8Index: 3 },
            { name: 'dark red', hex: '#7D0000', pico8Index: 8 },
            { name: 'brown', hex: '#5F3A00', pico8Index: 4 },
            { name: 'dark gray', hex: '#3F3F3F', pico8Index: 5 },
            { name: 'light gray', hex: '#BFBFBF', pico8Index: 6 },
            { name: 'red', hex: '#BF0000', pico8Index: 8 },
            { name: 'orange', hex: '#FF5F00', pico8Index: 9 },
            { name: 'yellow', hex: '#FFBF00', pico8Index: 10 },
            { name: 'green', hex: '#00BF00', pico8Index: 11 },
            { name: 'blue', hex: '#005FFF', pico8Index: 12 },
            { name: 'lavender', hex: '#7D5FFF', pico8Index: 13 },
            { name: 'pink', hex: '#FF7DBF', pico8Index: 14 },
            { name: 'white', hex: '#FFFFFF', pico8Index: 7 }
        ]
    }
];

/** Helper: extract hex array from a preset (for engine compatibility) */
export function getPresetHexColors(preset: PalettePreset): string[] {
    return preset.colors.map(c => c.hex);
}
