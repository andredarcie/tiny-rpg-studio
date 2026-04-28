/**
 * Single source of truth for every font decision in the engine.
 * Change values here → both CSS editor and canvas game update automatically.
 */

/** Font name used in CSS @font-face and font-family stack. */
export const FONT_NAME = 'TinyRpgPico8';

/** Path to the WOFF file used by the CSS editor. */
export const FONT_CSS_SRC = '/pico8-ui.woff';

/** Path to the PNG spritesheet used by the canvas bitmap font renderer. */
export const FONT_BITMAP_SRC = '/pico8-font.png';

/** Character size in canvas pixels. */
export const FONT_SIZE = 8;

/** Font size for the game title on the intro screen — 25% larger than FONT_SIZE. */
export const TITLE_FONT_SIZE = Math.round(FONT_SIZE * 1.25);

/** Font size used by the DOM editor UI. */
export const UI_FONT_SIZE = 16;

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
