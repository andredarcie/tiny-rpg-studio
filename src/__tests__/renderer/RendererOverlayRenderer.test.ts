import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RendererOverlayRenderer } from '../../runtime/adapters/renderer/RendererOverlayRenderer';
import { TextResources } from '../../runtime/adapters/TextResources';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeCtx = () => {
    const gradient = { addColorStop: vi.fn() };
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        createLinearGradient: vi.fn(() => gradient),
        fillText: vi.fn(),
        measureText: vi.fn((t: string) => ({ width: t.length * 6 })),
        canvas: { width: 128, height: 128 },
        set lineWidth(_v: number) {},
        set fillStyle(_v: string) {},
        set strokeStyle(_v: string) {},
        set shadowColor(_v: string) {},
        set shadowBlur(_v: number) {},
        set shadowOffsetY(_v: number) {},
        set globalAlpha(_v: number) {},
        set textAlign(_v: CanvasTextAlign) {},
        set textBaseline(_v: CanvasTextBaseline) {},
        set font(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
};

const makeRenderer = (overrides: Record<string, unknown> = {}) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = makeCtx();
    canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext'];

    const renderer = {
        canvas,
        ctx,
        gameState: {
            getLevelUpOverlay: vi.fn(() => null),
            getPendingLevelUpChoices: vi.fn(() => 0),
            getLevelUpCelebration: vi.fn(() => null),
            isLevelUpCelebrationActive: vi.fn(() => false),
            getPickupOverlay: vi.fn(() => null),
            isPickupOverlayActive: vi.fn(() => false),
            getGameOverReason: vi.fn(() => null),
            getActiveEndingText: vi.fn(() => ''),
            canResetAfterGameOver: false,
            hasNecromancerReviveReady: vi.fn(() => false),
        },
        tileManager: {},
        paletteManager: { getColor: vi.fn((i: number) => `#color${i}`) },
        spriteFactory: { getObjectSprites: vi.fn(() => ({ key: [[1]] })) },
        canvasHelper: { drawSprite: vi.fn() },
        entityRenderer: { cleanupEnemyLabels: vi.fn() },
        draw: vi.fn(),
        gameEngine: {},
        ...overrides,
    };

    return { renderer, ctx, canvas };
};

const makeOverlay = () => {
    const { renderer, ctx, canvas } = makeRenderer();
    const overlay = new RendererOverlayRenderer(renderer as never);
    return { overlay, renderer, ctx, canvas };
};

// ─── constructor & setIntroData ──────────────────────────────────────────────

describe('RendererOverlayRenderer – constructor', () => {
    it('initialises with default introData', () => {
        const { overlay } = makeOverlay();
        expect(overlay.introData).toEqual({ title: 'Tiny RPG Studio', author: '' });
    });

    it('initialises animation handles as 0', () => {
        const { overlay } = makeOverlay();
        expect(overlay.pickupAnimationHandle).toBe(0);
        expect(overlay.levelUpAnimationHandle).toBe(0);
    });
});

describe('RendererOverlayRenderer – setIntroData', () => {
    it('sets title and author', () => {
        const { overlay } = makeOverlay();
        overlay.setIntroData({ title: 'My Game', author: 'Dev' });
        expect(overlay.introData).toEqual({ title: 'My Game', author: 'Dev' });
    });

    it('falls back to defaults when called with empty object', () => {
        const { overlay } = makeOverlay();
        overlay.setIntroData({});
        expect(overlay.introData).toEqual({ title: 'Tiny RPG Studio', author: '' });
    });

    it('falls back to defaults when called with no args', () => {
        const { overlay } = makeOverlay();
        overlay.setIntroData();
        expect(overlay.introData).toEqual({ title: 'Tiny RPG Studio', author: '' });
    });
});

// ─── clamp / easeOutBack / easeOutQuad ───────────────────────────────────────

describe('RendererOverlayRenderer – clamp', () => {
    it('returns value when within range', () => {
        const { overlay } = makeOverlay();
        expect(overlay.clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to min', () => {
        const { overlay } = makeOverlay();
        expect(overlay.clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to max', () => {
        const { overlay } = makeOverlay();
        expect(overlay.clamp(15, 0, 10)).toBe(10);
    });
});

describe('RendererOverlayRenderer – easeOutBack', () => {
    it('returns 1 at t=1', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutBack(1)).toBeCloseTo(1, 5);
    });

    it('returns 0 at t=0', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutBack(0)).toBeCloseTo(0, 5);
    });

    it('clamps t above 1', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutBack(2)).toBeCloseTo(overlay.easeOutBack(1), 5);
    });

    it('defaults t to 0 when not provided', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutBack()).toBeCloseTo(0, 5);
    });
});

