import { LINE_HEIGHT, FONT_SIZE, FONT_NAME } from '../../../config/FontConfig';

/**
 * Canvas text renderer for the engine's pixel font (Pixel Operator Mono HB 8).
 *
 * Text is drawn with the Canvas 2D text API at the font's native pixel size
 * (FONT_SIZE) onto a reusable offscreen canvas, then blitted to the target
 * with nearest-neighbor scaling (imageSmoothingEnabled = false) so it keeps
 * hard pixel edges at any size — matching the rest of the pixel-art canvas.
 *
 * The public surface (load / isReady / setDisabled / measureText /
 * getCharAdvance / truncateText / drawText) is unchanged from the previous
 * bitmap-spritesheet implementation, so callers don't need to change.
 */

type DocumentWithFonts = Document & {
    fonts?: { load: (font: string, text?: string) => Promise<unknown> };
};

const fontSpec = (px: number): string => `${px}px "${FONT_NAME}"`;

type GlyphCacheEntry = {
    canvas: HTMLCanvasElement;
    w: number;
    h: number;
    logicalH: number;
};

export class BitmapFont {
    private ready = false;
    private loading = false;
    private readyCallbacks = new Set<() => void>();
    private _disabled = false;
    private measureCtx: CanvasRenderingContext2D | null = null;
    private tmp: HTMLCanvasElement | null = null;
    // Cache of fully-rasterized + tinted text bitmaps keyed by text|size|color.
    // The expensive part of drawText (fillText, getImageData binarization and the
    // source-in tint) is a pure function of those three inputs, so it only needs
    // to run once per unique string instead of every frame. HUD labels, the "!"
    // alert icon and player names are the same string for thousands of frames.
    private glyphCache = new Map<string, GlyphCacheEntry>();
    private static readonly GLYPH_CACHE_LIMIT = 320;

    setDisabled(disabled: boolean): void {
        this._disabled = disabled;
    }

    /**
     * Ensures the font face is loaded so canvas text renders correctly.
     * Idempotent: fires immediately if already loaded, queues the callback if a
     * load is in flight, otherwise starts the load. The @font-face itself is
     * injected by applyFontConfig (and inlined in index.html).
     */
    load(onReady?: () => void): void {
        if (this.ready) {
            onReady?.();
            return;
        }
        if (onReady) {
            this.readyCallbacks.add(onReady);
        }
        if (this.loading) return;
        this.loading = true;

        const finish = (): void => {
            this.ready = true;
            this.loading = false;
            const callbacks = Array.from(this.readyCallbacks);
            this.readyCallbacks.clear();
            callbacks.forEach((callback) => callback());
        };

        const fonts =
            typeof document !== 'undefined' ? (document as DocumentWithFonts).fonts : undefined;
        if (fonts && typeof fonts.load === 'function') {
            fonts.load(fontSpec(FONT_SIZE)).then(() => finish()).catch(() => finish());
        } else {
            finish();
        }
    }

    isReady(): boolean {
        return this._disabled || this.ready;
    }

    private getMeasureCtx(): CanvasRenderingContext2D | null {
        if (this.measureCtx) return this.measureCtx;
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        this.measureCtx = ctx;
        return ctx;
    }

    /**
     * Snaps a requested size to the nearest whole multiple of the native size
     * (never below it). The pixel font is only crisp at its native size and
     * integer multiples (8, 16, 24…); any in-between size renders distorted, so
     * every measurement and render is forced onto the crisp grid here. This is
     * the single guarantee that canvas text can never be drawn blurry/doubled.
     */
    snapSize(charSize: number): number {
        const multiple = Math.max(1, Math.round(charSize / FONT_SIZE));
        return multiple * FONT_SIZE;
    }

    /** Width (in target px) of the longest line at the given character size. */
    measureText(text: string, charSize: number): number {
        const value = String(text || '');
        if (this._disabled) {
            const lines = value.split('\n');
            return lines.reduce((max, line) => Math.max(max, line.length * charSize * 0.6), 0);
        }
        if (!this.ready || value === '') return 0;
        const ctx = this.getMeasureCtx();
        if (!ctx) return 0;
        ctx.font = fontSpec(FONT_SIZE);
        const scale = this.snapSize(charSize) / FONT_SIZE;
        const lines = value.split('\n');
        const nativeWidth = lines.reduce(
            (max, line) => Math.max(max, ctx.measureText(line).width),
            0,
        );
        return nativeWidth * scale;
    }

    /** Advance width (in target px) of a single character. */
    getCharAdvance(charCode: number, charSize: number): number {
        if (this._disabled) return charSize * 0.6;
        if (!this.ready) return 0;
        const ctx = this.getMeasureCtx();
        if (!ctx) return 0;
        ctx.font = fontSpec(FONT_SIZE);
        const char = String.fromCodePoint(charCode);
        return ctx.measureText(char).width * (this.snapSize(charSize) / FONT_SIZE);
    }

