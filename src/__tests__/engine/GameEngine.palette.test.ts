import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../runtime/services/GameEngine';

describe('GameEngine - Custom Palette', () => {
    let engine: GameEngine;

    beforeEach(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        engine = new GameEngine(canvas);
    });

    it('should start with no custom palette', () => {
        expect(engine.getCustomPalette()).toBeUndefined();
    });

    it('should set custom palette', () => {
        const customPalette = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];

        engine.setCustomPalette(customPalette);

        expect(engine.getCustomPalette()).toEqual(customPalette);
    });

    it('should reset palette to default', () => {
        const customPalette = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];
        engine.setCustomPalette(customPalette);

        engine.resetPaletteToDefault();

        expect(engine.getCustomPalette()).toBeUndefined();
    });

    it('should sync custom palette to renderer', () => {
        const customPalette = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];

        engine.setCustomPalette(customPalette);

        expect(engine.rendererPalette.isUsingCustomPalette()).toBe(true);
        expect(engine.rendererPalette.getActivePalette()).toEqual(customPalette);
    });

    it('should handle null palette (reset via setCustomPalette)', () => {
        const customPalette = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
            '#888888', '#444444', '#CCCCCC', '#999999',
            '#111111', '#222222', '#333333', '#555555'
        ];
        engine.setCustomPalette(customPalette);

        engine.setCustomPalette(null);

        expect(engine.getCustomPalette()).toBeUndefined();
        expect(engine.rendererPalette.isUsingCustomPalette()).toBe(false);
    });
});
