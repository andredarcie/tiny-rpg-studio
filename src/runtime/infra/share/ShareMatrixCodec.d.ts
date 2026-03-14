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
declare class ShareMatrixCodec {
    private static _tileMaskLengthCache;
    static normalizeGround(matrix?: MatrixInput): GroundMatrix;
    static normalizeOverlay(matrix?: MatrixInput): OverlayMatrix;
    static collectGroundMatrices(gameData: ShareGameData | null | undefined, roomCount: number): MatrixInput[];
    static collectOverlayMatrices(gameData: ShareGameData | null | undefined, roomCount: number): MatrixInput[];
    static encodeGround(matrix?: MatrixInput): string;
    static decodeGround(text?: string, version?: number): GroundMatrix;
    static encodeOverlay(matrix?: MatrixInput): {
        text: string;
        hasData: boolean;
    };
    static decodeOverlay(text?: string, version?: number): OverlayMatrix;
    static decodeWorldGround(text: string | null | undefined, version: number, roomCount: number): GroundMatrix[];
    static decodeWorldOverlay(text: string | null | undefined, version: number, roomCount: number): OverlayMatrix[];
    static coerceTileValue(value: TileValueInput, fallback?: number): number;
    static shouldUseExtendedTileEncoding(matrix?: MatrixInput): boolean;
    static matrixHasExtendedTiles(matrix?: MatrixInput): boolean;
    static packTileValues(values: number[], useExtended: boolean): Uint8Array;
    static unpackTileValues(bytes: Uint8Array, expectedCount: number, useExtended: boolean): number[];
    static countSetBits(bytes: Uint8Array): number;
    static getTileMaskBase64Length(tileCount: number): number;
}
export { ShareMatrixCodec };
