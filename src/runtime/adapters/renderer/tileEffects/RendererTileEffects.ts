import { GameConfig } from '../../../../config/GameConfig';
import {
    colorLuminance,
    mixColors,
    modulateColor,
    parseColor,
} from './colorUtils';
import { buildHeightField } from './baseEffects/proceduralField';
import { getTileEffectDefinition, TILE_EFFECT_DEFINITIONS } from './registry';
import {
    getCustomTileEffect,
    isCustomTileEffectId,
    type BaseTileEffectId,
} from '../../../domain/definitions/customTileEffects';
import { paintBaseTileEffectComposition } from './baseEffectRegistry';
import type {
    TileEffectHost,
    TileEffectSource,
    TileVisualEffectId,
} from './types';

/**
 * Owns the discrete animation clock and dispatches tile canvas effects.
 *
 * RendererCanvasHelper stays free of effect-specific drawing; new effects are
 * registered in `registry.ts` only.
 */
class RendererTileEffects {
    /**
     * Discrete phase step. Advanced only from the tile-animation tick so
     * movement redraws do not jitter the effect.
     */
    phaseStep = 0;

    advancePhase(): number {
        this.phaseStep += 1;
        return this.phaseStep;
    }

    /** Stable pseudo-time derived from discrete steps. */
    getTimeMs(): number {
        const stepMs = Math.max(
            GameConfig.animation.minInterval,
            GameConfig.animation.tileInterval
        );
        return this.phaseStep * stepMs;
    }

    /** Project master switch (Project → Visuals → Enable effects). */
    isEnabled(enableEffects: boolean | undefined): boolean {
        return enableEffects !== false;
    }

    /**
     * Resolve which effect to paint for a tile.
     * Order: global off → explicit visualEffect → registered heuristics → none.
     */
    resolveEffect(
        tile: TileEffectSource | null | undefined,
        enableEffects: boolean | undefined,
        customTileEffects: unknown = []
    ): TileVisualEffectId {
        if (!tile) return 'none';
        if (!this.isEnabled(enableEffects)) return 'none';

        if (tile.visualEffect === 'water' || tile.visualEffect === 'lava' || tile.visualEffect === 'none') {
            return tile.visualEffect;
        }
        if (isCustomTileEffectId(tile.visualEffect)) {
            return getCustomTileEffect(customTileEffects, tile.visualEffect)?.id ?? 'none';
        }
        if (typeof tile.visualEffect === 'string' && tile.visualEffect.startsWith('custom:')) {
            return 'none';
        }

        for (const effect of TILE_EFFECT_DEFINITIONS) {
            if (effect.matchesHeuristic(tile)) return effect.id;
        }
        return 'none';
    }

    /**
     * Paint a tile with its effect, or fall back to plain pixel grid.
     */
    paintTile(
        host: TileEffectHost,
        ctx: CanvasRenderingContext2D,
        tile: TileEffectSource | null | undefined,
        pixels: (string | null)[][],
        px: number,
        py: number,
        size: number,
        enableEffects: boolean | undefined,
        customTileEffects: unknown = []
    ): void {
        const step = Math.max(1, Math.floor(size / 8));
        const effectId = this.resolveEffect(tile, enableEffects, customTileEffects);
        const context = { ctx, host, pixels, px, py, step, size, timeMs: this.getTimeMs() };
        const customDefinition = getCustomTileEffect(customTileEffects, effectId);
        if (customDefinition) {
            try {
                paintBaseTileEffectComposition(context, customDefinition.baseEffectIds);
            } catch {
                host.drawPixelGrid(ctx, pixels, px, py, step);
            }
            return;
        }
        const definition = getTileEffectDefinition(effectId);

        if (!definition) {
            host.drawPixelGrid(ctx, pixels, px, py, step);
            return;
        }

        definition.paint(context);
    }

    paintCustomPreview(
        host: TileEffectHost,
        ctx: CanvasRenderingContext2D,
        pixels: (string | null)[][],
        px: number,
        py: number,
        size: number,
        baseEffectIds: readonly BaseTileEffectId[],
        timeMs = this.getTimeMs()
    ): void {
        const step = Math.max(1, Math.floor(size / 8));
        paintBaseTileEffectComposition(
            { ctx, host, pixels, px, py, step, size, timeMs },
            baseEffectIds
        );
    }
}

export {
    RendererTileEffects,
    TILE_EFFECT_DEFINITIONS,
    getTileEffectDefinition,
    buildHeightField,
    parseColor,
    colorLuminance,
    modulateColor,
    mixColors,
};
export type { TileVisualEffectId, TileEffectSource, TileEffectHost };
