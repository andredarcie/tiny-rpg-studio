import { ShareDecoder } from '../runtime/infra/share/ShareDecoder';
import { TileDefinitions } from '../runtime/domain/definitions/TileDefinitions';
import { StateWorldManager } from '../runtime/domain/state/StateWorldManager';
import { normalizeCustomTileEffects, createCustomTileEffect, type BaseTileEffectId, type CustomTileEffectColor, type CustomTileEffectDefinition, type CustomTileEffectId } from '../runtime/domain/definitions/customTileEffects';
import type { BaseProjectData, TileDefinition, TileId, SkillCustomizationMap } from './types';
import { validateBaseProject } from './validation';

import { ShareConstants } from '../runtime/infra/share/ShareConstants';
import { ShareEncoder } from '../runtime/infra/share/ShareEncoder';
import { SkillDefinitions } from '../runtime/domain/definitions/SkillDefinitions';
import { normalizeBackgroundMusicVideoId } from '../runtime/infra/share/BackgroundMusicVideoId';
import { RoomBuilder } from './RoomBuilder';
import { MAX_VARIABLES, variableId, resolveVariableId, type VariableRef } from './variables';
import type {
    CustomSpriteGroup,
    CustomSpriteVariant,
    SdkCustomSprite,
    SdkOnlineConfig,
    SdkSharePayload,
    SdkVariable,
} from './types';

const CUSTOM_SPRITE_GROUPS: CustomSpriteGroup[] = ['tile', 'npc', 'enemy', 'object', 'player'];

class TinyRPGBuilder {
    private _rooms = new Map<number, RoomBuilder>();
    private _basePalette = ['#000000', '#1D2B53', '#FFF1E8'];
    private _title?: string;
    private _author?: string;
    private _hideHud = false;
    private _spriteOutline = false;
    private _spriteOutlineColor = 1;
    private _disableSkills = false;
    private _disablePixelFont = false;
    private _backgroundMusicVideoId?: string;
    private _backgroundMusicVolume?: number;
    private _skillOrder?: string[];
    private _online?: SdkOnlineConfig;
    private _start?: { x: number; y: number; roomIndex: number };
    private _palette?: string[];
    private _variables: SdkVariable[] = [];
    private _enableEffects = true;
    private _showNewDialogExclamation = true;
    private _effects: CustomTileEffectDefinition[] = [];
    private _tiles: TileDefinition[] = structuredClone(TileDefinitions.TILE_PRESETS);
    private _skillCustomizations?: SkillCustomizationMap;
    private _customSprites: SdkCustomSprite[] = [];

    setTitle(title: string): this {
        if (title.length > 18) {
            throw new Error('title exceeds 18 characters and will be truncated');
        }
        this._title = title;
        return this;
    }

    setAuthor(author: string): this {
        if (author.length > 18) {
            throw new Error('author exceeds 18 characters and will be truncated');
        }
        this._author = author;
        return this;
    }

    hideHUD(hide = true): this {
        this._hideHud = hide;
        return this;
    }

    /** Draws a 1px palette outline around entity sprites (default on). */
    spriteOutline(enabled = true): this {
        this._spriteOutline = enabled;
        return this;
    }

    /** Palette index (0–15) used for the sprite outline color (default 1). */
    spriteOutlineColor(index: number): this {
        if (!Number.isInteger(index) || index < 0 || index > 15) {
            throw new Error(`spriteOutlineColor must be an integer in [0, 15], got ${index}`);
        }
        this._spriteOutlineColor = index;
        return this;
    }

    /** Disables the in-game skill/level-up system. */
    disableSkills(disable = true): this {
        this._disableSkills = disable;
        return this;
    }

    /** Renders text with the system font instead of the bitmap pixel font. */
    disablePixelFont(disable = true): this {
        this._disablePixelFont = disable;
        return this;
    }

