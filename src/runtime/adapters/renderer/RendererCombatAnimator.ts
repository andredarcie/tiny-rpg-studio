import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

type Position = {
    x: number;
    y: number;
};

type AnimationType = 'lunge' | 'knockback';

type AnimationState = {
    active: boolean;
    type?: AnimationType;
    startTime?: number;
    duration?: number;
    entity?: 'player' | { enemyId: string };
    from?: Position;
    to?: Position;
    onComplete?: (() => void) | null;
    rafId?: number | null;
};

type GameStateApi = {
    pauseGame?: (reason: string) => void;
    resumeGame?: (reason: string) => void;
};

/**
 * RendererCombatAnimator handles combat-related animations
 *
 * Manages smooth 60 FPS animations for:
 * - Lunge attacks: Brief forward movement then return
 * - Knockback: Push entity back when hit
 *
 * Uses requestAnimationFrame pattern from RendererTransitionManager
 */
class RendererCombatAnimator extends RendererModuleBase {
    animation: AnimationState;

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.animation = { active: false };
    }

    get combatGameState(): GameStateApi {
        return this.gameState as GameStateApi;
    }

    /**
     * Check if any animation is currently active
     */
    isAnimating(): boolean {
        return Boolean(this.animation.active);
    }

    /**
     * Start a lunge attack animation
     * @param attacker The attacking entity ('player')
     * @param target Target position { x, y } in tile coordinates
     * @param onComplete Callback when animation finishes
     */
    startLungeAttack(
        _attacker: 'player',
        target: Position,
        onComplete?: () => void
    ): void {
        const state = this.gameState as { state?: { player?: Position } };
        const player = state.state?.player;
        if (!player) {
            onComplete?.();
            return;
        }

        const from = { x: player.x, y: player.y };
        const duration = GameConfig.combat.lungeAnimationDuration;

        this.startAnimation({
            type: 'lunge',
            entity: 'player',
            from,
            to: target,
            duration,
            onComplete
        });
    }

    /**
     * Start a knockback animation
     * @param entity The entity being knocked back ('player' or enemy ID)
     * @param direction Direction vector { x, y } (e.g., { x: 1, y: 0 } for right)
     * @param onComplete Callback when animation finishes
     */
    startKnockback(
        entity: 'player' | string,
        direction: Position,
        onComplete?: () => void
    ): void {
        const state = this.gameState as { state?: { player?: Position } };

        // Only support player knockback for now
        if (entity !== 'player') {
            // Enemy knockback - for future implementation
            onComplete?.();
            return;
        }

        const player = state.state?.player;
        if (!player) {
            onComplete?.();
            return;
        }

        const from = { x: player.x, y: player.y };
        const to = { x: from.x + direction.x, y: from.y + direction.y };
        const duration = GameConfig.combat.knockbackDuration;

        this.startAnimation({
            type: 'knockback',
            entity: 'player',
            from,
            to,
            duration,
            onComplete
        });
    }

    /**
     * Get the current render position for an entity during animation
     * Returns undefined if entity is not being animated
     * @param entity The entity to get position for
     * @returns Position override in pixel coordinates, or undefined
     */
    getEntityRenderPosition(entity: 'player' | string): Position | undefined {
        if (!this.animation.active) return undefined;

        const animatingPlayer = this.animation.entity === 'player';
        const animatingEnemy = typeof this.animation.entity === 'object' &&
                              this.animation.entity.enemyId === entity;

        if (entity === 'player') {
            if (!animatingPlayer) return undefined;
        } else {
            if (!animatingEnemy) return undefined;
        }

        if (!this.animation.from || !this.animation.to) {
            return undefined;
        }

        const progress = this.getProgress();
        const tileSize = 16; // Standard tile size

        if (this.animation.type === 'lunge') {
            // Lunge with wind-up: pull back → lunge forward → return
            // 0-15%: Wind-up (pull back slightly)
            // 15-60%: Lunge forward
            // 60-100%: Return to start
            const fromX = this.animation.from.x * tileSize;
            const fromY = this.animation.from.y * tileSize;
            const toX = this.animation.to.x * tileSize;
            const toY = this.animation.to.y * tileSize;

            let lungeProgress: number;
            const windupPhase = 0.15;    // 15% of animation
            const lungePhase = 0.60;     // Until 60%
            const windupDistance = -0.15; // Pull back 15% in opposite direction

            if (progress < windupPhase) {
                // Wind-up: move backward
                lungeProgress = (progress / windupPhase) * windupDistance;
            } else if (progress < lungePhase) {
                // Lunge forward
                const lungeLocalProgress = (progress - windupPhase) / (lungePhase - windupPhase);
                lungeProgress = lungeLocalProgress * 0.5; // Move 50% forward
            } else {
                // Return
                const returnLocalProgress = (progress - lungePhase) / (1 - lungePhase);
                lungeProgress = (1 - returnLocalProgress) * 0.5;
            }

            return {
                x: Math.round(fromX + (toX - fromX) * lungeProgress),
                y: Math.round(fromY + (toY - fromY) * lungeProgress)
            };
        } else if (this.animation.type === 'knockback') {
            // Knockback with slight wind-up: brief pause → push back
            // 0-10%: Wind-up (lean toward enemy slightly)
            // 10-100%: Knockback with ease-out
            const fromX = this.animation.from.x * tileSize;
            const fromY = this.animation.from.y * tileSize;
            const toX = this.animation.to.x * tileSize;
            const toY = this.animation.to.y * tileSize;

            const windupPhase = 0.1; // 10% wind-up
            let effectiveProgress: number;

            if (progress < windupPhase) {
                // Wind-up: move slightly toward enemy (opposite of knockback)
                effectiveProgress = -(progress / windupPhase) * 0.1; // Move 10% opposite
            } else {
                // Knockback
                const knockbackProgress = (progress - windupPhase) / (1 - windupPhase);
                effectiveProgress = this.easeOutQuad(knockbackProgress);
            }

            return {
                x: Math.round(fromX + (toX - fromX) * effectiveProgress),
                y: Math.round(fromY + (toY - fromY) * effectiveProgress)
            };
        }

        return undefined;
    }

    /**
     * Cancel any active animation immediately
     */
    cancel(): void {
        if (this.animation.rafId) {
            globalThis.cancelAnimationFrame(this.animation.rafId);
        }

        const wasActive = this.animation.active;
        this.animation = { active: false };

        if (wasActive) {
            this.combatGameState.resumeGame?.('combat-animation');
        }
    }

    /**
     * Freeze the game briefly for impact effect (hitstop)
     * @param duration Duration in milliseconds
     */
    freezeFrame(duration: number): void {
        this.combatGameState.pauseGame?.('hitstop');
        setTimeout(() => {
            this.combatGameState.resumeGame?.('hitstop');
        }, duration);
    }

    // Private methods

    private startAnimation(options: {
        type: AnimationType;
        entity: 'player' | { enemyId: string };
        from: Position;
        to: Position;
        duration: number;
        onComplete?: () => void;
    }): void {
        const now = performance.now();

        // Cancel any existing animation
        if (this.animation.rafId) {
            globalThis.cancelAnimationFrame(this.animation.rafId);
        }

        this.animation = {
            active: true,
            type: options.type,
            startTime: now,
            duration: options.duration,
            entity: options.entity,
            from: options.from,
            to: options.to,
            onComplete: options.onComplete ?? null,
            rafId: null
        };

        // Pause game during animation
        this.combatGameState.pauseGame?.('combat-animation');

        // Start animation loop
        this.scheduleTick();
    }

    private scheduleTick(): void {
        const tick = () => {
            if (!this.animation.active) {
                return;
            }

            const progress = this.getProgress();
            if (progress >= 1) {
                this.finish();
                return;
            }

            // Trigger redraw through renderer
            const renderer = this.renderer as { draw?: () => void };
            renderer.draw?.();

            this.animation.rafId = globalThis.requestAnimationFrame(tick);
        };
        this.animation.rafId = globalThis.requestAnimationFrame(tick);
    }

    private getProgress(): number {
        if (!this.animation.active || !this.animation.startTime || !this.animation.duration) {
            return 1;
        }

        const now = performance.now();
        const elapsed = now - this.animation.startTime;
        return Math.max(0, Math.min(1, elapsed / this.animation.duration));
    }

    private finish(): void {
        if (this.animation.rafId) {
            globalThis.cancelAnimationFrame(this.animation.rafId);
        }

        const onComplete = this.animation.onComplete;
        this.animation = { active: false };

        // Resume game
        this.combatGameState.resumeGame?.('combat-animation');

        // Execute callback
        onComplete?.();
    }

    private easeOutQuad(t: number): number {
        const clamped = Math.max(0, Math.min(1, t));
        return 1 - (1 - clamped) * (1 - clamped);
    }
}

export { RendererCombatAnimator };
