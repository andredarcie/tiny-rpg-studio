import type { TileDefinition } from '../../domain/definitions/tileTypes';
import {
    buildLavaHeightField,
    colorLuminance,
    mixColors,
    modulateColor,
    parseColor,
    RendererTileEffects,
    type TileVisualEffectId,
} from './tileEffects/RendererTileEffects';
import { paintWaterReflection } from './tileEffects/waterEffect';

type TilePixels = (string | null)[][];

type TileManagerApi = {
    getTile: (tileId: string | number) => TileDefinition | null;
    getTilePixels?: (tile: TileDefinition, frameOverride?: number | null) => TilePixels | null;
    getTileMap?: (roomIndex: number) => {
        ground: ((string | number) | null)[][];
        overlay: ((string | number) | null)[][];
    } | null;
};

type PaletteApi = {
    getColor: (index: number) => string;
};

type GameStateApi = {
    getGame?: () => {
        spriteOutline?: boolean;
        spriteOutlineColor?: number;
        /** Global master switch for water/lava canvas effects (default true). */
        enableEffects?: boolean;
    };
} | null;

/** @deprecated Prefer TileVisualEffectId from tileEffects module. */
type TileVisualEffect = TileVisualEffectId;

/** Fallback when no palette is wired (PICO-8 dark blue / palette index 1). */
const DEFAULT_SPRITE_OUTLINE_COLOR = '#1D2B53';

/** Default outline palette index when game setting is missing. */
const DEFAULT_SPRITE_OUTLINE_COLOR_INDEX = 1;

/** Cardinal offsets used to expand opaque pixels into a 1px outline. */
const OUTLINE_DIRS: ReadonlyArray<readonly [number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];

/**
 * Canvas drawing helper for tiles and sprites.
 * Optional liquid tile effects live in `tileEffects/` and are dispatched via
 * {@link RendererTileEffects} — keep effect-specific code out of this file.
 */
class RendererCanvasHelper {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tileManager: TileManagerApi | null;
    paletteManager: PaletteApi | null;
    gameState: GameStateApi;
    /** Isolated tile-effect engine (phase clock + water/lava painters). */
    readonly tileEffects = new RendererTileEffects();

    constructor(
        canvas: HTMLCanvasElement,
        context: CanvasRenderingContext2D,
        tileManager: TileManagerApi | null,
        paletteManager: PaletteApi | null = null,
        gameState: GameStateApi = null
    ) {
        this.canvas = canvas;
        this.ctx = context;
        this.tileManager = tileManager;
        this.paletteManager = paletteManager;
        this.gameState = gameState;
    }

    getTilePixelSize() {
        return Math.floor(this.canvas.width / 8);
    }

    /** @see RendererTileEffects.advancePhase */
    advanceLiquidEffectPhase(): number {
        return this.tileEffects.advancePhase();
    }

    /** @see RendererTileEffects.getTimeMs */
    getEffectTimeMs(): number {
        return this.tileEffects.getTimeMs();
    }

    /** Discrete phase counter (tests / debugging). */
    get liquidEffectStep(): number {
        return this.tileEffects.phaseStep;
    }

    set liquidEffectStep(value: number) {
        this.tileEffects.phaseStep = value;
    }

