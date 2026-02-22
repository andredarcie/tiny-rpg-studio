import { RendererModuleBase } from './RendererModuleBase';
import { GameConfig } from '../../../config/GameConfig';

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
};

type SpawnOptions = {
    color?: string;
    count?: number;
    speed?: number;
    size?: number;
    spread?: number;
};

/**
 * RendererParticleSystem renders impact particles
 *
 * Small pixels fly from impact point with radial spread, gravity physics,
 * and alpha fade over lifetime. Pool limited to 100 particles max.
 */
class RendererParticleSystem extends RendererModuleBase {
    private particles: Particle[];
    private maxParticles: number;
    private gravity: number;

    constructor(renderer: ConstructorParameters<typeof RendererModuleBase>[0]) {
        super(renderer);
        this.particles = [];
        this.maxParticles = 100;
        this.gravity = GameConfig.combat.particles.gravity;
    }

    /**
     * Spawn an impact particle burst at the specified position
     * @param x X position in pixel coordinates
     * @param y Y position in pixel coordinates
     * @param options Optional configuration
     */
    spawnImpact(x: number, y: number, options: SpawnOptions = {}): void {
        if (!GameConfig.combat.particles.enabled) {
            return;
        }

        const config = GameConfig.combat.particles;
        const count = options.count ?? config.impactCount;
        const color = options.color ?? '#FF004D';
        const speed = options.speed ?? 1.5;
        const size = options.size ?? 2;
        const spread = options.spread ?? Math.PI * 2; // Full circle by default

        // Spawn particles in radial pattern
        for (let i = 0; i < count; i++) {
            // Check pool limit
            if (this.particles.length >= this.maxParticles) {
                break;
            }

            // Random angle within spread
            const angle = (spread * i / count) + (Math.random() * 0.3 - 0.15);
            // Random speed variation
            const particleSpeed = speed * (0.7 + Math.random() * 0.6);

            const particle: Particle = {
                x,
                y,
                vx: Math.cos(angle) * particleSpeed,
                vy: Math.sin(angle) * particleSpeed,
                life: config.lifetime,
                maxLife: config.lifetime,
                color,
                size
            };

            this.particles.push(particle);
        }
    }

    /**
     * Spawn impact at tile position
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @param options Optional configuration
     */
    spawnImpactAtTile(tileX: number, tileY: number, options: SpawnOptions = {}): void {
        const tileSize = 16;
        const pixelX = tileX * tileSize + tileSize / 2;
        const pixelY = tileY * tileSize + tileSize / 2;
        this.spawnImpact(pixelX, pixelY, options);
    }

    /**
     * Spawn critical impact with more particles
     */
    spawnCriticalImpact(x: number, y: number, options: SpawnOptions = {}): void {
        const config = GameConfig.combat.particles;
        this.spawnImpact(x, y, {
            count: config.criticalImpactCount,
            color: '#FFA300', // Orange for critical
            speed: 2.0,
            ...options
        });
    }

    /**
     * Spawn death particles
     */
    spawnDeath(x: number, y: number, options: SpawnOptions = {}): void {
        const config = GameConfig.combat.particles;
        this.spawnImpact(x, y, {
            count: config.deathCount,
            color: '#FF004D', // Red
            speed: 2.5,
            ...options
        });
    }

    /**
     * Update particle physics and lifetime
     * @param deltaTime Time since last update in milliseconds
     */
    update(deltaTime: number): void {
        const toRemove: number[] = [];

        this.particles.forEach((particle, index) => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Apply gravity
            particle.vy += this.gravity;

            // Update lifetime
            particle.life -= deltaTime;

            if (particle.life <= 0) {
                toRemove.push(index);
            }
        });

        // Remove expired particles (in reverse order)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.particles.splice(toRemove[i], 1);
        }
    }

    /**
     * Draw all active particles
     * @param ctx Canvas rendering context
     */
    draw(ctx: CanvasRenderingContext2D | null): void {
        if (!ctx || this.particles.length === 0) {
            return;
        }

        ctx.save();

        this.particles.forEach(particle => {
            // Calculate alpha based on remaining life
            const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));

            ctx.globalAlpha = alpha;
            ctx.fillStyle = particle.color;

            // Draw particle as small rectangle
            ctx.fillRect(
                Math.round(particle.x - particle.size / 2),
                Math.round(particle.y - particle.size / 2),
                particle.size,
                particle.size
            );
        });

        ctx.restore();

        // Auto-update (assuming ~16ms per frame at 60 FPS)
        this.update(16);
    }

    /**
     * Clear all active particles
     */
    clear(): void {
        this.particles = [];
    }

    /**
     * Get count of active particles
     */
    getActiveCount(): number {
        return this.particles.length;
    }
}

export { RendererParticleSystem };
