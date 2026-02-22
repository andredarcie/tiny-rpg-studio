import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

type ShakeState = {
    active: boolean;
    startTime?: number;
    duration?: number;
    intensity?: number;
};

type Offset = {
    x: number;
    y: number;
};

/**
 * RendererCameraShake provides screen shake effect for impact
 *
 * Uses sine wave with linear decay to create camera offset variation.
 * Intensity scales with damage for dynamic feedback.
 */
class RendererCameraShake extends RendererModuleBase {
    private shake: ShakeState;
    private maxOffset: number;

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.shake = { active: false };
        this.maxOffset = 4; // Maximum offset in pixels at intensity 1.0
    }

    /**
     * Trigger a screen shake effect
     * @param intensity Shake intensity (0.0 - 1.0), clamped to min/max from config
     * @param duration Duration in milliseconds (optional, uses config default)
     */
    trigger(intensity: number, duration?: number): void {
        if (!GameConfig.combat.screenShake.enabled) {
            return;
        }

        const config = GameConfig.combat.screenShake;
        const clampedIntensity = Math.max(
            config.minIntensity,
            Math.min(config.maxIntensity, intensity)
        );

        const shakeDuration = duration ?? config.baseDuration;

        this.shake = {
            active: true,
            startTime: performance.now(),
            duration: shakeDuration,
            intensity: clampedIntensity
        };
    }

    /**
     * Trigger shake based on damage amount
     * @param damage Damage amount to calculate intensity from
     */
    triggerFromDamage(damage: number): void {
        const config = GameConfig.combat.screenShake;
        const intensity = config.minIntensity + (damage * config.intensityPerDamage);
        this.trigger(intensity);
    }

    /**
     * Get the current camera offset for rendering
     * @returns Offset { x, y } in pixels, or { x: 0, y: 0 } if not shaking
     */
    getCurrentOffset(): Offset {
        if (!this.shake.active) {
            return { x: 0, y: 0 };
        }

        const now = performance.now();
        const elapsed = now - (this.shake.startTime ?? now);
        const duration = this.shake.duration ?? 1;
        const progress = Math.min(1, elapsed / duration);

        if (progress >= 1) {
            this.shake.active = false;
            return { x: 0, y: 0 };
        }

        // Sine wave with linear decay: sin(progress * 20) * maxOffset * (1 - progress)
        const intensity = this.shake.intensity ?? 1.0;
        const amplitude = this.maxOffset * intensity * (1 - progress);
        const angle = progress * 20; // Fast oscillation

        return {
            x: Math.sin(angle) * amplitude,
            y: Math.cos(angle * 1.3) * amplitude * 0.7 // Slight vertical offset, less intense
        };
    }

    /**
     * Check if shake is currently active
     */
    isActive(): boolean {
        return Boolean(this.shake.active);
    }

    /**
     * Stop shake immediately
     */
    stop(): void {
        this.shake = { active: false };
    }
}

export { RendererCameraShake };
