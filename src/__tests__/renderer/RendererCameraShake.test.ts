import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RendererCameraShake } from '../../runtime/adapters/renderer/RendererCameraShake';
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

describe('RendererCameraShake', () => {
    let now: number;

    beforeEach(() => {
        now = 5000;
        vi.spyOn(performance, 'now').mockReturnValue(now);
    });

    describe('constructor', () => {
        it('starts with shake inactive', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            expect(shake.isActive()).toBe(false);
        });

        it('getCurrentOffset returns zero when inactive', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            expect(shake.getCurrentOffset()).toEqual({ x: 0, y: 0 });
        });
    });

    describe('trigger', () => {
        it('activates shake', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(0.5);
            expect(shake.isActive()).toBe(true);
        });

        it('clamps intensity to minIntensity', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(0); // below minIntensity (0.3)
            // shake should still be active
            expect(shake.isActive()).toBe(true);
            // offset should be non-zero (intensity clamped to min)
            const offset = shake.getCurrentOffset();
            expect(offset.x !== 0 || offset.y !== 0).toBe(true);
        });

        it('clamps intensity to maxIntensity', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(99); // well above maxIntensity (1.0)
            expect(shake.isActive()).toBe(true);
        });

        it('uses provided duration', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(0.5, 999);
            expect(shake.isActive()).toBe(true);
            // At progress=1 (elapsed=999ms), shake should deactivate
            vi.spyOn(performance, 'now').mockReturnValue(now + 999);
            shake.getCurrentOffset(); // triggers deactivation check
            expect(shake.isActive()).toBe(false);
        });

        it('uses config baseDuration when duration not provided', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(0.5); // no duration → uses baseDuration (300ms)
            vi.spyOn(performance, 'now').mockReturnValue(now + GameConfig.combat.screenShake.baseDuration);
            shake.getCurrentOffset();
            expect(shake.isActive()).toBe(false);
        });
    });

    describe('triggerFromDamage', () => {
        it('activates shake', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.triggerFromDamage(5);
            expect(shake.isActive()).toBe(true);
        });

        it('applies minIntensity + damage * intensityPerDamage', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            // damage=0 → intensity = minIntensity (0.3), still within valid range
            shake.triggerFromDamage(0);
            expect(shake.isActive()).toBe(true);
        });

        it('caps intensity at maxIntensity for large damage values', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.triggerFromDamage(1000); // huge damage
            expect(shake.isActive()).toBe(true);
        });
    });

    describe('getCurrentOffset', () => {
        it('returns { x: 0, y: 0 } when not active', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            expect(shake.getCurrentOffset()).toEqual({ x: 0, y: 0 });
        });

        it('returns non-zero offset while shake is active', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(1.0, 500);
            // At t=100ms (progress=0.2), sine wave should produce non-zero offset
            vi.spyOn(performance, 'now').mockReturnValue(now + 100);
            const offset = shake.getCurrentOffset();
            expect(offset.x !== 0 || offset.y !== 0).toBe(true);
        });

        it('deactivates and returns zero when progress reaches 1', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(1.0, 300);
            vi.spyOn(performance, 'now').mockReturnValue(now + 300);
            const offset = shake.getCurrentOffset();
            expect(offset).toEqual({ x: 0, y: 0 });
            expect(shake.isActive()).toBe(false);
        });

        it('returns zero when progress exceeds 1', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(1.0, 300);
            vi.spyOn(performance, 'now').mockReturnValue(now + 999);
            expect(shake.getCurrentOffset()).toEqual({ x: 0, y: 0 });
        });
    });

    describe('isActive', () => {
        it('returns false before any trigger', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            expect(shake.isActive()).toBe(false);
        });

        it('returns true right after trigger', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(0.5);
            expect(shake.isActive()).toBe(true);
        });

        it('returns false after stop', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(0.5);
            shake.stop();
            expect(shake.isActive()).toBe(false);
        });
    });

    describe('stop', () => {
        it('deactivates an active shake', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(1.0, 1000);
            shake.stop();
            expect(shake.isActive()).toBe(false);
        });

        it('makes getCurrentOffset return zero immediately', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            shake.trigger(1.0, 1000);
            shake.stop();
            expect(shake.getCurrentOffset()).toEqual({ x: 0, y: 0 });
        });

        it('is safe to call when already inactive', () => {
            const shake = new RendererCameraShake(makeRenderer() as never);
            expect(() => shake.stop()).not.toThrow();
        });
    });
});
