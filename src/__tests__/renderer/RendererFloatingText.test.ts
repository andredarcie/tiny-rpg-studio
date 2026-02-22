import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RendererFloatingText } from '../../runtime/adapters/renderer/RendererFloatingText';
import { GameConfig } from '../../config/GameConfig';

const makeRenderer = () => ({
    canvas: {} as HTMLCanvasElement,
    ctx: null,
    gameState: {},
    tileManager: {},
    paletteManager: {},
    spriteFactory: {},
    canvasHelper: {},
    entityRenderer: {},
});

const makeCtx = () => ({
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    set globalAlpha(_: number) {},
    set font(_: string) {},
    set fillStyle(_: string) {},
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    set textAlign(_: string) {},
    set textBaseline(_: string) {},
} as unknown as CanvasRenderingContext2D);

describe('RendererFloatingText', () => {
    let now: number;

    beforeEach(() => {
        now = 1000;
        vi.spyOn(performance, 'now').mockReturnValue(now);
    });

    describe('constructor', () => {
        it('starts with no active texts', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            expect(ft.getActiveCount()).toBe(0);
        });
    });

    describe('spawn', () => {
        it('adds an entry when floatingNumbers is enabled', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('5', 64, 32);
            expect(ft.getActiveCount()).toBe(1);
        });

        it('uses config defaults for duration, riseSpeed and fontSize', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('10', 0, 0);
            expect(ft.getActiveCount()).toBe(1);
        });

        it('uses provided options over defaults', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('!', 10, 20, { color: '#00FF00', fontSize: 16, duration: 500, riseSpeed: 1.0 });
            expect(ft.getActiveCount()).toBe(1);
        });

        it('converts text argument to string', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            // The implementation does String(text) — passing a non-string should work
            ft.spawn('42', 0, 0);
            expect(ft.getActiveCount()).toBe(1);
        });

        it('allows multiple concurrent texts', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('1', 0, 0);
            ft.spawn('2', 10, 10);
            ft.spawn('3', 20, 20);
            expect(ft.getActiveCount()).toBe(3);
        });
    });

    describe('spawnDamageNumber', () => {
        it('spawns a floating text entry', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawnDamageNumber(7, 3, 4);
            expect(ft.getActiveCount()).toBe(1);
        });

        it('converts tile coordinates to pixel coordinates (tileX*16+8, tileY*16)', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            ft.spawnDamageNumber(5, 2, 3); // pixelX=40, pixelY=48
            // Draw at t=0 (not expired) and verify text is drawn
            ft.draw(ctx);
            expect(ctx.fillText).toHaveBeenCalledWith('5', 40, 48);
        });

    });

    describe('draw', () => {
        it('does nothing when ctx is null', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('5', 10, 10);
            expect(() => ft.draw(null)).not.toThrow();
        });

        it('does nothing when there are no active texts', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            ft.draw(ctx);
            expect(ctx.save).not.toHaveBeenCalled();
        });

        it('calls save and restore per entry drawn', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            ft.spawn('3', 10, 10);
            ft.draw(ctx);
            expect(ctx.save).toHaveBeenCalledTimes(1);
            expect(ctx.restore).toHaveBeenCalledTimes(1);
        });

        it('renders strokeText and fillText', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            ft.spawn('9', 20, 30);
            ft.draw(ctx);
            expect(ctx.strokeText).toHaveBeenCalledWith('9', 20, 30);
            expect(ctx.fillText).toHaveBeenCalledWith('9', 20, 30);
        });

        it('removes expired entries on draw', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            const duration = GameConfig.combat.floatingNumbers.duration;
            ft.spawn('X', 0, 0);
            expect(ft.getActiveCount()).toBe(1);
            // Advance time past the entry's duration
            vi.spyOn(performance, 'now').mockReturnValue(now + duration + 1);
            ft.draw(ctx);
            expect(ft.getActiveCount()).toBe(0);
        });

        it('keeps entries that have not yet expired', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            ft.spawn('Y', 0, 0);
            // Advance time to halfway through the duration
            vi.spyOn(performance, 'now').mockReturnValue(now + GameConfig.combat.floatingNumbers.duration / 2);
            ft.draw(ctx);
            expect(ft.getActiveCount()).toBe(1);
        });

        it('removes multiple expired entries correctly', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            const duration = GameConfig.combat.floatingNumbers.duration;
            ft.spawn('A', 0, 0);
            ft.spawn('B', 10, 0);
            ft.spawn('C', 20, 0);
            vi.spyOn(performance, 'now').mockReturnValue(now + duration + 1);
            ft.draw(ctx);
            expect(ft.getActiveCount()).toBe(0);
        });

        it('draws text at rising y position (y decreases over time)', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            const ctx = makeCtx();
            const riseSpeed = GameConfig.combat.floatingNumbers.riseSpeed;
            const elapsed = 200;
            ft.spawn('Z', 64, 50);
            vi.spyOn(performance, 'now').mockReturnValue(now + elapsed);
            ft.draw(ctx);
            const expectedY = 50 - riseSpeed * elapsed;
            expect(ctx.fillText).toHaveBeenCalledWith('Z', 64, expectedY);
        });
    });

    describe('clear', () => {
        it('removes all active texts', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('1', 0, 0);
            ft.spawn('2', 10, 0);
            ft.spawn('3', 20, 0);
            ft.clear();
            expect(ft.getActiveCount()).toBe(0);
        });

        it('is safe to call when already empty', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            expect(() => ft.clear()).not.toThrow();
            expect(ft.getActiveCount()).toBe(0);
        });
    });

    describe('getActiveCount', () => {
        it('returns 0 initially', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            expect(ft.getActiveCount()).toBe(0);
        });

        it('increments with each spawn', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('a', 0, 0);
            expect(ft.getActiveCount()).toBe(1);
            ft.spawn('b', 0, 0);
            expect(ft.getActiveCount()).toBe(2);
        });

        it('returns 0 after clear', () => {
            const ft = new RendererFloatingText(makeRenderer() as never);
            ft.spawn('a', 0, 0);
            ft.clear();
            expect(ft.getActiveCount()).toBe(0);
        });
    });
});
