import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RendererAttackTelegraph } from '../../runtime/adapters/renderer/RendererAttackTelegraph';

describe('RendererAttackTelegraph', () => {
    let telegraph: RendererAttackTelegraph;
    let mockRenderer: {
        gameState: {
            state: {
                enemies: Array<{
                    id: string;
                    x: number;
                    y: number;
                    roomIndex: number;
                    attackWarning?: boolean;
                }>;
            };
        };
        viewportOffsetY: number;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        // Mock performance.now() to work with fake timers
        vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
        mockRenderer = {
            gameState: {
                state: {
                    enemies: []
                }
            },
            viewportOffsetY: 0
        };
        telegraph = new RendererAttackTelegraph(mockRenderer as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should activate telegraph for enemy', () => {
        telegraph.activateTelegraph('enemy-1', { x: 1, y: 0 });
        expect(telegraph.isActive('enemy-1')).toBe(true);
    });

    it('should deactivate telegraph for enemy', () => {
        telegraph.activateTelegraph('enemy-1', { x: 1, y: 0 });
        telegraph.deactivateTelegraph('enemy-1');
        expect(telegraph.isActive('enemy-1')).toBe(false);
    });

    it('should clear all telegraphs', () => {
        telegraph.activateTelegraph('enemy-1', { x: 1, y: 0 });
        telegraph.activateTelegraph('enemy-2', { x: 0, y: 1 });
        telegraph.clearAll();
        expect(telegraph.isActive('enemy-1')).toBe(false);
        expect(telegraph.isActive('enemy-2')).toBe(false);
    });

    it('should return null windup offset for inactive enemy', () => {
        const offset = telegraph.getWindupOffset('enemy-1');
        expect(offset).toBeNull();
    });

    it('should return valid windup offset for active enemy', () => {
        telegraph.activateTelegraph('enemy-1', { x: 1, y: 0 });
        const offset = telegraph.getWindupOffset('enemy-1');
        expect(offset).not.toBeNull();
        expect(offset).toHaveProperty('x');
        expect(offset).toHaveProperty('y');
    });

    it('should not throw when rendering with no enemies', () => {
        const mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        expect(() => {
            telegraph.render(mockCtx, 16);
        }).not.toThrow();
    });

    it('should apply windup offset correctly', () => {
        // Enemy at (2, 3) moving toward player at (3, 3) - direction is (1, 0) right
        telegraph.activateTelegraph('enemy-1', { x: 1, y: 0 });

        const baseX = 32; // 2 * 16
        const baseY = 48; // 3 * 16

        // Advance time to middle of windup animation (150ms out of 300ms)
        // This is when the offset should be at its peak
        vi.advanceTimersByTime(150);

        const result = telegraph.applyWindupOffset('enemy-1', baseX, baseY);

        // Should pull back to the left (negative x offset)
        expect(result.x).toBeLessThan(baseX);
        expect(result.y).toBe(baseY); // Y should not change for horizontal movement
    });
});
