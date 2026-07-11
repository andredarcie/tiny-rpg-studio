import type { CustomSpriteEntry, CustomSpriteFrame, CustomSpriteVariant } from '../../types/gameState';
import { CustomSpriteLookup } from '../../runtime/domain/sprites/CustomSpriteLookup';

export type SpritePackV1 = {
    format: 'tiny-rpg-studio-custom-sprites';
    version: 1;
    exportedAt?: string;
    engineHint?: string;
    sprites: CustomSpriteEntry[];
};

export type ParseResult =
    | { ok: true; sprites: CustomSpriteEntry[]; skipped: number; warnings: string[] }
    | { ok: false; error: string };

export type ApplyResult =
    | { ok: true; sprites: CustomSpriteEntry[] }
    | { ok: false; error: string };

export type SerializeResult =
    | { ok: true; text: string }
    | { ok: false; error: string };

const VALID_GROUPS = new Set<CustomSpriteEntry['group']>([
    'tile',
    'npc',
    'enemy',
    'object',
    'player',
]);

const VALID_VARIANTS = new Set<CustomSpriteVariant>(['base', 'on']);

export class CustomSpritesIO {
    static readonly FORMAT = 'tiny-rpg-studio-custom-sprites' as const;
    static readonly VERSION = 1 as const;
    /** Share-codec safe (1-byte count in ShareEncoder). */
    static readonly MAX_ENTRIES = 255;
    static readonly MAX_FRAMES_PER_ENTRY = 4;
    static readonly FRAME_SIZE = 8;
    static readonly MAX_FILE_BYTES = 2 * 1024 * 1024;

    static readonly ERROR_INVALID_JSON = 'invalid_json';
    static readonly ERROR_WRONG_FORMAT = 'wrong_format';
    static readonly ERROR_UNSUPPORTED_VERSION = 'unsupported_version';
    static readonly ERROR_SPRITES_NOT_ARRAY = 'sprites_not_array';
    static readonly ERROR_TOO_MANY_ENTRIES = 'too_many_entries';
    static readonly ERROR_NOTHING_TO_IMPORT = 'nothing_to_import';
    static readonly ERROR_FILE_TOO_LARGE = 'file_too_large';
    static readonly ERROR_MERGE_TOO_LARGE = 'merge_too_large';

    /**
     * Serialize custom sprite entries to a versioned JSON pack string.
     * Deep-clones frames so the payload never shares references with live state.
     * Fails closed if entry count exceeds MAX_ENTRIES (does not truncate).
     */
    static serialize(
        entries: CustomSpriteEntry[],
        meta?: { engineHint?: string; exportedAt?: string }
    ): SerializeResult {
        if (!Array.isArray(entries)) {
            return { ok: false, error: CustomSpritesIO.ERROR_NOTHING_TO_IMPORT };
        }
        if (entries.length > CustomSpritesIO.MAX_ENTRIES) {
            return { ok: false, error: CustomSpritesIO.ERROR_TOO_MANY_ENTRIES };
        }

        const pack: SpritePackV1 = {
            format: CustomSpritesIO.FORMAT,
            version: CustomSpritesIO.VERSION,
            exportedAt: meta?.exportedAt ?? new Date().toISOString(),
            sprites: entries.map((entry) => ({
                group: entry.group,
                key: entry.key,
                variant: entry.variant ?? 'base',
                frames: CustomSpritesIO.cloneFrames(entry.frames),
            })),
        };

        if (meta?.engineHint !== undefined) {
            pack.engineHint = meta.engineHint;
        }

        return { ok: true, text: JSON.stringify(pack, null, 2) };
    }

    /**
     * Parse and validate a custom-sprites pack.
     * Soft-skips bad entries; hard-fails on structural issues or zero valid entries.
     * Entry-count cap is applied after soft-filter + last-wins dedupe.
     */
    static parse(text: string): ParseResult {
        if (typeof text !== 'string') {
            return { ok: false, error: CustomSpritesIO.ERROR_INVALID_JSON };
        }

        if (new TextEncoder().encode(text).length > CustomSpritesIO.MAX_FILE_BYTES) {
            return { ok: false, error: CustomSpritesIO.ERROR_FILE_TOO_LARGE };
        }

        let data: unknown;
        try {
            data = JSON.parse(text) as unknown;
        } catch {
            return { ok: false, error: CustomSpritesIO.ERROR_INVALID_JSON };
        }

        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            return { ok: false, error: CustomSpritesIO.ERROR_INVALID_JSON };
        }

        const record = data as Record<string, unknown>;

        if (record.format !== CustomSpritesIO.FORMAT) {
            return { ok: false, error: CustomSpritesIO.ERROR_WRONG_FORMAT };
        }

        if (record.version !== CustomSpritesIO.VERSION) {
            return { ok: false, error: CustomSpritesIO.ERROR_UNSUPPORTED_VERSION };
        }

        if (!Array.isArray(record.sprites)) {
            return { ok: false, error: CustomSpritesIO.ERROR_SPRITES_NOT_ARRAY };
        }

        if (record.sprites.length === 0) {
            return { ok: false, error: CustomSpritesIO.ERROR_NOTHING_TO_IMPORT };
        }

