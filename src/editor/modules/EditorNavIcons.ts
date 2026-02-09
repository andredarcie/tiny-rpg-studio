import type { GameEngine } from '../../runtime/services/GameEngine';

type TileDefinition = {
    id: number | string;
    name?: string;
    category?: string;
};

/**
 * Renders tile icons in the editor mobile navigation tabs
 */
export class EditorNavIcons {
    private gameEngine: GameEngine;

    constructor(gameEngine: GameEngine) {
        this.gameEngine = gameEngine;
    }

    /**
     * Renders all navigation icons
     */
    renderAll(): void {
        const navIcons = document.querySelectorAll<HTMLCanvasElement>('.nav-icon[data-nav-icon]');

        navIcons.forEach(canvas => {
            const iconType = canvas.dataset.navIcon;
            if (!iconType) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Render appropriate sprite
            switch (iconType) {
                case 'tree':
                    this.renderTree(ctx);
                    break;
                case 'water':
                    this.renderWater(ctx);
                    break;
                case 'sword':
                    this.renderSword(ctx);
                    break;
                case 'oldMage':
                    this.renderOldMage(ctx);
                    break;
                case 'rat':
                    this.renderRat(ctx);
                    break;
                case 'scroll':
                    this.renderScroll(ctx);
                    break;
            }
        });
    }

    private renderTree(ctx: CanvasRenderingContext2D): void {
        // Tree tile - ID 8
        const tiles = this.gameEngine.getTiles() as TileDefinition[];
        const treeTile = tiles.find(t => t.id === 8);
        if (treeTile && ctx.canvas) {
            this.gameEngine.renderer.drawTileOnCanvas(ctx.canvas, treeTile);
        }
    }

    private renderWater(ctx: CanvasRenderingContext2D): void {
        // Water tile - ID 5
        const tiles = this.gameEngine.getTiles() as TileDefinition[];
        const waterTile = tiles.find(t => t.id === 5);
        if (waterTile && ctx.canvas) {
            this.gameEngine.renderer.drawTileOnCanvas(ctx.canvas, waterTile);
        }
    }

    private renderSword(ctx: CanvasRenderingContext2D): void {
        // Steel sword
        const objectSprites = this.gameEngine.renderer.spriteFactory.getObjectSprites();
        const swordSprite = objectSprites['sword'];
        if (swordSprite) {
            this.drawSprite(ctx, swordSprite);
        }
    }

    private renderOldMage(ctx: CanvasRenderingContext2D): void {
        // Old mage (human)
        const npcSprites = this.gameEngine.renderer.spriteFactory.getNpcSprites();
        const oldMageSprite = npcSprites['old-mage'];
        if (oldMageSprite) {
            this.drawSprite(ctx, oldMageSprite);
        }
    }

    private renderRat(ctx: CanvasRenderingContext2D): void {
        // Giant rat enemy
        const enemySprites = this.gameEngine.renderer.spriteFactory.getEnemySprites();
        const ratSprite = enemySprites['giant-rat'];
        if (ratSprite) {
            this.drawSprite(ctx, ratSprite);
        }
    }

    private renderScroll(ctx: CanvasRenderingContext2D): void {
        // XP scroll
        const objectSprites = this.gameEngine.renderer.spriteFactory.getObjectSprites();
        const scrollSprite = objectSprites['xp-scroll'];
        if (scrollSprite) {
            this.drawSprite(ctx, scrollSprite);
        }
    }

    private drawSprite(ctx: CanvasRenderingContext2D, sprite: (string | null)[][]): void {
        const spriteSize = sprite.length;
        const canvasSize = 16;
        const pixelSize = canvasSize / spriteSize;

        for (let y = 0; y < spriteSize; y++) {
            for (let x = 0; x < spriteSize; x++) {
                const color = sprite[y][x];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        Math.floor(x * pixelSize),
                        Math.floor(y * pixelSize),
                        Math.ceil(pixelSize),
                        Math.ceil(pixelSize)
                    );
                }
            }
        }
    }
}
