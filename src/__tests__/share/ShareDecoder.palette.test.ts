import { describe, it, expect } from 'vitest';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';
import { ShareBase64 } from '../../runtime/infra/share/ShareBase64';

describe('ShareDecoder - Custom Palette', () => {
    it('should decode custom palette segment', () => {
        const colors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];
        const bytes = new Uint8Array(16 * 3);
        colors.forEach((color, index) => {
            const hex = color.replace('#', '');
            const base = index * 3;
            bytes[base] = parseInt(hex.slice(0, 2), 16);
            bytes[base + 1] = parseInt(hex.slice(2, 4), 16);
            bytes[base + 2] = parseInt(hex.slice(4, 6), 16);
        });
        const segment = ShareBase64.toBase64Url(bytes);

        const decodeCustomPalette = (ShareDecoder as unknown as {
            decodeCustomPalette: (value: string) => string[] | undefined;
        }).decodeCustomPalette;
        const decoded = decodeCustomPalette(segment);

        expect(decoded).toEqual(colors);
    });

    it('should return undefined for empty segment', () => {
        const decodeCustomPalette = (ShareDecoder as unknown as {
            decodeCustomPalette: (value: string) => string[] | undefined;
        }).decodeCustomPalette;
        const decoded = decodeCustomPalette('');
        expect(decoded).toBeUndefined();
    });

    it('should return undefined for invalid color count', () => {
        const segment = 'FF0000,00FF00'; // Only 2 colors (legacy format)
        const decodeCustomPalette = (ShareDecoder as unknown as {
            decodeCustomPalette: (value: string) => string[] | undefined;
        }).decodeCustomPalette;
        const decoded = decodeCustomPalette(segment);
        expect(decoded).toBeUndefined();
    });

    it('should return undefined for invalid hex colors', () => {
        const segment = 'ZZZZZZ,00FF00,0000FF,FFFF00,FF00FF,00FFFF,FFFFFF,000000,888888,444444,CCCCCC,999999,111111,222222,333333,555555';
        const decodeCustomPalette = (ShareDecoder as unknown as {
            decodeCustomPalette: (value: string) => string[] | undefined;
        }).decodeCustomPalette;
        const decoded = decodeCustomPalette(segment);
        expect(decoded).toBeUndefined();
    });

    it('should convert colors to uppercase', () => {
        const segment = 'ff0000,00ff00,0000ff,ffff00,ff00ff,00ffff,ffffff,000000,888888,444444,cccccc,999999,111111,222222,333333,555555';
        const decodeCustomPalette = (ShareDecoder as unknown as {
            decodeCustomPalette: (value: string) => string[] | undefined;
        }).decodeCustomPalette;
        const decoded = decodeCustomPalette(segment);

        expect(decoded?.[0]).toBe('#FF0000');
        expect(decoded?.[10]).toBe('#CCCCCC');
    });
});
