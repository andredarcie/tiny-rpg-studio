
import { ShareConstants } from '../runtime/infra/share/ShareConstants';
import { ShareEncoder } from '../runtime/infra/share/ShareEncoder';
import { RoomBuilder } from './RoomBuilder';
import type { SdkSharePayload } from './types';

class TinyRPGBuilder {
    private _rooms = new Map<number, RoomBuilder>();
    private _title?: string;
    private _author?: string;
    private _hideHud = false;
    private _start?: { x: number; y: number; roomIndex: number };
    private _palette?: string[];

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

    room(index: number): RoomBuilder {
        const max = ShareConstants.MAX_ROOM_INDEX;
        if (!Number.isInteger(index) || index < 0 || index > max) {
            throw new Error(`room index must be between 0 and ${max}, got ${index}`);
        }
        if (!this._rooms.has(index)) {
            this._rooms.set(index, new RoomBuilder());
        }
        return this._rooms.get(index)!;
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
            start: this._start,
            enemies,
            sprites,
            objects,
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