describe('RendererOverlayRenderer – easeOutQuad', () => {
    it('returns 1 at t=1', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutQuad(1)).toBeCloseTo(1, 5);
    });

    it('returns 0 at t=0', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutQuad(0)).toBeCloseTo(0, 5);
    });

    it('defaults t to 0 when not provided', () => {
        const { overlay } = makeOverlay();
        expect(overlay.easeOutQuad()).toBeCloseTo(0, 5);
    });
});

// ─── getNow ──────────────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – getNow', () => {
    it('uses performance.now when available', () => {
        const { overlay } = makeOverlay();
        vi.spyOn(performance, 'now').mockReturnValue(42);
        expect(overlay.getNow()).toBe(42);
        vi.restoreAllMocks();
    });

    it('falls back to Date.now when performance is unavailable', () => {
        const { overlay } = makeOverlay();
        const original = (globalThis as Record<string, unknown>).performance;
        (globalThis as Record<string, unknown>).performance = undefined;
        vi.spyOn(Date, 'now').mockReturnValue(999);
        expect(overlay.getNow()).toBe(999);
        (globalThis as Record<string, unknown>).performance = original;
        vi.restoreAllMocks();
    });
});

// ─── schedulePickupFrame / cancelPickupFrame ─────────────────────────────────

describe('RendererOverlayRenderer – schedulePickupFrame', () => {
    beforeEach(() => { vi.stubGlobal('requestAnimationFrame', vi.fn(() => 7)); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('calls requestAnimationFrame when available', () => {
        const { overlay } = makeOverlay();
        const fn = vi.fn();
        const id = overlay.schedulePickupFrame(fn);
        expect(requestAnimationFrame).toHaveBeenCalledWith(fn);
        expect(id).toBe(7);
    });

    it('falls back to setTimeout when requestAnimationFrame is not available', () => {
        vi.stubGlobal('requestAnimationFrame', undefined);
        vi.stubGlobal('setTimeout', vi.fn(() => 42));
        const { overlay } = makeOverlay();
        const id = overlay.schedulePickupFrame(vi.fn());
        expect(setTimeout).toHaveBeenCalled();
        expect(id).toBe(42);
    });
});

describe('RendererOverlayRenderer – cancelPickupFrame', () => {
    beforeEach(() => { vi.stubGlobal('cancelAnimationFrame', vi.fn()); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('calls cancelAnimationFrame when available', () => {
        const { overlay } = makeOverlay();
        overlay.cancelPickupFrame(5);
        expect(cancelAnimationFrame).toHaveBeenCalledWith(5);
    });

    it('falls back to clearTimeout when cancelAnimationFrame is not available', () => {
        vi.stubGlobal('cancelAnimationFrame', undefined);
        vi.stubGlobal('clearTimeout', vi.fn());
        const { overlay } = makeOverlay();
        overlay.cancelPickupFrame(5);
        expect(clearTimeout).toHaveBeenCalledWith(5);
    });
});

// ─── stopPickupAnimationLoop / stopLevelUpAnimationLoop ──────────────────────

describe('RendererOverlayRenderer – stopPickupAnimationLoop', () => {
    beforeEach(() => { vi.stubGlobal('cancelAnimationFrame', vi.fn()); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('does nothing when handle is 0', () => {
        const { overlay } = makeOverlay();
        overlay.stopPickupAnimationLoop();
        expect(cancelAnimationFrame).not.toHaveBeenCalled();
    });

    it('cancels frame and resets handle when active', () => {
        const { overlay } = makeOverlay();
        overlay.pickupAnimationHandle = 99;
        overlay.stopPickupAnimationLoop();
        expect(cancelAnimationFrame).toHaveBeenCalledWith(99);
        expect(overlay.pickupAnimationHandle).toBe(0);
    });
});

describe('RendererOverlayRenderer – stopLevelUpAnimationLoop', () => {
    beforeEach(() => { vi.stubGlobal('cancelAnimationFrame', vi.fn()); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('does nothing when handle is 0', () => {
        const { overlay } = makeOverlay();
        overlay.stopLevelUpAnimationLoop();
        expect(cancelAnimationFrame).not.toHaveBeenCalled();
    });

    it('cancels frame and resets handle when active', () => {
        const { overlay } = makeOverlay();
        overlay.levelUpAnimationHandle = 77;
        overlay.stopLevelUpAnimationLoop();
        expect(cancelAnimationFrame).toHaveBeenCalledWith(77);
        expect(overlay.levelUpAnimationHandle).toBe(0);
    });
});

// ─── ensurePickupFx ───────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – ensurePickupFx', () => {
    it('creates new fx when id changes', () => {
        const { overlay } = makeOverlay();
        const result = overlay.ensurePickupFx({ spriteGroup: 'object', spriteType: 'key', name: 'Key' }, 1000);
        expect(result.id).toBe('object:key:Key');
        expect(result.startTime).toBe(1000);
    });

    it('reuses existing fx when id is the same', () => {
        const { overlay } = makeOverlay();
        overlay.ensurePickupFx({ spriteGroup: 'object', spriteType: 'key', name: 'Key' }, 1000);
        const result = overlay.ensurePickupFx({ spriteGroup: 'object', spriteType: 'key', name: 'Key' }, 2000);
        expect(result.startTime).toBe(1000);
    });

    it('handles missing overlay fields', () => {
        const { overlay } = makeOverlay();
        const result = overlay.ensurePickupFx({}, 500);
        expect(result.id).toBe('::');
        expect(result.startTime).toBe(500);
    });
});

// ─── getPickupSprite ──────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – getPickupSprite', () => {
    it('returns null when overlay is null', () => {
        const { overlay } = makeOverlay();
        expect(overlay.getPickupSprite(null)).toBeNull();
    });

    it('returns null when spriteGroup is missing', () => {
        const { overlay } = makeOverlay();
        expect(overlay.getPickupSprite({})).toBeNull();
    });

    it('returns sprite for object group', () => {
        const { overlay } = makeOverlay();
        const result = overlay.getPickupSprite({ spriteGroup: 'object', spriteType: 'key' });
        expect(result).toEqual([[1]]);
    });

    it('returns null when spriteType is missing in object group', () => {
        const { overlay } = makeOverlay();
        const result = overlay.getPickupSprite({ spriteGroup: 'object', spriteType: '' });
        expect(result).toBeNull();
    });

    it('returns null when spriteType is not found in the sprites map', () => {
        const { renderer } = makeRenderer();
        (renderer.spriteFactory.getObjectSprites as ReturnType<typeof vi.fn>).mockReturnValue({});
        const overlay = new RendererOverlayRenderer(renderer as never);
        const result = overlay.getPickupSprite({ spriteGroup: 'object', spriteType: 'nonexistent' });
        expect(result).toBeNull();
    });

    it('returns null for unknown spriteGroup', () => {
        const { overlay } = makeOverlay();
        const result = overlay.getPickupSprite({ spriteGroup: 'unknown' });
        expect(result).toBeNull();
    });
});

// ─── drawWrappedText ─────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawWrappedText', () => {
    it('returns immediately for empty text', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawWrappedText(ctx, '', 0, 0, 200, 12);
        expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('draws single line that fits within maxWidth', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawWrappedText(ctx, 'hi', 0, 0, 200, 12);
        expect(ctx.fillText).toHaveBeenCalledWith('hi', 0, 0);
    });

    it('wraps text that exceeds maxWidth', () => {
        // each char = 6px; maxWidth=50 → limit ~8 chars per line
        // "aaaaa bbbbb" → "aaaaa"=30px fits, "aaaaa bbbbb"=66px overflows → wraps
        const { overlay, ctx } = makeOverlay();
        overlay.drawWrappedText(ctx, 'aaaaa bbbbb', 0, 0, 50, 12);
        expect(ctx.fillText).toHaveBeenCalledTimes(2);
        expect(ctx.fillText).toHaveBeenNthCalledWith(1, 'aaaaa', 0, 0);
        expect(ctx.fillText).toHaveBeenNthCalledWith(2, 'bbbbb', 0, 12);
    });

    it('stops at maxLines and appends ellipsis', () => {
        // maxLines=1: after first word triggers hitMaxLines, remaining words are truncated
        const { overlay, ctx } = makeOverlay();
        overlay.drawWrappedText(ctx, 'aaa bbb ccc', 0, 0, 200, 12, 1);
        const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1][0] as string;
        expect(lastCall).toMatch(/\.\.\./);
    });

    it('draws all words when maxLines is null', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawWrappedText(ctx, 'a b c d e', 0, 0, 12, 10, null);
        // each single char fits (6px < 12px), but "a b" = 18px > 12px → wraps each word
        expect(ctx.fillText).toHaveBeenCalled();
    });
});