        let skipped = 0;
        const warnings: string[] = [];
        const valid: CustomSpriteEntry[] = [];

        for (const raw of record.sprites) {
            const entry = CustomSpritesIO.validateEntry(raw);
            if (!entry) {
                skipped += 1;
                continue;
            }
            valid.push(entry);
        }

        if (valid.length === 0) {
            return { ok: false, error: CustomSpritesIO.ERROR_NOTHING_TO_IMPORT };
        }

        // Last-wins dedupe by (group, key, variant)
        const deduped = CustomSpritesIO.dedupeLastWins(valid);
        const droppedDupes = valid.length - deduped.length;
        if (droppedDupes > 0) {
            skipped += droppedDupes;
            warnings.push(`Dropped ${droppedDupes} duplicate entry(ies); kept last.`);
        }

        if (deduped.length > CustomSpritesIO.MAX_ENTRIES) {
            return { ok: false, error: CustomSpritesIO.ERROR_TOO_MANY_ENTRIES };
        }

        return { ok: true, sprites: deduped, skipped, warnings };
    }

    /**
     * Build the next customSprites list for merge or replace.
     * Fails closed if the result would exceed MAX_ENTRIES (no partial list).
     * Returns a deep-cloned list; empty array means caller should assign undefined.
     */
    static applyImport(
        current: CustomSpriteEntry[] | undefined,
        incoming: CustomSpriteEntry[],
        mode: 'merge' | 'replace'
    ): ApplyResult {
        if (!Array.isArray(incoming) || incoming.length === 0) {
            return { ok: false, error: CustomSpritesIO.ERROR_NOTHING_TO_IMPORT };
        }

        let next: CustomSpriteEntry[];

        if (mode === 'replace') {
            next = incoming.map((e) => CustomSpritesIO.cloneEntry(e));
        } else {
            next = (current ?? []).map((e) => CustomSpritesIO.cloneEntry(e));
            for (const entry of incoming) {
                next = CustomSpriteLookup.upsert(next, CustomSpritesIO.cloneEntry(entry));
            }
        }

        if (next.length > CustomSpritesIO.MAX_ENTRIES) {
            return { ok: false, error: CustomSpritesIO.ERROR_MERGE_TOO_LARGE };
        }

        return { ok: true, sprites: next };
    }

    static cloneFrames(frames: CustomSpriteFrame[]): CustomSpriteFrame[] {
        return frames.map((frame) => frame.map((row) => row.slice()));
    }

    static cloneEntry(entry: CustomSpriteEntry): CustomSpriteEntry {
        return {
            group: entry.group,
            key: entry.key,
            variant: entry.variant ?? 'base',
            frames: CustomSpritesIO.cloneFrames(entry.frames),
        };
    }

    private static dedupeLastWins(entries: CustomSpriteEntry[]): CustomSpriteEntry[] {
        const map = new Map<string, CustomSpriteEntry>();
        for (const entry of entries) {
            const variant = entry.variant ?? 'base';
            const id = `${entry.group}\0${entry.key}\0${variant}`;
            map.set(id, entry);
        }
        return Array.from(map.values());
    }

    private static validateEntry(raw: unknown): CustomSpriteEntry | null {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            return null;
        }

        const record = raw as Record<string, unknown>;
        const group = record.group;
        if (typeof group !== 'string' || !VALID_GROUPS.has(group as CustomSpriteEntry['group'])) {
            return null;
        }

        if (typeof record.key !== 'string') {
            return null;
        }
        const key = record.key.trim();
        if (!key) {
            return null;
        }

        let variant: CustomSpriteVariant = 'base';
        if (record.variant !== undefined && record.variant !== null) {
            if (typeof record.variant !== 'string' || !VALID_VARIANTS.has(record.variant as CustomSpriteVariant)) {
                return null;
            }
            variant = record.variant as CustomSpriteVariant;
        }

        if (!Array.isArray(record.frames)) {
            return null;
        }
        if (
            record.frames.length < 1 ||
            record.frames.length > CustomSpritesIO.MAX_FRAMES_PER_ENTRY
        ) {
            return null;
        }

        const frames: CustomSpriteFrame[] = [];
        for (const rawFrame of record.frames) {
            const frame = CustomSpritesIO.validateFrame(rawFrame);
            if (!frame) {
                return null;
            }
            frames.push(frame);
        }

        return {
            group: group as CustomSpriteEntry['group'],
            key,
            variant,
            frames,
        };
    }

    private static validateFrame(raw: unknown): CustomSpriteFrame | null {
        if (!Array.isArray(raw) || raw.length !== CustomSpritesIO.FRAME_SIZE) {
            return null;
        }

        const frame: CustomSpriteFrame = [];
        for (const rawRow of raw) {
            if (!Array.isArray(rawRow) || rawRow.length !== CustomSpritesIO.FRAME_SIZE) {
                return null;
            }
            const row: (number | null)[] = [];
            for (const cell of rawRow) {
                if (cell === null) {
                    row.push(null);
                    continue;
                }
                // Reject floats, strings, booleans, and out-of-range indices
                if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 15) {
                    return null;
                }
                row.push(cell);
            }
            frame.push(row);
        }
        return frame;
    }
}

export default CustomSpritesIO;
