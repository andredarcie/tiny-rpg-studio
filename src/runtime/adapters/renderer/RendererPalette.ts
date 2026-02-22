import { PICO8_COLORS } from '../../domain/definitions/TileDefinitions';

// Type-safe interface for GameState with palette support
interface GameStateWithPalette {
    game?: {
        customPalette?: string[];
    };
}

type GameStateApi = GameStateWithPalette | Record<string, unknown> | null;

class RendererPalette {
    gameState: GameStateApi;

    constructor(gameState: GameStateApi) {
        this.gameState = gameState;
    }

    getActivePalette(): string[] {
        const palette = this.extractCustomPalette();
        return palette || this.getDefaultPalette();
    }

    getDefaultPalette(): string[] {
        return PICO8_COLORS as string[];
    }

    getColor(index: number): string {
        const palette = this.getActivePalette();
        return palette[index] || "#f4f4f8";
    }

    isUsingCustomPalette(): boolean {
        const palette = this.extractCustomPalette();
        return Array.isArray(palette);
    }

    private extractCustomPalette(): string[] | undefined {
        if (!this.gameState) return undefined;

        // Type-safe extraction
        const state = this.gameState as GameStateWithPalette;
        return state.game?.customPalette;
    }
}

export { RendererPalette };
