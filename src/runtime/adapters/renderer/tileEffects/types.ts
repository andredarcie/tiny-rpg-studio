/**
 * Tile canvas effects — shared types.
 *
 * To add a new effect:
 * Built-ins are registered in registry.ts. Project-defined effects compose the
 * fixed base-effect catalog and never register executable project code.
 */

import type {
    BuiltInTileVisualEffectKind,
    TileVisualEffectKind,
} from '../../../domain/definitions/customTileEffects';

export type TileVisualEffectId = TileVisualEffectKind;

/** Minimal tile fields used to resolve which effect applies. */
export type TileEffectSource = {
    category?: string;
    name?: string;
    visualEffect?: string;
};

/** Host callbacks provided by RendererCanvasHelper (outline + plain pixel paint). */
export type TileEffectHost = {
    isEmptyPixel(col: string | null | undefined): boolean;
    isSpriteOutlineEnabled(): boolean;
    getSpriteOutlineColor(): string;
    drawPixelGrid(
        ctx: CanvasRenderingContext2D,
        pixels: (string | null)[][],
        px: number,
        py: number,
        step: number
    ): void;
};

/** Everything an effect painter needs to draw one tile. */
export type TileEffectPaintContext = {
    ctx: CanvasRenderingContext2D;
    host: TileEffectHost;
    pixels: (string | null)[][];
    px: number;
    py: number;
    step: number;
    size: number;
    /** Stable discrete clock (ms), advanced only on tile-animation ticks. */
    timeMs: number;
};

/** One independently composable tile paint pass. */
export type TileEffectPainter = (context: TileEffectPaintContext) => void;

export type TileEffectDefinition = {
    /** Unique id; must match TileVisualEffectId (except 'none'). */
    id: Exclude<BuiltInTileVisualEffectKind, 'none'>;
    /**
     * Legacy/heuristic match when tile.visualEffect is unset.
     * Explicit visualEffect on the tile always wins over this.
     */
    matchesHeuristic(tile: TileEffectSource): boolean;
    /** Paint the effect for one tile cell. */
    paint(context: TileEffectPaintContext): void;
};
