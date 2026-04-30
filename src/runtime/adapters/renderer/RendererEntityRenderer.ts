import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { GameConfig } from '../../../config/GameConfig';
import { bitmapFont } from './BitmapFont';
import { drawUnreadNpcDialogMarker, shouldDrawUnreadNpcDialogMarker } from './RendererNpcDialogMarker';

type FlashState = {
    color: string;
    startTime: number;
    duration: number;
};

type FlyingLifeSquare = {
    x: number;
    y: number;
    size: number;
    velocityY: number;
    opacity: number;
    startTime: number;
    duration: number;
};

class RendererEntityRenderer {
    gameState: GameStateApi;
    tileManager: TileManagerApi;
    spriteFactory: SpriteFactoryApi;
    canvasHelper: CanvasHelperApi;
    paletteManager: PaletteManagerApi;
    viewportOffsetY?: number;
    attackTelegraph?: { applyWindupOffset: (enemyId: string, x: number, y: number) => { x: number; y: number } };
    private flashStates: Map<string, FlashState>;
    private flyingLifeSquares: FlyingLifeSquare[];

    constructor(
        gameState: GameStateApi,
        tileManager: TileManagerApi,
        spriteFactory: SpriteFactoryApi,
        canvasHelper: CanvasHelperApi,
        paletteManager: PaletteManagerApi
    ) {
        this.gameState = gameState;
        this.tileManager = tileManager;
        this.spriteFactory = spriteFactory;
        this.canvasHelper = canvasHelper;
        this.paletteManager = paletteManager;
        this.flashStates = new Map();
        this.flyingLifeSquares = [];
    }

    setViewportOffset(offsetY = 0) {
        this.viewportOffsetY = Number.isFinite(offsetY) ? Math.max(0, offsetY) : 0;
    }

    /**
     * Flash an entity with a color overlay
     * @param entityId Entity identifier ('player' or enemy ID)
     * @param color Flash color (e.g., '#FF004D' for red)
     * @param duration Flash duration in milliseconds (optional, uses config default)
     */
    flashEntity(entityId: string, color: string, duration?: number): void {
        const flashDuration = duration ?? GameConfig.combat.hitFlashDuration;
        this.flashStates.set(entityId, {
            color,
            startTime: this.getNow(),
            duration: flashDuration
        });
    }

    /**
     * Check if an entity should flash and get the flash color
     * @param entityId Entity identifier
     * @returns Flash color if active, null otherwise
     */
    private getFlashColor(entityId: string): string | null {
        const flash = this.flashStates.get(entityId);
        if (!flash) return null;

        const now = this.getNow();
        const elapsed = now - flash.startTime;

        if (elapsed >= flash.duration) {
            this.flashStates.delete(entityId);
            return null;
        }

        return flash.color;
    }

