type SpriteMatrix = (number | null)[][];
declare class SpriteMatrixRegistry {
    static get(group: string, type?: string): SpriteMatrix;
}
export { SpriteMatrixRegistry };
