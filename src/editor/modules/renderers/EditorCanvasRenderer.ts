
import { EditorRendererBase } from './EditorRendererBase';
import { ITEM_TYPES } from '../../../runtime/domain/constants/itemTypes';

type CanvasObject = { type: string; roomIndex: number; x: number; y: number; variableId?: string | null };
type CanvasNpc = {
    type: string;
    roomIndex: number;
    x: number;
    y: number;
    placed?: boolean;
    conditionVariableId?: string | null;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};
type CanvasEnemy = { type: string; roomIndex: number; x: number; y: number; id?: string; defeatVariableId?: string | null };
type TileMapWithLayers = {
    ground?: (string | number | null)[][];
    overlay?: (string | number | null)[][];
};
type VariableDefinition = { id: string; color?: string | null };

class EditorCanvasRenderer extends EditorRendererBase {
    renderEditor(): void {
        const ctx = this.manager.ectx;
        const canvas = this.dom.editorCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tileSize = Math.floor(canvas.width / 8);
        const roomIndex = this.state.activeRoomIndex;
        const tileMap = (this.gameEngine.getTileMap(roomIndex) || {}) as TileMapWithLayers;
        const ground = tileMap.ground || [];
        const overlay = tileMap.overlay || [];

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const groundId = ground[y]?.[x];
                if (groundId !== null) {
                    this.drawTile(ctx, groundId, x * tileSize, y * tileSize, tileSize);
                } else {
                    ctx.fillStyle = '#141414';
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }

                const overlayId = overlay[y]?.[x];
                if (overlayId !== null) {
                    this.drawTile(ctx, overlayId, x * tileSize, y * tileSize, tileSize);
                }
            }
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        for (let x = 0; x <= 8; x++) {
            ctx.beginPath();
            ctx.moveTo(x * tileSize, 0);
            ctx.lineTo(x * tileSize, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= 8; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * tileSize);
            ctx.lineTo(canvas.width, y * tileSize);
            ctx.stroke();
        }

        this.drawEntities(tileSize);
    }

    drawEntities(tileSize: number): void {
        const ctx = this.manager.ectx;
        if (!ctx) return;
        const roomIndex = this.state.activeRoomIndex;
        const step = tileSize / 8;

        const objects = (this.gameEngine.getObjectsForRoom(roomIndex) ||
            []) as CanvasObject[];
        for (const object of objects) {
            if (object.type === ITEM_TYPES.PLAYER_START) {
                const sprite = this.gameEngine.renderer.spriteFactory.getPlayerSprite();
                if (sprite) this.gameEngine.renderer.canvasHelper.drawSprite(ctx, sprite, object.x * tileSize, object.y * tileSize, step);
            } else {
                this.gameEngine.renderer.drawObjectSprite(
                    ctx,
                    object.type,
                    object.x * tileSize,
                    object.y * tileSize,
                    step
                );
            }
            // Draw variable indicator outline
            if (object.variableId) {
                this.drawVariableOutline(ctx, object.x * tileSize, object.y * tileSize, tileSize, [object.variableId]);
            }
        }

        const npcs = (this.gameEngine.getSprites() as CanvasNpc[]).filter(
            (npc: CanvasNpc) => npc.roomIndex === roomIndex && npc.placed,
        );
        for (const npc of npcs) {
            const sprite =
                this.gameEngine.renderer.npcSprites[npc.type] ||
                this.gameEngine.renderer.npcSprites.default;
            if (!Array.isArray(sprite)) continue;
            this.gameEngine.renderer.drawSprite(
                ctx,
                sprite,
                npc.x * tileSize,
                npc.y * tileSize,
                step
            );
            // Draw variable indicator outlines
            const variableIds = [npc.conditionVariableId, npc.rewardVariableId, npc.conditionalRewardVariableId].filter((id): id is string => Boolean(id));
            if (variableIds.length > 0) {
                this.drawVariableOutline(ctx, npc.x * tileSize, npc.y * tileSize, tileSize, variableIds);
            }
        }

        const enemies = (this.gameEngine.getActiveEnemies() as CanvasEnemy[]).filter(
            (enemy: CanvasEnemy) => enemy.roomIndex === roomIndex,
        );
        const renderer = this.gameEngine.renderer;
        const enemySprites = renderer.enemySprites;
        for (const enemy of enemies) {
            const sprite = enemySprites[enemy.type] || renderer.enemySprite;
            if (!Array.isArray(sprite)) continue;
            renderer.drawSprite(
                ctx,
                sprite,
                enemy.x * tileSize,
                enemy.y * tileSize,
                step
            );
            // Draw variable indicator outline
            if (enemy.defeatVariableId) {
                this.drawVariableOutline(ctx, enemy.x * tileSize, enemy.y * tileSize, tileSize, [enemy.defeatVariableId]);
            }
        }
    }

    getVariableColor(variableId: string): string | null {
        const variables = this.gameEngine.getVariableDefinitions() as VariableDefinition[];
        const variable = variables.find((v) => v.id === variableId);
        if (!variable?.color) return null;
        const color = this.service.resolvePicoColor(variable.color);
        return typeof color === 'string' ? color : String(color);
    }

    drawVariableOutline(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, variableIds: string[]): void {
        const validColors = variableIds
            .map((id) => this.getVariableColor(id))
            .filter((color): color is string => color !== null);

        if (validColors.length === 0) return;

        const lineWidth = 2;
        const offset = lineWidth / 2;

        ctx.save();
        ctx.lineWidth = lineWidth;

        if (validColors.length === 1) {
            // Single outline for one variable
            ctx.strokeStyle = validColors[0];
            ctx.strokeRect(x + offset, y + offset, size - lineWidth, size - lineWidth);
        } else if (validColors.length === 2) {
            // Two outlines: outer and inner
            ctx.strokeStyle = validColors[0];
            ctx.strokeRect(x + offset, y + offset, size - lineWidth, size - lineWidth);

            const innerOffset = lineWidth * 2;
            ctx.strokeStyle = validColors[1];
            ctx.strokeRect(x + innerOffset, y + innerOffset, size - innerOffset * 2, size - innerOffset * 2);
        } else if (validColors.length >= 3) {
            // Three outlines: outer, middle, inner
            ctx.strokeStyle = validColors[0];
            ctx.strokeRect(x + offset, y + offset, size - lineWidth, size - lineWidth);

            const middleOffset = lineWidth * 2;
            ctx.strokeStyle = validColors[1];
            ctx.strokeRect(x + middleOffset, y + middleOffset, size - middleOffset * 2, size - middleOffset * 2);

            const innerOffset = lineWidth * 4;
            ctx.strokeStyle = validColors[2];
            ctx.strokeRect(x + innerOffset, y + innerOffset, size - innerOffset * 2, size - innerOffset * 2);
        }

        ctx.restore();
    }

    drawTile(ctx: CanvasRenderingContext2D, tileId: string | number, px: number, py: number, size: number): void {
        const tileManager = this.manager.gameEngine.tileManager;
        const tile = tileManager.getTile(tileId);
        if (!tile) return;
        const pixels = tileManager.getTilePixels(tile);
        if (!Array.isArray(pixels)) return;
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
}

export { EditorCanvasRenderer };