    /**
     * Apply flash overlay to currently drawn sprite
     * @param ctx Canvas rendering context
     * @param color Flash color
     * @param x X position
     * @param y Y position
     * @param size Tile size
     */
    private applyFlashOverlay(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number): void {
        ctx.save();
        ctx.globalCompositeOperation = 'lighten';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, size, size);
        ctx.restore();
    }

    drawObjects(ctx: CanvasRenderingContext2D) {
        const game = this.gameState.getGame();
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const step = tileSize / 8;
        const objects = Array.isArray(game.objects) ? game.objects : [];
        const objectSprites = this.spriteFactory.getObjectSprites();
        const OT = ITEM_TYPES;

        for (const object of objects) {
            if (object.roomIndex !== player.roomIndex) continue;
            if (object.hiddenInRuntime) continue;

            if (object.hideWhenCollected && object.collected) continue;

            if (object.hideWhenOpened && object.opened) continue;

            if (object.hideWhenVariableOpen) {
                const isOpen = object.variableId
                    ? this.gameState.isVariableOn?.(object.variableId)
                    : false;
                if (isOpen) continue;
            }
            let sprite = objectSprites[object.type];
            if (object.type === OT.SWITCH && object.on) {
                sprite = objectSprites[`${object.type}--on`] || sprite;
            }
            if (!sprite) continue;
            const px = object.x * tileSize;
            const floatOffset = object.isCollectible && !object.collected
                ? this.getFloatingOffset(object.x, object.y, tileSize)
                : 0;
            const py = Math.round(object.y * tileSize + floatOffset);
            this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
        }
    }

    drawItems(ctx: CanvasRenderingContext2D) {
        const game = this.gameState.getGame();
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const now = this.getNow();

        ctx.fillStyle = this.paletteManager.getColor(2);
        for (const item of game.items) {
            if (item.roomIndex !== player.roomIndex || item.collected) continue;
            const phase = (item.x * 0.75 + item.y * 1.15) * 0.6;
            const floatOffset = Math.sin(now * 0.004 + phase) * tileSize * 0.1;
            const sizeScale = 0.5 + Math.sin(now * 0.006 + phase) * 0.03;
            const size = tileSize * sizeScale;
            const sizeOffset = (tileSize * 0.5 - size) / 2;
            const drawX = Math.round(item.x * tileSize + tileSize * 0.25 + sizeOffset);
            const drawY = Math.round(item.y * tileSize + tileSize * 0.25 + floatOffset + sizeOffset);
            ctx.fillRect(drawX, drawY, Math.round(size), Math.round(size));
        }
    }

    drawNPCs(ctx: CanvasRenderingContext2D) {
        const game = this.gameState.getGame();
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const step = tileSize / 8;
        const npcSprites = this.spriteFactory.getNpcSprites();

        for (const npc of game.sprites) {
            if (!npc.placed) continue;
            if (npc.roomIndex !== player.roomIndex) continue;
            const px = npc.x * tileSize;
            const py = npc.y * tileSize;
            let sprite = npcSprites[npc.type] || npcSprites.default;
            if (!sprite) continue;
            sprite = this.adjustSpriteHorizontally(player.x, npc.x, sprite);
            this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
            if (shouldDrawUnreadNpcDialogMarker(this.gameState, npc)) {
                drawUnreadNpcDialogMarker(ctx, this.paletteManager, px, py, tileSize);
            }
        }
    }

    drawEnemies(ctx: CanvasRenderingContext2D) {
        const enemies = this.gameState.getEnemies?.() as EnemyStateWithId[] | undefined;
        if (!enemies?.length) return;
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const step = tileSize / 8;
        enemies.forEach((enemy) => {
            if (enemy.roomIndex !== player.roomIndex) return;
            const baseSprite = this.spriteFactory.getEnemySprite(enemy.type);
            if (!baseSprite) return;
            const sprite = this.adjustSpriteHorizontally(enemy.x, enemy.lastX ?? enemy.x, baseSprite);

            // Apply wind-up animation offset (enemy pulls back before attacking)
            let px = enemy.x * tileSize;
            let py = enemy.y * tileSize;
            const enemyId = enemy.id || `${enemy.type}-${enemy.x}-${enemy.y}`;

            if (this.attackTelegraph) {
                const windupPos = this.attackTelegraph.applyWindupOffset(enemyId, px, py);
                px = windupPos.x;
                py = windupPos.y;
            }

            // Death animation: Rotation (0-500ms) + Fade + Float (500-1000ms)
            const isDying = typeof enemy.deathStartTime === 'number';
            if (isDying) {
                const elapsed = performance.now() - (enemy.deathStartTime as number);
                const deathDuration = 1000; // Total animation duration
                const rotationPhase = 500; // First 500ms: rotation only

                ctx.save();

                // Phase 1 (0-500ms): Rotate 90° clockwise (fall to side)
                if (elapsed < rotationPhase) {
                    const rotationProgress = elapsed / rotationPhase;
                    const angle = (Math.PI / 2) * rotationProgress; // 0 to 90 degrees
                    const centerX = px + tileSize / 2;
                    const centerY = py + tileSize / 2;
                    ctx.translate(centerX, centerY);
                    ctx.rotate(angle);
                    ctx.translate(-centerX, -centerY);
                } else {
                    // Phase 2 (500-1000ms): Fade out + Float upward
                    const fadeProgress = (elapsed - rotationPhase) / (deathDuration - rotationPhase);
                    ctx.globalAlpha = 1 - fadeProgress; // Fade from 1 to 0
                    py -= fadeProgress * tileSize * 0.5; // Float up half a tile

                    // Keep rotation at 90°
                    const centerX = px + tileSize / 2;
                    const centerY = py + tileSize / 2;
                    ctx.translate(centerX, centerY);
                    ctx.rotate(Math.PI / 2);
                    ctx.translate(-centerX, -centerY);
                }

                this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
                ctx.restore();
            } else {
                // Normal rendering (not dying)
                this.canvasHelper.drawSprite(ctx, sprite, px, py, step);

                // Apply hit flash effect (only if not dying)
                const flashColor = this.getFlashColor(enemyId);
                if (flashColor) {
                    this.applyFlashOverlay(ctx, flashColor, px, py, tileSize);
                }

                // Draw alert icon (only if not dying)
                this.drawEnemyAlert(ctx, enemy, px, py, tileSize);
            }
        });
    }

    /**
     * Draw life markers for all enemies in current room
     * Should be called AFTER drawing player to ensure markers are always visible
     */
    drawAllEnemyLivesMarkers(ctx: CanvasRenderingContext2D) {
        const enemies = this.gameState.getEnemies?.() as EnemyStateWithId[] | undefined;
        if (!enemies?.length) return;
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();

        enemies.forEach((enemy) => {
            if (enemy.roomIndex !== player.roomIndex) return;

            // Skip life markers for dying enemies
            const isDying = typeof enemy.deathStartTime === 'number';
            if (isDying) return;

            // Apply wind-up animation offset to life markers
            let px = enemy.x * tileSize;
            let py = enemy.y * tileSize;
            const enemyId = enemy.id || `${enemy.type}-${enemy.x}-${enemy.y}`;

            if (this.attackTelegraph) {
                const windupPos = this.attackTelegraph.applyWindupOffset(enemyId, px, py);
                px = windupPos.x;
                py = windupPos.y;
            }

            const currentLives = enemy.lives ?? 1;
            this.drawEnemyLivesMarkers(ctx, px, py, tileSize, currentLives);
        });
    }

    drawPlayer(ctx: CanvasRenderingContext2D) {
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const step = tileSize / 8;
        const px = player.x * tileSize;
        const py = player.y * tileSize;
        let sprite = this.spriteFactory.getPlayerSprite();
        if (!sprite) return;
        sprite = this.adjustSpriteHorizontally(player.x, player.lastX ?? player.x, sprite);
        const fadeStealth = this.shouldFadePlayerForStealth();
        if (fadeStealth) ctx.save();
        if (fadeStealth) ctx.globalAlpha = 0.45;
        this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
        if (fadeStealth) ctx.restore();

        // Apply hit flash effect
        const flashColor = this.getFlashColor('player');
        if (flashColor) {
            this.applyFlashOverlay(ctx, flashColor, px, py, tileSize);
        }

        // Player lives are shown in HUD - no need for squares above head
    }

    drawTileIconOnPlayer(ctx: CanvasRenderingContext2D, tileId: string) {
        const objectSprites = this.spriteFactory.getObjectSprites();
        const tileSprite = objectSprites[tileId];
        if (!tileSprite) return;

        const player = this.gameState.getPlayer();
        let tileSize = this.canvasHelper.getTilePixelSize();
        tileSize = tileSize / 2;
        const step = tileSize / 8;
        const px = (player.x+0.2) * tileSize * 2;
        const py = (player.y-1) * tileSize * 2;
        this.canvasHelper.drawSprite(ctx, tileSprite, px, py, step);
    }

    adjustSpriteHorizontally(targetX: number, baseX: number, sprite: Sprite) {
        if (targetX < baseX) {
            return this.spriteFactory.turnSpriteHorizontally(sprite);
        }
        return sprite;
    }

    getFloatingOffset(x: number, y: number, tileSize: number) {
        const phase = (x * 0.7 + y * 1.3) * 0.6;
        return Math.sin(this.getNow() * 0.003 + phase) * tileSize * 0.12;
    }

    getNow() {
        const perf = (globalThis as Partial<typeof globalThis>).performance;
        if (perf) {
            return perf.now();
        }
        return Date.now();
    }

    getEnemyDamage(type: string): number {
        const direct = EnemyDefinitions.getEnemyDefinition(type);
        if (direct && Number.isFinite(direct.damage)) {
            return Math.max(1, direct.damage);
        }
        const normalized = EnemyDefinitions.normalizeType(type);
        const normalizedDef = EnemyDefinitions.getEnemyDefinition(normalized);
        if (normalizedDef && Number.isFinite(normalizedDef.damage)) {
            return Math.max(1, normalizedDef.damage);
        }
        return 1;
    }

    shouldFadePlayerForStealth() {
        if (!this.gameState.hasSkill?.('stealth')) return false;
        const enemies = this.gameState.getEnemies?.() ?? [];
        const playerRoom = this.gameState.getPlayer().roomIndex;
        return enemies.some((enemy) => enemy.roomIndex === playerRoom && this.getEnemyDamage(enemy.type) <= 2);
    }

    drawEnemyLivesMarkers(ctx: CanvasRenderingContext2D, px: number, py: number, tileSize: number, lives: number) {
        if (lives <= 0) return; // Don't draw if enemy is dead

        const markers = Math.max(1, Math.floor(lives));
        // Larger size for better visibility (was tileSize/8, now tileSize/5)
        const size = Math.max(3, Math.floor(tileSize / 5));
        const gap = Math.max(2, Math.floor(size * 0.4));
        const totalWidth = markers * size + (markers - 1) * gap;
        const startX = Math.round(px + tileSize / 2 - totalWidth / 2);
        // Position much higher above the enemy sprite to avoid overlap
        const startY = Math.round(py - size - gap * 4);

        // Better contrast: light gray fill with black border
        const fill = this.paletteManager.getColor(6) || '#C2C3C7'; // Light gray
        const stroke = '#000000'; // Black border

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;

        for (let i = 0; i < markers; i++) {
            const mx = startX + i * (size + gap);
            ctx.fillRect(mx, startY, size, size);
            ctx.strokeRect(mx + 0.5, startY + 0.5, size - 1, size - 1);
        }
    }

    /**
     * Spawn a flying life square animation when enemy loses a life
     * @param px Enemy pixel X position
     * @param py Enemy pixel Y position
     * @param tileSize Tile size in pixels
     * @param lostLifeIndex Index of the life that was lost (0 = first square)
     */
    spawnFlyingLifeSquare(px: number, py: number, tileSize: number, lostLifeIndex: number): void {
        const size = Math.max(3, Math.floor(tileSize / 5));
        const gap = Math.max(2, Math.floor(size * 0.4));

        // Calculate position of the lost square
        const startX = Math.round(px + tileSize / 2);
        const squareX = startX + lostLifeIndex * (size + gap) - (lostLifeIndex * size) / 2;
        const startY = Math.round(py - size - gap * 4);

        this.flyingLifeSquares.push({
            x: squareX,
            y: startY,
            size: size,
            velocityY: -0.8, // Float upward
            opacity: 1.0,
            startTime: this.getNow(),
            duration: 600, // 600ms animation
        });
    }

    /**
     * Update and draw all flying life squares
     */
    drawFlyingLifeSquares(ctx: CanvasRenderingContext2D): void {
        const now = this.getNow();

        // Update and draw each flying square
        for (let i = this.flyingLifeSquares.length - 1; i >= 0; i--) {
            const square = this.flyingLifeSquares[i];
            const elapsed = now - square.startTime;

            // Remove if animation complete
            if (elapsed >= square.duration) {
                this.flyingLifeSquares.splice(i, 1);
                continue;
            }

            // Calculate progress (0 to 1)
            const progress = elapsed / square.duration;

            // Update position (float upward)
            square.y += square.velocityY;

            // Fade out (opacity from 1 to 0)
            square.opacity = 1 - progress;

            // Draw the flying square
            ctx.save();
            ctx.globalAlpha = square.opacity;

            const fill = this.paletteManager.getColor(6) || '#C2C3C7';
            const stroke = '#000000';

            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1;

            ctx.fillRect(square.x, square.y, square.size, square.size);
            ctx.strokeRect(square.x + 0.5, square.y + 0.5, square.size - 1, square.size - 1);

            ctx.restore();
        }
    }

    drawEnemyAlert(ctx: CanvasRenderingContext2D, enemy: EnemyState, px: number, py: number, tileSize: number) {
        const alertDuration: number = GameConfig.enemy.vision.alertDuration;
        const alertStart: number | null = typeof enemy.alertStart === 'number' ? enemy.alertStart : null;
        const alertUntil: number | null = typeof enemy.alertUntil === 'number' ? enemy.alertUntil : null;
        if (alertStart === null || alertUntil === null || alertDuration <= 0) return;

        const now = this.getNow();
        if (now >= alertUntil) return;
        const progress = Math.max(0, Math.min(1, (now - alertStart) / alertDuration));
        const iconAlpha = 0.6 + Math.sin(progress * Math.PI) * 0.4;

        const iconSize = Math.max(tileSize * 0.8, tileSize * 0.6);
        const iconX = px + tileSize / 2;
        const iconY = py - tileSize * 0.5;

        ctx.save();
        ctx.globalAlpha = iconAlpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconColor = this.paletteManager.getColor(9) || '#FFD600';
        // Icon scales with tile size intentionally so it matches the enemy sprite, not the UI font size.
        bitmapFont.drawText(ctx, '!', iconX, iconY, Math.max(8, Math.round(iconSize)), iconColor);
        ctx.restore();

    }

    cleanupEnemyLabels() {
        // Legacy no-op: labels are now rendered directly on the canvas.
    }
}

