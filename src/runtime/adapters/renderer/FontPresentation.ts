import { FONT_NAME } from '../../../config/FontConfig';

export type FontPresentation = { family: string; weight: string; style: string; variationSettings: string };
let custom: FontPresentation | undefined;
let disabled = false;
let revision = 0;
export function setGameFont(font?: FontPresentation): void { custom = font; revision++; }
export function setGameFontDisabled(value: boolean): void { if (disabled !== value) revision++; disabled = value; }
export function getGameFont(): FontPresentation {
    return custom ?? { family: disabled ? 'monospace' : `"${FONT_NAME}", monospace`, weight: '400', style: 'normal', variationSettings: 'normal' };
}
export function getGameFontRevision(): number { return revision; }
export function hasCustomGameFont(): boolean { return Boolean(custom); }
export function applyGameFont(element: HTMLElement): void {
    const font = getGameFont();
    Object.assign(element.style, { fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style, fontVariationSettings: font.variationSettings, fontSynthesis: 'none' });
    element.toggleAttribute('data-game-font', hasCustomGameFont());
}
