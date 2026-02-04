import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

type EdgeFlashState = {
    direction: string;
    expiresAt: number;
    color: string;
    tileX: number | null;
    tileY: number | null;
};

class RendererEffectsManager extends RendererModuleBase {
    edgeFlash: EdgeFlashState;
    combatIndicatorElement: HTMLElement | null;
    combatIndicatorTimeout: ReturnType<typeof setTimeout> | null;
    screenFlashElement: HTMLElement | null;
    screenFlashTimeout: ReturnType<typeof setTimeout> | null;

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.edgeFlash = {
            direction: '',
            expiresAt: 0,
            color: 'rgba(255,255,255,0.35)',
            tileX: null,
            tileY: null
        };
        this.combatIndicatorElement = typeof document !== 'undefined'
            ? document.getElementById('combat-indicator')
            : null;
        this.combatIndicatorTimeout = null;
        this.screenFlashElement = typeof document !== 'undefined'
            ? document.getElementById('screen-flash')
            : null;
        this.screenFlashTimeout = null;
        if (this.combatIndicatorElement) {
            this.combatIndicatorElement.classList.remove('visible');
            this.combatIndicatorElement.setAttribute('data-visible', 'false');
        }
        if (this.screenFlashElement) {
            this.screenFlashElement.classList.remove('visible');
        }
    }

    get effectsGameState(): EffectsGameState {
        return this.gameState as EffectsGameState;
    }

    get effectsCanvasHelper(): EffectsCanvasHelper {
        return this.canvasHelper as EffectsCanvasHelper;
    }

    showCombatIndicator(text: string, options: { duration?: number } = {}) {
        const element = this.combatIndicatorElement;
        if (!element) return;
        const duration = Number.isFinite(options.duration)
            ? Math.max(0, options.duration as number)
            : GameConfig.effects.combatIndicatorDuration;

        if (this.combatIndicatorTimeout) {
            clearTimeout(this.combatIndicatorTimeout);
            this.combatIndicatorTimeout = null;
        }

        element.classList.remove('visible');
        element.setAttribute('data-visible', 'false');
        element.textContent = '';
        void element.offsetWidth;

        element.textContent = text;
        element.classList.add('visible');
        element.setAttribute('data-visible', 'true');

        this.combatIndicatorTimeout = setTimeout(() => {
            element.classList.remove('visible');
            element.setAttribute('data-visible', 'false');
            element.textContent = '';
            this.combatIndicatorTimeout = null;
        }, duration);
    }

    flashScreen(options: { duration?: number; intensity?: number; color?: string } = {}) {
        const element = this.screenFlashElement;
        if (!element) return;
        const duration = Number.isFinite(options.duration)
            ? Math.max(GameConfig.effects.screenFlashMinDuration, options.duration as number)
            : GameConfig.effects.screenFlashDuration;
        if (typeof options.intensity === 'number' && Number.isFinite(options.intensity)) {
            const clamped = Math.max(0, Math.min(1, options.intensity));
            element.style.setProperty('--screen-flash-opacity', clamped.toString());
        }
        if (typeof options.color === 'string' && options.color.trim()) {
            element.style.setProperty('--screen-flash-color', options.color.trim());
        }
        if (this.screenFlashTimeout) {
            clearTimeout(this.screenFlashTimeout);
            this.screenFlashTimeout = null;
        }
        element.classList.remove('visible');
        void element.offsetWidth;
        element.classList.add('visible');
        this.screenFlashTimeout = setTimeout(() => {
            element.classList.remove('visible');
            this.screenFlashTimeout = null;
        }, duration);
    }

    flashEdge(direction: string, options: { duration?: number; color?: string; tileX?: number; tileY?: number } = {}) {
        if (typeof direction !== 'string' || !direction.trim()) return;
        const normalizedDirection = direction.trim().toLowerCase();
        const duration = Number.isFinite(options.duration)
            ? Math.max(GameConfig.effects.edgeFlashMinDuration, options.duration as number)
            : GameConfig.effects.edgeFlashDuration;
        const color = typeof options.color === 'string' && options.color.trim()
            ? options.color.trim()
            : 'rgba(255,255,255,0.35)';
        const clampIndex = (value: number | null | undefined) => {
            if (!Number.isFinite(value)) return null;
            const idx = Math.floor(value as number);
            return Math.max(0, Math.min(7, idx));
        };
        const tileX = clampIndex(options.tileX);
        const tileY = clampIndex(options.tileY);
        this.edgeFlash = {
            direction: normalizedDirection,
            expiresAt: Date.now() + duration,
            color,
            tileX,
            tileY
        };
    }

    drawEdgeFlash(ctx: CanvasRenderingContext2D, bounds: { width: number; height: number }) {
        const state = this.edgeFlash;
        if (!state.direction) return;
        const now = Date.now();
        if (!Number.isFinite(state.expiresAt) || state.expiresAt <= now) {
            this.edgeFlash.direction = '';
            return;
        }

        const tileSize = Math.max(1, this.effectsCanvasHelper.getTilePixelSize());
        const thickness = Math.max(2, Math.floor(tileSize / 4));
        const highlightSize = tileSize;
        const clampIndex = (value: number | null | undefined, fallback = 0) => {
            if (!Number.isFinite(value)) return Math.max(0, Math.min(7, Math.floor(fallback)));
            return Math.max(0, Math.min(7, Math.floor(value as number)));
        };
        const player = this.effectsGameState.getPlayer();
        const tileX = clampIndex(state.tileX, player.x);
        const tileY = clampIndex(state.tileY, player.y);
        ctx.save();
        ctx.fillStyle = state.color || 'rgba(255,255,255,0.35)';
        switch (state.direction) {
            case 'left':
                ctx.fillRect(0, tileY * highlightSize, thickness, highlightSize);
                break;
            case 'right':
                ctx.fillRect(bounds.width - thickness, tileY * highlightSize, thickness, highlightSize);
                break;
            case 'up':
                ctx.fillRect(tileX * highlightSize, 0, highlightSize, thickness);
                break;
            case 'down':
                ctx.fillRect(tileX * highlightSize, bounds.height - thickness, highlightSize, thickness);
                break;
            default:
                ctx.fillRect(0, 0, bounds.width, thickness);
                break;
        }
        ctx.restore();
    }
}

export { RendererEffectsManager };

type EffectsGameState = {
    getPlayer: () => { x: number; y: number };
};

type EffectsCanvasHelper = {
    getTilePixelSize: () => number;
};
