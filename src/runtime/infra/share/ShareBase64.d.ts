declare class ShareBase64 {
    static toBase64Url(bytes: Uint8Array | ArrayLike<number> | null | undefined): string;
    static fromBase64Url(text?: string): Uint8Array;
    static logInvalidInput(input: string, error?: unknown): void;
}
export { ShareBase64 };
