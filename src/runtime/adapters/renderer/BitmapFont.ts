import { LETTER_SPACING, SPACE_ADVANCE, LINE_HEIGHT, FONT_SIZE } from '../../../config/FontConfig';

const SOURCE_SHEET_SIZE = 512;
const SOURCE_CHAR_PX = 32;
const CHAR_PX = 8;
const CHARS_PER_ROW = SOURCE_SHEET_SIZE / SOURCE_CHAR_PX;
const NORMALIZED_SHEET_SIZE = CHARS_PER_ROW * CHAR_PX;

type GlyphMetric = {
    left: number;
    width: number;
    advance: number;
};

export class BitmapFont {
    private sheet: HTMLCanvasElement | null = null;
    private glyphMetrics: GlyphMetric[] = [];
    private loading = false;
    private tmp: HTMLCanvasElement | null = null;
    private readyCallbacks = new Set<() => void>();
    private _disabled = false;

    setDisabled(disabled: boolean): void {
        this._disabled = disabled;
    }

    load(src: string, onReady?: () => void): void {
        if (this.sheet) {
            onReady?.();
            return;
        }
        if (onReady) {
            this.readyCallbacks.add(onReady);
        }
        if (this.loading || typeof Image === 'undefined' || typeof document === 'undefined') return;
        this.loading = true;
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = NORMALIZED_SHEET_SIZE;
            c.height = NORMALIZED_SHEET_SIZE;
            const ctx = c.getContext('2d');
            if (!ctx) {
                this.loading = false;
                this.readyCallbacks.clear();
                console.error('[BitmapFont] Unable to create 2D context for font sheet.');
                return;
            }
            ctx.imageSmoothingEnabled = false;
            for (let index = 0; index < CHARS_PER_ROW * CHARS_PER_ROW; index += 1) {
                const col = index % CHARS_PER_ROW;
                const row = Math.floor(index / CHARS_PER_ROW);
                ctx.drawImage(
                    img,
                    col * SOURCE_CHAR_PX, row * SOURCE_CHAR_PX, SOURCE_CHAR_PX, SOURCE_CHAR_PX,
                    col * CHAR_PX, row * CHAR_PX, CHAR_PX, CHAR_PX
                );
            }
            // Make black background transparent
            const imageData = ctx.getImageData(0, 0, NORMALIZED_SHEET_SIZE, NORMALIZED_SHEET_SIZE);
            const px = imageData.data;
            for (let i = 0; i < px.length; i += 4) {
                if (px[i] < 64 && px[i + 1] < 64 && px[i + 2] < 64) px[i + 3] = 0;
            }
            ctx.putImageData(imageData, 0, 0);
            this.glyphMetrics = this.buildGlyphMetrics(imageData);
            this.sheet = c;
            this.loading = false;
            const callbacks = Array.from(this.readyCallbacks);
            this.readyCallbacks.clear();
            callbacks.forEach((callback) => callback());
        };
        img.onerror = () => {
            this.loading = false;
            this.readyCallbacks.clear();
            console.error(`[BitmapFont] Failed to load font sheet: ${src}`);
        };
        img.src = src;
    }

    isReady(): boolean {
        return this._disabled || this.sheet !== null;
    }

    private buildGlyphMetrics(imageData: ImageData): GlyphMetric[] {
        const metrics: GlyphMetric[] = [];
        const px = imageData.data;
        for (let index = 0; index < CHARS_PER_ROW * CHARS_PER_ROW; index += 1) {
            const col = index % CHARS_PER_ROW;
            const row = Math.floor(index / CHARS_PER_ROW);
            let left = CHAR_PX;
            let right = -1;
            for (let y = 0; y < CHAR_PX; y += 1) {
                for (let x = 0; x < CHAR_PX; x += 1) {
                    const pxIndex = (((row * CHAR_PX) + y) * NORMALIZED_SHEET_SIZE + (col * CHAR_PX) + x) * 4;
                    if (px[pxIndex + 3] > 0) {
                        left = Math.min(left, x);
                        right = Math.max(right, x);
                    }
                }
            }
            const width = right >= left ? right - left + 1 : 0;
            metrics[index] = {
                left: width > 0 ? left : 0,
                width,
                advance: width > 0 ? Math.min(CHAR_PX, width + LETTER_SPACING) : SPACE_ADVANCE
            };
        }
        return metrics;
    }

    private getGlyphMetric(charCode: number): GlyphMetric {
        return this.glyphMetrics[charCode] || { left: 0, width: 0, advance: SPACE_ADVANCE };
    }

    getCharAdvance(charCode: number, charSize: number): number {
        const scale = charSize / CHAR_PX;
        return this.getGlyphMetric(charCode).advance * scale;
    }

    truncateText(text: string, maxWidth: number, charSize: number): string {
        if (!this.sheet || this.measureText(text, charSize) <= maxWidth) return text;
        const ellipsis = '...';
        let truncated = text;
        while (truncated.length > 0 && this.measureText(truncated + ellipsis, charSize) > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + ellipsis;
    }

    private static normalize(text: string): string {
        return String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .normalize('NFC');
    }

    measureText(text: string, charSize: number): number {
        if (this._disabled) {
            const lines = BitmapFont.normalize(text).split('\n');
            return lines.reduce((max, line) => Math.max(max, line.length * charSize * 0.6), 0);
        }
        const lines = BitmapFont.normalize(text).split('\n');
        return lines.reduce((maxWidth, line) => {
            let cursorX = 0;
            let renderedWidth = 0;
            Array.from(line).forEach((char) => {
                const code = char.codePointAt(0) ?? 0;
                const metric = this.getGlyphMetric(code);
                if (metric.width > 0) {
                    const scale = charSize / CHAR_PX;
                    renderedWidth = Math.max(renderedWidth, cursorX + Math.ceil(metric.width * scale));
                }
                cursorX += this.getCharAdvance(code, charSize);
            });
            return Math.max(maxWidth, renderedWidth);
        }, 0);
    }

    drawText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        charSize: number,
        color = '#ffffff'
    ): void {
        if (!text) return;
        if (this._disabled) {
            ctx.save();
            ctx.font = `${charSize}px monospace`;
            ctx.fillStyle = color;
            ctx.textAlign = ctx.textAlign;
            ctx.textBaseline = 'top';
            const lines = BitmapFont.normalize(text).split('\n');
            const lineH = Math.round(charSize * (LINE_HEIGHT / FONT_SIZE));
            lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineH));
            ctx.restore();
            return;
        }
        if (!this.sheet) return;

        const scale = charSize / CHAR_PX;
        const lineHeight = Math.max(1, Math.round((LINE_HEIGHT / FONT_SIZE) * charSize));
        const lines = BitmapFont.normalize(text).split('\n');
        const w = Math.max(1, Math.ceil(this.measureText(text, charSize)));
        const h = Math.max(1, Math.ceil((lines.length - 1) * lineHeight + charSize));

        // Apply ctx.textAlign
        let dx = x;
        const align = ctx.textAlign;
        if (align === 'center') dx -= w / 2;
        else if (align === 'right') dx -= w;

        // Apply ctx.textBaseline
        let dy = y;
        const baseline = ctx.textBaseline;
        if (baseline === 'middle') dy -= h / 2;
        else if (baseline === 'bottom' || baseline === 'alphabetic') dy -= h;

        dx = Math.round(dx);
        dy = Math.round(dy);

        // Reuse temp canvas (grow if needed, never shrink)
        if (!this.tmp) this.tmp = document.createElement('canvas');
        if (this.tmp.width < w) this.tmp.width = Math.max(w, 256);
        if (this.tmp.height < h) this.tmp.height = h;

        const tctx = this.tmp.getContext('2d');
        if (!tctx) return;
        tctx.clearRect(0, 0, w, h);
        tctx.imageSmoothingEnabled = false;
        tctx.globalCompositeOperation = 'source-over';

        let cursorY = 0;
        for (const line of lines) {
            let cursorX = 0;
            for (const char of Array.from(line)) {
                const cc = char.codePointAt(0) ?? 0;
                const glyphAdvance = this.getCharAdvance(cc, charSize);
                const metric = this.getGlyphMetric(cc);
                if (cc >= 0 && cc < CHARS_PER_ROW * CHARS_PER_ROW) {
                    const col = cc % CHARS_PER_ROW;
                    const row = Math.floor(cc / CHARS_PER_ROW);
                    if (metric.width > 0) {
                        const glyphWidth = Math.ceil(metric.width * scale);
                        tctx.drawImage(
                            this.sheet,
                            col * CHAR_PX + metric.left, row * CHAR_PX, metric.width, CHAR_PX,
                            Math.round(cursorX), cursorY, glyphWidth, charSize
                        );
                    }
                }
                cursorX += glyphAdvance;
            }
            cursorY += lineHeight;
        }

        // Tint the white chars to the desired color
        tctx.globalCompositeOperation = 'source-atop';
        tctx.fillStyle = color;
        tctx.fillRect(0, 0, w, h);
        tctx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.tmp, 0, 0, w, h, dx, dy, w, h);
        ctx.restore();
    }
}

export const bitmapFont = new BitmapFont();
