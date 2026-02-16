import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

type TelegraphState = {
    entityId: string;
    startTime: number;
    direction: { x: number; y: number }; // Direction TO player (we'll move opposite)
};

/**
 * RendererAttackTelegraph handles wind-up animations before attacks
 *
 * Entities pull back slightly in the opposite direction before attacking,
 * creating a visual "charging" effect that telegraphs their intent.
 * Used for both player and enemy attack animations.
 */
class RendererAttackTelegraph extends RendererModuleBase {
    private telegraphs: Map<string, TelegraphState>;
    private windupDistance: number; // Max pixels to pull back

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.telegraphs = new Map();
        this.windupDistance = 4; // Pull back 4 pixels max for more visibility
    }

    /**
     * Activate telegraph for an entity that's about to attack
     * @param entityId Entity identifier ('player' or enemy ID)
     * @param directionToTarget Direction vector from attacker to target
     */
    activateTelegraph(entityId: string, directionToTarget: { x: number; y: number }): void {
        if (!this.telegraphs.has(entityId)) {
            this.telegraphs.set(entityId, {
                entityId: entityId,
                startTime: performance.now(),
                direction: { ...directionToTarget }
            });
        }
    }

    /**
     * Remove telegraph warning from entity
     * @param entityId Entity identifier ('player' or enemy ID)
     */
    deactivateTelegraph(entityId: string): void {
        this.telegraphs.delete(entityId);
    }

    /**
     * Clear all active telegraphs
     */
    clearAll(): void {
        this.telegraphs.clear();
    }

    /**
     * Check if entity has active attack warning
     * @param entityId Entity identifier ('player' or enemy ID)
     * @returns true if entity is telegraphing an attack
     */
    isActive(entityId: string): boolean {
        return this.telegraphs.has(entityId);
    }

    /**
     * Get wind-up offset for an entity (pixels to offset in opposite direction)
     * ONE-TIME animation, not continuous loop
     * @param entityId Entity identifier ('player' or enemy ID)
     * @returns Pixel offset { x, y } or null if not active
     */
    getWindupOffset(entityId: string): { x: number; y: number } | null {
        const telegraph = this.telegraphs.get(entityId);
        if (!telegraph) return null;

        const now = performance.now();
        const elapsed = now - telegraph.startTime;
        const windupDuration = GameConfig.combat.lungeAnimationDuration; // Use config value for consistency

        // After wind-up completes, stop animating (stay at rest position)
        if (elapsed >= windupDuration) {
            this.telegraphs.delete(entityId); // Auto-cleanup after wind-up
            return null;
        }

        // Single pulse: 0ms → pull back → 300ms → return to rest
        // Use sine wave for smooth motion: starts at 0, peaks at middle, returns to 0
        const progress = elapsed / windupDuration; // 0.0 to 1.0
        const pulse = Math.sin(progress * Math.PI); // 0 → 1 → 0 (single hump)
        const distance = pulse * this.windupDistance;

        // Normalize direction vector
        const magnitude = Math.sqrt(
            telegraph.direction.x * telegraph.direction.x +
            telegraph.direction.y * telegraph.direction.y
        );

        if (magnitude === 0) return { x: 0, y: 0 };

        // Move in OPPOSITE direction (pull back before strike)
        const normalizedX = telegraph.direction.x / magnitude;
        const normalizedY = telegraph.direction.y / magnitude;

        return {
            x: -normalizedX * distance, // Negative = opposite direction
            y: -normalizedY * distance
        };
    }

    /**
     * Apply wind-up offsets to entity rendering positions
     * Called by RendererEntityRenderer when drawing entities
     * @param entityId Entity identifier ('player' or enemy ID)
     * @param baseX Base X position in pixels
     * @param baseY Base Y position in pixels
     * @returns Modified position { x, y }
     */
    applyWindupOffset(entityId: string, baseX: number, baseY: number): { x: number; y: number } {
        const offset = this.getWindupOffset(entityId);
        if (!offset) return { x: baseX, y: baseY };

        // Round to avoid sub-pixel rendering (causes blur)
        return {
            x: Math.round(baseX + offset.x),
            y: Math.round(baseY + offset.y)
        };
    }

    /**
     * Render is now a no-op - the offset is applied directly in entity rendering
     * Keeping this method for API compatibility
     */
    render(_ctx: CanvasRenderingContext2D, _tileSize: number): void {
        // No longer rendering overlays - animation is applied directly to enemy position
        return;
    }
}

export { RendererAttackTelegraph };