    truncateText(text: string, maxWidth: number, charSize: number): string {
        if (!this.isReady() || this.measureText(text, charSize) <= maxWidth) return text;
        const ellipsis = '...';
        let truncated = text;
        while (truncated.length > 0 && this.measureText(truncated + ellipsis, charSize) > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + ellipsis;
    }

    drawText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        charSize: number,
        color = '#ffffff',
    ): void {
        if (!text) return;

        if (this._disabled) {
            ctx.save();
            ctx.font = `${charSize}px monospace`;
            ctx.fillStyle = color;
            ctx.textBaseline = 'top';
            const lines = String(text).split('\n');
            const lineH = Math.round(charSize * (LINE_HEIGHT / FONT_SIZE));
            lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineH));
            ctx.restore();
            return;
        }
        if (!this.ready) return;

        const measure = this.getMeasureCtx();
        if (!measure) return;

        const size = this.snapSize(Math.round(charSize));
        const cacheKey = `${text}|${size}|${color}`;
        let entry = this.glyphCache.get(cacheKey);
        if (!entry) {
            const built = this.rasterize(String(text), size, color, measure);
            if (!built) return;
            if (this.glyphCache.size >= BitmapFont.GLYPH_CACHE_LIMIT) {
                const oldest = this.glyphCache.keys().next().value;
                if (oldest !== undefined) this.glyphCache.delete(oldest);
            }
            this.glyphCache.set(cacheKey, built);
            entry = built;
        }

        const { canvas, w, h, logicalH } = entry;

        let dx = x;
        if (ctx.textAlign === 'center') dx -= w / 2;
        else if (ctx.textAlign === 'right') dx -= w;

        let dy = y;
        if (ctx.textBaseline === 'middle') dy -= logicalH / 2;
        else if (ctx.textBaseline === 'bottom' || ctx.textBaseline === 'alphabetic') dy -= logicalH;

        dx = Math.round(dx);
        dy = Math.round(dy);

        // 1:1 blit of the cached bitmap — no scaling, so nothing reintroduces
        // blur or doubling.
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, w, h, dx, dy, w, h);
        ctx.restore();
    }

    /**
     * Rasterizes text once into an immutable bitmap: render at the (snapped)
     * crisp size, snap the alpha on/off to kill anti-aliasing, then tint. This
     * is a pure function of (text, size, color), so the result is cached and
     * reused every frame for repeated labels (HUD, names, the "!" alert).
     */
    private rasterize(
        text: string,
        size: number,
        color: string,
        measure: CanvasRenderingContext2D,
    ): GlyphCacheEntry | null {
        const lines = text.split('\n');
        measure.font = fontSpec(size);
        const w = Math.max(
            1,
            Math.ceil(lines.reduce((max, line) => Math.max(max, measure.measureText(line).width), 0)),
        );
        const lineHeight = Math.max(1, Math.round((LINE_HEIGHT / FONT_SIZE) * size));
        const logicalH = (lines.length - 1) * lineHeight + size;
        // Headroom for descenders (g, y, p, q).
        const h = Math.max(1, logicalH + Math.ceil(size / 4) + 1);

        if (!this.tmp) this.tmp = document.createElement('canvas');
        if (this.tmp.width < w) this.tmp.width = Math.max(w, 256);
        if (this.tmp.height < h) this.tmp.height = h;

        const tctx = this.tmp.getContext('2d');
        if (!tctx) return null;
        tctx.clearRect(0, 0, this.tmp.width, this.tmp.height);
        tctx.imageSmoothingEnabled = false;
        tctx.font = fontSpec(size);
        tctx.textAlign = 'left';
        tctx.textBaseline = 'top';
        tctx.fillStyle = '#ffffff';
        lines.forEach((line, i) => tctx.fillText(line, 0, i * lineHeight));

        const pixels = tctx.getImageData(0, 0, w, h);
        const data = pixels.data;
        for (let i = 3; i < data.length; i += 4) {
            data[i] = data[i] >= 128 ? 255 : 0;
        }
        tctx.putImageData(pixels, 0, 0);

        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = color;
        tctx.fillRect(0, 0, w, h);
        tctx.globalCompositeOperation = 'source-over';

        // Copy into a dedicated, immutable canvas for the cache (the scratch
        // `tmp` canvas is reused for the next string).
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const cctx = canvas.getContext('2d');
        if (!cctx) return null;
        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(this.tmp, 0, 0, w, h, 0, 0, w, h);
        return { canvas, w, h, logicalH };
    }
}

export const bitmapFont = new BitmapFont();
