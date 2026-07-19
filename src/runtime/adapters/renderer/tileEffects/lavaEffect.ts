import { paintEmbers } from './baseEffects/emberEffect';
import { paintEmissive } from './baseEffects/emissiveEffect';
import { paintGlow } from './baseEffects/glowEffect';
import { paintHeightFieldBody } from './baseEffects/heightFieldBodyEffect';
import { paintTileEffectOutline } from './baseEffects/outlineEffect';
import { paintRidgeWave } from './baseEffects/ridgeWaveEffect';
import { normalizeTileLabel } from './colorUtils';
import type {
    TileEffectDefinition,
    TileEffectPaintContext,
    TileEffectPainter,
    TileEffectSource,
} from './types';

const LAVA_EFFECT_PAINTERS = [
    paintGlow,
    paintTileEffectOutline,
    paintHeightFieldBody,
    paintRidgeWave,
    paintEmissive,
    paintEmbers,
] satisfies readonly TileEffectPainter[];

function matchesHeuristic(tile: TileEffectSource): boolean {
    const category = normalizeTileLabel(tile.category || '');
    const name = normalizeTileLabel(tile.name || '');
    return category === 'perigo' || name.includes('lava');
}

function paint(context: TileEffectPaintContext): void {
    if (context.pixels.length === 0 || (context.pixels[0]?.length ?? 0) === 0) return;
    LAVA_EFFECT_PAINTERS.forEach((paintEffect) => paintEffect(context));
}

/** Lava composed from independent glow, outline, body, wave, emissive, and ember passes. */
export const lavaTileEffect: TileEffectDefinition = {
    id: 'lava',
    matchesHeuristic,
    paint,
};