// ─── drawPickupFrame ─────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawPickupFrame', () => {
    it('draws using provided accent color', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawPickupFrame(ctx, { x: 10, y: 10, size: 80, elapsed: 0.5, accent: '#FF0000' });
        expect(ctx.createLinearGradient).toHaveBeenCalled();
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('falls back to palette color when no accent provided', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawPickupFrame(ctx, { x: 10, y: 10, size: 80 });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('falls back to #FFF1E8 when palette returns falsy', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.paletteManager.getColor as ReturnType<typeof vi.fn>).mockReturnValue('');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawPickupFrame(ctx, { x: 0, y: 0, size: 64 });
        expect(ctx.fillRect).toHaveBeenCalled();
    });
});

// ─── drawPickupRings ─────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawPickupRings', () => {
    it('draws rings with arc calls', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawPickupRings(ctx, { centerX: 64, centerY: 64, size: 80, elapsed: 0.5 });
        expect(ctx.arc).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('uses default elapsed=0 when not provided', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawPickupRings(ctx, { centerX: 64, centerY: 64, size: 80 });
        expect(ctx.arc).toHaveBeenCalled();
    });
});

// ─── ensurePickupAnimationLoop ────────────────────────────────────────────────

describe('RendererOverlayRenderer – ensurePickupAnimationLoop', () => {
    beforeEach(() => {
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('does nothing when handle is already set', () => {
        const { overlay } = makeOverlay();
        overlay.pickupAnimationHandle = 99;
        overlay.ensurePickupAnimationLoop();
        expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('schedules animation frame when handle is 0', () => {
        const { overlay } = makeOverlay();
        overlay.ensurePickupAnimationLoop();
        expect(requestAnimationFrame).toHaveBeenCalled();
        expect(overlay.pickupAnimationHandle).toBe(1);
    });

    it('callback stops loop when pickup overlay becomes inactive', () => {
        let capturedStep: (() => void) | null = null;
        vi.stubGlobal('requestAnimationFrame', vi.fn((fn: () => void) => {
            capturedStep = fn;
            return 2;
        }));
        const { renderer } = makeRenderer();
        (renderer.gameState.isPickupOverlayActive as ReturnType<typeof vi.fn>).mockReturnValue(false);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.ensurePickupAnimationLoop();
        overlay.pickupAnimationHandle = 2;
        expect(capturedStep).toBeDefined();
        (capturedStep as () => void)();
        expect(overlay.pickupAnimationHandle).toBe(0);
    });

    it('callback reschedules and calls draw when overlay is still active', () => {
        let callCount = 0;
        let capturedStep: (() => void) | null = null;
        vi.stubGlobal('requestAnimationFrame', vi.fn((fn: () => void) => {
            if (callCount++ === 0) capturedStep = fn;
            return callCount;
        }));
        const { renderer } = makeRenderer();
        (renderer.gameState.isPickupOverlayActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.ensurePickupAnimationLoop();
        expect(capturedStep).toBeDefined();
        (capturedStep as () => void)();
        expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
        expect(renderer.draw).toHaveBeenCalled();
    });
});

// ─── ensureLevelUpAnimationLoop ───────────────────────────────────────────────

describe('RendererOverlayRenderer – ensureLevelUpAnimationLoop', () => {
    beforeEach(() => {
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('does nothing when handle is already set', () => {
        const { overlay } = makeOverlay();
        overlay.levelUpAnimationHandle = 55;
        overlay.ensureLevelUpAnimationLoop();
        expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('schedules animation frame when handle is 0', () => {
        const { overlay } = makeOverlay();
        overlay.ensureLevelUpAnimationLoop();
        expect(requestAnimationFrame).toHaveBeenCalled();
        expect(overlay.levelUpAnimationHandle).toBe(1);
    });

    it('callback stops loop and draws when celebration becomes inactive', () => {
        let capturedStep: (() => void) | null = null;
        vi.stubGlobal('requestAnimationFrame', vi.fn((fn: () => void) => {
            capturedStep = fn;
            return 3;
        }));
        const { renderer } = makeRenderer();
        (renderer.gameState.isLevelUpCelebrationActive as ReturnType<typeof vi.fn>).mockReturnValue(false);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.ensureLevelUpAnimationLoop();
        overlay.levelUpAnimationHandle = 3;
        expect(capturedStep).toBeDefined();
        (capturedStep as () => void)();
        expect(overlay.levelUpAnimationHandle).toBe(0);
        expect(renderer.draw).toHaveBeenCalled();
    });

    it('callback reschedules and draws when celebration is still active', () => {
        let callCount = 0;
        let capturedStep: (() => void) | null = null;
        vi.stubGlobal('requestAnimationFrame', vi.fn((fn: () => void) => {
            if (callCount++ === 0) capturedStep = fn;
            return callCount;
        }));
        const { renderer } = makeRenderer();
        (renderer.gameState.isLevelUpCelebrationActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.ensureLevelUpAnimationLoop();
        expect(capturedStep).toBeDefined();
        (capturedStep as () => void)();
        expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
        expect(renderer.draw).toHaveBeenCalled();
    });
});

// ─── getLevelUpCardLayout ────────────────────────────────────────────────────

describe('RendererOverlayRenderer – getLevelUpCardLayout', () => {
    it('returns layout with default params', () => {
        const { overlay } = makeOverlay();
        const layout = overlay.getLevelUpCardLayout();
        expect(layout.rects).toHaveLength(1);
        expect(layout.cardArea).toBeDefined();
    });

    it('stacks cards vertically when cardCount is 2', () => {
        const { overlay } = makeOverlay();
        const layout = overlay.getLevelUpCardLayout({ width: 200, height: 200, choicesLength: 2 });
        expect(layout.rects).toHaveLength(2);
        // perRow = 1 when cardCount === 2
        expect(layout.cardArea.perRow).toBe(1);
        expect(layout.cardArea.rows).toBe(2);
    });

    it('lays out 3 cards side by side', () => {
        const { overlay } = makeOverlay();
        const layout = overlay.getLevelUpCardLayout({ width: 300, height: 200, choicesLength: 3 });
        expect(layout.rects).toHaveLength(3);
        expect(layout.cardArea.perRow).toBe(3);
    });

    it('adds extra vertical space when hasPendingText is true', () => {
        const { overlay } = makeOverlay();
        const withPending = overlay.getLevelUpCardLayout({ width: 200, height: 200, hasPendingText: true });
        const withoutPending = overlay.getLevelUpCardLayout({ width: 200, height: 200, hasPendingText: false });
        expect(withPending.cardArea.cardYStart).toBeGreaterThanOrEqual(withoutPending.cardArea.cardYStart);
    });

    it('uses provided titleFont and pendingFont values', () => {
        const { overlay } = makeOverlay();
        const layout = overlay.getLevelUpCardLayout({
            width: 200, height: 200, titleFont: 20, pendingFont: 10, hasPendingText: true
        });
        expect(layout.rects).toBeDefined();
    });
});

// ─── drawLevelUpCard ─────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawLevelUpCard', () => {
    it('draws inactive card without icon', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawLevelUpCard(ctx, { x: 0, y: 0, width: 120, height: 80, active: false, data: { id: 'test' } });
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(ctx.strokeRect).toHaveBeenCalled();
    });

    it('uses #C2C3C7 fallback when inactive and getColor(6) returns empty', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.paletteManager.getColor as ReturnType<typeof vi.fn>).mockReturnValue('');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpCard(ctx, { x: 0, y: 0, width: 120, height: 80, active: false, data: { id: 'x' } });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws active card with icon', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawLevelUpCard(ctx, {
            x: 0, y: 0, width: 120, height: 80, active: true,
            data: { id: 'skill', icon: '⚔️', nameKey: 'skills.stealth.name', descriptionKey: 'skills.stealth.desc' }
        });
        expect(ctx.fillText).toHaveBeenCalled();
    });

    it('uses #64b5f6 fallback when active and getColor(13) returns empty', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.paletteManager.getColor as ReturnType<typeof vi.fn>).mockReturnValue('');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpCard(ctx, { x: 0, y: 0, width: 120, height: 80, active: true, data: { id: 'x' } });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws card with null data', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawLevelUpCard(ctx, { x: 0, y: 0, width: 120, height: 80, data: null });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws card using id as name when no nameKey', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawLevelUpCard(ctx, {
            x: 0, y: 0, width: 120, height: 80,
            data: { id: 'myskill', descriptionKey: 'skills.stealth.desc' }
        });
        const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.some((c) => c[0] === 'myskill')).toBe(true);
    });

    it('uses empty name when data has nameKey but no id', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawLevelUpCard(ctx, {
            x: 0, y: 0, width: 120, height: 80,
            data: { nameKey: 'skills.stealth.name' }
        });
        expect(ctx.fillRect).toHaveBeenCalled();
    });
});

