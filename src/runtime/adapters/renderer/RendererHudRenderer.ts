import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { GameConfig } from '../../../config/GameConfig';

class RendererHudRenderer {
    gameState: GameStateApi;
    entityRenderer: EntityRendererApi;
    paletteManager: PaletteManagerApi;
    padding: number;
    gap: number;
    backgroundColor: string;
    viewportOffsetY: number;
    canvasHelper: CanvasHelperApi;
    healthIconDefinitions: Record<string, (string | null)[][]>;
    objectSprites: Record<string, (string | null)[][] | undefined>;

    constructor(gameState: GameStateApi, entityRenderer: EntityRendererApi, paletteManager: PaletteManagerApi) {
        this.gameState = gameState;
        this.entityRenderer = entityRenderer;
        this.paletteManager = paletteManager;
        this.padding = GameConfig.hud.padding;
        this.gap = GameConfig.hud.gap;
        this.backgroundColor = GameConfig.hud.backgroundColor;
        this.viewportOffsetY = 0;
        this.canvasHelper = entityRenderer.canvasHelper;
        this.healthIconDefinitions = {};
        this.objectSprites = this.entityRenderer.spriteFactory?.getObjectSprites?.() || {};
        this.setupHealthIcons();
    }

    drawHUD(ctx: CanvasRenderingContext2D, area: HudArea = {}) {
        const width = area.width ?? ctx.canvas.width;
        const height = area.height ?? 16;
        const padding = area.padding ?? this.padding;
        const accent = this.paletteManager.getColor(7);

        ctx.save();
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        if (this.gameState.isGameOver()) {
            ctx.restore();
            return;
        }

        const label = this.getLevelLabel();
        const fontSize = area.fontSize ?? Math.max(6, Math.floor(height * 0.4));
        ctx.font = `${fontSize}px monospace`;
        ctx.textBaseline = 'middle';

        const mapCellSize = Math.max(4, Math.floor((height - padding * 2) / 3));
        const miniMapSize = mapCellSize * 3;
        const miniMapX = width - padding - miniMapSize;
        const miniMapY = Math.round(height / 2 - miniMapSize / 2);

        const labelWidth = label ? ctx.measureText(label).width : 0;
        const labelGap = label ? this.gap : 0;
        const rightReserved = miniMapSize + this.gap + labelWidth + labelGap;
        const availableWidth = Math.max(0, width - padding - rightReserved);

        const heartBaseSize = this.canvasHelper.getTilePixelSize();
        const maxLives = this.gameState.getMaxLives();
        const heartSize = Math.max(6, Math.min(height - padding * 2, heartBaseSize / 2));
        const heartStride = heartSize + 2;
        const minPerRow = maxLives > 0 ? Math.max(1, Math.ceil(maxLives / 2)) : 1;
        const heartsPerRow = Math.max(
            minPerRow,
            Math.floor(availableWidth / Math.max(heartStride, 1))
        );

        this.drawHealth(ctx, {
            offsetX: padding - 4,
            offsetY: padding + Math.max(0, (height - padding * 2 - heartSize) / 2) - 2,
            heartsPerRow,
            heartSize,
            gap: 2
        });

        if (label) {
            ctx.fillStyle = accent;
            ctx.textAlign = 'right';
            ctx.fillText(label, miniMapX - this.gap, height / 2);
        }

        this.drawMiniMap(ctx, miniMapX, miniMapY, mapCellSize, miniMapSize);
        this.drawXpBar(ctx,miniMapX-30,miniMapY+miniMapSize)

        ctx.restore();
    }

