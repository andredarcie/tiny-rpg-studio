import { normalizeTileLabel } from './colorUtils';
import type {
    TileEffectDefinition,
    TileEffectPaintContext,
    TileEffectPainter,
    TileEffectSource,
} from './types';
import { paintCaustic } from './baseEffects/causticEffect';
import { paintCoolTint } from './baseEffects/coolTintEffect';
import { paintTileEffectOutline } from './baseEffects/outlineEffect';
import { paintSparkle } from './baseEffects/sparkleEffect';
import { paintSpecular } from './baseEffects/specularEffect';
import { paintTranslucentWave } from './baseEffects/translucentWaveEffect';

const WATER_EFFECT_PAINTERS = [
    paintCoolTint,
    paintTileEffectOutline,
    paintTranslucentWave,
    paintSparkle,
    paintCaustic,
    paintSpecular,
] satisfies readonly TileEffectPainter[];

function matchesHeuristic(tile: TileEffectSource): boolean {
    const category = normalizeTileLabel(tile.category || '');
    const name = normalizeTileLabel(tile.name || '');
    return category === 'agua' || name.includes('agua') || name.includes('water');
}

function paint(context: TileEffectPaintContext): void {
    if (context.pixels.length === 0 || (context.pixels[0]?.length ?? 0) === 0) return;
    WATER_EFFECT_PAINTERS.forEach((paintEffect) => paintEffect(context));
}

/** Water composed from independent tint, outline, wave, sparkle, caustic, and specular passes. */
export const waterTileEffect: TileEffectDefinition = {
    id: 'water',
    matchesHeuristic,
    paint,
};