// ─── drawIntroOverlay ────────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawIntroOverlay', () => {
    it('draws title without author line', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.setIntroData({ title: 'My Game', author: '' });
        overlay.drawIntroOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillText).toHaveBeenCalledWith('My Game', expect.any(Number), expect.any(Number));
    });

    it('falls back to "Tiny RPG Studio" when introData.title is empty', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.introData = { title: '', author: '' };
        overlay.drawIntroOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillText).toHaveBeenCalledWith('Tiny RPG Studio', expect.any(Number), expect.any(Number));
    });

    it('draws byline when author is set', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.setIntroData({ title: 'My Game', author: 'Dev' });
        overlay.drawIntroOverlay(ctx, { width: 128, height: 128 });
        const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
        expect(texts.some((t: string) => t.includes('Dev'))).toBe(true);
    });

    it('draws start label when canDismissIntroScreen is true (blink max phase)', () => {
        vi.spyOn(Date, 'now').mockReturnValue(0);
        const { renderer, ctx } = makeRenderer({ gameEngine: { canDismissIntroScreen: true } });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawIntroOverlay(ctx, { width: 128, height: 128 });
        vi.restoreAllMocks();
        expect(ctx.fillText).toHaveBeenCalledTimes(2);
    });

    it('draws start label with blink min phase', () => {
        vi.spyOn(Date, 'now').mockReturnValue(750);
        const { renderer, ctx } = makeRenderer({ gameEngine: { canDismissIntroScreen: true } });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawIntroOverlay(ctx, { width: 128, height: 128 });
        vi.restoreAllMocks();
        expect(ctx.fillText).toHaveBeenCalledTimes(2);
    });

    it('skips start label when canDismissIntroScreen is false', () => {
        const { renderer, ctx } = makeRenderer({ gameEngine: { canDismissIntroScreen: false } });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawIntroOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillText).toHaveBeenCalledTimes(1);
    });
});

