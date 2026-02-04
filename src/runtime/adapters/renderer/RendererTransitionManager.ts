import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

type TransitionState = {
    active: boolean;
    direction?: string;
    fromFrame?: HTMLCanvasElement;
    toFrame?: HTMLCanvasElement;
    duration?: number;
    startTime?: number;
    playerPath?: PlayerPath | null;
    onComplete?: (() => void) | null;
    rafId?: number | null;
};

type TileCoords = {
    x: number;
    y: number;
    roomIndex?: number;
};

type PlayerPath = {
    from: TileCoords;
    to: TileCoords;
    facingLeft?: boolean;
};

type TransitionOptions = {
    fromFrame?: HTMLCanvasElement;
    toFrame?: HTMLCanvasElement;
    direction?: 'left' | 'right' | 'up' | 'down';
    duration?: number;
    playerPath?: PlayerPath | null;
    onComplete?: (() => void) | null;
};

class RendererTransitionManager extends RendererModuleBase {
    transition: TransitionState;

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.transition = { active: false };
    }

    get transitionGameState(): TransitionGameState {
        return this.gameState as TransitionGameState;
    }

    get transitionTileManager(): TransitionTileManagerApi {
        return this.tileManager as TransitionTileManagerApi;
    }

    get transitionPalette(): PaletteManagerApi {
        return this.paletteManager as PaletteManagerApi;
    }

    get transitionSpriteFactory(): SpriteFactoryApi {
        return this.spriteFactory as SpriteFactoryApi;
    }

    get transitionCanvasHelper(): CanvasHelperApi {
        return this.canvasHelper as CanvasHelperApi;
    }

    get transitionRenderer(): TransitionRendererApi {
        return this.renderer as unknown as TransitionRendererApi;
    }

    isActive() {
        return Boolean(this.transition.active);
    }

    start(options: TransitionOptions = {}) {
        const fromFrame = options.fromFrame;
        const toFrame = options.toFrame;
        if (!fromFrame || !toFrame) {
            options.onComplete?.();
            return false;
        }
        const direction = options.direction || 'right';
        const duration = Number.isFinite(options.duration)
            ? Math.max(GameConfig.transitions.roomMinDuration, options.duration as number)
            : GameConfig.transitions.roomDuration;
        const now = performance.now();

        if (this.transition.rafId) {
            globalThis.cancelAnimationFrame(this.transition.rafId);
        }

        this.removePlayerFromFrame(fromFrame, options.playerPath?.from);
        this.removePlayerFromFrame(toFrame, options.playerPath?.to);

        this.transition = {
            active: true,
            direction,
            fromFrame,
            toFrame,
            duration,
            startTime: now,
            playerPath: options.playerPath || null,
            onComplete: options.onComplete ?? null,
            rafId: null
        };

        this.transitionGameState.pauseGame('room-transition');

        this.transitionRenderer.draw();
        this.scheduleTick();
        return true;
    }

    scheduleTick() {
        const tick = () => {
            if (!this.isActive()) {
                return;
            }
            const progress = this.getProgress();
            if (progress >= 1) {
                this.finish();
                return;
            }
            this.transitionRenderer.draw();
            this.transition.rafId = globalThis.requestAnimationFrame(tick);
        };
        this.transition.rafId = globalThis.requestAnimationFrame(tick);
    }

    getProgress() {
        if (!this.transition.active) {
            return 1;
        }
        const now = performance.now();
        const elapsed = now - (this.transition.startTime ?? now);
        return Math.max(0, Math.min(1, elapsed / (this.transition.duration ?? 1)));
    }

    drawFrame(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }) {
        const transition = this.transition;
        if (!transition.active) return;
        const width = gameplayCanvas.width;
        const height = gameplayCanvas.height;
        const progress = this.getProgress();
        const deltaX = progress * width;
        const deltaY = progress * height;
        let fromX = 0;
        let fromY = 0;
        let toX = 0;
        let toY = 0;
        switch (transition.direction) {
            case 'left':
                fromX = deltaX;
                toX = deltaX - width;
                break;
            case 'right':
                fromX = -deltaX;
                toX = width - deltaX;
                break;
            case 'up':
                fromY = deltaY;
                toY = deltaY - height;
                break;
            case 'down':
                fromY = -deltaY;
                toY = height - deltaY;
                break;
            default:
                fromX = -deltaX;
                toX = width - deltaX;
                break;
        }
        ctx.save();
        ctx.fillStyle = this.transitionPalette.getColor(this.transitionGameState.getCurrentRoom().bg ?? 0);
        ctx.fillRect(0, 0, width, height);
        if (transition.fromFrame) {
            ctx.drawImage(transition.fromFrame, Math.round(fromX), Math.round(fromY));
        }
        if (transition.toFrame) {
            ctx.drawImage(transition.toFrame, Math.round(toX), Math.round(toY));
        }
        this.drawTransitionPlayer(ctx, gameplayCanvas, progress);
        ctx.restore();
        if (progress >= 1) {
            this.finish();
        }
    }

    removePlayerFromFrame(frameCanvas: HTMLCanvasElement, coords: TileCoords | null | undefined) {
        if (!coords) return;
        const ctx = frameCanvas.getContext('2d');
        if (!ctx) return;
        const tileSize = Math.max(1, Math.floor(frameCanvas.width / 8));
        const tileX = Math.max(0, Math.min(7, Math.floor(coords.x)));
        const tileY = Math.max(0, Math.min(7, Math.floor(coords.y)));
        const roomIndex = Math.max(
            0,
            Math.floor(
                Number(
                    Number.isFinite(coords.roomIndex)
                        ? coords.roomIndex
                        : this.transitionGameState.getPlayer().roomIndex
                )
            )
        );
        const game = this.transitionGameState.getGame() as { rooms?: Array<{ bg?: number } | undefined> };
        const rooms = Array.isArray(game.rooms) ? (game.rooms as Array<{ bg?: number } | undefined>) : [];
        const room = rooms[roomIndex];
        const roomBg = room?.bg;
        const bg = typeof roomBg === 'number' ? roomBg : 0;
        ctx.fillStyle = this.transitionPalette.getColor(bg);
        ctx.fillRect(tileX * tileSize, tileY * tileSize, tileSize, tileSize);
        this.drawTileStackOnContext(ctx, roomIndex, tileX, tileY, tileSize);
    }

    drawTransitionPlayer(ctx: CanvasRenderingContext2D, gameplayCanvas: { width: number; height: number }, progress: number) {
        const transition = this.transition;
        const path = transition.playerPath;
        if (!path) return;
        const tileSize = Math.max(1, Math.floor(gameplayCanvas.width / 8));
        const step = tileSize / 8;
        const x = path.from.x + (path.to.x - path.from.x) * progress;
        const y = path.from.y + (path.to.y - path.from.y) * progress;
        let sprite = this.transitionSpriteFactory.getPlayerSprite();
        let facingLeft = path.facingLeft;
        if (facingLeft === undefined) {
            facingLeft = path.to.x < path.from.x;
        }
        if (facingLeft) {
            sprite = this.transitionSpriteFactory.turnSpriteHorizontally(sprite);
        }
        this.transitionCanvasHelper.drawSprite(ctx, sprite, x * tileSize, y * tileSize, step);
    }

    drawTileStackOnContext(ctx: CanvasRenderingContext2D, roomIndex: number, tileX: number, tileY: number, tileSize: number) {
        const tileMap = this.transitionTileManager.getTileMap(roomIndex);
        if (!tileMap) return;
        const px = tileX * tileSize;
        const py = tileY * tileSize;
        const groundId = tileMap.ground?.[tileY]?.[tileX];
        if (groundId !== null && groundId !== undefined) {
            this.drawTilePixelsOnContext(ctx, groundId, px, py, tileSize);
        }
        const overlayId = tileMap.overlay?.[tileY]?.[tileX];
        if (overlayId !== null && overlayId !== undefined) {
            this.drawTilePixelsOnContext(ctx, overlayId, px, py, tileSize);
        }
    }

    drawTilePixelsOnContext(ctx: CanvasRenderingContext2D, tileId: string | number, px: number, py: number, size: number) {
        const pixels = this.transitionTileManager.getTilePixels(tileId);
        if (!pixels) return;
        const step = Math.max(1, Math.floor(size / 8));
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const col = pixels[y]?.[x];
                if (!col || col === 'transparent') continue;
                ctx.fillStyle = col;
                ctx.fillRect(px + x * step, py + y * step, step, step);
            }
        }
    }

    finish() {
        if (!this.transition.active) return;
        if (this.transition.rafId) {
            globalThis.cancelAnimationFrame(this.transition.rafId);
        }
        const callback = this.transition.onComplete;
        this.transition = { active: false };
        this.transitionGameState.resumeGame('room-transition');
        callback?.();
    }
}

export { RendererTransitionManager };

type TransitionRendererApi = {
    draw: () => void;
};

type TransitionGameState = {
    pauseGame: (reason: string) => void;
    resumeGame: (reason: string) => void;
    getCurrentRoom: () => { bg?: number };
    getPlayer: () => { roomIndex?: number };
    getGame: () => { rooms?: Array<{ bg?: number }> };
};

type TransitionTileManagerApi = {
    getTileMap: (roomIndex: number) => { ground?: (string | number | null)[][]; overlay?: (string | number | null)[][] } | null;
    getTilePixels: (tileId: string | number) => (string | null)[][] | null;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

type SpriteFactoryApi = {
    getPlayerSprite: () => (number | null)[][] | null;
    turnSpriteHorizontally: (sprite: (number | null)[][] | null) => (number | null)[][] | null;
};

type CanvasHelperApi = {
    drawSprite: (
        ctx: CanvasRenderingContext2D,
        sprite: (number | null)[][] | null,
        x: number,
        y: number,
        step: number
    ) => void;
};