    /**
     * Sets looping background music from a YouTube video id or URL.
     * `volume` is clamped to [0, 100] (default 100).
     */
    setBackgroundMusic(videoIdOrUrl: string, volume?: number): this {
        const normalized = normalizeBackgroundMusicVideoId(videoIdOrUrl);
        if (!normalized) {
            throw new Error(`Invalid YouTube video id or URL: '${videoIdOrUrl}'`);
        }
        if (volume !== undefined) {
            if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
                throw new Error(`volume must be an integer in [0, 100], got ${volume}`);
            }
            this._backgroundMusicVolume = volume;
        }
        this._backgroundMusicVideoId = normalized;
        return this;
    }

    /** Sets the order skills are offered in on level-up. Validates known skill ids. */
    setVariableDefault(ref: VariableRef | number, value: boolean, name?: string): this {
        const id = resolveVariableId(ref);
        const existing = this._variables.find(entry => entry.id === id);
        if (existing) { existing.value = value; if (name !== undefined) existing.name = name; }
        else this._variables.push({ id, value, name });
        return this;
    }

    setSkillOrder(ids: string[]): this {
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
            throw new Error('setSkillOrder expects an array of skill id strings');
        }
        const known = new Set(SkillDefinitions.SKILL_DEFINITION_DATA.map(s => s.id));
        const unknown = ids.filter(id => !known.has(id));
        if (unknown.length) {
            throw new Error(`Unknown skill id(s): ${unknown.join(', ')}`);
        }
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicates.length) {
            throw new Error(`Duplicate skill id(s): ${Array.from(new Set(duplicates)).join(', ')}`);
        }
        const normalized = SkillDefinitions.normalizeSkillOrder(ids);
        this._skillOrder = SkillDefinitions.isDefaultSkillOrder(normalized) ? undefined : normalized;
        return this;
    }

    enableOnline(config: Omit<SdkOnlineConfig, 'enabled'> = {}): this {
        for (const point of config.spawnPoints ?? []) {
            if (!['p1', 'p2'].includes(point.role)) throw Error('Spawn role must be p1 or p2');
            validateBaseProject({ start: point });
        }
        if (new Set(config.spawnPoints?.map(point => point.role)).size !== (config.spawnPoints?.length ?? 0)) throw Error('Duplicate spawn role');
        this._online = structuredClone({ ...config, enabled: true }); return this;
    }

    disableOnline(): this { this._online = undefined; return this; }
    clearOnlineSpawns(): this { if (this._online) this._online.spawnPoints = []; return this; }
    clearBackgroundMusic(): this { this._backgroundMusicVideoId = undefined; this._backgroundMusicVolume = undefined; return this; }
    clearPalette(): this { this._palette = undefined; return this; }
    clearSkillOrder(): this { this._skillOrder = undefined; return this; }
    enableEffects(enabled = true): this { this._enableEffects = enabled; return this; }
    showNewDialogExclamation(enabled = true): this { this._showNewDialogExclamation = enabled; return this; }
    setSkillCustomizations(value: SkillCustomizationMap | undefined): this {
        this._skillCustomizations = SkillDefinitions.sanitizeCustomizationMap(value); return this;
    }
    defineTile(tile: TileDefinition & { id: TileId }): this {
        const tiles = [...this._tiles.filter(entry => entry.id !== tile.id), structuredClone(tile)];
        validateBaseProject({ tileset: { tiles, maps: [] }, customTileEffects: this._effects });
        this._tiles = tiles; return this;
    }
    resetTile(id: TileId): this {
        const preset = TileDefinitions.TILE_PRESETS.find(entry => entry.id === id);
        if (!preset) throw Error('Use configureTile to edit custom tiles');
        this._tiles = this._tiles.map(entry => entry.id === id ? structuredClone(preset) : entry); return this;
    }

    configureTile(id: TileId, value: Partial<TileDefinition>): this {
        const index = this._tiles.findIndex(tile => tile.id === id);
        if (index < 0) throw Error('Unknown tile');
        const next = this._tiles.map((tile, i) => i === index ? { ...tile, ...structuredClone(value), id } : tile);
        validateBaseProject({ tileset: { tiles: next, maps: [] }, customTileEffects: this._effects });
        this._tiles = next; return this;
    }
    createTileEffect(name: string, passes: BaseTileEffectId[], color?: CustomTileEffectColor): CustomTileEffectId {
        const result = createCustomTileEffect(this._effects, name, passes, color);
        if (!result.ok) throw Error(result.error);
        this._effects.push(structuredClone(result.definition)); return result.definition.id;
    }
    replaceTileEffects(definitions: CustomTileEffectDefinition[]): this {
        const normalized = normalizeCustomTileEffects(definitions);
        if (normalized.length !== definitions.length) throw Error('Invalid custom effects');
        this._effects = structuredClone(normalized);
        for (const tile of this._tiles) if (tile.visualEffect?.startsWith('custom:')) tile.visualEffect = 'none';
        return this;
    }
    removeTileEffect(id: CustomTileEffectId): this {
        this._effects = this._effects.filter(effect => effect.id !== id);
        for (const tile of this._tiles) if (tile.visualEffect === id) tile.visualEffect = 'none';
        return this;
    }
    removeSprite(group: CustomSpriteGroup, key: string, variant: CustomSpriteVariant = 'base'): this {
        this._customSprites = this._customSprites.filter(entry => !(entry.group === group && entry.key === key && (entry.variant ?? 'base') === variant));
        return this;
    }

    setPlayerStart(opts: { x: number; y: number; room: number }): this {
        const maxCoord = ShareConstants.MATRIX_SIZE - 1;
        if (!Number.isInteger(opts.x) || opts.x < 0 || opts.x > maxCoord) {
            throw new Error(`x must be between 0 and ${maxCoord}, got ${opts.x}`);
        }
        if (!Number.isInteger(opts.y) || opts.y < 0 || opts.y > maxCoord) {
            throw new Error(`y must be between 0 and ${maxCoord}, got ${opts.y}`);
        }
        const maxRoom = ShareConstants.MAX_ROOM_INDEX;
        if (!Number.isInteger(opts.room) || opts.room < 0 || opts.room > maxRoom) {
            throw new Error(`room index must be between 0 and ${maxRoom}, got ${opts.room}`);
        }
        this._start = { x: opts.x, y: opts.y, roomIndex: opts.room };
        return this;
    }

    setPalette(colors: string[]): this {
        if (colors.length !== 16 || colors.some(c => !/^#[0-9a-fA-F]{6}$/.test(c))) {
            throw new Error("Palette must have exactly 16 colors in '#RRGGBB' format");
        }
        this._palette = colors.slice();
        return this;
    }

    /**
     * Allocates the next boolean variable slot (up to `var-16`) and returns a
     * handle to wire into switches, gates, doors, traps and plates.
     * `name` is the saved display label. Set `initial: true` to start it ON.
     */
    variable(name?: string, opts: { initial?: boolean } = {}): VariableRef {
        let index = 1;
        while (this._variables.some(entry => entry.id === `var-${index}`)) index++;
        const max = MAX_VARIABLES;
        if (index > max) {
            throw new Error(`Cannot allocate more than ${max} variables`);
        }
        const id = variableId(index);
        const entry = { id, value: opts.initial ?? false, name };
        validateBaseProject({ variables: [...this._variables, entry] });
        this._variables.push(entry);
        return { id, index, name };
    }

    /**
     * Defines custom pixel art for a sprite. Overrides a built-in sprite when
     * `group`+`key` match one (e.g. group `'enemy'`, key `'skeleton'`), or adds a
     * brand-new one. Each frame is a matrix of palette indices (0-15) or `null`
     * for transparency; multiple frames animate the sprite.
     */
    defineSprite(opts: {
        group: CustomSpriteGroup;
        key: string;
        variant?: CustomSpriteVariant;
        frames: (number | null)[][][];
    }): this {
        if (!CUSTOM_SPRITE_GROUPS.includes(opts.group)) {
            throw new Error(`Unknown sprite group '${opts.group}'. Valid: ${CUSTOM_SPRITE_GROUPS.join(', ')}`);
        }
        if (typeof opts.key !== 'string' || !opts.key.trim()) {
            throw new Error('defineSprite requires a non-empty key');
        }
        const variant = opts.variant as string | undefined;
        if (variant !== undefined && variant !== 'base' && variant !== 'on') {
            throw new Error(`Sprite variant must be 'base' or 'on', got '${opts.variant}'`);
        }
        if (!Array.isArray(opts.frames) || opts.frames.length === 0) {
            throw new Error('defineSprite requires at least one frame');
        }
        opts.frames.forEach((frame, fi) => {
            if (!Array.isArray(frame) || frame.length === 0) {
                throw new Error(`Frame ${fi} must be a non-empty matrix`);
            }
            const cols = frame[0].length;
            frame.forEach((row, ri) => {
                if (!Array.isArray(row) || row.length !== cols) {
                    throw new Error(`Frame ${fi} row ${ri} must have ${cols} columns (matrix must be rectangular)`);
                }
                row.forEach((value, ci) => {
                    if (value === null) return;
                    if (!Number.isInteger(value) || value < 0 || value > 15) {
                        throw new Error(`Frame ${fi} pixel (${ri}, ${ci}) must be an integer in [0, 15] or null, got ${value}`);
                    }
                });
            });
        });
        validateBaseProject({ customSprites: [opts] });
        this.removeSprite(opts.group, opts.key, opts.variant);
        this.removeSprite(opts.group, opts.key, opts.variant);
        this._customSprites.push({
            group: opts.group,
            key: opts.key,
            variant: opts.variant,
            frames: structuredClone(opts.frames),
        });
        return this;
    }

    room(index: number): RoomBuilder {
        const max = ShareConstants.MAX_ROOM_INDEX;
        if (!Number.isInteger(index) || index < 0 || index > max) {
            throw new Error(`room index must be between 0 and ${max}, got ${index}`);
        }
        let room = this._rooms.get(index);
        if (!room) {
            room = new RoomBuilder(index, incoming => {
                const data = this.buildPayload();
                data.sprites = [...(data.sprites ?? []).filter(entry => entry.roomIndex !== index), ...incoming.sprites];
                data.enemies = [...(data.enemies ?? []).filter(entry => entry.roomIndex !== index), ...incoming.enemies];
                data.objects = [...(data.objects ?? []).filter(entry => entry.roomIndex !== index), ...incoming.objects];
                validateBaseProject(data);
            });
            this._rooms.set(index, room);
        }
        return room;
    }

    toSharePayload(): SdkSharePayload {
        return this.buildPayload();
    }

    toProjectData(): BaseProjectData {
        const payload = this.buildPayload();
        const maps = (payload.tileset?.maps ?? []).map(map => ({
            ground: map.ground ?? Array.from({ length: 8 }, () => Array<number | null>(8).fill(0)),
            overlay: map.overlay ?? Array.from({ length: 8 }, () => Array<number | null>(8).fill(null)),
        }));
        return { ...payload, title: payload.title ?? 'My Tiny RPG Game', author: payload.author ?? '',
            roomSize: 8, world: { rows: 3, cols: 3 }, palette: this._basePalette.slice(), start: payload.start ?? { x: 1, y: 1, roomIndex: 0 },
            rooms: payload.rooms ?? [], sprites: payload.sprites ?? [], enemies: payload.enemies ?? [], objects: payload.objects ?? [],
            items: payload.items ?? [], exits: payload.exits ?? [], variables: Array.from({ length: MAX_VARIABLES }, (_, index) => payload.variables?.find(entry => entry.id === variableId(index + 1)) ?? { id: variableId(index + 1), value: false }),
            tileset: { tiles: payload.tileset?.tiles ?? [], maps, map: maps[0] },
        };

    }

    static fromShareCode(code: string): TinyRPGBuilder {
        const data = ShareDecoder.decodeShareCode(code);
        if (!data) throw Error('Invalid share code');
        if (Array.isArray(data.variables)) data.variables = data.variables.filter(entry => (entry as { id?: string }).id !== 'skill:bard');
        return this.fromProjectData(data);
    }

    static fromProjectData(input: unknown): TinyRPGBuilder {
        validateBaseProject(input);
        const data = structuredClone(input) as Omit<SdkSharePayload, 'tileset'> & { palette?: string[]; tileset?: Partial<NonNullable<SdkSharePayload['tileset']>> };
        const builder = new TinyRPGBuilder();
        builder._basePalette = data.palette ?? builder._basePalette;
        builder._title = data.title; builder._author = data.author;
        builder._hideHud = data.hideHud ?? false; builder._spriteOutline = data.spriteOutline ?? false;
        builder._spriteOutlineColor = data.spriteOutlineColor ?? 1; builder._disableSkills = data.disableSkills ?? false;
        builder._disablePixelFont = data.disablePixelFont ?? false; builder._enableEffects = data.enableEffects !== false;
        builder._showNewDialogExclamation = data.showNewDialogExclamation !== false;
        builder._backgroundMusicVideoId = data.backgroundMusicVideoId; builder._backgroundMusicVolume = data.backgroundMusicVolume;
        builder._skillOrder = data.skillOrder; builder._skillCustomizations = data.skillCustomizations;
        builder._online = data.online; builder._start = data.start; builder._palette = data.customPalette;
        builder._variables = data.variables ?? []; builder._customSprites = data.customSprites ?? [];
        builder._effects = data.customTileEffects ?? [];
        builder._tiles = data.tileset?.tiles?.length ? data.tileset.tiles : builder._tiles;
        const shareMetadata = data as SdkSharePayload & { tileVisualEffects?: Record<string, string>; tileMergeEdges?: string[]; tileCollisions?: Record<string, boolean> };
        for (const tile of builder._tiles) {
            const key = String(tile.id);
            if (shareMetadata.tileVisualEffects?.[key]) tile.visualEffect = shareMetadata.tileVisualEffects[key] as TileDefinition['visualEffect'];
            if (shareMetadata.tileMergeEdges?.includes(key)) tile.mergeEdges = true;
            if (shareMetadata.tileCollisions?.[key] !== undefined) tile.collision = shareMetadata.tileCollisions[key];
        }
        for (let index = 0; index < 9; index++) {
            const inRoom = <T extends { roomIndex: number }>(entries: T[] | undefined) => (entries ?? []).filter(entry => entry.roomIndex === index);
            builder.room(index)._load({ sprites: inRoom(data.sprites), enemies: inRoom(data.enemies), objects: inRoom(data.objects), items: inRoom(data.items), exits: inRoom(data.exits) }, data.tileset?.maps?.[index] ?? (data.tileset?.maps === undefined && index === 0 ? data.tileset?.map : undefined) ?? {}, data.rooms?.[index] ? { ...StateWorldManager.createEmptyRoom(8, index, 3), ...data.rooms[index], size: 8 } : undefined);
        }
        return builder;
    }

    private buildPayload(): SdkSharePayload {
        const count = ShareConstants.WORLD_ROOM_COUNT;
        const maps = Array.from({ length: count }, (_, i) => {
            const rb = this._rooms.get(i);
            return rb ? rb._getTileData() : {};
        });

        const enemies: SdkSharePayload['enemies'] = [];
        const sprites: SdkSharePayload['sprites'] = [];
        const objects: SdkSharePayload['objects'] = [];

        for (const [index, rb] of this._rooms) {
            const ent = rb._getEntities(index);
            enemies.push(...ent.enemies);
            sprites.push(...ent.sprites);
            objects.push(...(ent.objects as NonNullable<SdkSharePayload['objects']>));
        }

        const items = []; const exits = [];
        const rooms = StateWorldManager.createWorldRooms(3, 3, 8);
        for (const [index, rb] of this._rooms) {
            const extra = rb._getAdditional(index); items.push(...extra.items); exits.push(...extra.exits);
            if (extra.room) rooms[index] = extra.room;
        }
        const payload: SdkSharePayload = {
            enableEffects: this._enableEffects, showNewDialogExclamation: this._showNewDialogExclamation,
            customTileEffects: this._effects, skillCustomizations: this._skillCustomizations,
            rooms, items, exits,
            title: this._title,
            author: this._author,
            hideHud: this._hideHud,
            spriteOutline: this._spriteOutline,
            spriteOutlineColor: this._spriteOutlineColor !== 1 ? this._spriteOutlineColor : undefined,
            disableSkills: this._disableSkills,
            disablePixelFont: this._disablePixelFont,
            backgroundMusicVideoId: this._backgroundMusicVideoId,
            backgroundMusicVolume: this._backgroundMusicVolume,
            skillOrder: this._skillOrder,
            online: this._online,
            start: this._start,
            enemies,
            sprites,
            objects,
            variables: this._variables.length ? this._variables : undefined,
            customSprites: this._customSprites.length ? this._customSprites : undefined,
            tileset: { maps, tiles: this._tiles },
            customPalette: this._palette
        };
        validateBaseProject(payload);
        return structuredClone(payload);
    }

    toShareCode(): string {
        return ShareEncoder.buildShareCode(this.toProjectData());
    }

    buildURL(baseUrl?: string): string {
        const code = this.toShareCode();
        const base = baseUrl ?? 'https://andredarcie.github.io/tiny-rpg-studio/';
        return code ? `${base}#${code}` : base;
    }
}

export { TinyRPGBuilder };
