import { RendererPalette } from './renderer/RendererPalette';
import { RendererSpriteFactory } from './renderer/RendererSpriteFactory';
import { RendererCanvasHelper } from './renderer/RendererCanvasHelper';
import { RendererTileRenderer } from './renderer/RendererTileRenderer';
import { RendererEntityRenderer } from './renderer/RendererEntityRenderer';
import { RendererDialogRenderer } from './renderer/RendererDialogRenderer';
import { RendererHudRenderer } from './renderer/RendererHudRenderer';
import { RendererEffectsManager } from './renderer/RendererEffectsManager';
import { RendererTransitionManager } from './renderer/RendererTransitionManager';
import { RendererOverlayRenderer } from './renderer/RendererOverlayRenderer';
import { RendererCombatAnimator } from './renderer/RendererCombatAnimator';
import { RendererCameraShake } from './renderer/RendererCameraShake';
import { RendererFloatingText } from './renderer/RendererFloatingText';
import { RendererParticleSystem } from './renderer/RendererParticleSystem';
import { RendererAttackTelegraph } from './renderer/RendererAttackTelegraph';
import type { TileDefinition } from '../domain/definitions/tileTypes';
import { GameConfig } from '../../config/GameConfig';
import { DebugFlags } from '../debug/DebugFlags';

type SpriteMatrix = (string | null)[][];
type SpriteMap = Record<string, SpriteMatrix | undefined>;

type RendererGameState = {
    isPickupOverlayActive?: () => boolean;
    isLevelUpCelebrationActive?: () => boolean;
    isLevelUpOverlayActive?: () => boolean;
    getPlayer?: () => { roomIndex: number; x: number; y: number };
    getEnemies?: () => { id?: string; roomIndex: number; x: number; y: number; lastX: number; lastY?: number }[];
    isGameOver: () => boolean;
    isEditorModeActive?: () => boolean;
};

type RendererEngine = {
    isIntroVisible?: () => boolean;
};

type TileManagerApi = {
    getAnimationFrameCount: () => number;
    advanceAnimationFrame: () => number;
};

/**
 * Renderer coordena módulos especializados para desenhar a cena.
 */
class Renderer {
    canvas!: HTMLCanvasElement;
    ctx!: CanvasRenderingContext2D | null;
    hudBarHeight!: number;
    inventoryBarHeight!: number;
    totalHudHeight!: number;
    gameplayHeight!: number;
    gameplayOffsetY!: number;
    inventoryOffsetY!: number;
    gameplayCanvasBounds!: { width: number; height: number };
    gameState!: RendererGameState;
    gameEngine!: RendererEngine | null;
    tileManager!: TileManagerApi;
    npcManager!: Record<string, unknown>;
    paletteManager!: RendererPalette;
    spriteFactory!: RendererSpriteFactory;
    canvasHelper!: RendererCanvasHelper;
    tileRenderer!: RendererTileRenderer;
    entityRenderer!: RendererEntityRenderer;
    dialogRenderer!: RendererDialogRenderer;
    hudRenderer!: RendererHudRenderer;
    effectsManager!: RendererEffectsManager;
    transitionManager!: RendererTransitionManager;
    overlayRenderer!: RendererOverlayRenderer;
    combatAnimator!: RendererCombatAnimator;
    cameraShake!: RendererCameraShake;
    floatingText!: RendererFloatingText;
    particleSystem!: RendererParticleSystem;
    attackTelegraph!: RendererAttackTelegraph;
    drawIconIdNextFrame: string;
    timeIconOverPlayer: number;
    tileAnimationInterval: number;
    tileAnimationTimer: ReturnType<typeof setInterval> | null;

