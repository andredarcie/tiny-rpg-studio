import type { GameDefinition, RoomDefinition, VariableDefinition, CustomSpriteEntry, SkillCustomizationMap, OnlineConfig } from '../../../types/gameState';
import type { StateWorldManager } from './StateWorldManager';
import type { StateObjectManager, ObjectEntry } from './StateObjectManager';
import type { StateVariableManager } from './StateVariableManager';
import { SkillDefinitions } from '../definitions/SkillDefinitions';
import {
    normalizeBackgroundMusicVideoId,
    normalizeBackgroundMusicVolume,
} from '../../infra/share/BackgroundMusicVideoId';
import {
    normalizeCustomTileEffects,
    normalizeTileVisualEffect,
    type CustomTileEffectDefinition,
    type TileVisualEffectKind,
} from '../definitions/customTileEffects';

/** Default outline palette index (PICO-8 dark blue). */
export const DEFAULT_SPRITE_OUTLINE_COLOR_INDEX = 1;

/** Clamp outline palette index to 0–15; invalid values become the default. */
export function normalizeSpriteOutlineColor(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SPRITE_OUTLINE_COLOR_INDEX;
    return Math.max(0, Math.min(15, Math.floor(n)));
}

type StateDataManagerOptions = {
    game: GameDefinition;
    worldManager: StateWorldManager;
    objectManager: StateObjectManager;
    variableManager: StateVariableManager;
};

type ImportData = {
    title?: string;
    author?: string;
    palette?: string[];
    customPalette?: string[];
    backgroundMusicVideoId?: string;
    backgroundMusicVolume?: unknown;
    hideHud?: boolean;
    enableEffects?: boolean;
    spriteOutline?: boolean;
    spriteOutlineColor?: number;
    disableSkills?: boolean;
    disablePixelFont?: boolean;
    roomSize?: number;
    world?: { rows?: number; cols?: number };
    rooms?: RoomDefinition[];
    start?: { x?: number; y?: number; roomIndex?: number };
    sprites?: unknown[];
    enemies?: unknown[];
    items?: unknown[];
    objects?: ObjectEntry[];
    variables?: VariableDefinition[];
    exits?: unknown[];
    tileset?: {
        tiles?: unknown[];
        maps?: unknown;
        map?: unknown;
    };
    customSprites?: unknown[];
    skillOrder?: string[];
    skillCustomizations?: SkillCustomizationMap;
    online?: OnlineConfig;
    customTileEffects?: CustomTileEffectDefinition[];
    /** VERSION_36 share map: tileId → water|lava (applied after default tiles load). */
    tileVisualEffects?: Record<string, TileVisualEffectKind>;
};

class StateDataManager {
    game: GameDefinition;
    worldManager: StateWorldManager;
    objectManager: StateObjectManager;
    variableManager: StateVariableManager;

    constructor({ game, worldManager, objectManager, variableManager }: StateDataManagerOptions) {
        this.game = game;
        this.worldManager = worldManager;
        this.objectManager = objectManager;
        this.variableManager = variableManager;
    }

    setGame(game: GameDefinition): void {
        this.game = game;
    }

    setWorldManager(worldManager: StateWorldManager): void {
        this.worldManager = worldManager;
    }

    setObjectManager(objectManager: StateObjectManager): void {
        this.objectManager = objectManager;
    }

    setVariableManager(variableManager: StateVariableManager): void {
        this.variableManager = variableManager;
    }

    exportGameData(): ImportData {
        return {
            title: this.game.title,
            author: this.game.author,
            palette: this.game.palette,
            customPalette: this.game.customPalette,
            backgroundMusicVideoId: this.game.backgroundMusicVideoId,
            backgroundMusicVolume: normalizeBackgroundMusicVolume(this.game.backgroundMusicVolume),
            hideHud: Boolean(this.game.hideHud),
            // Default on; only persist explicit false so exports stay compact.
            enableEffects: this.game.enableEffects === false ? false : true,
            ...(normalizeCustomTileEffects(this.game.customTileEffects).length
                ? { customTileEffects: normalizeCustomTileEffects(this.game.customTileEffects) }
                : {}),
            spriteOutline: Boolean(this.game.spriteOutline),
            spriteOutlineColor: normalizeSpriteOutlineColor(this.game.spriteOutlineColor),
            disableSkills: Boolean(this.game.disableSkills),
            disablePixelFont: Boolean(this.game.disablePixelFont),
            roomSize: this.game.roomSize,
            world: this.game.world,
            rooms: this.game.rooms,
            start: this.game.start,
            sprites: this.game.sprites,
            enemies: this.game.enemies,
            // `collected` is run-time pickup state stored on the item; reset it in
            // the exported definition so play progress never leaks into the saved
            // or shared game.
            items: Array.isArray(this.game.items)
                ? this.game.items.map((item) => ({ ...item, collected: false }))
                : this.game.items,
            objects: this.game.objects,
            variables: this.game.variables,
            exits: this.game.exits,
            tileset: this.game.tileset,
            ...(Array.isArray(this.game.customSprites) && this.game.customSprites.length
                ? { customSprites: this.game.customSprites }
                : {}),
            ...(Array.isArray(this.game.skillOrder) && this.game.skillOrder.length
                ? { skillOrder: this.game.skillOrder }
                : {}),
            ...(this.game.skillCustomizations
                ? { skillCustomizations: this.game.skillCustomizations }
                : {}),
            ...(this.game.online?.enabled
                ? { online: this.game.online }
                : {}),
        };
    }

