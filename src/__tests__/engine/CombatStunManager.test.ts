import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatStunManager } from '../../runtime/services/engine/CombatStunManager';
import { GameConfig } from '../../config/GameConfig';

const makeState = (stunUntil = 0) => ({
    player: { stunUntil }
});

describe('CombatStunManager', () => {
    let now: number;

    beforeEach(() => {
        now = 1000;
        vi.spyOn(performance, 'now').mockReturnValue(now);
    });

    describe('constructor', () => {
        it('reads stunDuration from GameConfig', () => {
            const state = makeState();
            const manager = new CombatStunManager(state as never);
            // Verify it uses config (indirect: applyStun sets stunUntil = now + stunDuration)
            manager.applyStun();
            expect(state.player.stunUntil).toBe(now + GameConfig.combat.hitStunDuration);
        });
    });

    describe('applyStun', () => {
        it('sets stunUntil to now + stunDuration', () => {
            const state = makeState();
            const manager = new CombatStunManager(state as never);
            manager.applyStun();
            expect(state.player.stunUntil).toBe(now + GameConfig.combat.hitStunDuration);
        });

        it('overwrites a previous stun', () => {
            const state = makeState(9999);
            const manager = new CombatStunManager(state as never);
            manager.applyStun();
            expect(state.player.stunUntil).toBe(now + GameConfig.combat.hitStunDuration);
        });
    });

    describe('isStunned', () => {
        it('returns true when stunUntil is in the future', () => {
            const state = makeState(now + 500);
            const manager = new CombatStunManager(state as never);
            expect(manager.isStunned()).toBe(true);
        });

        it('returns false when stunUntil is in the past', () => {
            const state = makeState(now - 1);
            const manager = new CombatStunManager(state as never);
            expect(manager.isStunned()).toBe(false);
        });

        it('returns false when stunUntil equals now', () => {
            const state = makeState(now);
            const manager = new CombatStunManager(state as never);
            expect(manager.isStunned()).toBe(false);
        });

        it('returns false when stunUntil is 0 (initial state)', () => {
            const state = makeState(0);
            const manager = new CombatStunManager(state as never);
            expect(manager.isStunned()).toBe(false);
        });

        it('returns true immediately after applyStun', () => {
            const state = makeState();
            const manager = new CombatStunManager(state as never);
            manager.applyStun();
            expect(manager.isStunned()).toBe(true);
        });
    });

    describe('clearStun', () => {
        it('sets stunUntil to 0', () => {
            const state = makeState(now + 9999);
            const manager = new CombatStunManager(state as never);
            manager.clearStun();
            expect(state.player.stunUntil).toBe(0);
        });

        it('makes isStunned return false after clearing', () => {
            const state = makeState();
            const manager = new CombatStunManager(state as never);
            manager.applyStun();
            expect(manager.isStunned()).toBe(true);
            manager.clearStun();
            expect(manager.isStunned()).toBe(false);
        });
    });
});
