import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';
import { FONT_SIZE } from '../../../config/FontConfig';
import { bitmapFont } from './BitmapFont';

type FloatingTextEntry = {
    text: string;
    x: number;
    y: number;
    startTime: number;
    duration: number;
    riseSpeed: number;
    color: string;
    fontSize: number;
};

type SpawnOptions = {
    color?: string;
    fontSize?: number;
    duration?: number;
    riseSpeed?: number;
};

/**
 * RendererFloatingText renders damage numbers rising from hit positions
 *
 * Text floats upward with linear fade, auto-cleaning when lifetime expires.
 */
class RendererFloatingText extends RendererModuleBase {
    private activeTexts: FloatingTextEntry[];

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.activeTexts = [];
    }

    /**
     * Spawn a new floating text at the specified position
     * @param text Text to display
     * @param x X position in pixel coordinates
     * @param y Y position in pixel coordinates
     * @param options Optional configuration
     */
    spawn(text: string, x: number, y: number, options: SpawnOptions = {}): void {
        if (!GameConfig.combat.floatingNumbers.enabled) {
            return;
        }

        const config = GameConfig.combat.floatingNumbers;

        const entry: FloatingTextEntry = {
            text: String(text),
            x,
            y,
            startTime: performance.now(),
            duration: options.duration ?? config.duration,
            riseSpeed: options.riseSpeed ?? config.riseSpeed,
            color: options.color ?? '#FF004D', // Red for player damage
            fontSize: options.fontSize ?? FONT_SIZE
        };

        this.activeTexts.push(entry);
    }

    /**
     * Spawn damage number at tile position
     * @param damage Damage amount to display
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @param options Optional configuration
     */
    spawnDamageNumber(damage: number, tileX: number, tileY: number, options: SpawnOptions = {}): void {
        const tileSize = 16;
        const pixelX = tileX * tileSize + tileSize / 2;
        const pixelY = tileY * tileSize;

        this.spawn(String(damage), pixelX, pixelY, {
            color: '#FF004D', // Red
            ...options
        });
    }

    /**
     * Draw all active floating texts
     * @param ctx Canvas rendering context
     */
    draw(ctx: CanvasRenderingContext2D | null): void {
        if (!ctx || this.activeTexts.length === 0) {
            return;
        }

        const now = performance.now();
        const toRemove: number[] = [];

        this.activeTexts.forEach((entry, index) => {
            const elapsed = now - entry.startTime;
            const progress = Math.min(1, elapsed / entry.duration);

            if (progress >= 1) {
                toRemove.push(index);
                return;
            }

            // Calculate position (rise upward)
            const riseDistance = entry.riseSpeed * elapsed;
            const currentY = entry.y - riseDistance;

            // Calculate opacity (linear fade)
            const opacity = 1 - progress;

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            bitmapFont.drawText(ctx, entry.text, entry.x, currentY, entry.fontSize, entry.color);
            ctx.restore();
        });

        // Remove expired texts (in reverse order to maintain indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activeTexts.splice(toRemove[i], 1);
        }
    }

    /**
     * Clear all active floating texts
     */
    clear(): void {
        this.activeTexts = [];
    }

    /**
     * Get count of active floating texts
     */
    getActiveCount(): number {
        return this.activeTexts.length;
    }
}

export { RendererFloatingText };
