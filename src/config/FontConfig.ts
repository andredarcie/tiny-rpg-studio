/**
 * Single source of truth for every font decision in the engine.
 * Change values here → both CSS editor and canvas game update automatically.
 *
 * The engine uses Pixel Operator Mono HB 8 (by Jayvee Enaguas, CC0 / public
 * domain), a monospace pixel font. The DOM UI renders it via CSS @font-face and
 * the game canvas renders it via the Canvas 2D text API (see BitmapFont).
 */

/** Font name used in CSS @font-face and font-family stack. */
export const FONT_NAME = 'PixelOperator';

/** Path to the WOFF file used by the DOM UI and the canvas font. */
export const FONT_CSS_SRC = 'pixel-operator.woff';

/**
 * Native design size (in px) of the pixel font. Pixel Operator Mono HB 8 is
 * crisp at 8px and integer multiples; the canvas renderer rasterizes at this
 * size and scales with nearest-neighbor to keep hard pixel edges.
 */
export const FONT_SIZE = 8;

/**
 * Font size for the game intro title. Twice the native size (a crisp integer
 * multiple) so short titles stand out; long titles auto-fit back down to the
 * native size on the canvas. See RendererOverlayRenderer.fitBitmapText.
 */
export const TITLE_FONT_SIZE = FONT_SIZE * 2;

/**
 * Font size (px) used by the DOM editor UI. Pixel Operator Mono is full-em
 * monospace (every glyph advances one em), so it is markedly wider than the
 * previous proportional font; this is tuned smaller so UI labels still fit.
 */
export const UI_FONT_SIZE = 12;

/** Pixels added between glyphs in canvas bitmap rendering. */
export const LETTER_SPACING = 1;

/** Width in canvas pixels used for the space character. */
export const SPACE_ADVANCE = 4;

/** Line spacing in canvas pixels. */
export const LINE_HEIGHT = FONT_SIZE + 2;

/**
 * Injects the @font-face declaration and CSS variables into the document.
 * Call once at app startup — drives all editor text styling.
 */
export function applyFontConfig(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('engine-font-config')) return;

    const style = document.createElement('style');
    style.id = 'engine-font-config';
    style.textContent = `
        @font-face {
            font-family: "${FONT_NAME}";
            src: url("${FONT_CSS_SRC}") format("woff");
            font-style: normal;
            font-weight: 400;
            font-display: swap;
        }
    `;
    document.head.appendChild(style);

    const root = document.documentElement;
    root.style.setProperty('--engine-font-size', `${UI_FONT_SIZE}px`);
    root.style.setProperty('--ui-font-family', `"${FONT_NAME}", monospace`);
}

/**
 * Switches the editor UI font between the pixel font and system monospace.
 * Instant — no page reload needed.
 */
export function setEditorFontDisabled(disabled: boolean): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty(
        '--ui-font-family',
        disabled ? 'monospace' : `"${FONT_NAME}", monospace`
    );
}
