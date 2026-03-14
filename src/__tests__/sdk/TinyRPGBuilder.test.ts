import { beforeAll, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { TinyRPG } from '../../sdk/index';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';

// Minimal mocks needed for the share infrastructure
beforeAll(() => {
    // Mock canvas for SpriteMatrixRegistry usage
    if (typeof HTMLCanvasElement !== 'undefined') {
        const noop = () => {};
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            canvas: document.createElement('canvas'),
            fillRect: noop, clearRect: noop, drawImage: noop,
            getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
            putImageData: noop, createImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
            save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
            beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
            arc: noop, rect: noop, strokeRect: noop, setTransform: noop, resetTransform: noop,
            measureText: (text: string) => ({ width: text.length * 6 }),
            fillText: noop, strokeText: noop, getContextAttributes: () => ({}),
            imageSmoothingEnabled: false, font: '', textAlign: 'left', textBaseline: 'alphabetic',
            fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1
        })) as unknown as HTMLCanvasElement['getContext'];
    }
});

describe('TinyRPGBuilder', () => {
    describe('buildURL()', () => {
        it('returns a string containing #', () => {
            const url = new TinyRPG().buildURL();
            expect(typeof url).toBe('string');
            expect(url).toContain('#');
        });

        it('uses default base URL', () => {
            const url = new TinyRPG().buildURL();
            expect(url).toContain('andredarcie.github.io/tiny-rpg-studio/');
        });

        it('accepts custom base URL', () => {
            const url = new TinyRPG().buildURL('http://localhost:5173/');
            expect(url).toContain('http://localhost:5173/');
        });
    });

    describe('toSharePayload()', () => {
        it('tileset.maps has length === ShareConstants.WORLD_ROOM_COUNT', () => {
            const payload = new TinyRPG().toSharePayload();
            expect(payload.tileset?.maps.length).toBe(ShareConstants.WORLD_ROOM_COUNT);
        });

        it('room(0).ground is set correctly, other rooms are {}', () => {
            const matrix = Array.from({ length: ShareConstants.MATRIX_SIZE }, () =>
                Array(ShareConstants.MATRIX_SIZE).fill(0)
            );
            const game = new TinyRPG();
            game.room(0).ground(matrix);
            const payload = game.toSharePayload();
            expect(payload.tileset?.maps[0].ground).toEqual(matrix);
            for (let i = 1; i < ShareConstants.WORLD_ROOM_COUNT; i++) {
                expect(payload.tileset?.maps[i]).toEqual({});
            }
        });

        it('room(MAX_ROOM_INDEX) is indexed correctly even when it is the only room created', () => {
            const game = new TinyRPG();
            game.room(ShareConstants.MAX_ROOM_INDEX).addEnd({ x: 4, y: 4 });
            const payload = game.toSharePayload();
            expect(payload.tileset?.maps.length).toBe(ShareConstants.WORLD_ROOM_COUNT);
            for (let i = 0; i < ShareConstants.MAX_ROOM_INDEX; i++) {
                expect(payload.tileset?.maps[i]).toEqual({});
            }
        });

        it('enemies array contains skeleton in room 0', () => {
            const game = new TinyRPG();
            game.room(0).addEnemy({ type: 'skeleton', x: 3, y: 3 });
            const payload = game.toSharePayload();
            expect(payload.enemies).toHaveLength(1);
            expect(payload.enemies?.[0].type).toBe('skeleton');
            expect(payload.enemies?.[0].roomIndex).toBe(0);
        });

        it('objects contain key, door, and player-end', () => {
            const game = new TinyRPG();
            game.room(0).addKey({ x: 1, y: 1 }).addDoor({ x: 2, y: 2 });
            game.room(1).addEnd({ x: 4, y: 4, message: 'You win!' });
            const payload = game.toSharePayload();
            const types = payload.objects?.map(o => o.type) ?? [];
            expect(types).toContain('key');
            expect(types).toContain('door');
            expect(types).toContain('player-end');
        });

        it('setTitle and setAuthor appear in payload', () => {
            const payload = new TinyRPG().setTitle('My RPG').setAuthor('Andre').toSharePayload();
            expect(payload.title).toBe('My RPG');
            expect(payload.author).toBe('Andre');
        });

        it('hideHUD sets hideHud in payload', () => {
            const payload = new TinyRPG().hideHUD().toSharePayload();
            expect(payload.hideHud).toBe(true);
        });

        it('setPlayerStart sets start in payload', () => {
            const payload = new TinyRPG().setPlayerStart({ x: 1, y: 1, room: 0 }).toSharePayload();
            expect(payload.start).toEqual({ x: 1, y: 1, roomIndex: 0 });
        });

        it('sprites contain NPC with text', () => {
            const game = new TinyRPG();
            game.room(0).addNPC({ type: 'villager-man', x: 2, y: 2, text: 'Ola!' });
            const payload = game.toSharePayload();
            expect(payload.sprites).toHaveLength(1);
            expect(payload.sprites?.[0].type).toBe('villager-man');
            expect(payload.sprites?.[0].text).toBe('Ola!');
            expect(payload.sprites?.[0].placed).toBe(true);
        });
    });

    describe('Validation errors', () => {
        it('room(-1) throws Error', () => {
            expect(() => new TinyRPG().room(-1)).toThrow();
        });

        it('room(MAX_ROOM_INDEX + 1) throws Error', () => {
            expect(() => new TinyRPG().room(ShareConstants.MAX_ROOM_INDEX + 1)).toThrow();
        });

        it('addEnemy with invalid type throws Error', () => {
            expect(() => new TinyRPG().room(0).addEnemy({ type: 'invalid' as never, x: 1, y: 1 })).toThrow(/Unknown enemy type/);
        });

        it('addEnemy with x out of range throws Error', () => {
            const max = ShareConstants.MATRIX_SIZE;
            expect(() => new TinyRPG().room(0).addEnemy({ type: 'skeleton', x: max, y: 0 })).toThrow(/x must be between/);
        });

        it('addEnemy with y out of range throws Error', () => {
            expect(() => new TinyRPG().room(0).addEnemy({ type: 'skeleton', x: 0, y: -1 })).toThrow(/y must be between/);
        });

        it('addKey() called twice in same room throws Error', () => {
            const room = new TinyRPG().room(0);
            room.addKey({ x: 1, y: 1 });
            expect(() => room.addKey({ x: 2, y: 2 })).toThrow(/already has a 'key'/);
        });

        it('addEnemy called 10 times throws Error on the 10th call', () => {
            const room = new TinyRPG().room(0);
            for (let i = 0; i < 9; i++) {
                room.addEnemy({ type: 'giant-rat', x: i % ShareConstants.MATRIX_SIZE, y: 0 });
            }
            expect(() => room.addEnemy({ type: 'giant-rat', x: 0, y: 1 })).toThrow(/already has 9 enemies/);
        });

        it('ground matrix with wrong size throws Error', () => {
            expect(() => new TinyRPG().room(0).ground([[1, 2], [3, 4]])).toThrow(/Ground matrix must be/);
        });

        it('setTitle over 80 chars throws Error', () => {
            expect(() => new TinyRPG().setTitle('a'.repeat(81))).toThrow(/80 characters/);
        });

        it('setAuthor over 60 chars throws Error', () => {
            expect(() => new TinyRPG().setAuthor('a'.repeat(61))).toThrow(/60 characters/);
        });

        it('setPalette with wrong count throws Error', () => {
            expect(() => new TinyRPG().setPalette(['#FF0000'])).toThrow(/Palette must have exactly 16/);
        });

        it('setPalette with invalid color format throws Error', () => {
            const colors = Array(16).fill('#FF0000');
            colors[0] = 'red';
            expect(() => new TinyRPG().setPalette(colors)).toThrow(/Palette must have exactly 16/);
        });
    });

    describe('Sword tiers', () => {
        it('addSword() defaults to iron (type: sword)', () => {
            const game = new TinyRPG();
            game.room(0).addSword({ x: 1, y: 1 });
            expect(game.toSharePayload().objects?.some(o => o.type === 'sword')).toBe(true);
        });

        it('addSword({ tier: bronze }) sets type sword-bronze', () => {
            const game = new TinyRPG();
            game.room(0).addSword({ x: 1, y: 1, tier: 'bronze' });
            expect(game.toSharePayload().objects?.some(o => o.type === 'sword-bronze')).toBe(true);
        });

        it('addSword({ tier: wood }) sets type sword-wood', () => {
            const game = new TinyRPG();
            game.room(0).addSword({ x: 1, y: 1, tier: 'wood' });
            expect(game.toSharePayload().objects?.some(o => o.type === 'sword-wood')).toBe(true);
        });
    });

    describe('Full example', () => {
        it('generates a valid URL with all features', () => {
            const size = ShareConstants.MATRIX_SIZE;
            const matrix = Array.from({ length: size }, (_, r) =>
                Array.from({ length: size }, (__, c) => (r === 0 || r === size - 1 || c === 0 || c === size - 1 ? 1 : 0))
            );

            const game = new TinyRPG()
                .setTitle('Meu RPG')
                .setAuthor('Andre')
                .setPlayerStart({ x: 1, y: 1, room: 0 });

            game.room(0)
                .ground(matrix)
                .addEnemy({ type: 'skeleton', x: 3, y: 3 })
                .addNPC({ type: 'villager-man', x: 2, y: 2, text: 'Ola!' })
                .addKey({ x: 5, y: 5 })
                .addDoor({ x: 6, y: 3 });

            game.room(ShareConstants.MAX_ROOM_INDEX)
                .addEnd({ x: 4, y: 4, message: 'Voce venceu!' });

            const url = game.buildURL();
            expect(url).toContain('#');
            expect(url).toContain('andredarcie.github.io');
        });
    });
});
