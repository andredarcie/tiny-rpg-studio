import {
    BASE_TILE_EFFECT_IDS,
    type BaseTileEffectId,
} from '../../../domain/definitions/customTileEffects';
import { paintCalmWave } from './baseEffects/calmWaveEffect';
import { paintCaustic } from './baseEffects/causticEffect';
import { paintChoppyWave } from './baseEffects/choppyWaveEffect';
import { paintCoolTint } from './baseEffects/coolTintEffect';
import { paintDeepTint } from './baseEffects/deepTintEffect';
import { paintDiagonalOutline } from './baseEffects/diagonalOutlineEffect';
import { paintEmbers } from './baseEffects/emberEffect';
import { paintEmissive } from './baseEffects/emissiveEffect';
import { paintGentleRidge } from './baseEffects/gentleRidgeEffect';
import { paintGlow } from './baseEffects/glowEffect';
import { paintHeightFieldBody } from './baseEffects/heightFieldBodyEffect';
import { paintInnerOutline } from './baseEffects/innerOutlineEffect';
import { paintIntenseGlow } from './baseEffects/intenseGlowEffect';
import { paintMurkyTint } from './baseEffects/murkyTintEffect';
import { paintTileEffectOutline } from './baseEffects/outlineEffect';
import { paintRidgeWave } from './baseEffects/ridgeWaveEffect';
import { paintReflectionBottom } from './baseEffects/reflectionBottomEffect';
import { paintReflectionLeft } from './baseEffects/reflectionLeftEffect';
import { paintReflectionRight } from './baseEffects/reflectionRightEffect';
import { paintReflectionTop } from './baseEffects/reflectionTopEffect';
import { paintSharpRidge } from './baseEffects/sharpRidgeEffect';
import { paintSoftGlow } from './baseEffects/softGlowEffect';
import { paintSparkle } from './baseEffects/sparkleEffect';
import { paintSpecular } from './baseEffects/specularEffect';
import { paintTranslucentWave } from './baseEffects/translucentWaveEffect';
import type { TileEffectPaintContext, TileEffectPainter } from './types';

export type BaseTileEffectCatalogEntry = {
    id: BaseTileEffectId;
    textKey: string;
    fallbackLabel: string;
    helpTextKey?: string;
    fallbackHelp?: string;
    painter: TileEffectPainter;
};

const outlineHelp = {
    helpTextKey: 'customEffects.outlineHelp',
    fallbackHelp: 'Uses the Project → Visuals Sprite outline setting and color.',
};

const reflectionHelp = {
    helpTextKey: 'customEffects.reflectionHelp',
    fallbackHelp: 'Mirrors the tile inward from the selected edge.',
};

const paintReflectionTopPass: TileEffectPainter = ({ ctx, host, pixels, px, py, step, size }) => {
    const spriteHeight = pixels.length * step;
    paintReflectionTop(ctx, host, pixels, px, py - spriteHeight, step, px, py, size);
};

const paintReflectionBottomPass: TileEffectPainter = ({ ctx, host, pixels, px, py, step, size }) => {
    const spriteHeight = pixels.length * step;
    paintReflectionBottom(ctx, host, pixels, px, py + size * 2 - spriteHeight, step, px, py, size);
};

const getSpriteWidth = (pixels: (string | null)[][], step: number): number =>
    pixels.reduce((width, row) => Math.max(width, row.length), 0) * step;

const paintReflectionLeftPass: TileEffectPainter = ({ ctx, host, pixels, px, py, step, size }) => {
    const spriteWidth = getSpriteWidth(pixels, step);
    paintReflectionLeft(ctx, host, pixels, px - spriteWidth, py, step, px, py, size);
};

const paintReflectionRightPass: TileEffectPainter = ({ ctx, host, pixels, px, py, step, size }) => {
    const spriteWidth = getSpriteWidth(pixels, step);
    paintReflectionRight(ctx, host, pixels, px + size * 2 - spriteWidth, py, step, px, py, size);
};