    constructor(
        canvas: HTMLCanvasElement,
        gameState: RendererGameState,
        tileManager: TileManagerApi,
        npcManager: Record<string, unknown>,
        gameEngine: RendererEngine | null = null
    ) {
        this.canvas = canvas;
        const tilePixelSize = Math.max(
            GameConfig.canvas.minTileSize,
            Math.floor(this.canvas.width / GameConfig.world.roomSize)
        );
        this.hudBarHeight = Math.max(
            GameConfig.canvas.minHudHeight,
            Math.round(tilePixelSize * GameConfig.canvas.hudHeightMultiplier)
        );
        this.inventoryBarHeight = Math.max(
            GameConfig.canvas.minInventoryHeight,
            Math.round(tilePixelSize * GameConfig.canvas.inventoryHeightMultiplier)
        );
        this.totalHudHeight = this.hudBarHeight + this.inventoryBarHeight;
        this.gameplayHeight = tilePixelSize * GameConfig.world.roomSize;
        const desiredHeight = this.gameplayHeight + this.totalHudHeight;
        if (this.canvas.height !== desiredHeight) {
            this.canvas.height = desiredHeight;
        }
        this.ctx = canvas.getContext("2d");
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = false;
        }
        this.gameplayOffsetY = this.hudBarHeight;
        this.inventoryOffsetY = this.hudBarHeight + this.gameplayHeight;
        this.gameplayCanvasBounds = {
            width: this.canvas.width,
            height: this.gameplayHeight
        };

        this.gameState = gameState;
        this.gameEngine = gameEngine;
        this.tileManager = tileManager;
        this.npcManager = npcManager;

        this.paletteManager = new RendererPalette(gameState as never);
        this.spriteFactory = new RendererSpriteFactory(this.paletteManager, gameState as never);
        this.canvasHelper = new RendererCanvasHelper(canvas, this.ctx as CanvasRenderingContext2D, tileManager as never);
        this.tileRenderer = new RendererTileRenderer(gameState as never, tileManager as never, this.paletteManager, this.canvasHelper);
        this.entityRenderer = new RendererEntityRenderer(gameState as never, tileManager as never, this.spriteFactory as never, this.canvasHelper as never, this.paletteManager);
        this.entityRenderer.setViewportOffset(this.gameplayOffsetY);
        this.dialogRenderer = new RendererDialogRenderer(gameState as never, this.paletteManager);
        this.hudRenderer = new RendererHudRenderer(gameState as never, this.entityRenderer as never, this.paletteManager);
        this.effectsManager = new RendererEffectsManager(this as never);
        this.transitionManager = new RendererTransitionManager(this as never);
        this.overlayRenderer = new RendererOverlayRenderer(this as never);
        this.combatAnimator = new RendererCombatAnimator(this as never);
        this.cameraShake = new RendererCameraShake(this as never);
        this.floatingText = new RendererFloatingText(this as never);
        this.particleSystem = new RendererParticleSystem(this as never);
        this.attackTelegraph = new RendererAttackTelegraph(this as never);

        // Connect attack telegraph to entity renderer for wind-up animations
        this.entityRenderer.attackTelegraph = this.attackTelegraph;

