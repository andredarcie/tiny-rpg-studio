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
                value: Array.from({ length: 256 }, () => ({ left: 0, width: 0, advance: 4, top: 0, height: 5 })),
                configurable: true
            });

            const glyphMetrics = (font as unknown as { glyphMetrics: Array<{ left: number; width: number; advance: number; top: number; height: number }> }).glyphMetrics;
            glyphMetrics['A'.charCodeAt(0)] = { left: 0, width: 5, advance: 6, top: 0, height: 5 };
            glyphMetrics['a'.charCodeAt(0)] = { left: 0, width: 3, advance: 4, top: 0, height: 5 };

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

        it('normalizes short uppercase glyphs to the standard visible height', () => {
            const tmpDrawImage = vi.fn();
            const tmpCtx = {
                clearRect: vi.fn(),
                drawImage: tmpDrawImage,
                fillRect: vi.fn(),
                imageSmoothingEnabled: false,
                globalCompositeOperation: 'source-over',
                fillStyle: '#000000'
            } as unknown as CanvasRenderingContext2D;
            const targetCtx = makeCtx();
            const sheetCanvas = document.createElement('canvas');
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.getContext = vi.fn(() => tmpCtx) as unknown as HTMLCanvasElement['getContext'];

            Object.defineProperty(font, 'sheet', { value: sheetCanvas, configurable: true });
            Object.defineProperty(font, 'tmp', { value: tmpCanvas, configurable: true, writable: true });
            Object.defineProperty(font, 'glyphMetrics', {
                value: Array.from({ length: 256 }, () => ({ left: 0, width: 0, advance: 4, top: 0, height: 5 })),
                configurable: true
            });

            const glyphMetrics = (font as unknown as { glyphMetrics: Array<{ left: number; width: number; advance: number; top: number; height: number }> }).glyphMetrics;
            glyphMetrics['E'.charCodeAt(0)] = { left: 0, width: 3, advance: 4, top: 1, height: 4 };

            font.drawText(targetCtx, 'E', 0, 0, 8);

            expect(tmpDrawImage).toHaveBeenCalledWith(
                sheetCanvas,
                40, 33, 3, 4,
                0, 0, 3, 5
            );
        });

        it('preserves baseline-relative vertical placement for punctuation', () => {
            const tmpDrawImage = vi.fn();
            const tmpCtx = {
                clearRect: vi.fn(),
                drawImage: tmpDrawImage,
                fillRect: vi.fn(),
                imageSmoothingEnabled: false,
                globalCompositeOperation: 'source-over',
                fillStyle: '#000000'
            } as unknown as CanvasRenderingContext2D;
            const targetCtx = makeCtx();
            const sheetCanvas = document.createElement('canvas');
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.getContext = vi.fn(() => tmpCtx) as unknown as HTMLCanvasElement['getContext'];

            Object.defineProperty(font, 'sheet', { value: sheetCanvas, configurable: true });
            Object.defineProperty(font, 'tmp', { value: tmpCanvas, configurable: true, writable: true });
            Object.defineProperty(font, 'glyphMetrics', {
                value: Array.from({ length: 256 }, () => ({ left: 0, width: 0, advance: 4, top: 0, height: 5 })),
                configurable: true
            });

            const glyphMetrics = (font as unknown as { glyphMetrics: Array<{ left: number; width: number; advance: number; top: number; height: number }> }).glyphMetrics;
            glyphMetrics['.'.charCodeAt(0)] = { left: 1, width: 1, advance: 2, top: 4, height: 1 };

            font.drawText(targetCtx, '.', 0, 0, 8);

            expect(tmpDrawImage).toHaveBeenCalledWith(
                sheetCanvas,
                113, 20, 1, 1,
                0, 4, 1, 1
            );
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
        let imageCtorSpy: ReturnType<typeof vi.fn<() => void>>;

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

        it('preserves bright source pixels that are off the nearest-neighbor sample point', () => {
            const sourcePixels = new Uint8ClampedArray(512 * 512 * 4);
            const sourceIndex = ((3 * 512) + 3) * 4;
            sourcePixels[sourceIndex] = 255;
            sourcePixels[sourceIndex + 1] = 255;
            sourcePixels[sourceIndex + 2] = 255;
            sourcePixels[sourceIndex + 3] = 255;

            let normalizedImage: ImageData | null = null;
            const dstCtx = {
                createImageData: vi.fn((width: number, height: number) => ({
                    data: new Uint8ClampedArray(width * height * 4),
                    width,
                    height
                })),
                putImageData: vi.fn((imageData: ImageData) => {
                    normalizedImage = imageData;
                })
            } as unknown as CanvasRenderingContext2D;
            const srcCtx = {
                drawImage: vi.fn(),
                getImageData: vi.fn(() => ({
                    data: sourcePixels,
                    width: 512,
                    height: 512
                }))
            } as unknown as CanvasRenderingContext2D;

            let contextCall = 0;
            const getContextSpy = vi
                .spyOn(HTMLCanvasElement.prototype, 'getContext')
                .mockImplementation(() => ((contextCall += 1) === 1 ? dstCtx : srcCtx));

            font.load('/font.png');
            lastImg.onload?.();

            const output = normalizedImage as unknown as ImageData;
            expect(getContextSpy).toHaveBeenCalled();
            expect(output).not.toBeNull();
            expect(output.data[3]).toBe(255);
        });
    });
});