type Sprite = (string | null)[][];

type PlayerState = {
    roomIndex: number;
    x: number;
    y: number;
    lastX?: number;
};

type NpcState = {
    id?: string;
    placed?: boolean;
    roomIndex: number;
    x: number;
    y: number;
    type: string;
    text?: string;
    conditionText?: string;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};

type GameObjectState = {
    roomIndex: number;
    x: number;
    y: number;
    type: string;
    collected?: boolean;
    opened?: boolean;
    on?: boolean;
    variableId?: string | null;
    hiddenInRuntime?: boolean;
    hideWhenCollected?: boolean;
    hideWhenOpened?: boolean;
    hideWhenVariableOpen?: boolean;
    isCollectible?: boolean;
};

type ItemState = {
    roomIndex: number;
    x: number;
    y: number;
    collected?: boolean;
};

type EnemyState = {
    roomIndex: number;
    x: number;
    y: number;
    lastX?: number;
    type: string;
    lives?: number;
    playerInVision?: boolean;
    alertUntil?: number | null;
    alertStart?: number | null;
    deathStartTime?: number | null;
};

type EnemyStateWithId = EnemyState & {
    id?: string;
};

type GameData = {
    objects: GameObjectState[];
    items: ItemState[];
    sprites: NpcState[];
};

type GameStateApi = {
    getGame: () => GameData;
    getPlayer: () => PlayerState;
    getEnemies?: () => EnemyState[];
    normalizeVariableId?: (id: string | null) => string | null;
    isVariableOn?: (id: string) => boolean;
    hasSkill?: (skillId: string) => boolean;
    hasUnreadNpcDialog?: (npcId: string, variantKey: string | null) => boolean;
};

type SpriteFactoryApi = {
    getObjectSprites: () => Record<string, Sprite | undefined>;
    getNpcSprites: () => Record<string, Sprite | undefined>;
    getEnemySprite: (type: string | null) => Sprite | null;
    getPlayerSprite: () => Sprite | null;
    turnSpriteHorizontally: (sprite: Sprite) => Sprite;
};

type CanvasHelperApi = {
    getTilePixelSize: () => number;
    drawSprite: (ctx: CanvasRenderingContext2D, sprite: Sprite | null, x: number, y: number, step: number) => void;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

type TileManagerApi = Record<string, unknown>;

export { RendererEntityRenderer };