    drawInventory(ctx: CanvasRenderingContext2D, area: HudArea = {}) {
        const width = area.width ?? ctx.canvas.width;
        const height = area.height ?? 16;
        const padding = area.padding ?? this.padding;
        const offsetX = area.x ?? 0;
        const offsetY = area.y ?? 0;
        const gap = Number.isFinite(area.gap) ? Math.max(0, area.gap as number) : 2;
        const maxSlots = Math.min(9, this.gameState.getMaxKeys());
        let keys = this.gameState.getKeys();
        keys = Math.max(0, Math.min(maxSlots, keys));
        const swordShield = Math.max(0, this.gameState.getDamageShield());
        const swordShieldMax = Math.max(0, this.gameState.getDamageShieldMax());
        const swordType = this.gameState.getSwordType() || null;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        if (this.gameState.isGameOver()) {
            ctx.restore();
            return;
        }

        const baseSize = this.canvasHelper.getTilePixelSize();
        const availableHeight = Math.max(0, height - padding * 2);
        const maxIconSize = Math.max(6, Math.min(availableHeight, baseSize / 2));
        const fittedIconSize = Math.min(
            maxIconSize,
            Math.floor((availableHeight + gap) / 3 - gap)
        );
        const iconSize = Math.max(6, fittedIconSize);
        const iconsStride = iconSize + gap;
        const iconsPerRow = 3;
        const rows = 3;
        const gridHeight = rows * iconsStride - gap;
        const startX = padding;
        const startY = padding + Math.max(0, (height - padding * 2 - gridHeight) / 2);
        const keySprite = this.objectSprites[ITEM_TYPES.KEY];
        if (keys > 0 && keySprite) {
            const totalKeys = Math.min(keys, maxSlots);
            for (let i = 0; i < totalKeys; i++) {
                const row = Math.floor(i / iconsPerRow);
                const col = i % iconsPerRow;
                const px = startX + col * iconsStride;
                const py = startY + row * iconsStride;
                const step = iconSize / 8;
                this.canvasHelper.drawSprite(ctx, keySprite, px, py, step);
            }
        }

        const swordSprite = this.getSwordHudSprite(swordType);
        if (swordShield > 0 && swordSprite) {
            const tileSize = this.canvasHelper.getTilePixelSize();
            const swordSize = tileSize;
            const swordX = width - padding - swordSize;
            const swordY = padding + Math.max(0, Math.round((height - padding * 2 - swordSize) / 2));
            const step = swordSize / 8;
            const alpha = swordShieldMax > 0 ? Math.max(0.25, Math.min(1, swordShield / swordShieldMax)) : 1;
            ctx.save();
            ctx.globalAlpha = alpha;
            this.canvasHelper.drawSprite(ctx, swordSprite, swordX, swordY, step);
            ctx.restore();
        }

        ctx.restore();
    }

    getSwordHudSprite(swordType: string | null) {
        const sprites = this.objectSprites;
        if (swordType && sprites[swordType]) {
            return sprites[swordType];
        }
        return null;
    }

    drawHealth(ctx: CanvasRenderingContext2D, options: HealthOptions = {}) {
        const currentLives = this.gameState.getLives();
        const maxLives = this.gameState.getMaxLives();

        const offsetX = Number.isFinite(options.offsetX) ? (options.offsetX as number) : 0;
        const offsetY = Number.isFinite(options.offsetY) ? (options.offsetY as number) : 0;
        const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap as number) : 0;
        const heartsPerRow = Number.isFinite(options.heartsPerRow)
            ? Math.max(1, Math.floor(options.heartsPerRow as number))
            : 5;

        const tilePixelSize = this.canvasHelper.getTilePixelSize();
        let iconSize = Number.isFinite(options.heartSize) && (options.heartSize as number) > 0
            ? (options.heartSize as number)
            : tilePixelSize / 2;
        iconSize = Math.max(4, iconSize);
        const step = iconSize / 8;

