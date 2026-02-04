import { PICO8_COLORS } from '../../domain/definitions/TileDefinitions';

type GameStateApi = Record<string, unknown> | null;

class RendererPalette {
    gameState: GameStateApi;
    private customPalette: string[] | null = null;

    constructor(gameState: GameStateApi) {
        this.gameState = gameState;
    }

    setCustomPalette(colors: string[] | null): void {
        this.customPalette = colors;
    }

    getPalette(): string[] {
        return this.customPalette || this.getPicoPalette();
    }

    getPicoPalette(): string[] {
        return PICO8_COLORS as string[];
    }

    getColor(index: number): string {
        const palette = this.getPalette();
        return palette[index] || "#f4f4f8";
    }

    isUsingCustomPalette(): boolean {
        return this.customPalette !== null;
    }

    resetToDefault(): void {
        this.customPalette = null;
    }
}

export { RendererPalette };