// ─── drawLevelUpOverlay ──────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawLevelUpOverlay', () => {
    beforeEach(() => { vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('returns without drawing when overlay is null', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('returns without drawing when overlay is inactive', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({ active: false });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('draws "all unlocked" text when choices array is empty', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, choices: [], cursor: 0
        });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('skips "all unlocked" text when TextResources returns empty string', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, choices: [], cursor: 0
        });
        const spy = vi.spyOn(TextResources, 'get').mockReturnValue('');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        spy.mockRestore();
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws cards when choices are present', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true,
            choices: [{ id: 'skill1' }, { id: 'skill2' }],
            cursor: 0
        });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('falls back to empty choices when overlay.choices is not an array', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, choices: undefined, cursor: 0
        });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('uses accent fallback when getColor(13) returns empty for accentStrong', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, choices: [{ id: 'skill1' }], cursor: 0
        });
        (renderer.paletteManager.getColor as ReturnType<typeof vi.fn>).mockImplementation((i: number) =>
            i === 13 ? '' : '#colorX'
        );
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws pending label when getPendingLevelUpChoices > 0', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, choices: [{ id: 'skill1' }], cursor: 0
        });
        (renderer.gameState.getPendingLevelUpChoices as ReturnType<typeof vi.fn>).mockReturnValue(2);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.fillText).toHaveBeenCalled();
    });

    it('skips pending label when formatOverlayText returns empty', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, choices: [{ id: 'skill1' }], cursor: 0
        });
        (renderer.gameState.getPendingLevelUpChoices as ReturnType<typeof vi.fn>).mockReturnValue(1);
        const spy = vi.spyOn(TextResources, 'format').mockReturnValue('');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpOverlay(ctx, { width: 128, height: 128 });
        spy.mockRestore();
        expect(ctx.fillRect).toHaveBeenCalled();
    });
});

