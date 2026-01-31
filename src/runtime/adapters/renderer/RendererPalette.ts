import { PICO8_COLORS } from '../../domain/definitions/TileDefinitions';

type GameStateApi = Record<string, unknown> | null;

class RendererPalette {
    gameState: GameStateApi;

    constructor(gameState: GameStateApi) {
        this.gameState = gameState;
    }

    getPalette(): string[] {
        return this.getPicoPalette();
    }

    getPicoPalette(): string[] {
        return PICO8_COLORS as string[];
    }

    getColor(index: number): string {
        const palette = this.getPalette();
        return palette[index] || "#f4f4f8";
    }
}

export { RendererPalette };
