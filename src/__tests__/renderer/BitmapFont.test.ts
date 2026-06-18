import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BitmapFont } from '../../runtime/adapters/renderer/BitmapFont';

// The new BitmapFont renders the Pixel Operator font via the Canvas 2D text
// API. The global test setup mocks HTMLCanvasElement.getContext, so measureText
// here resolves to `text.length * 6` and fillText/drawImage are spies.

function makeCtx(): CanvasRenderingContext2D {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        measureText: vi.fn((t: string) => ({ width: t.length * 6 })),
        textAlign: 'left' as CanvasTextAlign,
        textBaseline: 'top' as CanvasTextBaseline,
        imageSmoothingEnabled: false,
        font: '',
        fillStyle: '#000',
    } as unknown as CanvasRenderingContext2D;
}

/** Drives load() to completion regardless of sync/async font loading. */
function loadReady(font: BitmapFont): Promise<void> {
    return new Promise((resolve) => font.load(() => resolve()));
}

describe('BitmapFont (Pixel Operator)', () => {
    let font: BitmapFont;
    let originalFonts: unknown;

    beforeEach(() => {
        font = new BitmapFont();
        originalFonts = (document as unknown as { fonts?: unknown }).fonts;
        Object.defineProperty(document, 'fonts', {
            value: { load: vi.fn(() => Promise.resolve([])) },
            configurable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(document, 'fonts', { value: originalFonts, configurable: true });
    });

    // ─── isReady / load ───────────────────────────────────────────────────────

    describe('isReady / load', () => {
        it('returns false before load', () => {
            expect(font.isReady()).toBe(false);
        });

        it('becomes ready and fires the callback after load', async () => {
            await loadReady(font);
            expect(font.isReady()).toBe(true);
        });

        it('fires immediately when already loaded', async () => {
            await loadReady(font);
            const cb = vi.fn();
            font.load(cb);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('queues multiple callbacks and fires all once loaded', async () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            font.load(cb1);
            font.load(cb2);
            await Promise.resolve();
            await Promise.resolve();
            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledTimes(1);
        });

        it('reports ready when the pixel font is disabled', () => {
            font.setDisabled(true);
            expect(font.isReady()).toBe(true);
        });
    });

    // ─── snapSize (crisp guarantee) ─────────────────────────────────────────────
    // This font only renders crisply at its native size and whole multiples
    // (8, 16, 24…). Every size must be snapped onto that grid so canvas text can
    // never be drawn blurry/doubled again.

    describe('snapSize', () => {
        it('snaps every size onto the crisp grid (multiple of 8, never below 8)', () => {
            for (let s = 1; s <= 64; s += 1) {
                const snapped = font.snapSize(s);
                expect(snapped % 8).toBe(0);
                expect(snapped).toBeGreaterThanOrEqual(8);
            }
        });

        it('keeps the engine sizes unchanged', () => {
            expect(font.snapSize(8)).toBe(8); // body / dialog / prompt
            expect(font.snapSize(16)).toBe(16); // title
        });

        it('rounds in-between sizes to the nearest crisp size', () => {
            expect(font.snapSize(6)).toBe(8);
            expect(font.snapSize(7)).toBe(8);
            expect(font.snapSize(10)).toBe(8);
            expect(font.snapSize(12)).toBe(16);
        });

        it('drawText rasterizes a non-native size at a snapped crisp size', async () => {
            await loadReady(font);
            let renderedFont = '';
            const recording = {
                clearRect: vi.fn(),
                fillRect: vi.fn(),
                fillText: vi.fn(),
                measureText: (t: string) => ({ width: t.length * 6 }),
                getImageData: () => ({ data: new Uint8ClampedArray(8), width: 1, height: 1 }),
                putImageData: vi.fn(),
                set font(v: string) { renderedFont = v; },
                get font() { return renderedFont; },
                set textAlign(_v: CanvasTextAlign) {},
                set textBaseline(_v: CanvasTextBaseline) {},
                set fillStyle(_v: string) {},
                set globalCompositeOperation(_v: string) {},
                set imageSmoothingEnabled(_v: boolean) {},
            } as unknown as CanvasRenderingContext2D;
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.getContext = vi.fn(() => recording) as unknown as HTMLCanvasElement['getContext'];
            Object.defineProperty(font, 'tmp', { value: tmpCanvas, writable: true, configurable: true });

            font.drawText(makeCtx(), 'Hi', 0, 0, 6); // request a distorted 6px size
            expect(renderedFont).toBe('8px "PixelOperator"'); // snapped up to crisp 8px
        });
    });

    // ─── measureText ──────────────────────────────────────────────────────────

    describe('measureText', () => {
        it('returns 0 when not loaded', () => {
            expect(font.measureText('hello', 8)).toBe(0);
        });

        it('returns 0 for empty / null-ish input', async () => {
            await loadReady(font);
            expect(font.measureText('', 8)).toBe(0);
            expect(font.measureText(null as unknown as string, 8)).toBe(0);
        });

        it('scales with the character size once loaded', async () => {
            await loadReady(font);
            expect(font.measureText('abc', 16)).toBe(font.measureText('abc', 8) * 2);
        });

        it('counts accented characters (does not strip them)', async () => {
            await loadReady(font);
            // Three accented glyphs must measure as three characters wide.
            expect(font.measureText('ÁÉÍ', 8)).toBe(font.measureText('xyz', 8));
        });

        it('uses a monospace estimate when disabled', () => {
            font.setDisabled(true);
            expect(font.measureText('abcd', 8)).toBeGreaterThan(0);
        });
    });

    // ─── drawText ─────────────────────────────────────────────────────────────

    describe('drawText', () => {
        it('does nothing when not loaded', () => {
            const ctx = makeCtx();
            expect(() => font.drawText(ctx, 'hello', 10, 20, 8)).not.toThrow();
            expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
        });

        it('does nothing for empty text', async () => {
            await loadReady(font);
            const ctx = makeCtx();
            font.drawText(ctx, '', 0, 0, 8);
            expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
        });

        it('blits rendered text to the target context when loaded', async () => {
            await loadReady(font);
            const ctx = makeCtx();
            font.drawText(ctx, 'Olá, Mundo!', 4, 4, 8, '#fff');
            expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
        });

        it('draws directly with fillText when the pixel font is disabled', () => {
            font.setDisabled(true);
            const ctx = makeCtx();
            font.drawText(ctx, 'plain', 0, 0, 8);
            expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
            expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
        });
    });

    // ─── truncateText ─────────────────────────────────────────────────────────

    describe('truncateText', () => {
        it('returns text unchanged when not ready', () => {
            expect(font.truncateText('a very long title', 10, 8)).toBe('a very long title');
        });

        it('appends an ellipsis when text exceeds maxWidth', async () => {
            await loadReady(font);
            vi.spyOn(font, 'measureText').mockImplementation((text) => String(text).length * 6);
            const result = font.truncateText('hello world', 30, 8);
            expect(result.endsWith('...')).toBe(true);
            expect(result.length).toBeLessThan('hello world'.length + 1);
        });

        it('returns the full text when within maxWidth', async () => {
            await loadReady(font);
            vi.spyOn(font, 'measureText').mockReturnValue(40);
            expect(font.truncateText('short', 100, 8)).toBe('short');
        });
    });
});