        for (let i = 0; i < maxLives; i++) {
            const sprite = i < currentLives
                ? this.healthIconDefinitions.full
                : this.healthIconDefinitions.empty;
            const row = Math.floor(i / heartsPerRow);
            const col = i % heartsPerRow;
            const px = offsetX + col * (iconSize + gap);
            const py = offsetY + row * (iconSize + gap);
            this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
        }
    }

    getLevelLabel() {
        const level = this.gameState.getLevel();
        if (!Number.isFinite(level)) {
            return null;
        }
        return `LVL ${Math.max(1, Math.floor(level))}`;
    }

    drawMiniMap(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number, mapSize: number) {
        const rows = 3;
        const cols = 3;
        const bgColor = 'rgba(255,255,255,0.08)';
        const borderColor = 'rgba(255,255,255,0.25)';
        const activeColor = '#64b5f6';

        ctx.save();
        ctx.translate(x, y);

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(-2, -2, mapSize + 4, mapSize + 4);

        const game = this.gameState.getGame();
        const worldRows = Math.max(1, game.world?.rows || 1);
        const worldCols = Math.max(1, game.world?.cols || 1);
        const playerRoom = this.gameState.getPlayer().roomIndex ?? 0;
        const playerRow = Math.floor(playerRoom / worldCols);
        const playerCol = playerRoom % worldCols;
        const rowChunk = Math.max(1, Math.ceil(worldRows / rows));
        const colChunk = Math.max(1, Math.ceil(worldCols / cols));
        const activeRow = Math.min(rows - 1, Math.floor(playerRow / rowChunk));
        const activeCol = Math.min(cols - 1, Math.floor(playerCol / colChunk));

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const px = c * cellSize;
                const py = r * cellSize;
                ctx.fillStyle = r === activeRow && c === activeCol ? activeColor : bgColor;
                ctx.fillRect(px, py, cellSize, cellSize);
                ctx.strokeStyle = borderColor;
                ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
            }
        }

        ctx.restore();
    }

    drawXpBar(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const xpNeeded = this.gameState.getExperienceToNext();
        if (!Number.isFinite(xpNeeded) || xpNeeded <= 0) {
            return;
        }
        const totalBarSize = 24;
        ctx.strokeStyle = 'rgba(204, 204, 204, 0.25)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x+totalBarSize, y);
        ctx.stroke();

        const currentXp = this.gameState.getExperience();
        if (currentXp === 0) {return;}
        const barSize = (currentXp * totalBarSize / xpNeeded);

        ctx.strokeStyle = this.paletteManager.getColor(13);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x+barSize, y);
        ctx.stroke();
    }

    setupHealthIcons() {
        const white = this.paletteManager.getColor(7);
        const red = this.paletteManager.getColor(8);
        this.healthIconDefinitions = {
            full: [
                [ null, null, null, null, null, null, null, null ],
                [ null, null, null, null, null, null, null, null ],
                [ null, null,red,red, null,red,red, null ],
                [ null,red,red,red,red,red,white,red ],
                [ null,red,red,red,red,red,red,red ],
                [ null, null,red,red,red,red,red, null ],
                [ null, null, null,red,red,red, null, null ],
                [ null, null, null, null,red, null, null, null ]
            ],
            empty: [
                [ null, null, null, null, null, null, null, null ],
                [ null, null, null, null, null, null, null, null ],
                [ null, null,red,red, null,red,red, null ],
                [ null,red,null,null,red,null,null,red ],
                [ null,red,null,null,null,null,null,red ],
                [ null, null,red,null,null,null,red, null ],
                [ null, null, null,red,null,red, null, null ],
                [ null, null, null, null,red, null, null, null ]
            ]
        }
    }
}

type HudArea = {
    width?: number;
    height?: number;
    padding?: number;
    fontSize?: number;
    gap?: number;
    x?: number;
    y?: number;
};

type HealthOptions = {
    offsetX?: number;
    offsetY?: number;
    gap?: number;
    heartsPerRow?: number;
    heartSize?: number;
};

type GameStateApi = {
    isGameOver: () => boolean;
    getMaxLives: () => number;
    getLives: () => number;
    getMaxKeys: () => number;
    getKeys: () => number;
    getDamageShield: () => number;
    getDamageShieldMax: () => number;
    getSwordType: () => string | null;
    getLevel: () => number;
    getGame: () => { world?: { rows?: number; cols?: number } };
    getPlayer: () => { roomIndex?: number };
    getExperienceToNext: () => number;
    getExperience: () => number;
};

type EntityRendererApi = {
    canvasHelper: CanvasHelperApi;
    spriteFactory?: { getObjectSprites?: () => Record<string, (string | null)[][]> };
};

type CanvasHelperApi = {
    getTilePixelSize: () => number;
    drawSprite: (
        ctx: CanvasRenderingContext2D,
        sprite: (string | null)[][],
        x: number,
        y: number,
        step: number
    ) => void;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

export { RendererHudRenderer };