// ─── drawLevelUpOverlayFull ──────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawLevelUpOverlayFull', () => {
    it('delegates to drawLevelUpOverlay using canvas dimensions', () => {
        const { overlay, ctx } = makeOverlay();
        const spy = vi.spyOn(overlay, 'drawLevelUpOverlay');
        overlay.drawLevelUpOverlayFull(ctx);
        expect(spy).toHaveBeenCalledWith(ctx, { width: ctx.canvas.width, height: ctx.canvas.height });
    });
});

// ─── drawLevelUpCelebrationOverlay ───────────────────────────────────────────

describe('RendererOverlayRenderer – drawLevelUpCelebrationOverlay', () => {
    beforeEach(() => {
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('stops animation and returns when overlay is null', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.levelUpAnimationHandle = 5;
        overlay.drawLevelUpCelebrationOverlay(ctx, { width: 128, height: 128 });
        expect(overlay.levelUpAnimationHandle).toBe(0);
        expect(ctx.save).not.toHaveBeenCalled();
    });

    it('stops animation when overlay is inactive', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpCelebration as ReturnType<typeof vi.fn>).mockReturnValue({ active: false });
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.levelUpAnimationHandle = 5;
        overlay.drawLevelUpCelebrationOverlay(ctx, { width: 128, height: 128 });
        expect(overlay.levelUpAnimationHandle).toBe(0);
    });

    it('uses #F8E7A1 fallback when getColor(13) returns empty in celebration', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpCelebration as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, startTime: performance.now() - 100
        });
        (renderer.gameState.isLevelUpCelebrationActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (renderer.paletteManager.getColor as ReturnType<typeof vi.fn>).mockReturnValue('');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpCelebrationOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.save).toHaveBeenCalled();
    });

    it('draws celebration frame with finite startTime', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpCelebration as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, startTime: performance.now() - 100
        });
        (renderer.gameState.isLevelUpCelebrationActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpCelebrationOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalled();
    });

    it('draws celebration frame when startTime is non-finite (uses now)', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getLevelUpCelebration as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, startTime: undefined
        });
        (renderer.gameState.isLevelUpCelebrationActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawLevelUpCelebrationOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.save).toHaveBeenCalled();
    });
});

