
import { ShareConstants } from '../runtime/infra/share/ShareConstants';
import { ShareEncoder } from '../runtime/infra/share/ShareEncoder';
import { SkillDefinitions } from '../runtime/domain/definitions/SkillDefinitions';
import { normalizeBackgroundMusicVideoId } from '../runtime/infra/share/BackgroundMusicVideoId';
import { RoomBuilder } from './RoomBuilder';
import { MAX_VARIABLES, variableId, type VariableRef } from './variables';
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
    private _title?: string;
    private _author?: string;
    private _hideHud = false;
    private _spriteOutline = true;
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
    private _customSprites: SdkCustomSprite[] = [];

    setTitle(title: string): this {
        if (title.length > 80) {
            throw new Error('title exceeds 80 characters and will be truncated');
        }
        this._title = title;
        return this;
    }

    setAuthor(author: string): this {
        if (author.length > 60) {
            throw new Error('author exceeds 60 characters and will be truncated');
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
        this._backgroundMusicVideoId = normalized;
        if (volume !== undefined) {
            if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
                throw new Error(`volume must be an integer in [0, 100], got ${volume}`);
            }
            this._backgroundMusicVolume = volume;
        }
        return this;
    }

    /** Sets the order skills are offered in on level-up. Validates known skill ids. */
    setSkillOrder(ids: string[]): this {
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
            throw new Error('setSkillOrder expects an array of skill id strings');
        }
        const known = new Set(SkillDefinitions.SKILL_DEFINITION_DATA.map(s => s.id));
        const unknown = ids.filter(id => !known.has(id));
        if (unknown.length) {
            throw new Error(`Unknown skill id(s): ${unknown.join(', ')}`);
        }
        this._skillOrder = [...ids];
        return this;
    }

    /** Enables online multiplayer with optional spawn points. */
    enableOnline(config: Omit<SdkOnlineConfig, 'enabled'> = {}): this {
        this._online = { enabled: true, ...config };
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
        this._palette = colors;
        return this;
    }

    /**
     * Allocates the next boolean variable slot (`var-1`..`var-16`) and returns a
     * handle to wire into switches, gates, doors, traps and plates.
     * `name` is an authoring label only. Set `initial: true` to start it ON.
     */
    variable(name?: string, opts: { initial?: boolean } = {}): VariableRef {
        const index = this._variables.length + 1;
        if (index > MAX_VARIABLES) {
            throw new Error(`Cannot allocate more than ${MAX_VARIABLES} variables`);
        }
        const id = variableId(index);
        this._variables.push({ id, value: Boolean(opts.initial), name });
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
        this._customSprites.push({
            group: opts.group,
            key: opts.key,
            variant: opts.variant,
            frames: opts.frames,
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
            room = new RoomBuilder();
            this._rooms.set(index, room);
        }
        return room;
    }

    toSharePayload(): SdkSharePayload {
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

        return {
            title: this._title,
            author: this._author,
            hideHud: this._hideHud || undefined,
            spriteOutline: this._spriteOutline === false ? false : undefined,
            spriteOutlineColor: this._spriteOutlineColor !== 1 ? this._spriteOutlineColor : undefined,
            disableSkills: this._disableSkills || undefined,
            disablePixelFont: this._disablePixelFont || undefined,
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
            tileset: { maps },
            customPalette: this._palette
        };
    }

    toShareCode(): string {
        return ShareEncoder.buildShareCode(this.toSharePayload());
    }

    buildURL(baseUrl?: string): string {
        const code = this.toShareCode();
        const base = baseUrl ?? 'https://andredarcie.github.io/tiny-rpg-studio/';
        return code ? `${base}#${code}` : base;
    }
}

export { TinyRPGBuilder };
