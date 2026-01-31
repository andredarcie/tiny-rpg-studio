
import { ShareBase64 } from './ShareBase64';
import { ShareConstants } from './ShareConstants';
import { ShareMath } from './ShareMath';

type PositionEntry = { roomIndex?: number; x?: number; y?: number };
type NpcEntry = { type?: string };
type EnemyEntry = { type?: string; typeIndex?: number };

class SharePositionCodec {
    static positionToByte(entry: PositionEntry) {
        const room = ShareMath.clamp(Number(entry.roomIndex), 0, ShareConstants.MAX_ROOM_INDEX, 0) & 0x0f;
        const y = ShareMath.clamp(Number(entry.y), 0, ShareConstants.MATRIX_SIZE - 1, 0) & 0x07;
        const x = ShareMath.clamp(Number(entry.x), 0, ShareConstants.MATRIX_SIZE - 1, 0) & 0x07;
        return ((room & 0x03) << 6) | (y << 3) | x;
    }

    static byteToPosition(byte: number) {
        return {
            x: byte & 0x07,
            y: (byte >> 3) & 0x07,
            roomIndex: ShareMath.clamp((byte >> 6) & 0x03, 0, ShareConstants.MAX_ROOM_INDEX, 0)
        };
    }

    static encodePositions(entries: PositionEntry[]) {
        if (!entries.length) return '';
        const maxRoomIndex = entries.reduce(
            (max: number, entry: PositionEntry) => Math.max(
                max,
                ShareMath.clamp(Number(entry.roomIndex), 0, ShareConstants.MAX_ROOM_INDEX, 0)
            ),
            0
        );
        const useWide = maxRoomIndex > 3;
        if (useWide) {
            const bytes = new Uint8Array(entries.length * 2);
            for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const room = ShareMath.clamp(Number(entry.roomIndex), 0, ShareConstants.MAX_ROOM_INDEX, 0) & 0x0f;
            const y = ShareMath.clamp(Number(entry.y), 0, ShareConstants.MATRIX_SIZE - 1, 0) & 0x07;
            const x = ShareMath.clamp(Number(entry.x), 0, ShareConstants.MATRIX_SIZE - 1, 0) & 0x07;
                const offset = i * 2;
                bytes[offset] = ((room & 0x03) << 6) | (y << 3) | x;
                bytes[offset + 1] = (room >> 2) & 0x0f;
            }
            return ShareConstants.POSITION_WIDE_PREFIX + ShareBase64.toBase64Url(bytes);
        }

        const bytes = new Uint8Array(entries.length);
        for (let i = 0; i < entries.length; i++) {
            bytes[i] = SharePositionCodec.positionToByte(entries[i]);
        }
        return ShareBase64.toBase64Url(bytes);
    }

    static decodePositions(text?: string | null): PositionEntry[] {
        if (!text) return [];
        if (text[0] === ShareConstants.POSITION_WIDE_PREFIX) {
            const bytes = ShareBase64.fromBase64Url(text.slice(1));
            const positions: PositionEntry[] = [];
            for (let i = 0; i < bytes.length; i += 2) {
                const low = bytes[i] ?? 0;
                const high = bytes[i + 1] ?? 0;
                const x = low & 0x07;
                const y = (low >> 3) & 0x07;
                const roomLower = (low >> 6) & 0x03;
                const roomUpper = high & 0x0f;
                const roomIndex = ShareMath.clamp((roomUpper << 2) | roomLower, 0, ShareConstants.MAX_ROOM_INDEX, 0);
                positions.push({ x, y, roomIndex });
            }
            return positions;
        }
        const bytes = ShareBase64.fromBase64Url(text);
        return Array.from(bytes, (byte) => SharePositionCodec.byteToPosition(byte));
    }

    static encodeNpcTypeIndexes(sprites: NpcEntry[]) {
        if (!sprites.length) return '';
        const defs = ShareConstants.NPC_DEFINITIONS as Array<{ type?: string }>;
        const bytes = new Uint8Array(sprites.length);
        let hasNonSequential = false;
        for (let i = 0; i < sprites.length; i++) {
            const sprite = sprites[i];
            const index = defs.findIndex((def) => def.type === sprite.type);
            bytes[i] = index >= 0 ? index : 255;
            if (!hasNonSequential && bytes[i] !== i) {
                hasNonSequential = true;
            }
        }
        if (!hasNonSequential) return '';
        return ShareBase64.toBase64Url(bytes);
    }

    static decodeNpcTypeIndexes(text?: string | null): number[] {
        if (!text) return [];
        return Array.from(ShareBase64.fromBase64Url(text), (byte) => byte);
    }

    static encodeEnemyTypeIndexes(enemies: EnemyEntry[]) {
        if (!enemies.length) return '';
        const defs = ShareConstants.ENEMY_DEFINITIONS as Array<{ type?: string }>;
        if (!Array.isArray(defs) || !defs.length) return '';
        const bytes = new Uint8Array(enemies.length);
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i] || {};
            let index =
                typeof enemy.typeIndex === 'number' && Number.isInteger(enemy.typeIndex)
                    ? enemy.typeIndex
                    : -1;
            if (index < 0 || index >= defs.length) {
                const type = typeof enemy.type === 'string' ? enemy.type : null;
                index = type ? defs.findIndex((def) => def.type === type) : -1;
            }
            bytes[i] = index >= 0 ? index : 255;
        }
        return ShareBase64.toBase64Url(bytes);
    }

    static decodeEnemyTypeIndexes(text: string | null | undefined, expectedLength = 0): number[] {
        if (!text) {
            return Array.from({ length: expectedLength }, () => 255);
        }
        const bytes = Array.from(ShareBase64.fromBase64Url(text), (byte) => byte);
        if (expectedLength > 0 && bytes.length < expectedLength) {
            while (bytes.length < expectedLength) {
                bytes.push(255);
            }
        }
        return bytes;
    }
}

export { SharePositionCodec };