        this.drawIconIdNextFrame = '';
        this.timeIconOverPlayer = GameConfig.animation.iconOverPlayerDuration;
        this.tileAnimationInterval = GameConfig.animation.tileInterval;
        this.tileAnimationTimer = null;
        this.startTileAnimationLoop();
    }

    /**
     * Debug visualization: Draw enemy vision range overlay
     */
    private drawEnemyVisionDebug(ctx: CanvasRenderingContext2D): void {
        if (!DebugFlags.showEnemyVision) return;

        const player = this.gameState.getPlayer?.();
        const enemies = this.gameState.getEnemies?.();
        if (!player || !enemies) return;

        const visionRange = GameConfig.enemy.vision.range;
        const roomSize = GameConfig.world.roomSize;
        const tileSize = this.canvasHelper.getTilePixelSize();

        enemies.forEach(enemy => {
            if (enemy.roomIndex !== player.roomIndex) return;

            // Calculate vision tiles based on directional vision
            for (let dx = -visionRange; dx <= visionRange; dx++) {
                for (let dy = -visionRange; dy <= visionRange; dy++) {
                    const tileX = enemy.x + dx;
                    const tileY = enemy.y + dy;

                    // Skip tiles outside room bounds
                    if (tileX < 0 || tileX >= roomSize || tileY < 0 || tileY >= roomSize) continue;

                    // Check if this tile is in enemy's vision using directional logic
                    const canSee = this.canEnemySeeTile(enemy, tileX, tileY);
                    if (!canSee) continue;

                    // Draw red transparent overlay on this tile
                    const screenX = tileX * tileSize;
                    const screenY = tileY * tileSize;

                    ctx.save();
                    ctx.fillStyle = GameConfig.debug.visionOverlayColor;
                    ctx.globalAlpha = GameConfig.debug.visionOverlayOpacity;
                    ctx.fillRect(screenX, screenY, tileSize, tileSize);
                    ctx.restore();
                }
            }
        });
    }

    /**
     * Check if enemy can see a specific tile based on directional vision
     * Uses same logic as EnemyManager.canEnemySeePlayer
     */
    private canEnemySeeTile(enemy: { x: number; y: number; lastX: number; lastY?: number }, tileX: number, tileY: number): boolean {
        // Get last known positions (default to current position if never set)
        const lastX = typeof enemy.lastX === 'number' ? enemy.lastX : enemy.x;
        const lastY = typeof enemy.lastY === 'number' ? enemy.lastY : enemy.y;

        // Calculate movement deltas
        const deltaX = enemy.x - lastX;
        const deltaY = enemy.y - lastY;

        // Determine which axis had more movement to decide primary facing direction
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Special case: if both deltas are 0 (stopped) and lastY exists, prefer vertical
        if (absDeltaX === 0 && absDeltaY === 0 && typeof enemy.lastY === 'number') {
            // Stopped with vertical tracking - face down by default
            return tileY >= enemy.y;
        }

        // If enemy is moving or has moved primarily horizontally
        if (absDeltaX >= absDeltaY) {
            // Facing direction based on X movement (or default to right if no movement)
            const facingRight = deltaX >= 0;
            // Can ONLY see in facing direction
            return facingRight ? tileX >= enemy.x : tileX <= enemy.x;
        } else {
            // Facing direction based on Y movement
            const facingDown = deltaY >= 0;
            // Can ONLY see in facing direction
            return facingDown ? tileY >= enemy.y : tileY <= enemy.y;
        }
    }

    draw() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const gameplayCanvas = this.gameplayCanvasBounds;
        const introActive = this.isIntroOverlayActive();
        const pickupOverlayActive = this.gameState.isPickupOverlayActive?.();
        const levelUpCelebrationActive = this.gameState.isLevelUpCelebrationActive?.();
        const levelUpOverlayActive = this.gameState.isLevelUpOverlayActive?.();
        ctx.save();
        // Apply camera shake offset
        const shakeOffset = this.cameraShake.getCurrentOffset();
        ctx.translate(shakeOffset.x, this.gameplayOffsetY + shakeOffset.y);

        if (this.transitionManager.isActive()) {
            this.transitionManager.drawFrame(ctx, gameplayCanvas);
        } else {
            this.tileRenderer.clearCanvas(ctx, gameplayCanvas);
            this.tileRenderer.drawBackground(ctx, gameplayCanvas);
            this.tileRenderer.drawTiles(ctx, gameplayCanvas);
            this.tileRenderer.drawWalls(ctx);
            this.effectsManager.drawEdgeFlash(ctx, gameplayCanvas);

            if (!introActive && !this.gameState.isGameOver()) {
                this.entityRenderer.drawObjects(ctx);
                this.entityRenderer.drawItems(ctx);
                this.entityRenderer.drawNPCs(ctx);
                // Debug: Draw enemy vision overlay before enemies
                this.drawEnemyVisionDebug(ctx);
                this.entityRenderer.drawEnemies(ctx);
                this.entityRenderer.drawPlayer(ctx);
                // Draw enemy life markers AFTER player to ensure they're always visible on top
                this.entityRenderer.drawAllEnemyLivesMarkers(ctx);
                // Draw combat effects after entities
                this.particleSystem.draw(ctx);
                this.entityRenderer.drawFlyingLifeSquares(ctx);
                this.floatingText.draw(ctx);
                if (this.drawIconIdNextFrame) {
                    this.drawTileIconOnPlayer(ctx, this.drawIconIdNextFrame);
                }
                if (!pickupOverlayActive && !levelUpOverlayActive && !levelUpCelebrationActive) {
                    this.dialogRenderer.drawDialog(ctx, gameplayCanvas);
                }
            }
        }
        if (introActive) {
            this.overlayRenderer.drawIntroOverlay(ctx, gameplayCanvas);
        } else if (levelUpCelebrationActive) {
            this.overlayRenderer.drawLevelUpCelebrationOverlay(ctx, gameplayCanvas);
        } else if (pickupOverlayActive) {
            this.overlayRenderer.drawPickupOverlay(ctx, gameplayCanvas);
        }
        ctx.restore();

        const topHudArea = {
            width: this.canvas.width,
            height: this.hudBarHeight
        };
        const bottomHudArea = {
            x: 0,
            y: this.inventoryOffsetY,
            width: this.canvas.width,
            height: this.inventoryBarHeight
        };

        if (introActive) {
            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, topHudArea.width, topHudArea.height);
            ctx.fillRect(bottomHudArea.x, bottomHudArea.y, bottomHudArea.width, bottomHudArea.height);
            ctx.restore();
        } else if (!levelUpOverlayActive) {
            this.hudRenderer.drawHUD(ctx, topHudArea);
            this.hudRenderer.drawInventory(ctx, bottomHudArea);
        }

        if (this.gameState.isGameOver()) {
            this.overlayRenderer.drawGameOverScreen();
            return;
        }

        if (levelUpOverlayActive) {
            this.overlayRenderer.drawLevelUpOverlayFull(ctx);
        }
    }

    // Métodos utilitários delegados
    getTilePixelSize() {
        return this.canvasHelper.getTilePixelSize();
    }

    getColor(idx: number) {
        return this.paletteManager.getColor(idx);
    }

    setIconOverPlayer(tileType: string) {
        this.drawIconIdNextFrame = tileType;
        setTimeout(() => {
            this.drawIconIdNextFrame = '';
        }, this.timeIconOverPlayer);
    }

    drawCustomTile(tileId: string | number, px: number, py: number, size: number) {
        this.canvasHelper.drawCustomTile(tileId, px, py, size);
    }

    drawSprite(ctx: CanvasRenderingContext2D, sprite: (string | null)[][], px: number, py: number, step: number) {
        this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
    }

    drawTileOnCanvas(canvas: HTMLCanvasElement, tile: TileDefinition | null) {
        this.canvasHelper.drawTileOnCanvas(canvas, tile);
    }

    drawTileIconOnPlayer(ctx: CanvasRenderingContext2D, tileId: string) {
        this.entityRenderer.drawTileIconOnPlayer(ctx, tileId);
    }

    drawTilePreviewAt(
        tileId: string | number,
        px: number,
        py: number,
        size: number,
        ctx: CanvasRenderingContext2D
    ) {
        this.canvasHelper.drawTilePreview(tileId, px, py, size, ctx);
    }

    setIntroData(data: { title?: string; author?: string } = {}) {
        this.overlayRenderer.setIntroData(data);
    }

    isIntroOverlayActive() {
        return Boolean(this.gameEngine?.isIntroVisible?.());
    }

    captureGameplayFrame() {
        if (typeof document === 'undefined') {
            return null;
        }
        const width = this.gameplayCanvasBounds.width;
        const height = this.gameplayCanvasBounds.height;
        const buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        const bufferCtx = buffer.getContext('2d');
        if (!bufferCtx) return null;
        bufferCtx.drawImage(
            this.canvas,
            0,
            this.gameplayOffsetY,
            width,
            height,
            0,
            0,
            width,
            height
        );
        return buffer;
    }

    isRoomTransitionActive() {
        return this.transitionManager.isActive();
    }

    startRoomTransition(options: Record<string, unknown> = {}) {
        return this.transitionManager.start(options);
    }

    flashEdge(direction: string, options: Record<string, unknown> = {}) {
        this.effectsManager.flashEdge(direction, options);
    }


    startTileAnimationLoop() {
        if (this.tileAnimationTimer) {
            clearInterval(this.tileAnimationTimer);
            this.tileAnimationTimer = null;
        }
        const interval = Math.max(
            GameConfig.animation.minInterval,
            this.tileAnimationInterval || 0
        );
        this.tileAnimationTimer = setInterval(() => this.tickTileAnimation(), interval);
    }

    tickTileAnimation() {
        if (this.gameState.isEditorModeActive?.()) return;
        const manager = this.tileManager;
        const totalFrames = manager.getAnimationFrameCount();
        if (totalFrames <= 1) return;
        const nextIndex = manager.advanceAnimationFrame();
        this.draw();
        try {
            if (typeof globalThis.dispatchEvent === 'function') {
                globalThis.dispatchEvent(new CustomEvent('tile-animation-frame', {
                    detail: { frameIndex: nextIndex }
                }));
            } else if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('tile-animation-frame', {
                    detail: { frameIndex: nextIndex }
                }));
            }
        } catch {
            if (typeof globalThis.dispatchEvent === 'function') {
                globalThis.dispatchEvent(new Event('tile-animation-frame'));
            } else if (typeof document !== 'undefined') {
                document.dispatchEvent(new Event('tile-animation-frame'));
            }
        }
    }

    showCombatIndicator(text: string, options: Record<string, unknown> = {}) {
        this.effectsManager.showCombatIndicator(text, options);
    }

    flashScreen(options: Record<string, unknown> = {}) {
        this.effectsManager.flashScreen(options);
    }

    /**
     * Spawn a flying life square animation when enemy loses a life
     * @param enemyX Enemy X position in tiles
     * @param enemyY Enemy Y position in tiles
     * @param lostLifeIndex Index of the life that was lost (rightmost square)
     */
    spawnEnemyLifeLoss(enemyX: number, enemyY: number, lostLifeIndex: number): void {
        const tileSize = this.canvasHelper.getTilePixelSize();
        const px = enemyX * tileSize;
        const py = enemyY * tileSize;
        this.entityRenderer.spawnFlyingLifeSquare(px, py, tileSize, lostLifeIndex);
    }

    /**
     * Apply grayscale filter to canvas for death effect
     */
    applyGrayscaleFilter(): void {
        this.canvas.style.filter = 'grayscale(100%)';
    }

    /**
     * Remove grayscale filter from canvas
     */
    removeGrayscaleFilter(): void {
        this.canvas.style.filter = '';
    }

    drawObjectSprite(
        ctx: CanvasRenderingContext2D,
        type: string,
        px: number,
        py: number,
        stepOverride?: number
    ) {
        const objectSprites = this.spriteFactory.getObjectSprites();
        const sprite = objectSprites[type];
        if (!sprite) return;
        const step = stepOverride || (this.canvasHelper.getTilePixelSize() / 8);
        this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
    }

    // Getters para compatibilidade com código existente que acessa sprites diretamente.
    get playerSprite(): SpriteMatrix | null {
        return this.spriteFactory.getPlayerSprite();
    }

    get npcSprites(): SpriteMap {
        return this.spriteFactory.getNpcSprites() as SpriteMap;
    }

    get enemySprites(): SpriteMap {
        return this.spriteFactory.getEnemySprites() as SpriteMap;
    }

    get enemySprite(): SpriteMatrix | null {
        return this.spriteFactory.getEnemySprite();
    }

    get objectSprites(): SpriteMap {
        return this.spriteFactory.getObjectSprites() as SpriteMap;
    }

    // Métodos preservados para compatibilidade.
    buildPlayerSprite() {
        return this.spriteFactory.getPlayerSprite();
    }

    buildNpcSprites() {
        return this.spriteFactory.getNpcSprites() as SpriteMap;
    }

    buildEnemySprite() {
        return this.spriteFactory.getEnemySprite();
    }

    buildObjectSprites() {
        return this.spriteFactory.getObjectSprites() as SpriteMap;
    }
}

export { Renderer };
