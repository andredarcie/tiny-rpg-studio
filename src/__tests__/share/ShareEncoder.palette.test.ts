import { describe, it, expect } from 'vitest';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';

describe('ShareEncoder - Custom Palette', () => {
    it('should encode custom palette', () => {
        const gameData = {
            title: 'Test',
            author: 'Test',
            start: { x: 0, y: 0, room: 0 },
            sprites: [],
            enemies: [],
            objects: [],
            variables: [],
            rooms: [],
            tileset: { ground: [[]], overlay: [[]] },
            world: { width: 1, height: 1, layout: [[0]] },
            customPalette: [
                '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                '#FF00FF', '#00FFFF', '#FFFFFF', '#000000',
                '#888888', '#444444', '#CCCCCC', '#999999',
                '#111111', '#222222', '#333333', '#555555'
            ]
        } as never;

        const encoded = ShareEncoder.buildShareCode(gameData);

        // Deve conter segmento 'P' em base64url (sem '#' e sem vírgulas)
        expect(encoded).toContain('P');
        expect(encoded).not.toContain('#');
        expect(encoded).not.toContain(',');
    });

    it('should NOT encode palette if equal to PICO-8 default', () => {
        const gameData = {
            title: 'Test',
            author: 'Test',
            start: { x: 0, y: 0, room: 0 },
            sprites: [],
            enemies: [],
            objects: [],
            variables: [],
            rooms: [],
            tileset: { ground: [[]], overlay: [[]] },
            world: { width: 1, height: 1, layout: [[0]] },
            customPalette: [...TileDefinitions.PICO8_COLORS]
        } as never;

        const encoded = ShareEncoder.buildShareCode(gameData);

        // Não deve ter segmento 'P'
        expect(encoded).not.toContain('.P');
    });

    it('should NOT encode palette if undefined', () => {
        const gameData = {
            title: 'Test',
            author: 'Test',
            start: { x: 0, y: 0, room: 0 },
            sprites: [],
            enemies: [],
            objects: [],
            variables: [],
            rooms: [],
            tileset: { ground: [[]], overlay: [[]] },
            world: { width: 1, height: 1, layout: [[0]] },
            customPalette: undefined
        } as never;

        const encoded = ShareEncoder.buildShareCode(gameData);

        expect(encoded).not.toContain('.P');
    });
});
