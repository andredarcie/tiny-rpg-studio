import { describe, it, expect } from 'vitest';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';

describe('ShareCodec - Custom Palette Round-trip', () => {
    it('should preserve custom palette in encode-decode cycle', () => {
        const originalData: Record<string, unknown> & { customPalette: string[] } = {
            title: 'Palette Test',
            author: 'Tester',
            start: { x: 5, y: 5, room: 0 },
            sprites: [],
            enemies: [],
            objects: [],
            variables: [],
            rooms: [],
            tileset: {
                ground: [[0, 1, 2]],
                overlay: [[0, 0, 0]]
            },
            world: {
                width: 1,
                height: 1,
                layout: [[0]]
            },
            customPalette: [
                '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
                '#888888', '#444444', '#CCCCCC', '#999999',
                '#111111', '#222222', '#333333', '#555555'
            ]
        };

        // Encode
        const encoded = ShareUtils.encode(originalData);

        // Decode
        const decoded = ShareUtils.decode(encoded) as { customPalette?: string[] } | null;

        // Verify palette preservation
        expect(decoded).toBeDefined();
        expect(decoded?.customPalette).toBeDefined();
        expect(decoded?.customPalette).toHaveLength(16);
        expect(decoded?.customPalette).toEqual(originalData.customPalette);
    });

    it('should handle missing palette gracefully', () => {
        const dataWithoutPalette: Record<string, unknown> = {
            title: 'No Palette',
            author: 'Test',
            start: { x: 0, y: 0, room: 0 },
            sprites: [],
            enemies: [],
            objects: [],
            variables: [],
            rooms: [],
            tileset: { ground: [[]], overlay: [[]] },
            world: { width: 1, height: 1, layout: [[0]] }
            // NO customPalette
        };

        const encoded = ShareUtils.encode(dataWithoutPalette);
        const decoded = ShareUtils.decode(encoded) as { customPalette?: string[] } | null;

        expect(decoded).toBeDefined();
        expect(decoded?.customPalette).toBeUndefined();
    });
});
