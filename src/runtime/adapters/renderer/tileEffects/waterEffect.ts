import { colorLuminance, normalizeTileLabel } from './colorUtils';
import type { TileEffectDefinition, TileEffectPaintContext, TileEffectSource } from './types';

/** Water body translucency — darker cells more see-through. */
const BODY_ALPHA_MIN = 0.32;
const BODY_ALPHA_MAX = 0.62;
const SPARKLE_ALPHA = 0.88;
const SPARKLE_LUMA = 0.72;
const DEPTH_TINT = 'rgba(30, 110, 200, 0.14)';
const SOFT_LIGHT_TINT = 'rgba(90, 170, 230, 0.18)';
const CAUSTIC_COLOR = 'rgba(200, 245, 255, 0.5)';
const SPECULAR_COLOR = 'rgba(255, 255, 255, 0.75)';
const WAVE_PERIOD_MS = 900;
const REFLECTION_ALPHA = 0.2;

function matchesHeuristic(tile: TileEffectSource): boolean {
    const category = normalizeTileLabel(tile.category || '');
    const name = normalizeTileLabel(tile.name || '');
    return category === 'agua' || name.includes('agua') || name.includes('water');
}

function paint(context: TileEffectPaintContext): void {
    const { ctx, host, pixels, px, py, step, size, timeMs } = context;
    if (pixels.length === 0) return;
    const height = pixels.length;
    const width = pixels[0]?.length ?? 0;
    if (width === 0) return;

    const t = timeMs / WAVE_PERIOD_MS;

    // Wet tint over whatever is already behind this tile.
    ctx.save();
    ctx.fillStyle = DEPTH_TINT;
    ctx.fillRect(px, py, size, size);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = SOFT_LIGHT_TINT;
    ctx.fillRect(px, py, size, size);
    ctx.restore();

    if (host.isSpriteOutlineEnabled()) {
        ctx.fillStyle = host.getSpriteOutlineColor();
        for (let y = 0; y < height; y++) {
            const row = pixels[y];
            for (let x = 0; x < row.length; x++) {
                if (host.isEmptyPixel(row[x])) continue;
                for (const [dx, dy] of [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                ] as const) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    if (!host.isEmptyPixel(pixels[ny][nx])) continue;
                    ctx.fillRect(px + nx * step, py + ny * step, step, step);
                }
            }
        }
    }

    // Body: luminance alpha + clear center (meniscus).
    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            const col = row[x];
            if (host.isEmptyPixel(col)) continue;
            const luma = colorLuminance(col as string);
            const alpha =
                luma >= SPARKLE_LUMA
                    ? SPARKLE_ALPHA
                    : BODY_ALPHA_MIN + (BODY_ALPHA_MAX - BODY_ALPHA_MIN) * luma;

            const nx = width <= 1 ? 0 : (x / (width - 1)) * 2 - 1;
            const ny = height <= 1 ? 0 : (y / (height - 1)) * 2 - 1;
            const edge = Math.min(1, Math.sqrt(nx * nx + ny * ny));
            const meniscus = 0.82 + edge * 0.28;
            const wave = 0.94 + 0.06 * Math.sin(x * 0.9 + y * 0.45 + t * Math.PI * 2);

            ctx.save();
            ctx.globalAlpha = Math.max(0.16, Math.min(0.95, alpha * meniscus * wave));
            ctx.fillStyle = col as string;
            ctx.fillRect(px + x * step, py + y * step, step, step);
            ctx.restore();
        }
    }

    paintSurfaceFx(ctx, host, pixels, px, py, step, width, height, t);
}

function paintSurfaceFx(
    ctx: CanvasRenderingContext2D,
    host: TileEffectPaintContext['host'],
    pixels: (string | null)[][],
    px: number,
    py: number,
    step: number,
    width: number,
    height: number,
    t: number
): void {
    // World offset so neighboring tiles do not share identical caustic lines.
    const worldPhase = (px * 0.07 + py * 0.11) * 0.01;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let y = 0; y < height; y++) {
        const row = pixels[y];
        for (let x = 0; x < width; x++) {
            if (host.isEmptyPixel(row[x])) continue;

            const caustic =
                Math.sin(x * 1.1 - y * 0.7 + t * Math.PI * 2 + worldPhase) *
                Math.sin(x * 0.35 + y * 1.3 + t * Math.PI * 1.4 + worldPhase * 1.3);
            if (caustic > 0.55) {
                ctx.globalAlpha = 0.22 + (caustic - 0.55) * 0.85;
                ctx.fillStyle = CAUSTIC_COLOR;
                ctx.fillRect(px + x * step, py + y * step, step, step);
            }

            const specular = Math.sin(x * 1.7 + y * 0.5 - t * Math.PI * 2.3 + worldPhase);
            if (specular > 0.82 && (x * 3 + y * 5 + Math.floor(t * 4)) % 5 === 0) {
                ctx.globalAlpha = 0.5 + (specular - 0.82) * 1.2;
                ctx.fillStyle = SPECULAR_COLOR;
                const fleck = Math.max(1, Math.floor(step * 0.35));
                const inset = Math.max(0, Math.floor((step - fleck) * 0.35));
                ctx.fillRect(px + x * step + inset, py + y * step + inset, fleck, fleck);
            }
        }
    }

    ctx.restore();
}

/** Paint a faint, vertically mirrored sprite inside a water tile. */
export function paintWaterReflection(
    ctx: CanvasRenderingContext2D,
    host: TileEffectPaintContext['host'],
    sprite: (string | null)[][],
    sourcePx: number,
    sourcePy: number,
    step: number,
    waterPx: number,
    waterPy: number,
    size: number
): void {
    if (sprite.length === 0) return;

    const spriteHeight = sprite.length * step;
    const reflectedPy = waterPy + (waterPy - (sourcePy + spriteHeight));

    ctx.save();
    ctx.beginPath();
    ctx.rect(waterPx, waterPy, size, size);
    ctx.clip();
    ctx.globalAlpha *= REFLECTION_ALPHA;
    host.drawPixelGrid(ctx, [...sprite].reverse(), sourcePx, reflectedPy, step);
    ctx.restore();
}

/** Translucent water surface with caustics / specular flecks. */
export const waterTileEffect: TileEffectDefinition = {
    id: 'water',
    matchesHeuristic,
    paint,
};
