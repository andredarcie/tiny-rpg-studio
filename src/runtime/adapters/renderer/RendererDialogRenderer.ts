import { FONT_NAME, FONT_SIZE } from '../../../config/FontConfig';
import { GameConfig } from '../../../config/GameConfig';
import { soundEngine } from '../../services/SoundEngine';
import type { DialogChoiceState } from '../../../types/gameState';

type DialogState = {
    active: boolean;
    text?: string;
    page?: number;
    maxPages?: number;
    choice?: DialogChoiceState | null;
};

type DialogGameState = {
    getDialog: () => DialogState;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

/** Inset (in canvas-internal px) of the dialog from the gameplay edges. */
const BOX_INSET = 4;
/** Milliseconds per revealed character — a visible but brisk typewriter. */
const TYPEWRITER_CHAR_MS = 55;
/** Fallback line-height factor when the stylesheet is not available (tests). */
const FALLBACK_LINE_HEIGHT = 1.3;

/**
 * Renders the dialog as an HTML/CSS overlay positioned over the game canvas
 * instead of drawing text onto the canvas. DOM text is always crisp (the browser
 * handles the device pixel ratio), which sidesteps the pixel-font scaling/blur
 * problems of canvas text.
 *
 * Layout: a bottom-anchored container holds the standard message box (paginated,
 * with a typewriter reveal) and — for a choice dialog — a row of two large Yes/No
 * buttons below it, which are easy and precise touch targets.
 *
 * Sizing follows two rules that keep the box identical on every screen:
 * - the font scales with the canvas exactly like the HUD font, so the dialog is
 *   never relatively huge on a phone and tiny on a desktop, up to
 *   GameConfig.dialog.maxFontSize; past that ceiling the font holds still and a
 *   page simply fits more characters;
 * - the box is as tall as the tallest page of the current message (capped at
 *   GameConfig.dialog.maxLines), so a short line does not reserve empty space and
 *   advancing pages never resizes the box mid-conversation.
 */
class RendererDialogRenderer {
    gameState: DialogGameState;
    paletteManager: PaletteManagerApi;
    private requestRedraw: (() => void) | null;

    /** Internal-px vertical offset of the gameplay viewport (the top HUD height). */
    private viewportOffsetY = 0;
    /** Internal-px height of the gameplay viewport (set from the bounds each draw). */
    private gameplayHeight = 0;
    /** Display-px height reserved for the message text (tallest page of this message). */
    private pageTextHeightPx = 0;
    /** Display pixels per internal canvas pixel (refreshed each draw). */
    private displayRatio = 1;
    /** Display-px font size of the dialog text — always in step with the HUD font. */
    private fontPx = FONT_SIZE;
    /** Display-px height of one text line (measured from the real stylesheet). */
    private lineHeightPx = 0;

    /** Cached pagination — recomputed only when the text/layout key changes. */
    private pages: string[] = [''];
    private pagesKey = '';

    private overlay: HTMLElement | null = null;
    private containerEl: HTMLElement | null = null;
    private boxEl: HTMLElement | null = null;
    private textEl: HTMLElement | null = null;
    private measurerEl: HTMLElement | null = null;
    private buttonsEl: HTMLElement | null = null;
    private buttonEls: HTMLButtonElement[] = [];
    /** Invoked when a player taps/clicks an option button (select + confirm). */
    private onChoose: ((index: number) => void) | null = null;

    // ─── Typewriter reveal state ──────────────────────────────────────────────
    private revealKey = '';
    private revealStart = 0;
    private revealedCount = 0;
    private totalChars = 0;
    private soundedChars = 0;
    private skip = false;
    private rafHandle = 0;
    private lastRenderedText = '';

    constructor(
        gameState: DialogGameState,
        paletteManager: PaletteManagerApi,
        requestRedraw: (() => void) | null = null,
    ) {
        this.gameState = gameState;
        this.paletteManager = paletteManager;
        this.requestRedraw = requestRedraw;
    }

    /** Registers the callback fired when an option button is tapped/clicked. */
    setChoiceHandler(handler: ((index: number) => void) | null): void {
        this.onChoose = handler;
    }

    setViewportOffset(offsetY = 0): void {
        this.viewportOffsetY = Number.isFinite(offsetY) ? Math.max(0, offsetY) : 0;
    }

    /** Whether the current message page has finished its typewriter reveal. */
    isRevealComplete(): boolean {
        return this.revealedCount >= this.totalChars;
    }

    /** Instantly reveal the full current page (player skipped the typewriter). */
    skipReveal(): void {
        this.skip = true;
        this.requestRedraw?.();
    }

    /** Option taps are handled by the DOM buttons directly, so this is unused. */
    pickChoiceFromPointer(): number | null {
        return null;
    }

    drawDialog(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }): void {
        this.gameplayHeight = canvas.height;
        const canvasEl = ctx.canvas;
        const dialog = this.gameState.getDialog();
        if (!dialog.active || !dialog.text || !canvasEl.parentElement) {
            this.hide();
            return;
        }
        this.ensureOverlay(canvasEl.parentElement);
        this.positionOverlay(canvasEl);
        this.fill(dialog);
    }

    private ensureOverlay(parent: HTMLElement): void {
        if (this.overlay && this.overlay.parentElement === parent) return;

        const overlay = document.createElement('div');
        overlay.className = 'game-dialog-overlay';
        overlay.style.position = 'absolute';
        overlay.style.pointerEvents = 'none';
        overlay.style.boxSizing = 'border-box';

        const container = document.createElement('div');
        container.className = 'game-dialog';

        const box = document.createElement('div');
        box.className = 'game-dialog-box';

        const text = document.createElement('div');
        text.className = 'game-dialog-text';

        const measurer = document.createElement('div');
        measurer.setAttribute('aria-hidden', 'true');
        measurer.style.position = 'absolute';
        measurer.style.visibility = 'hidden';
        measurer.style.pointerEvents = 'none';
        measurer.style.left = '-9999px';
        measurer.style.top = '0';
        measurer.style.whiteSpace = 'pre-wrap';
        measurer.style.overflowWrap = 'anywhere';

        const buttons = document.createElement('div');
        buttons.className = 'game-dialog-buttons';

        box.appendChild(text);
        box.appendChild(measurer);
        container.appendChild(box);
        container.appendChild(buttons);
        overlay.appendChild(container);

        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        parent.appendChild(overlay);

        this.overlay = overlay;
        this.containerEl = container;
        this.boxEl = box;
        this.textEl = text;
        this.measurerEl = measurer;
        this.buttonsEl = buttons;
        this.buttonEls = [];
    }

    private positionOverlay(canvasEl: HTMLCanvasElement): void {
        const overlay = this.overlay;
        const container = this.containerEl;
        const box = this.boxEl;
        if (!overlay || !container || !box) return;

        const displayW = canvasEl.offsetWidth || canvasEl.width;
        const displayH = canvasEl.offsetHeight || canvasEl.height;
        const ratio = displayH / (canvasEl.height || 1);
        this.displayRatio = ratio;

        overlay.style.left = `${canvasEl.offsetLeft}px`;
        overlay.style.top = `${canvasEl.offsetTop}px`;
        overlay.style.width = `${displayW}px`;
        overlay.style.height = `${displayH}px`;
        overlay.style.display = 'block';

        // The whole dialog (box + buttons) anchors to the bottom of the gameplay
        // viewport, inset from the edges like the old canvas box.
        const inventoryInternal = Math.max(0, canvasEl.height - this.viewportOffsetY - this.gameplayHeight);
        container.style.position = 'absolute';
        container.style.left = `${BOX_INSET * ratio}px`;
        container.style.right = `${BOX_INSET * ratio}px`;
        container.style.bottom = `${(inventoryInternal + BOX_INSET) * ratio}px`;
        container.style.fontFamily = `"${FONT_NAME}", monospace`;

        // The dialog text scales with the canvas exactly like the canvas-drawn HUD
        // font, so it keeps the same relative size on every screen, up to a ceiling
        // that stops it becoming huge on very large displays. It is applied to each
        // text-bearing element because the stylesheet's `body *` rule sets a fixed
        // font-size that would otherwise win over inheritance from the box.
        const fontPx = Math.min(
            Math.max(1, GameConfig.dialog.maxFontSize),
            Math.max(1, FONT_SIZE * ratio),
        );
        this.fontPx = fontPx;
        container.style.fontSize = `${fontPx}px`;
        box.style.fontSize = `${fontPx}px`;
        if (this.textEl) {
            this.textEl.style.fontSize = `${fontPx}px`;
            this.textEl.style.overflow = 'hidden';
        }
        if (this.buttonsEl) {
            this.buttonsEl.style.fontSize = `${fontPx}px`;
        }

        const accent = this.paletteManager.getColor(7) || '#FFF1E8';
        const background = this.paletteManager.getColor(1) || '#1D2B53';
        const border = `${Math.max(1, Math.round(ratio))}px solid ${accent}`;
        box.style.color = accent;
        box.style.background = background;
        box.style.border = border;
    }

    private fill(dialog: DialogState): void {
        const fullText = dialog.text ?? '';
        const typewriter = this.requestRedraw !== null;

        const pagesKey = `${fullText}|${this.textEl?.clientWidth ?? 0}|${Math.round(this.fontPx * 100)}`;
        if (pagesKey !== this.pagesKey) {
            this.pages = this.computePages(fullText);
            this.pagesKey = pagesKey;
            this.applyPageHeight();
        }
        const totalPages = Math.max(1, this.pages.length);
        if (dialog.maxPages !== totalPages) {
            dialog.maxPages = totalPages;
        }
        const pageIndex = Math.min(Math.max((dialog.page ?? 1) - 1, 0), totalPages - 1);
        if (dialog.page !== pageIndex + 1) {
            dialog.page = pageIndex + 1;
        }
        const pageText = this.pages[pageIndex] ?? '';
        const isLastPage = pageIndex === totalPages - 1;

        // Typewriter reveal of the current page (restarts whenever the page changes).
        const key = `${pageIndex}:${pageText}`;
        if (key !== this.revealKey) {
            this.revealKey = key;
            this.revealStart = this.now();
            this.skip = false;
            this.soundedChars = 0;
            // Clear immediately so a reopened dialog never flashes the previous text
            // for a frame before the typewriter starts.
            if (this.textEl) {
                this.textEl.textContent = '';
            }
            this.lastRenderedText = '';
        }
        this.totalChars = pageText.length;
        let revealed = pageText.length;
        if (typewriter && !this.skip) {
            revealed = Math.min(pageText.length, Math.floor((this.now() - this.revealStart) / TYPEWRITER_CHAR_MS));
        }
        this.revealedCount = revealed;

        if (typewriter && revealed > this.soundedChars) {
            if (/\S/.test(pageText.slice(this.soundedChars, revealed))) {
                soundEngine.play('typewriter');
            }
            this.soundedChars = revealed;
        }

        const revealedText = pageText.slice(0, revealed);
        if (this.textEl && revealedText !== this.lastRenderedText) {
            this.textEl.textContent = revealedText;
            this.lastRenderedText = revealedText;
        }

        // The Yes/No buttons appear only on the last page, once it has fully revealed.
        const choice = dialog.choice;
        const showButtons = Boolean(choice && choice.phase !== 'branch') && isLastPage && revealed >= pageText.length;
        if (this.buttonsEl) {
            this.buttonsEl.style.display = showButtons ? 'flex' : 'none';
        }
        if (showButtons && choice) {
            this.renderButtons(choice);
        }

        if (typewriter && revealed < pageText.length) {
            this.scheduleRevealFrame();
        } else {
            this.stopRevealLoop();
        }
    }

    private renderButtons(choice: DialogChoiceState): void {
        const container = this.buttonsEl;
        if (!container) return;
        const accent = this.paletteManager.getColor(7) || '#FFF1E8';
        const background = this.paletteManager.getColor(1) || '#1D2B53';
        const borderPx = Math.max(1, Math.round(this.displayRatio));
        // On touch devices the player taps the option directly, so both buttons stay
        // crisp; with a pointer/keyboard only the highlighted one is crisp and the
        // other is dimmed to show which one a confirm would pick.
        const touchPrimary = this.isTouchPrimary();

        choice.options.forEach((option, index) => {
            let button = this.buttonEls.at(index);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'game-dialog-button';
                button.style.pointerEvents = 'auto';
                const choose = (ev: Event) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.onChoose?.(index);
                };
                button.addEventListener('click', choose);
                button.addEventListener('touchstart', choose, { passive: false });
                container.appendChild(button);
                this.buttonEls[index] = button;
            }
            const selected = index === choice.selectedIndex;
            button.textContent = option.label;
            button.classList.toggle('game-dialog-button--selected', selected);
            // Every button keeps the same dialog styling; selection is shown by opacity.
            button.style.fontSize = `${this.fontPx}px`;
            button.style.color = accent;
            button.style.background = background;
            button.style.border = `${borderPx}px solid ${accent}`;
            button.style.opacity = touchPrimary || selected ? '1' : '0.4';
            button.style.display = 'block';
        });

        for (let i = choice.options.length; i < this.buttonEls.length; i++) {
            this.buttonEls[i].style.display = 'none';
        }
    }

    /** True on touch-first devices (phones/tablets), where the player taps directly. */
    private isTouchPrimary(): boolean {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }

    /**
     * Splits a message on the manual page-break marker. A lone backslash ends the
     * page; a doubled backslash is an escaped literal one. Authors use this to
     * control pacing without counting characters.
     */
    private splitPageBreaks(text: string): string[] {
        const segments: string[] = [];
        let current = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char !== '\\') {
                current += char;
                continue;
            }
            if (text[i + 1] === '\\') {
                current += '\\';
                i++;
                continue;
            }
            segments.push(current);
            current = '';
        }
        segments.push(current);
        return segments;
    }

    /**
     * Pre-computes the exact line breaks and groups them into pages of at most
     * GameConfig.dialog.maxLines, inserting explicit newlines. Because the wrap
     * points are baked in, revealing the text character by character never reflows:
     * a word that belongs on the next line starts there instead of being typed at
     * the right edge and then jumping. Line widths are measured against the real DOM
     * so they match CSS wrapping.
     */
    private computePages(text: string): string[] {
        const measurer = this.measurerEl;
        const textEl = this.textEl;
        if (!measurer || !textEl) {
            return [text];
        }

        const cs = getComputedStyle(textEl);
        const fontPx = parseFloat(cs.fontSize) || this.fontPx || FONT_SIZE;
        const lineHeightRaw = parseFloat(cs.lineHeight);
        this.lineHeightPx = Number.isFinite(lineHeightRaw) && lineHeightRaw > 0
            ? lineHeightRaw
            : fontPx * FALLBACK_LINE_HEIGHT;
        const maxLines = Math.max(1, GameConfig.dialog.maxLines);
        // Keep a 1px safety margin so a measured line never re-wraps when rendered.
        const availWidth = Math.max(1, textEl.clientWidth - 1);

        // Measure single-line widths (no wrapping) to find the exact break points.
        measurer.style.whiteSpace = 'nowrap';
        measurer.style.width = 'auto';
        measurer.style.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
        measurer.style.fontSize = cs.fontSize;
        measurer.style.fontFamily = cs.fontFamily;
        measurer.style.lineHeight = cs.lineHeight;
        measurer.style.letterSpacing = cs.letterSpacing;

        // A page break never merges two segments, so an authored break always starts
        // a new page even when the previous one is nearly empty.
        const segments = this.splitPageBreaks(text).filter((segment) => segment.trim().length > 0);
        const pages: string[] = [];
        for (const segment of (segments.length ? segments : [''])) {
            const wrappedLines: string[] = [];
            for (const rawLine of segment.split('\n')) {
                const words = rawLine.split(/\s+/).filter((word) => word.length > 0);
                if (!words.length) {
                    wrappedLines.push('');
                    continue;
                }
                let line = '';
                for (const word of words) {
                    const candidate = line ? `${line} ${word}` : word;
                    measurer.textContent = candidate;
                    if (measurer.offsetWidth > availWidth && line) {
                        wrappedLines.push(line);
                        line = word;
                    } else {
                        line = candidate;
                    }
                }
                wrappedLines.push(line);
            }
            for (let i = 0; i < wrappedLines.length; i += maxLines) {
                // Blank lines otherwise paginate like real content: a trailing
                // newline, which is what a textarea leaves behind, would produce a
                // page with nothing on it that the player still has to dismiss.
                const pageLines = this.trimBlankEdges(wrappedLines.slice(i, i + maxLines));
                if (!pageLines.length) continue;
                pages.push(pageLines.join('\n'));
            }
        }
        return pages.length ? pages : [''];
    }

    /** Drops empty lines from both ends, so a page starts and ends on real text. */
    private trimBlankEdges(lines: string[]): string[] {
        let start = 0;
        let end = lines.length;
        while (start < end && !lines[start].trim()) start++;
        while (end > start && !lines[end - 1].trim()) end--;
        return lines.slice(start, end);
    }

    /**
     * Sizes the message area to the tallest page of the current message. The height
     * is decided once per message, so advancing through its pages never resizes the
     * box while the player is reading — only opening a different dialog can change
     * it. It is derived from the fully paginated text rather than the revealed text,
     * so the typewriter fills a box that already has its final height.
     */
    private applyPageHeight(): void {
        if (!this.textEl) return;
        const lineHeight = this.lineHeightPx > 0 ? this.lineHeightPx : this.fontPx * FALLBACK_LINE_HEIGHT;
        const lines = this.pages.reduce(
            (tallest, page) => Math.max(tallest, page.split('\n').length),
            1,
        );
        this.pageTextHeightPx = lines * lineHeight;
        this.textEl.style.height = `${this.pageTextHeightPx}px`;
    }

    private hide(): void {
        this.revealKey = '';
        this.lastRenderedText = '';
        this.stopRevealLoop();
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
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
