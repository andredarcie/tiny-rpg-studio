
import { ShareBase64 } from './ShareBase64';
import { ShareConstants } from './ShareConstants';
import { ShareMath } from './ShareMath';
import { ShareVariableCodec } from './ShareVariableCodec';

type TileValueInput = number | string | null | undefined;
type MatrixInput = TileValueInput[][];
type GroundMatrix = number[][];
type OverlayMatrix = Array<(number | null)[]>;
type ShareGameData = {
    tileset?: {
        maps?: Array<{
            ground?: MatrixInput;
            overlay?: MatrixInput;
        }>;
        map?: {
            ground?: MatrixInput;
            overlay?: MatrixInput;
        };
    };
};

class ShareMatrixCodec {
    private static _tileMaskLengthCache: Map<number, number> | null = null;
    static normalizeGround(matrix?: MatrixInput): GroundMatrix {
        const size = ShareConstants.MATRIX_SIZE;
        const rows: GroundMatrix = [];
        const maxTileValue = ShareConstants.TILE_VALUE_MAX;
        for (let y = 0; y < size; y++) {
            const row: number[] = [];
            for (let x = 0; x < size; x++) {
                const value = ShareMatrixCodec.coerceTileValue(matrix?.[y]?.[x], 0);
                row.push(ShareMath.clamp(value, 0, maxTileValue, 0));
            }
            rows.push(row);
        }
        return rows;
    }

    static normalizeOverlay(matrix?: MatrixInput): OverlayMatrix {
        const size = ShareConstants.MATRIX_SIZE;
        const rows: OverlayMatrix = [];
        const maxTileValue = ShareConstants.TILE_VALUE_MAX;
        for (let y = 0; y < size; y++) {
            const row: (number | null)[] = [];
            for (let x = 0; x < size; x++) {
                const raw = matrix?.[y]?.[x];
                if (raw === null || raw === undefined) {
                    row.push(null);
                } else {
                    const value = ShareMatrixCodec.coerceTileValue(raw, 0);
                    row.push(ShareMath.clamp(value, 0, maxTileValue, 0));
                }
            }
            rows.push(row);
        }
        return rows;
    }

    static collectGroundMatrices(gameData: ShareGameData | null | undefined, roomCount: number): MatrixInput[] {
        const maps = Array.isArray(gameData?.tileset?.maps) ? gameData.tileset.maps : [];
        const fallbackGround = gameData?.tileset?.map?.ground ?? null;
        const matrices: MatrixInput[] = [];
        for (let index = 0; index < roomCount; index++) {
            const source = maps[index]?.ground ?? (index === 0 ? fallbackGround : null);
            matrices.push(source ?? []);
        }
        return matrices;
    }

    static collectOverlayMatrices(gameData: ShareGameData | null | undefined, roomCount: number): MatrixInput[] {
        const maps = Array.isArray(gameData?.tileset?.maps) ? gameData.tileset.maps : [];
        const fallbackOverlay = gameData?.tileset?.map?.overlay ?? null;
        const matrices: MatrixInput[] = [];
        for (let index = 0; index < roomCount; index++) {
            const source = maps[index]?.overlay ?? (index === 0 ? fallbackOverlay : null);
            matrices.push(source ?? []);
        }
        return matrices;
    }

