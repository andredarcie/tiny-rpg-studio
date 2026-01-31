import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { GameConfig } from '../../../config/GameConfig';

class RendererEntityRenderer {
    gameState: GameStateApi;
    tileManager: TileManagerApi;
    spriteFactory: SpriteFactoryApi;
    canvasHelper: CanvasHelperApi;
    paletteManager: PaletteManagerApi;
    viewportOffsetY?: number;

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
    }

    setViewportOffset(offsetY = 0) {
        this.viewportOffsetY = Number.isFinite(offsetY) ? Math.max(0, offsetY) : 0;
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
        }
    }

    drawEnemies(ctx: CanvasRenderingContext2D) {
        const enemies = this.gameState.getEnemies?.() as EnemyState[] | undefined;
        if (!enemies?.length) return;
        const player = this.gameState.getPlayer();
        const tileSize = this.canvasHelper.getTilePixelSize();
        const step = tileSize / 8;
        enemies.forEach((enemy) => {
            if (enemy.roomIndex !== player.roomIndex) return;
            const baseSprite = this.spriteFactory.getEnemySprite(enemy.type);
            if (!baseSprite) return;
            const sprite = this.adjustSpriteHorizontally(enemy.x, enemy.lastX ?? enemy.x, baseSprite);
            const px = enemy.x * tileSize;
            const py = enemy.y * tileSize;
            this.canvasHelper.drawSprite(ctx, sprite, px, py, step);
            this.drawEnemyAlert(ctx, enemy, px, py, tileSize);

            const damage = this.getEnemyDamage(enemy.type);
            this.drawEnemyDamageMarkers(ctx, px, py, tileSize, damage);
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
        return enemies.some((enemy) => enemy.roomIndex === playerRoom && this.getEnemyDamage(enemy.type) <= 3);
    }

    drawEnemyDamageMarkers(ctx: CanvasRenderingContext2D, px: number, py: number, tileSize: number, damage: number) {
        const markers = Math.max(1, Math.floor(damage));
        const size = Math.max(2, Math.floor(tileSize / 8));
        const gap = Math.max(1, Math.floor(size / 2));
        const totalWidth = markers * size + (markers - 1) * gap;
        const startX = Math.round(px + tileSize / 2 - totalWidth / 2);
        const startY = Math.round(py - size - gap);
        const fill = '#000000';
        const stroke = this.paletteManager.getColor(6) || '#5F574F';
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        for (let i = 0; i < markers; i++) {
            const mx = startX + i * (size + gap);
            ctx.fillRect(mx, startY, size, size);
            ctx.strokeRect(mx + 0.5, startY + 0.5, size - 1, size - 1);
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
        const iconColor = this.paletteManager.getColor(9) || '#FFD600';
        ctx.fillStyle = iconColor;
        const iconFont = `${Math.max(12, Math.round(iconSize))}px "Press Start 2P", monospace`;
        ctx.font = iconFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', iconX, iconY);
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
    placed?: boolean;
    roomIndex: number;
    x: number;
    y: number;
    type: string;
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
    playerInVision?: boolean;
    alertUntil?: number | null;
    alertStart?: number | null;
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
    isVariableOn?: (id: string) => boolean;
    hasSkill?: (skillId: string) => boolean;
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
