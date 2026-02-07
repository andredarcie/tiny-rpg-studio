import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { SpriteMatrixRegistry } from '../../domain/sprites/SpriteMatrixRegistry';
import { RendererConstants, type EnemyDefinition, type NpcDefinition, type ObjectDefinition, type SpriteMatrix } from './RendererConstants';

type Sprite = (string | null)[][];
type SpriteOrNull = Sprite | null;
type SpriteMap = Record<string, SpriteOrNull | undefined>;

type GameStateApi = Record<string, unknown> | null;

class RendererSpriteFactory {
    paletteManager: { getActivePalette: () => string[] };
    gameState: GameStateApi;
    playerSprite: SpriteOrNull;
    enemySprite: SpriteOrNull;
    enemySprites: SpriteMap | null;
    npcSprites: SpriteMap | null;
    objectSprites: SpriteMap | null;

    constructor(paletteManager: { getActivePalette: () => string[] }, gameState: GameStateApi = null) {
        this.paletteManager = paletteManager;
        this.gameState = gameState;
        this.playerSprite = null;
        this.enemySprite = null;
        this.enemySprites = null;
        this.npcSprites = null;
        this.objectSprites = null;
    }

    invalidate(): void {
        this.playerSprite = null;
        this.enemySprite = null;
        this.enemySprites = null;
        this.npcSprites = null;
        this.objectSprites = null;
    }

    getPlayerSprite(): SpriteOrNull {
        if (!this.playerSprite) {
            this.playerSprite = this.buildPlayerSprite();
        }
        return this.playerSprite;
    }

    getEnemySprite(type: string | null = null): SpriteOrNull {
        if (!this.enemySprites) {
            this.enemySprites = this.buildEnemySprites();
        }
        const sprites = this.enemySprites;
        if (type && sprites[type]) {
            return sprites[type];
        }
        if (type) {
            const normalized = EnemyDefinitions.normalizeType(type);
            if (sprites[normalized]) {
                return sprites[normalized];
            }
        }
        if (!this.enemySprite) {
            this.enemySprite = sprites.default || this.buildEnemySprite();
        }
        return this.enemySprite;
    }

    getEnemySprites(): SpriteMap {
        if (!this.enemySprites) {
            this.enemySprites = this.buildEnemySprites();
        }
        return this.enemySprites;
    }

    getNpcSprites(): SpriteMap {
        if (!this.npcSprites) {
            this.npcSprites = this.buildNpcSprites();
        }
        return this.npcSprites;
    }

    getObjectSprites(): SpriteMap {
        if (!this.objectSprites) {
            this.objectSprites = this.buildObjectSprites();
        }
        return this.objectSprites;
    }

    buildPlayerSprite(): SpriteOrNull {
        const activePalette = this.paletteManager.getActivePalette();
        const pixels = SpriteMatrixRegistry.get('player');
        return this.mapPixels(pixels, activePalette);
    }

    buildNpcSprites(): SpriteMap {
        const activePalette = this.paletteManager.getActivePalette();
        const sprites: SpriteMap = {};
        for (const def of RendererConstants.NPC_DEFINITIONS as NpcDefinition[]) {
            const matrix = def.sprite;
            sprites[def.type] = this.mapPixels(matrix, activePalette, () => this.buildDefaultNpcSprite(activePalette));
        }
        sprites.default = this.buildDefaultNpcSprite(activePalette);
        return sprites;
    }

    buildObjectSprites(): SpriteMap {
        const activePalette = this.paletteManager.getActivePalette();
        const sprites: SpriteMap = {};
        for (const def of RendererConstants.OBJECT_DEFINITIONS as ObjectDefinition[]) {
            if (!Array.isArray(def.sprite)) continue;
            sprites[def.type] = this.mapPixels(def.sprite, activePalette);
            if (Array.isArray(def.spriteOn)) {
                sprites[`${def.type}--on`] = this.mapPixels(def.spriteOn, activePalette);
            }
        }
        return sprites;
    }

    buildEnemySprites(): SpriteMap {
        const activePalette = this.paletteManager.getActivePalette();
        const defaultSprite = this.buildDefaultEnemySprite(activePalette);
        const sprites: SpriteMap = { default: defaultSprite };
        const definitions = RendererConstants.ENEMY_DEFINITIONS as EnemyDefinition[];
        if (Array.isArray(definitions)) {
            for (const def of definitions) {
                if (!Array.isArray(def.sprite)) continue;
                const sprite = this.mapPixels(def.sprite, activePalette, () => defaultSprite);
                sprites[def.type] = sprite;
                if (Array.isArray(def.aliases)) {
                    for (const alias of def.aliases) {
                        sprites[alias] = sprite;
                    }
                }
            }
        }
        return sprites;
    }

    buildDefaultNpcSprite(activePalette: string[]): SpriteOrNull {
        const pixels = SpriteMatrixRegistry.get('npc');
        return this.mapPixels(pixels, activePalette);
    }

    buildEnemySprite(): SpriteOrNull {
        const sprites = this.buildEnemySprites();
        this.enemySprites = sprites;
        this.enemySprite = sprites.default ?? null;
        return this.enemySprite;
    }

    buildDefaultEnemySprite(palette?: string[]): SpriteOrNull {
        const activePalette = palette || this.paletteManager.getActivePalette();
        const pixels = SpriteMatrixRegistry.get('enemy');
        return this.mapPixels(pixels, activePalette);
    }

    mapPixels(
        pixels: SpriteMatrix | null,
        palette: string[],
        fallbackBuilder?: () => Sprite | null
    ): SpriteOrNull {
        if (!Array.isArray(pixels)) {
            return fallbackBuilder
                ? fallbackBuilder()
                : null;
        }
        return pixels.map((row) =>
            row.map((value) => {
                if (value === null) return null;
                return palette[value] ?? null;
            })
        );
    }

    turnSpriteHorizontally(sprite: SpriteOrNull): SpriteOrNull {
        if (!sprite) return null;
        return sprite.map(line => [...line].reverse());
    }

}

export { RendererSpriteFactory };
