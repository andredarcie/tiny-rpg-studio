declare class ShareTextCodec {
    static encodeUtf8(value: string): Uint8Array;
    static decodeUtf8(bytes: Uint8Array | ArrayLike<number>): string;
    static encodeText(value: string): string;
    static decodeText(text: string | null | undefined, fallback?: string): string;
    static encodeTextArray(values: string[]): string;
    static decodeTextArray(text: string | null | undefined): string[];
}
export { ShareTextCodec };