// ─── drawPickupOverlay ───────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawPickupOverlay', () => {
    beforeEach(() => {
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('stops animation and returns when overlay is null', () => {
        const { overlay, ctx } = makeOverlay();
        overlay.pickupAnimationHandle = 5;
        overlay.drawPickupOverlay(ctx, { width: 128, height: 128 });
        expect(overlay.pickupAnimationHandle).toBe(0);
        expect(ctx.save).not.toHaveBeenCalled();
    });

    it('draws frame without sprite when spriteGroup is missing', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getPickupOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, name: 'Potion', spriteGroup: undefined
        });
        (renderer.gameState.isPickupOverlayActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawPickupOverlay(ctx, { width: 128, height: 128 });
        expect(ctx.save).toHaveBeenCalled();
        expect(renderer.canvasHelper.drawSprite).not.toHaveBeenCalled();
    });

    it('draws frame with sprite when spriteGroup and spriteType match', () => {
        const { renderer, ctx } = makeRenderer();
        (renderer.gameState.getPickupOverlay as ReturnType<typeof vi.fn>).mockReturnValue({
            active: true, name: 'Key', spriteGroup: 'object', spriteType: 'key'
        });
        (renderer.gameState.isPickupOverlayActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawPickupOverlay(ctx, { width: 128, height: 128 });
        expect(renderer.canvasHelper.drawSprite).toHaveBeenCalled();
    });
});

// ─── drawGameOverScreen ──────────────────────────────────────────────────────