    importGameData(data: ImportData | null): { x: number; y: number; roomIndex: number } | null {
        if (!data) return null;

        const worldRows = 3;
        const worldCols = 3;
        const totalRooms = worldRows * worldCols;

        const customTileEffects = normalizeCustomTileEffects(data.customTileEffects);
        const existingTiles = Array.isArray(this.game.tileset.tiles) ? this.game.tileset.tiles : [];
        const rawTiles = Array.isArray(data.tileset?.tiles) ? data.tileset.tiles : existingTiles;
        const tilesetTiles = rawTiles.map((tile) => {
            if (!tile || typeof tile !== 'object' || Array.isArray(tile)) return tile;
            const clone = { ...(tile as Record<string, unknown>) };
            if (Object.prototype.hasOwnProperty.call(clone, 'visualEffect')) {
                clone.visualEffect = normalizeTileVisualEffect(clone.visualEffect, customTileEffects);
            }
            return clone;
        });
        const normalizedRooms = this.worldManager.normalizeRooms(data.rooms, totalRooms, worldCols);
        const normalizedMaps = this.worldManager.normalizeTileMaps(
            data.tileset?.maps ?? data.tileset?.map ?? null,
            totalRooms
        );
        const normalizedObjects = this.objectManager.normalizeObjects(data.objects);
        const normalizedVariables = this.variableManager.normalizeVariables(data.variables);

        const customPalette =
            Array.isArray(data.customPalette) && data.customPalette.length === 16
                ? data.customPalette.slice(0, 16)
                : undefined;

        Object.assign(this.game, {
            title: typeof data.title === 'string' ? data.title.slice(0, 18) : "My Tiny RPG Game",
            author: typeof data.author === 'string' ? data.author.slice(0, 18) : "",
            palette: Array.isArray(data.palette) && data.palette.length >= 3 ? data.palette.slice(0, 3) : ['#000000', '#1D2B53', '#FFF1E8'],
            customPalette,
            backgroundMusicVideoId: normalizeBackgroundMusicVideoId(data.backgroundMusicVideoId),
            backgroundMusicVolume: normalizeBackgroundMusicVolume(data.backgroundMusicVolume),
            hideHud: Boolean(data.hideHud),
            // Missing means enabled (default true for pre-v36 and new games).
            enableEffects: data.enableEffects === false ? false : true,
            customTileEffects: customTileEffects.length ? customTileEffects : undefined,
            spriteOutline: Boolean(data.spriteOutline),
            spriteOutlineColor: normalizeSpriteOutlineColor(data.spriteOutlineColor),
            disableSkills: Boolean(data.disableSkills),
            disablePixelFont: Boolean(data.disablePixelFont),
            roomSize: 8,
            world: { rows: worldRows, cols: worldCols },
            rooms: normalizedRooms,
            start: data.start || { x: 1, y: 1, roomIndex: 0 },
            sprites: Array.isArray(data.sprites) ? data.sprites : [],
            enemies: Array.isArray(data.enemies) ? data.enemies : [],
            items: Array.isArray(data.items) ? data.items : [],
            objects: normalizedObjects,
            variables: normalizedVariables,
            exits: Array.isArray(data.exits) ? data.exits : [],
            tileset: {
                tiles: tilesetTiles,
                maps: normalizedMaps
            }
        });

        this.game.tileset.map = this.game.tileset.maps[0];

        if (Array.isArray(data.customSprites)) {
            this.game.customSprites = data.customSprites as CustomSpriteEntry[];
        } else {
            this.game.customSprites = undefined;
        }

        if (Array.isArray(data.skillOrder) && data.skillOrder.length) {
            this.game.skillOrder = data.skillOrder.filter((id) => typeof id === 'string' && !!id);
        } else {
            this.game.skillOrder = undefined;
        }

        this.game.skillCustomizations = SkillDefinitions.sanitizeCustomizationMap(data.skillCustomizations);

        if (data.online?.enabled === true) {
            const spawnPoints = Array.isArray(data.online.spawnPoints)
                ? data.online.spawnPoints.filter(
                    (p) => typeof p.role === 'string' && typeof p.roomIndex === 'number' &&
                           typeof p.x === 'number' && typeof p.y === 'number'
                  )
                : [];
            this.game.online = { enabled: true, spawnPoints };
        } else {
            this.game.online = undefined;
        }

        // Stash share map for GameEngine/TileManager after ensureDefaultTiles().
        if (data.tileVisualEffects && typeof data.tileVisualEffects === 'object') {
            (this.game as GameDefinition & { tileVisualEffects?: Record<string, TileVisualEffectKind> }).tileVisualEffects =
                data.tileVisualEffects;
        } else {
            delete (this.game as GameDefinition & { tileVisualEffects?: unknown }).tileVisualEffects;
        }

        const start = {
            x: this.worldManager.clampCoordinate(data.start?.x ?? 1),
            y: this.worldManager.clampCoordinate(data.start?.y ?? 1),
            roomIndex: this.worldManager.clampRoomIndex(data.start?.roomIndex ?? 0)
        };
        this.game.start = start;

        this.worldManager.setGame(this.game);
        this.objectManager.setGame(this.game);
        this.variableManager.setGame(this.game);

        return start;
    }
}

export { StateDataManager };