    /** Palette index for outline (game setting, default 1). */
    getSpriteOutlineColorIndex(): number {
        const game = this.gameState?.getGame?.();
        const raw = game?.spriteOutlineColor;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            return Math.max(0, Math.min(15, Math.floor(raw)));
        }
        return DEFAULT_SPRITE_OUTLINE_COLOR_INDEX;
    }

    /** Outline uses the selected palette index so custom palettes recolor the silhouette. */
    getSpriteOutlineColor(): string {
        const index = this.getSpriteOutlineColorIndex();
        return this.paletteManager?.getColor(index) ?? DEFAULT_SPRITE_OUTLINE_COLOR;
    }

    /** Project Visuals checkbox; defaults to off when unset. */
    isSpriteOutlineEnabled(): boolean {
        const game = this.gameState?.getGame?.();
        if (!game) return false;
        return game.spriteOutline === true;
    }

    /** Empty / transparent cells are not filled and may receive outline. */
    isEmptyPixel(col: string | null | undefined): boolean {
        return !col || col === 'transparent';
    }

    private readEnableEffectsFlag(): boolean | undefined {
        if (!this.gameState?.getGame) return undefined;
        return this.gameState.getGame().enableEffects;
    }

    isTileEffectsEnabled(): boolean {
        return this.tileEffects.isEnabled(this.readEnableEffectsFlag());
    }

    getTileVisualEffect(
        tile: { category?: string; name?: string; visualEffect?: string } | null | undefined
    ): TileVisualEffect {
        return this.tileEffects.resolveEffect(tile, this.readEnableEffectsFlag());
    }

    // Re-exported color helpers (used by tests / callers that previously lived here).
    parseColor = parseColor;
    colorLuminance = colorLuminance;
    modulateColor = modulateColor;
    mixColors = mixColors;
    buildLavaHeightField = buildLavaHeightField;

    /**
     * Draw an 8x8-style pixel matrix with optional in-bounds silhouette outline.
     * Used for both entity sprites and tiles that contain transparent cells.
     * Outline never expands outside the matrix bounds (no bleed into neighbors).
     */
    drawPixelGrid(
        ctx: CanvasRenderingContext2D,
        pixels: (string | null)[][],
        px: number,
        py: number,
        step: number
    ) {
        if (pixels.length === 0) return;

        const height = pixels.length;
        const width = pixels[0]?.length ?? 0;
        if (width === 0) return;

        if (this.isSpriteOutlineEnabled()) {
            ctx.fillStyle = this.getSpriteOutlineColor();
            for (let y = 0; y < height; y++) {
                const row = pixels[y];
                for (let x = 0; x < row.length; x++) {
                    if (this.isEmptyPixel(row[x])) continue;
                    for (const [dx, dy] of OUTLINE_DIRS) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        if (!this.isEmptyPixel(pixels[ny][nx])) continue;
                        ctx.fillRect(px + nx * step, py + ny * step, step, step);
                    }
                }
            }
        }

        for (let y = 0; y < height; y++) {
            const row = pixels[y];
            for (let x = 0; x < row.length; x++) {
                const col = row[x];
                if (this.isEmptyPixel(col)) continue;
                ctx.fillStyle = col as string;
                ctx.fillRect(px + x * step, py + y * step, step, step);
            }
        }
    }

    /**
     * Paint tile pixels, optionally with a registered canvas effect (water/lava/…).
     */
    drawTilePixels(
        ctx: CanvasRenderingContext2D,
        tile: { category?: string; name?: string; visualEffect?: string } | null | undefined,
        pixels: (string | null)[][],
        px: number,
        py: number,
        size: number
    ) {
        this.tileEffects.paintTile(
            this,
            ctx,
            tile,
            pixels,
            px,
            py,
            size,
            this.readEnableEffectsFlag()
        );
    }

    /**
     * Draw a pixel sprite with optional 1px outline (palette color 0).
     * Outline is clamped to the sprite grid so it never leaks into neighbors.
     */
    drawSprite(ctx: CanvasRenderingContext2D, sprite: (string | null)[][], px: number, py: number, step: number) {
        this.drawPixelGrid(ctx, sprite, px, py, step);
    }

    /** Reflect a world sprite only when the cell immediately below it is water. */
    drawWaterReflectionForSprite(
        ctx: CanvasRenderingContext2D,
        sprite: (string | null)[][],
        sourcePx: number,
        sourcePy: number,
        step: number,
        roomIndex: number,
        sourceTileX: number,
        sourceTileY: number
    ): void {
        const tileManager = this.tileManager;
        const tileMap = tileManager?.getTileMap?.(roomIndex);
        if (!tileMap || !tileManager) return;

        const waterTileX = Math.round(sourceTileX);
        const waterTileY = Math.round(sourceTileY) + 1;
        if (waterTileX < 0 || waterTileY < 0) return;

        const tileIds = [
            tileMap.overlay[waterTileY]?.[waterTileX],
            tileMap.ground[waterTileY]?.[waterTileX],
        ];
        const hasWater = tileIds.some((tileId) => {
            if (tileId === null) return false;
            return this.getTileVisualEffect(tileManager.getTile(tileId)) === 'water';
        });
        if (!hasWater) return;

        const size = this.getTilePixelSize();
        paintWaterReflection(
            ctx,
            this,
            sprite,
            sourcePx,
            sourcePy,
            step,
            waterTileX * size,
            waterTileY * size,
            size
        );
    }

    resolveTilePixels(tile: TileDefinition | null, frameOverride: number | null = null) {
        if (this.tileManager?.getTilePixels && tile) {
            return this.tileManager.getTilePixels(tile, frameOverride);
        }
        if (Array.isArray(tile?.frames) && tile.frames.length) {
            return tile.frames[0];
        }
        return Array.isArray(tile?.pixels) ? tile.pixels : null;
    }

    drawCustomTile(tileId: string | number, px: number, py: number, size: number, frameOverride: number | null = null) {
        if (!this.tileManager) return;
        const tile = this.tileManager.getTile(tileId);
        if (!tile) return;
        const pixels = this.resolveTilePixels(tile, frameOverride);
        if (!pixels) return;

        this.drawTilePixels(this.ctx, tile, pixels, px, py, size);
    }

    drawTileOnCanvas(canvas: HTMLCanvasElement, tile: TileDefinition | null, frameOverride: number | null = null) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pixels = this.resolveTilePixels(tile, frameOverride);
        if (!pixels) return;

        this.drawTilePixels(ctx, tile, pixels, 0, 0, canvas.width);
    }

    drawTilePreview(
        tileId: string | number,
        px: number,
        py: number,
        size: number,
        ctx: CanvasRenderingContext2D = this.ctx,
        frameOverride: number | null = null
    ) {
        if (!this.tileManager) return;
        const tile = this.tileManager.getTile(tileId);
        if (!tile) return;
        const pixels = this.resolveTilePixels(tile, frameOverride);
        if (!pixels) return;

        this.drawTilePixels(ctx, tile, pixels, px, py, size);
    }
}

export { RendererCanvasHelper };
export type { TileVisualEffect };
