import { FONT_SIZE, LINE_HEIGHT } from '../../../config/FontConfig';
import { bitmapFont } from './BitmapFont';
import { soundEngine } from '../../services/SoundEngine';

/**
 * Dialog body text size. Kept at the native size: this pixel font is only crisp
 * at its native size and whole multiples (8, 16…); smaller sizes render
 * distorted, so the dialog stays at FONT_SIZE.
 */
const DIALOG_FONT_SIZE = FONT_SIZE;
/** Milliseconds per revealed character — a visible but brisk typewriter. */
const TYPEWRITER_CHAR_MS = 55;

type DialogState = {
    active: boolean;
    text?: string;
    page?: number;
    maxPages?: number;
};

type DialogGameState = {
    getDialog: () => DialogState;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

class RendererDialogRenderer {
    gameState: DialogGameState;
    paletteManager: PaletteManagerApi;
    /** Set when running inside the live engine — enables the animated typewriter. */
    private requestRedraw: (() => void) | null;

    private revealKey = '';
    private revealStart = 0;
    private soundedChars = 0;
    private skip = false;
    private rafHandle = 0;
    private revealedCount = 0;
    private totalChars = 0;

    constructor(
        gameState: DialogGameState,
        paletteManager: PaletteManagerApi,
        requestRedraw: (() => void) | null = null,
    ) {
        this.gameState = gameState;
        this.paletteManager = paletteManager;
        this.requestRedraw = requestRedraw;
    }

    /** Whether the current page has finished its typewriter reveal. */
    isRevealComplete(): boolean {
        return this.revealedCount >= this.totalChars;
    }

    /** Instantly reveal the full current page (player skipped the typewriter). */
    skipReveal(): void {
        this.skip = true;
        this.requestRedraw?.();
    }

    drawDialog(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }) {
        const dialog = this.gameState.getDialog();
        if (!dialog.active || !dialog.text) {
            // Clear the reveal key so reopening a dialog with identical text on
            // the same page replays the typewriter (instead of the stale key
            // making `revealStart` ancient and snapping straight to fully shown).
            this.revealKey = '';
            this.stopRevealLoop();
            return;
        }
        if (!dialog.page || dialog.page < 1) {
            dialog.page = 1;
        }
        this.drawDialogBox(ctx, canvas, dialog);
    }

    drawDialogBox(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }, dialog: DialogState) {
        const pad = 4;
        const w = canvas.width - pad * 2;
        const h = 50;
        const x = pad;
        const y = canvas.height - h - pad;

        const accent = this.paletteManager.getColor(7) || '#FFF1E8';
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = this.paletteManager.getColor(1) || '#1D2B53';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        const lineHeight = Math.max(1, Math.round((LINE_HEIGHT / FONT_SIZE) * DIALOG_FONT_SIZE));
        const maxWidth = w - 12;
        const pages = this.calculateDialogPages(dialog, maxWidth, h - 8, lineHeight);
        const totalPages = Math.max(1, pages.length);
        if (dialog.maxPages !== totalPages) {
            dialog.maxPages = totalPages;
        }
        const currentIndex = Math.min(Math.max((dialog.page ?? 1) - 1, 0), totalPages - 1);
        if (dialog.page !== currentIndex + 1) {
            dialog.page = currentIndex + 1;
        }
        const lines = pages[currentIndex] || [];

        // ─── Typewriter reveal ────────────────────────────────────────────────
        const total = lines.reduce((sum, line) => sum + line.length, 0);
        this.totalChars = total;
        const typewriter = this.requestRedraw !== null;
        const key = `${dialog.text}#${dialog.page}`;
        if (key !== this.revealKey) {
            this.revealKey = key;
            this.revealStart = this.now();
            this.soundedChars = 0;
            this.skip = false;
        }
        let revealed = total;
        if (typewriter && !this.skip) {
            revealed = Math.min(total, Math.floor((this.now() - this.revealStart) / TYPEWRITER_CHAR_MS));
        }
        this.revealedCount = revealed;

        // One tick per newly revealed letter (skip whitespace so it doesn't click on spaces).
        if (typewriter && revealed > this.soundedChars) {
            const pageChars = lines.join('');
            if (/\S/.test(pageChars.slice(this.soundedChars, revealed))) {
                soundEngine.play('typewriter');
            }
            this.soundedChars = revealed;
        }

        // Anchor text to its top-left so the first line keeps a margin from the
        // box border (the default 'alphabetic' baseline would push it up against
        // the top edge).
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let budget = revealed;
        let ty = y + 7;
        for (const line of lines) {
            if (typewriter && budget <= 0) break;
            const shown = budget >= line.length ? line : line.slice(0, Math.max(0, budget));
            bitmapFont.drawText(ctx, shown, x + 6, ty, DIALOG_FONT_SIZE, accent);
            budget -= line.length;
            ty += lineHeight;
        }

        if (typewriter && revealed < total) {
            this.scheduleRevealFrame();
        } else {
            this.stopRevealLoop();
        }
    }

    calculateDialogPages(dialog: DialogState, maxWidth: number, boxHeight: number, lineHeight: number) {
        const words = (dialog.text || '').split(/\s+/);
        let line = '';
        const lines: string[] = [];

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (bitmapFont.measureText(testLine, DIALOG_FONT_SIZE) > maxWidth && i > 0) {
                lines.push(line.trim());
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());

        const linesPerPage = Math.max(1, Math.floor(boxHeight / lineHeight));
        const pages: string[][] = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }
        return pages;
    }

    private now(): number {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    private scheduleRevealFrame(): void {
        if (this.rafHandle) return;
        if (typeof requestAnimationFrame === 'function') {
            this.rafHandle = requestAnimationFrame(() => {
                this.rafHandle = 0;
                this.requestRedraw?.();
            });
        } else {
            this.rafHandle = setTimeout(() => {
                this.rafHandle = 0;
                this.requestRedraw?.();
            }, 16) as unknown as number;
        }
    }

    private stopRevealLoop(): void {
        if (!this.rafHandle) return;
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.rafHandle);
        } else {
            clearTimeout(this.rafHandle);
        }
        this.rafHandle = 0;
    }
}

export { RendererDialogRenderer };