describe('RendererOverlayRenderer – drawGameOverScreen', () => {
    it('returns early when ctx is null', () => {
        const { renderer } = makeRenderer({ ctx: null });
        const overlay = new RendererOverlayRenderer(renderer as never);
        expect(() => overlay.drawGameOverScreen()).not.toThrow();
    });

    it('draws "Game Over" for defeat without reset option', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('defeat');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        expect(renderer.ctx.fillText).toHaveBeenCalledWith('Game Over', expect.any(Number), expect.any(Number));
    });

    it('draws "The End" for victory', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('victory');
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        expect(renderer.ctx.fillText).toHaveBeenCalledWith('The End', expect.any(Number), expect.any(Number));
    });

    it('draws retry prompt when canResetAfterGameOver is true', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('defeat');
        (renderer.gameState as Record<string, unknown>).canResetAfterGameOver = true;
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        // fillText called more than once (Game Over + retry prompt)
        expect((renderer.ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    });

    it('uses necromancer revive text when revive is ready', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('defeat');
        (renderer.gameState as Record<string, unknown>).canResetAfterGameOver = true;
        (renderer.gameState.hasNecromancerReviveReady as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        const texts = (renderer.ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
        expect(texts.some((t) => t.length > 0)).toBe(true);
    });

    it('draws victory ending text that wraps long lines', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('victory');
        // "aaaaaaaaaaaaa bbbbbbbbbbbbb" = two words, candidate = 26 chars = 156px > 108px → wraps
        (renderer.gameState.getActiveEndingText as ReturnType<typeof vi.fn>).mockReturnValue(
            'aaaaaaaaaaaaa bbbbbbbbbbbbb'
        );
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        expect(renderer.ctx.fillText).toHaveBeenCalled();
    });

    it('handles multi-section ending text split by newlines', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('victory');
        (renderer.gameState.getActiveEndingText as ReturnType<typeof vi.fn>).mockReturnValue(
            'First section\nSecond section'
        );
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        expect(renderer.ctx.fillText).toHaveBeenCalled();
    });

    it('handles ending text with only newlines (empty sections)', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('victory');
        (renderer.gameState.getActiveEndingText as ReturnType<typeof vi.fn>).mockReturnValue('\n\n\n');
        const overlay = new RendererOverlayRenderer(renderer as never);
        expect(() => overlay.drawGameOverScreen()).not.toThrow();
    });

    it('handles ending text with \\r\\n line endings', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('victory');
        (renderer.gameState.getActiveEndingText as ReturnType<typeof vi.fn>).mockReturnValue(
            'Line one\r\nLine two'
        );
        const overlay = new RendererOverlayRenderer(renderer as never);
        expect(() => overlay.drawGameOverScreen()).not.toThrow();
    });

    it('draws retry prompt for victory with canReset (retryVictory branch)', () => {
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('victory');
        (renderer.gameState as Record<string, unknown>).canResetAfterGameOver = true;
        (renderer.gameState.hasNecromancerReviveReady as ReturnType<typeof vi.fn>).mockReturnValue(false);
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        const texts = (renderer.ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
        expect(texts.length).toBeGreaterThan(1);
    });

    it('uses blinkMinOpacity when blink condition is true (Date.now phase > 1)', () => {
        // With interval=500: Date.now()=750 → (750/500)%2 = 1.5 > 1 → blinkMinOpacity
        vi.spyOn(Date, 'now').mockReturnValue(750);
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('defeat');
        (renderer.gameState as Record<string, unknown>).canResetAfterGameOver = true;
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        vi.restoreAllMocks();
        expect(renderer.ctx.fillText).toHaveBeenCalled();
    });

    it('uses blinkMaxOpacity when blink condition is false (Date.now phase <= 1)', () => {
        // With interval=500: Date.now()=0 → (0/500)%2 = 0 <= 1 → blinkMaxOpacity
        vi.spyOn(Date, 'now').mockReturnValue(0);
        const { renderer } = makeRenderer();
        (renderer.gameState.getGameOverReason as ReturnType<typeof vi.fn>).mockReturnValue('defeat');
        (renderer.gameState as Record<string, unknown>).canResetAfterGameOver = true;
        const overlay = new RendererOverlayRenderer(renderer as never);
        overlay.drawGameOverScreen();
        vi.restoreAllMocks();
        expect(renderer.ctx.fillText).toHaveBeenCalled();
    });

    it('uses padding as startY when canvas dimensions are non-finite', () => {
        const ctx = makeCtx();
        const fakeCanvas = { width: NaN, height: NaN } as unknown as HTMLCanvasElement;
        const renderer = {
            canvas: fakeCanvas,
            ctx,
            gameState: {
                getLevelUpOverlay: vi.fn(() => null),
                getPendingLevelUpChoices: vi.fn(() => 0),
                getLevelUpCelebration: vi.fn(() => null),
                isLevelUpCelebrationActive: vi.fn(() => false),
                getPickupOverlay: vi.fn(() => null),
                isPickupOverlayActive: vi.fn(() => false),
                getGameOverReason: vi.fn(() => 'victory'),
                getActiveEndingText: vi.fn(() => 'some ending text'),
                canResetAfterGameOver: false,
                hasNecromancerReviveReady: vi.fn(() => false),
            },
            tileManager: {},
            paletteManager: { getColor: vi.fn(() => '#fff') },
            spriteFactory: { getObjectSprites: vi.fn(() => ({})) },
            canvasHelper: { drawSprite: vi.fn() },
            entityRenderer: { cleanupEnemyLabels: vi.fn() },
            draw: vi.fn(),
            gameEngine: {},
        };
        const overlay = new RendererOverlayRenderer(renderer as never);
        expect(() => overlay.drawGameOverScreen()).not.toThrow();
    });
});
