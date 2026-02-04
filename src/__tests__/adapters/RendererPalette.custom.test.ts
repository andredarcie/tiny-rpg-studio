import { describe, it, expect, beforeEach } from 'vitest';
import { RendererPalette } from '../../runtime/adapters/renderer/RendererPalette';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';

describe('RendererPalette - Custom Palette', () => {
    let palette: RendererPalette;

    beforeEach(() => {
        palette = new RendererPalette({});
    });

    it('should use PICO-8 colors by default', () => {
        expect(palette.getPalette()).toEqual(TileDefinitions.PICO8_COLORS);
        expect(palette.isUsingCustomPalette()).toBe(false);
    });

    it('should set custom palette', () => {
        const customColors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];

        palette.setCustomPalette(customColors);

        expect(palette.getPalette()).toEqual(customColors);
        expect(palette.isUsingCustomPalette()).toBe(true);
    });

    it('should reset to default palette', () => {
        const customColors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];
        palette.setCustomPalette(customColors);

        palette.resetToDefault();

        expect(palette.getPalette()).toEqual(TileDefinitions.PICO8_COLORS);
        expect(palette.isUsingCustomPalette()).toBe(false);
    });

    it('should get color by index from custom palette', () => {
        const customColors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];
        palette.setCustomPalette(customColors);

        expect(palette.getColor(0)).toBe('#FF0000');
        expect(palette.getColor(5)).toBe('#00FFFF');
    });

    it('should handle null custom palette (reset)', () => {
        palette.setCustomPalette(null);

        expect(palette.getPalette()).toEqual(TileDefinitions.PICO8_COLORS);
        expect(palette.isUsingCustomPalette()).toBe(false);
    });

    it('should return default color for invalid index', () => {
        const customColors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];
        palette.setCustomPalette(customColors);

        expect(palette.getColor(99)).toBe('#f4f4f8');
        expect(palette.getColor(-1)).toBe('#f4f4f8');
    });
});