    static encodeGround(matrix?: MatrixInput): string {
        const normalized = ShareMatrixCodec.normalizeGround(matrix);
        const values = [];
        const nonZeroValues = [];
        const tileCount = ShareConstants.TILE_COUNT;
        const maskBytes = new Uint8Array(Math.ceil(tileCount / 8));
        let hasNonZero = false;
        let bitIndex = 0;
        const size = ShareConstants.MATRIX_SIZE;
        const useExtendedTiles = ShareMatrixCodec.shouldUseExtendedTileEncoding(normalized);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const value = normalized[y][x] & 0xff;
                if (!hasNonZero && value !== 0) {
                    hasNonZero = true;
                }
                if (value !== 0) {
                    const byteIndex = bitIndex >> 3;
                    const bitPosition = bitIndex & 0x07;
                    maskBytes[byteIndex] |= (1 << bitPosition);
                    nonZeroValues.push(value);
                }
                values.push(value);
                bitIndex++;
            }
        }

        if (!hasNonZero) {
            return '';
        }

        const dense = ShareBase64.toBase64Url(ShareMatrixCodec.packTileValues(values, useExtendedTiles));
        if (!nonZeroValues.length) {
            return dense;
        }
        const encodedMask = ShareBase64.toBase64Url(maskBytes);
        const encodedValues = ShareBase64.toBase64Url(ShareMatrixCodec.packTileValues(nonZeroValues, useExtendedTiles));
        const sparseLength = 1 + encodedMask.length + encodedValues.length;
        if (sparseLength < dense.length) {
            return `${ShareConstants.GROUND_SPARSE_PREFIX}${encodedMask}${encodedValues}`;
        }
        return dense;
    }

    static decodeGround(text?: string, version = 0) {
        const tileCount = ShareConstants.TILE_COUNT;
        const size = ShareConstants.MATRIX_SIZE;
        const maxTileValue = ShareConstants.TILE_VALUE_MAX;
        const useExtendedTiles = version >= ShareConstants.TILE_EXTENDED_VERSION;
        const safeText = text ?? '';
        const useLegacy = version === ShareConstants.LEGACY_VERSION ||
            (safeText.length === tileCount && /^[0-9a-f]+$/i.test(safeText));
        const grid: GroundMatrix = [];

        if (useLegacy) {
            let index = 0;
            for (let y = 0; y < size; y++) {
                const row: number[] = [];
                for (let x = 0; x < size; x++) {
                    const char = text?.[index++] ?? '0';
                    const value = parseInt(char, 16);
                    row.push(Number.isFinite(value) ? ShareMath.clamp(value, 0, ShareConstants.TILE_LEGACY_MAX, 0) : 0);
                }
                grid.push(row);
            }
            return grid;
        }

        const useSparseEncoding = safeText[0] === ShareConstants.GROUND_SPARSE_PREFIX &&
            version !== ShareConstants.LEGACY_VERSION;
        if (useSparseEncoding) {
            const maskLength = ShareMatrixCodec.getTileMaskBase64Length(tileCount);
            const maskSlice = safeText.slice(1, 1 + maskLength);
            const valuesSlice = safeText.slice(1 + maskLength);
            const maskBytes = ShareBase64.fromBase64Url(maskSlice);
            const nonZeroCount = ShareMatrixCodec.countSetBits(maskBytes);
            const valueBytes = valuesSlice ? ShareBase64.fromBase64Url(valuesSlice) : new Uint8Array(0);
            const values = ShareMatrixCodec.unpackTileValues(valueBytes, nonZeroCount, useExtendedTiles);
            let valueIndex = 0;
            let bitIndex = 0;
            for (let y = 0; y < size; y++) {
                const row: number[] = [];
                for (let x = 0; x < size; x++) {
                    const byteIndex = bitIndex >> 3;
                    const bitPosition = bitIndex & 0x07;
                    const hasValue = (maskBytes[byteIndex] & (1 << bitPosition)) !== 0;
                    const tile = hasValue ? (values[valueIndex++] ?? 0) : 0;
                    row.push(ShareMath.clamp(tile, 0, maxTileValue, 0));
                    bitIndex++;
                }
                grid.push(row);
            }
            return grid;
        }

        const bytes = ShareBase64.fromBase64Url(safeText);
        const values = ShareMatrixCodec.unpackTileValues(bytes, tileCount, useExtendedTiles);
        let valueIndex = 0;
        for (let y = 0; y < size; y++) {
            const row: number[] = [];
            for (let x = 0; x < size; x++) {
                const value = values[valueIndex++] ?? 0;
                row.push(ShareMath.clamp(value, 0, maxTileValue, 0));
            }
            grid.push(row);
        }
        return grid;
    }

    static encodeOverlay(matrix?: MatrixInput): { text: string; hasData: boolean } {
        const normalized = ShareMatrixCodec.normalizeOverlay(matrix);
        const tileCount = ShareConstants.TILE_COUNT;
        const maskBytes = new Uint8Array(Math.ceil(tileCount / 8));
        const values: number[] = [];
        let hasData = false;
        let bitIndex = 0;
        const size = ShareConstants.MATRIX_SIZE;
        const useExtendedTiles = ShareMatrixCodec.shouldUseExtendedTileEncoding(normalized);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const value = normalized[y][x];
                const currentIndex = bitIndex++;
                if (value === null) {
                    continue;
                }
                hasData = true;
                const byteIndex = currentIndex >> 3;
                const bitPosition = currentIndex & 0x07;
                maskBytes[byteIndex] |= (1 << bitPosition);
                values.push(value & 0xff);
            }
        }

        if (!hasData) {
            return { text: '', hasData: false };
        }

        const encodedMask = ShareBase64.toBase64Url(maskBytes);
        const encodedValues = values.length
            ? ShareBase64.toBase64Url(ShareMatrixCodec.packTileValues(values, useExtendedTiles))
            : '';
        return {
            text: `${ShareConstants.OVERLAY_BINARY_PREFIX}${encodedMask}${encodedValues}`,
            hasData: true
        };
    }

    static decodeOverlay(text?: string, version = 0): OverlayMatrix {
        const size = ShareConstants.MATRIX_SIZE;
        const tileCount = ShareConstants.TILE_COUNT;
        const maxTileValue = ShareConstants.TILE_VALUE_MAX;
        const safeText = text ?? '';
        const useBinaryEncoding = safeText[0] === ShareConstants.OVERLAY_BINARY_PREFIX &&
            version !== ShareConstants.LEGACY_VERSION;
        const useExtendedTiles = version >= ShareConstants.TILE_EXTENDED_VERSION;
        const grid: OverlayMatrix = [];

        if (useBinaryEncoding) {
            const maskLength = ShareMatrixCodec.getTileMaskBase64Length(tileCount);
            const maskSlice = safeText.slice(1, 1 + maskLength);
            const valuesSlice = safeText.slice(1 + maskLength);
            const maskBytes = ShareBase64.fromBase64Url(maskSlice);
            const nonNullCount = ShareMatrixCodec.countSetBits(maskBytes);
            const valueBytes = valuesSlice ? ShareBase64.fromBase64Url(valuesSlice) : new Uint8Array(0);
            const values = ShareMatrixCodec.unpackTileValues(valueBytes, nonNullCount, useExtendedTiles);
            let bitIndex = 0;
            let valueIndex = 0;

            for (let y = 0; y < size; y++) {
                const row: (number | null)[] = [];
                for (let x = 0; x < size; x++) {
                    const byteIndex = bitIndex >> 3;
                    const bitPosition = bitIndex & 0x07;
                    const hasTile = (maskBytes[byteIndex] & (1 << bitPosition)) !== 0;
                    if (hasTile) {
                        const value = values[valueIndex++] ?? 0;
                        row.push(ShareMath.clamp(value, 0, maxTileValue, 0));
                    } else {
                        row.push(null);
                    }
                    bitIndex++;
                }
                grid.push(row);
            }
            return grid;
        }

        let index = 0;
        for (let y = 0; y < size; y++) {
            const row: (number | null)[] = [];
            for (let x = 0; x < size; x++) {
                const char = text?.[index++] ?? ShareConstants.NULL_CHAR;
                if (char === ShareConstants.NULL_CHAR) {
                    row.push(null);
                } else {
                    const value = parseInt(char, 16);
                    row.push(Number.isFinite(value) ? ShareMath.clamp(value, 0, ShareConstants.TILE_LEGACY_MAX, 0) : null);
                }
            }
            grid.push(row);
        }
        return grid;
    }

    static decodeWorldGround(
        text: string | null | undefined,
        version: number,
        roomCount: number
    ): GroundMatrix[] {
        if (version >= ShareConstants.WORLD_MULTIMAP_VERSION) {
            const segments = text ? text.split(',') : [];
            const matrices = [];
            for (let index = 0; index < roomCount; index++) {
                const segment = segments[index] ?? '';
                matrices.push(ShareMatrixCodec.decodeGround(segment, version));
            }
            return matrices;
        }
        return [ShareMatrixCodec.decodeGround(text ?? '', version)];
    }

    static decodeWorldOverlay(
        text: string | null | undefined,
        version: number,
        roomCount: number
    ): OverlayMatrix[] {
        if (version >= ShareConstants.WORLD_MULTIMAP_VERSION) {
            const segments = text ? text.split(',') : [];
            const matrices = [];
            for (let index = 0; index < roomCount; index++) {
                const segment = segments[index] ?? '';
                matrices.push(ShareMatrixCodec.decodeOverlay(segment, version));
            }
            return matrices;
        }
        return [ShareMatrixCodec.decodeOverlay(text || '', version)];
    }

    static coerceTileValue(value: TileValueInput, fallback = 0): number {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return fallback;
    }

    static shouldUseExtendedTileEncoding(matrix?: MatrixInput): boolean {
        if (ShareConstants.VERSION < ShareConstants.TILE_EXTENDED_VERSION) {
            return ShareMatrixCodec.matrixHasExtendedTiles(matrix);
        }
        return true;
    }

    static matrixHasExtendedTiles(matrix?: MatrixInput): boolean {
        const legacyMax = ShareConstants.TILE_LEGACY_MAX;
        const size = ShareConstants.MATRIX_SIZE;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const value = matrix?.[y]?.[x];
                if (value === null || value === undefined) continue;
                const numeric = typeof value === 'number'
                    ? value
                    : typeof value === 'string'
                    ? Number(value)
                    : NaN;
                if (Number.isFinite(numeric) && numeric > legacyMax) {
                    return true;
                }
            }
        }
        return false;
    }

    static packTileValues(values: number[], useExtended: boolean): Uint8Array {
        if (useExtended) {
            const bytes = new Uint8Array(values.length);
            for (let i = 0; i < values.length; i++) {
                const value = Number.isFinite(values[i]) ? values[i] : 0;
                bytes[i] = value & 0xff;
            }
            return bytes;
        }
        return ShareVariableCodec.packNibbles(values.map((entry) => Number(entry) & 0x0f));
    }

    static unpackTileValues(bytes: Uint8Array, expectedCount: number, useExtended: boolean): number[] {
        if (useExtended) {
            const values: number[] = new Array<number>(expectedCount).fill(0);
            for (let i = 0; i < expectedCount; i++) {
                values[i] = bytes[i] ?? 0;
            }
            return values;
        }
        return ShareVariableCodec.unpackNibbles(bytes, expectedCount);
    }

    static countSetBits(bytes: Uint8Array): number {
        let total = 0;
        for (let i = 0; i < bytes.length; i++) {
            let value = bytes[i] || 0;
            while (value) {
                value &= value - 1;
                total++;
            }
        }
        return total;
    }

    static getTileMaskBase64Length(tileCount: number): number {
        if (!ShareMatrixCodec._tileMaskLengthCache) {
            ShareMatrixCodec._tileMaskLengthCache = new Map();
        }
        if (!ShareMatrixCodec._tileMaskLengthCache.has(tileCount)) {
            const maskBytes = new Uint8Array(Math.ceil(tileCount / 8));
            ShareMatrixCodec._tileMaskLengthCache.set(
                tileCount,
                ShareBase64.toBase64Url(maskBytes).length
            );
        }
        return ShareMatrixCodec._tileMaskLengthCache.get(tileCount) ?? 0;
    }
}

export { ShareMatrixCodec };
