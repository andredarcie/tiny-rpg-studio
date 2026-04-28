import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BitmapFont } from '../../runtime/adapters/renderer/BitmapFont';

function makeCtx(): CanvasRenderingContext2D {
    return {
        save: vi.fn(), restore: vi.fn(),
        fillText: vi.fn(), strokeText: vi.fn(),
        clearRect: vi.fn(), fillRect: vi.fn(),
        drawImage: vi.fn(), getImageData: vi.fn(),
        putImageData: vi.fn(),
        textAlign: 'left' as CanvasTextAlign,
        textBaseline: 'alphabetic' as CanvasTextBaseline,
        imageSmoothingEnabled: false,
        globalCompositeOperation: 'source-over',
        fillStyle: '#000',
    } as unknown as CanvasRenderingContext2D;
}

describe('BitmapFont', () => {
    let font: BitmapFont;

    beforeEach(() => {
        font = new BitmapFont();
    });

    // ─── isReady ────────────────────────────────────────────────────────────────

    describe('isReady', () => {
        it('returns false before load', () => {
            expect(font.isReady()).toBe(false);
        });
    });

    // ─── measureText ────────────────────────────────────────────────────────────

    describe('measureText', () => {
        it('returns 0 when font not loaded', () => {
            expect(font.measureText('hello', 8)).toBe(0);
        });

        it('returns 0 for empty string', () => {
            expect(font.measureText('', 8)).toBe(0);
        });

        it('returns 0 for null-ish input', () => {
            expect(font.measureText(null as unknown as string, 8)).toBe(0);
        });

        it('is consistent across charSize when not loaded', () => {
            expect(font.measureText('abc', 8)).toBe(font.measureText('abc', 16));
        });

        it('preserves case while stripping accents for glyph lookup', () => {
            Object.defineProperty(font, 'sheet', { value: document.createElement('canvas'), configurable: true });
            Object.defineProperty(font, 'glyphMetrics', {
                value: Array.from({ length: 256 }, () => ({ left: 0, width: 0, advance: 4 })),
                configurable: true
            });

            const glyphMetrics = (font as unknown as { glyphMetrics: Array<{ left: number; width: number; advance: number }> }).glyphMetrics;
            glyphMetrics['A'.charCodeAt(0)] = { left: 0, width: 5, advance: 6 };
            glyphMetrics['a'.charCodeAt(0)] = { left: 0, width: 3, advance: 4 };

            expect(font.measureText('Á', 8)).toBe(font.measureText('A', 8));
            expect(font.measureText('Á', 8)).not.toBe(font.measureText('a', 8));
        });
    });

    // ─── drawText ───────────────────────────────────────────────────────────────

    describe('drawText', () => {
        it('does nothing when font not loaded', () => {
            const ctx = makeCtx();
            expect(() => font.drawText(ctx, 'hello', 10, 20, 8)).not.toThrow();
            expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
        });

        it('does nothing for empty text even when loaded', () => {
            const ctx = makeCtx();
            expect(() => font.drawText(ctx, '', 0, 0, 8)).not.toThrow();
        });
    });

    // ─── truncateText ───────────────────────────────────────────────────────────

    describe('truncateText', () => {
        it('returns text unchanged when font not loaded (cannot measure)', () => {
            expect(font.truncateText('a very long title', 10, 8)).toBe('a very long title');
        });

        it('returns text unchanged for empty string', () => {
            expect(font.truncateText('', 100, 8)).toBe('');
        });

        it('truncates and appends ellipsis when text exceeds maxWidth', () => {
            vi.spyOn(font, 'measureText').mockImplementation((text) => text.length * 6);
            vi.spyOn(font, 'isReady').mockReturnValue(true);
            Object.defineProperty(font, 'sheet', { get: () => document.createElement('canvas') });

            const result = font.truncateText('hello world', 30, 8);
            expect(result.endsWith('...')).toBe(true);
            expect(result.length).toBeLessThan('hello world'.length + 1);
        });

        it('returns full text unchanged when within maxWidth', () => {
            vi.spyOn(font, 'measureText').mockReturnValue(40);
            vi.spyOn(font, 'isReady').mockReturnValue(true);
            Object.defineProperty(font, 'sheet', { get: () => document.createElement('canvas') });

            expect(font.truncateText('short', 100, 8)).toBe('short');
        });
    });

    // ─── load ───────────────────────────────────────────────────────────────────

    describe('load', () => {
        let lastImg: { onload: (() => void) | null; onerror: (() => void) | null; src: string };
        let imageCtorSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            imageCtorSpy = vi.fn();
            class MockImg {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                src = '';
                constructor() { lastImg = this as unknown as typeof lastImg; imageCtorSpy(); }
            }
            vi.stubGlobal('Image', MockImg);
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('calls onReady immediately if font is already loaded', () => {
            const first = vi.fn();
            font.load('/font.png', first);
            lastImg.onload?.();

            const second = vi.fn();
            font.load('/font.png', second);

            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
        });

        it('queues multiple callbacks and fires all on load', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            font.load('/font.png', cb1);
            font.load('/font.png', cb2);
            lastImg.onload?.();

            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledTimes(1);
        });

        it('logs error and clears callbacks when image fails to load', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const cb = vi.fn();

            font.load('/font.png', cb);
            lastImg.onerror?.();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/font.png'));
            expect(cb).not.toHaveBeenCalled();
            expect(font.isReady()).toBe(false);

            consoleSpy.mockRestore();
        });

        it('does not start a second Image while already loading', () => {
            font.load('/font.png');
            font.load('/font.png');
            expect(imageCtorSpy).toHaveBeenCalledTimes(1);
        });
    });
});
