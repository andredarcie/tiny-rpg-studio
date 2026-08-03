import { describe, expect, it } from 'vitest';
import {
    PALETTE_PRESETS,
    resolvePresetPalette,
    resolvePresetSlots,
    type PalettePreset,
} from '../../runtime/domain/definitions/PalettePresets';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';

const BASE = TileDefinitions.PICO8_COLORS;

const preset = (colors: PalettePreset['colors']): PalettePreset => ({
    name: 'test',
    description: 'test',
    colors,
});

describe('resolvePresetSlots', () => {
    it('places each color in the slot named by pico8Index, not in array order', () => {
        const slots = resolvePresetSlots(
            preset([
                { name: 'goes to seven', hex: '#ABCDEF', pico8Index: 7 },
                { name: 'goes to one', hex: '#123456', pico8Index: 1 },
            ]),
            BASE,
        );

        expect(slots[7].hex).toBe('#ABCDEF');
        expect(slots[1].hex).toBe('#123456');
        // Array position 0 must not have leaked into slot 0.
        expect(slots[0].hex).toBe(BASE[0]);
    });

    it('reports a slot no color claimed as unchanged', () => {
        const slots = resolvePresetSlots(
            preset([{ name: 'only one', hex: '#ABCDEF', pico8Index: 7 }]),
            BASE,
        );

        expect(slots[3].hex).toBe(BASE[3]);
        expect(slots[3].sourceName).toBeNull();
        expect(slots[7].sourceName).toBe('only one');
    });

    it('lets a later color overwrite an earlier one targeting the same slot', () => {
        const slots = resolvePresetSlots(
            preset([
                { name: 'first', hex: '#111111', pico8Index: 8 },
                { name: 'second', hex: '#222222', pico8Index: 8 },
            ]),
            BASE,
        );

        expect(slots[8].hex).toBe('#222222');
        expect(slots[8].sourceName).toBe('second');
    });

    it('ignores colors whose pico8Index is missing or out of range', () => {
        const slots = resolvePresetSlots(
            preset([
                { name: 'no index', hex: '#111111' },
                { name: 'too high', hex: '#222222', pico8Index: 99 },
                { name: 'negative', hex: '#333333', pico8Index: -1 },
            ]),
            BASE,
        );

        expect(slots.map((s) => s.hex)).toEqual([...BASE]);
        expect(slots.every((s) => s.sourceName === null)).toBe(true);
    });

    it('keeps resolvePresetPalette in step with the resolved slots', () => {
        for (const p of PALETTE_PRESETS) {
            expect(resolvePresetPalette(p, BASE)).toEqual(
                resolvePresetSlots(p, BASE).map((slot) => slot.hex),
            );
        }
    });
});

describe('shipped palette presets', () => {
    it('puts a light, near-neutral color in slot 7, which draws HUD text', () => {
        // Slot 7 is read as "white" by the HUD, dialog and level-up renderers. What
        // separates a usable value here from a broken one is saturation, not
        // brightness: the ZX Spectrum preset once mapped slot 7 to cyan (#00D8D8),
        // whose luminance is a healthy 0.67 but which renders as coloured text.
        //
        // Measured across the shipped presets, slot 7 sits at saturation <= 0.176
        // (Game Boy Green, a deliberately green-tinted monochrome) and luminance
        // >= 0.541 (Grayscale). Both historical bugs sat at saturation 1.0. The
        // thresholds below leave room for a new monochrome palette while still
        // rejecting a fully saturated hue.
        const channels = (hex: string) => [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16),
        ];
        const luminance = (hex: string): number => {
            const [r, g, b] = channels(hex);
            return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        };
        const saturation = (hex: string): number => {
            const rgb = channels(hex);
            const max = Math.max(...rgb);
            const min = Math.min(...rgb);
            return max === 0 ? 0 : (max - min) / max;
        };

        for (const p of PALETTE_PRESETS) {
            const slot7 = resolvePresetSlots(p, BASE)[7].hex;
            expect(saturation(slot7), `${p.name} slot 7 saturation`).toBeLessThanOrEqual(0.35);
            expect(luminance(slot7), `${p.name} slot 7 luminance`).toBeGreaterThanOrEqual(0.5);
        }
    });
});
