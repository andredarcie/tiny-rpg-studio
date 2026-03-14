type PositionEntry = {
    roomIndex?: number;
    x?: number;
    y?: number;
};
type NpcEntry = {
    type?: string;
};
type EnemyEntry = {
    type?: string;
    typeIndex?: number;
};
declare class SharePositionCodec {
    static positionToByte(entry: PositionEntry): number;
    static byteToPosition(byte: number): {
        x: number;
        y: number;
        roomIndex: number;
    };
    static encodePositions(entries: PositionEntry[]): string;
    static decodePositions(text?: string | null): PositionEntry[];
    static encodeNpcTypeIndexes(sprites: NpcEntry[]): string;
    static decodeNpcTypeIndexes(text?: string | null): number[];
    static encodeEnemyTypeIndexes(enemies: EnemyEntry[]): string;
    static decodeEnemyTypeIndexes(text: string | null | undefined, expectedLength?: number): number[];
}
export { SharePositionCodec };