const CATALOG_BY_ID: Record<BaseTileEffectId, BaseTileEffectCatalogEntry> = {
    'calm-wave': { id: 'calm-wave', textKey: 'customEffects.base.calmWave', fallbackLabel: 'Calm wave', painter: paintCalmWave },
    caustic: { id: 'caustic', textKey: 'customEffects.base.caustic', fallbackLabel: 'Caustic light', painter: paintCaustic },
    'choppy-wave': { id: 'choppy-wave', textKey: 'customEffects.base.choppyWave', fallbackLabel: 'Choppy wave', painter: paintChoppyWave },
    'cool-tint': { id: 'cool-tint', textKey: 'customEffects.base.coolTint', fallbackLabel: 'Cool tint', painter: paintCoolTint },
    'deep-tint': { id: 'deep-tint', textKey: 'customEffects.base.deepTint', fallbackLabel: 'Deep tint', painter: paintDeepTint },
    'diagonal-outline': { id: 'diagonal-outline', textKey: 'customEffects.base.diagonalOutline', fallbackLabel: 'Diagonal outline', ...outlineHelp, painter: paintDiagonalOutline },
    embers: { id: 'embers', textKey: 'customEffects.base.embers', fallbackLabel: 'Embers', painter: paintEmbers },
    emissive: { id: 'emissive', textKey: 'customEffects.base.emissive', fallbackLabel: 'Emissive', painter: paintEmissive },
    'gentle-ridge': { id: 'gentle-ridge', textKey: 'customEffects.base.gentleRidge', fallbackLabel: 'Gentle ridge', painter: paintGentleRidge },
    glow: { id: 'glow', textKey: 'customEffects.base.glow', fallbackLabel: 'Glow', painter: paintGlow },
    'height-field-body': { id: 'height-field-body', textKey: 'customEffects.base.heightFieldBody', fallbackLabel: 'Height-field body', painter: paintHeightFieldBody },
    'inner-outline': { id: 'inner-outline', textKey: 'customEffects.base.innerOutline', fallbackLabel: 'Inner outline', ...outlineHelp, painter: paintInnerOutline },
    'intense-glow': { id: 'intense-glow', textKey: 'customEffects.base.intenseGlow', fallbackLabel: 'Intense glow', painter: paintIntenseGlow },
    'murky-tint': { id: 'murky-tint', textKey: 'customEffects.base.murkyTint', fallbackLabel: 'Murky tint', painter: paintMurkyTint },
    outline: { id: 'outline', textKey: 'customEffects.base.outline', fallbackLabel: 'Outline', ...outlineHelp, painter: paintTileEffectOutline },
    'ridge-wave': { id: 'ridge-wave', textKey: 'customEffects.base.ridgeWave', fallbackLabel: 'Ridge wave', painter: paintRidgeWave },
    'sharp-ridge': { id: 'sharp-ridge', textKey: 'customEffects.base.sharpRidge', fallbackLabel: 'Sharp ridge', painter: paintSharpRidge },
    'soft-glow': { id: 'soft-glow', textKey: 'customEffects.base.softGlow', fallbackLabel: 'Soft glow', painter: paintSoftGlow },
    sparkle: { id: 'sparkle', textKey: 'customEffects.base.sparkle', fallbackLabel: 'Sparkle', painter: paintSparkle },
    specular: { id: 'specular', textKey: 'customEffects.base.specular', fallbackLabel: 'Specular highlight', painter: paintSpecular },
    'translucent-wave': { id: 'translucent-wave', textKey: 'customEffects.base.translucentWave', fallbackLabel: 'Translucent wave', painter: paintTranslucentWave },
    'reflection-top': { id: 'reflection-top', textKey: 'customEffects.base.reflectionTop', fallbackLabel: 'Reflection from top', ...reflectionHelp, painter: paintReflectionTopPass },
    'reflection-bottom': { id: 'reflection-bottom', textKey: 'customEffects.base.reflectionBottom', fallbackLabel: 'Reflection from bottom', ...reflectionHelp, painter: paintReflectionBottomPass },
    'reflection-left': { id: 'reflection-left', textKey: 'customEffects.base.reflectionLeft', fallbackLabel: 'Reflection from left', ...reflectionHelp, painter: paintReflectionLeftPass },
    'reflection-right': { id: 'reflection-right', textKey: 'customEffects.base.reflectionRight', fallbackLabel: 'Reflection from right', ...reflectionHelp, painter: paintReflectionRightPass },
};

export const BASE_TILE_EFFECT_CATALOG: readonly BaseTileEffectCatalogEntry[] =
    BASE_TILE_EFFECT_IDS.map((id) => CATALOG_BY_ID[id]);

export function listBaseTileEffects(): ReadonlyArray<Omit<BaseTileEffectCatalogEntry, 'painter'>> {
    return BASE_TILE_EFFECT_CATALOG.map(({ painter: _painter, ...metadata }) => metadata);
}

export function getBaseTileEffectPainter(id: BaseTileEffectId): TileEffectPainter | null {
    return CATALOG_BY_ID[id].painter;
}

export function paintBaseTileEffectComposition(
    context: TileEffectPaintContext,
    ids: readonly BaseTileEffectId[]
): void {
    context.host.drawPixelGrid(context.ctx, context.pixels, context.px, context.py, context.step);
    for (const id of ids) {
        getBaseTileEffectPainter(id)?.(context);
    }
}
