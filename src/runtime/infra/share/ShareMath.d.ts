declare class ShareMath {
    static clamp(value: number, min: number, max: number, fallback: number): number;
    static clampRoomIndex(value: number | string | null | undefined): number;
}
export { ShareMath };
