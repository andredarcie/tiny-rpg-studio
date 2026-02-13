import { RendererModuleBase } from './RendererModuleBase';

type TelegraphState = {
    entityId: string;
    startTime: number;
    direction: { x: number; y: number }; // Direction TO player (we'll move opposite)
};

/**
 * RendererAttackTelegraph handles wind-up animations before enemy attacks
 *
 * Enemies pull back slightly in the opposite direction before attacking,
 * creating a visual "charging" effect that telegraphs their intent.
 */
class RendererAttackTelegraph extends RendererModuleBase {
    private telegraphs: Map<string, TelegraphState>;
    private pulseSpeed: number;
    private windupDistance: number; // Max pixels to pull back

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.telegraphs = new Map();
        this.pulseSpeed = 0.02; // Much faster!
        this.windupDistance = 4; // Pull back 4 pixels max for more visibility
    }

    /**
     * Activate telegraph for an enemy that's about to attack
     * @param enemyId Enemy identifier
     * @param directionToPlayer Direction vector from enemy to player
     */
    activateTelegraph(enemyId: string, directionToPlayer: { x: number; y: number }): void {
        if (!this.telegraphs.has(enemyId)) {
            this.telegraphs.set(enemyId, {
                entityId: enemyId,
                startTime: performance.now(),
                direction: { ...directionToPlayer }
            });
        }
    }

    /**
     * Remove telegraph warning from enemy
     * @param enemyId Enemy identifier
     */
    deactivateTelegraph(enemyId: string): void {
        this.telegraphs.delete(enemyId);
    }

    /**
     * Clear all active telegraphs
     */
    clearAll(): void {
        this.telegraphs.clear();
    }

    /**
     * Check if enemy has active attack warning
     * @param enemyId Enemy identifier
     * @returns true if enemy is telegraphing an attack
     */
    isActive(enemyId: string): boolean {
        return this.telegraphs.has(enemyId);
    }

    /**
     * Get wind-up offset for an enemy (pixels to offset in opposite direction)
     * ONE-TIME animation, not continuous loop
     * @param enemyId Enemy identifier
     * @returns Pixel offset { x, y } or null if not active
     */
    getWindupOffset(enemyId: string): { x: number; y: number } | null {
        const telegraph = this.telegraphs.get(enemyId);
        if (!telegraph) return null;

        const now = performance.now();
        const elapsed = now - telegraph.startTime;
        const windupDuration = 300; // Single wind-up takes 300ms

        // After wind-up completes, stop animating (stay at rest position)
        if (elapsed >= windupDuration) {
            this.telegraphs.delete(enemyId); // Auto-cleanup after wind-up
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
     * Apply wind-up offsets to enemy rendering positions
     * Called by RendererEntityRenderer when drawing enemies
     * @param enemyId Enemy identifier
     * @param baseX Base X position in pixels
     * @param baseY Base Y position in pixels
     * @returns Modified position { x, y }
     */
    applyWindupOffset(enemyId: string, baseX: number, baseY: number): { x: number; y: number } {
        const offset = this.getWindupOffset(enemyId);
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
