import type { RuntimeState } from '../../../types/gameState';
import { GameConfig } from '../../../config/GameConfig';

/**
 * CombatStunManager handles hit stun mechanics
 *
 * Hit stun prevents player movement briefly after taking damage,
 * adding weight and impact to combat encounters.
 */
class CombatStunManager {
    private state: RuntimeState;
    private stunDuration: number;

    constructor(state: RuntimeState) {
        this.state = state;
        this.stunDuration = GameConfig.combat.hitStunDuration;
    }

    /**
     * Apply stun to the player for the configured duration
     */
    applyStun(): void {
        const player = this.state.player;
        const now = performance.now();
        player.stunUntil = now + this.stunDuration;
    }

    /**
     * Check if the player is currently stunned
     * @returns true if player cannot move due to stun
     */
    isStunned(): boolean {
        const player = this.state.player;
        const now = performance.now();
        return now < player.stunUntil;
    }

    /**
     * Clear any active stun immediately
     */
    clearStun(): void {
        const player = this.state.player;
        player.stunUntil = 0;
    }
}

export { CombatStunManager };
