import { describe, expect, it, vi } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { OnlineStateBroadcaster } from '../../online/client/OnlineStateBroadcaster';
import { OnlineStateSync } from '../../online/client/OnlineStateSync';
import type { OnlineMessage } from '../../online/shared/protocol';

/**
 * Failing tests that prove two real bugs in the ONLINE subsystem.
 *
 * Each test encodes the CORRECT / EXPECTED behavior, so it FAILS against the
 * current (buggy) source and would PASS once the bug is fixed. No production
 * source is modified by this file.
 */

// ───────────────────────────────────────────────────────────────────────────
// BUG A (CRITICAL): Guest reduced to 0 HP keeps playing (no defeat).
//
// The online handler for 'player-took-damage'
//   src/online/OnlineModeApplication.ts:501-503
//       manager.client.on('player-took-damage', (msg) => {
//           if (msg.playerId !== manager.client.sessionToken) return;
//           gameEngine.gameState.damagePlayer(msg.damage);     // <-- return ignored
//       });
// applies damage straight through GameState.damagePlayer (GameState.ts:809-811),
// which delegates to StatePlayerManager.damage (StatePlayerManager.ts:146-176).
// That method clamps currentLives to >= 0 (line 170) and, only when lives reach
// 0, attempts a revive (line 171-173). It NEVER marks the game as defeated.
//
// Defeat normally fires through a completely different path:
//   CombatManager.applyDamageToPlayer -> onPlayerDefeated() (CombatManager.ts:563)
//   -> GameEngine.handlePlayerDefeat() -> gameState.setGameOver(true,'defeat')
//   (GameEngine.ts:105 + 804).
// The online damage path bypasses all of that, so a guest driven to 0 HP over
// the wire is never declared defeated and keeps playing as an "immortal ghost".
//
// Chosen defeat signal: GameState.isGameOver() / state.gameOver — the flag the
// rest of the engine relies on (GameStateLifecycle.ts:45-57, set by
// setGameOver, read by the game loop / game-over screen). We assert on THAT,
// invoking the exact method the online handler calls (gameState.damagePlayer).
// ───────────────────────────────────────────────────────────────────────────

describe('BUG A: online damage path does not trigger defeat at 0 HP', () => {
    it('marks the game as defeated once damagePlayer reduces the player to 0 lives', () => {
        // A fresh GameState starts the player with 3 lives, level 1, no skills
        // (so no revive). Skills disabled to guarantee no necromancer revive.
        const gameState = new GameState();
        gameState.game.disableSkills = true;
        gameState.resetGame();

        // Sanity: alive and not yet game over.
        expect(gameState.getLives()).toBe(3);
        expect(gameState.isGameOver()).toBe(false);

        // This is exactly what the 'player-took-damage' handler executes on the
        // guest: a raw damagePlayer() call with the wire-reported damage amount,
        // enough to reach 0 lives.
        gameState.damagePlayer(5);

        // The damage path DID drop the player to 0 lives...
        expect(gameState.getLives()).toBe(0);

        // ...so the engine MUST register defeat. This is the assertion that
        // proves the bug: today damagePlayer leaves state.gameOver === false,
        // so the guest stays "alive" at 0 HP. EXPECTED (correct) behavior is
        // a game-over once lives hit zero.
        expect(gameState.isGameOver()).toBe(true); // FAILS today -> proves the gap
    });
});

// ───────────────────────────────────────────────────────────────────────────
// BUG B (CRITICAL): World-state diffs are delta-encoded and the `tick` sequence
// number is never used, so a DROPPED diff is never reconciled (permanent desync).
//
// Broadcaster (src/online/client/OnlineStateBroadcaster.ts):
//   - broadcastDiff() only emits fields that CHANGED since the last send and
//     mutates lastVariables/lastObjects/lastItems/lastEnemySnapshot accordingly
//     (lines ~87-143), so a one-shot change is sent exactly once and never
//     re-sent.
//   - It stamps every diff with `tick: ++this.tick` (line 147) — a monotonic
//     sequence number meant to let the receiver detect a gap.
//
// Guest (src/online/client/OnlineStateSync.ts):
//   - applyDiff (lines 34-40) and applyDiffFields (lines 93-98) consume the
//     diff fields but IGNORE diff.tick entirely. There is no lastAppliedTick,
//     no gap detection, and no resync request.
//
// Consequence: if diff #1 (carrying a one-shot variable flip) is lost in
// transit, that change is gone forever. A later, unrelated diff #2 carries only
// its own field, so the guest's variable stays permanently wrong even though
// the tick numbers (1 then 2) reveal the gap.
//
// PRIMARY test wires the real broadcaster + sync (as OnlinePressurePlateSync /
// OnlineVariableSync tests do) and asserts host == guest after a dropped diff.
// ───────────────────────────────────────────────────────────────────────────

describe('BUG B: dropped world-state diff is never reconciled (tick gap ignored)', () => {
    it('guest state still converges to the host after a single diff is dropped', () => {
        // Two independent worlds, each with two boolean variables.
        const host = new GameState();
        const guest = new GameState();
        host.game.disableSkills = true;
        guest.game.disableSkills = true;
        host.game.variables = [
            { id: 'var-1', value: false },
            { id: 'var-2', value: false },
        ];
        guest.game.variables = [
            { id: 'var-1', value: false },
            { id: 'var-2', value: false },
        ];

        const sent: OnlineMessage[] = [];
        const client = { send: vi.fn((m: OnlineMessage) => sent.push(m)) };
        const broadcaster = new OnlineStateBroadcaster(client as never, host as never);
        const sync = new OnlineStateSync(guest as never);

        // Guest must have a snapshot before diffs apply (matches production order).
        sync.applySnapshot({ enemies: {}, variables: {}, objects: {}, items: {}, players: [] });

        // Seed the broadcaster baseline (first diff captures the all-false state).
        broadcaster.triggerNow();
        sent.length = 0;

        // --- Host one-shot change #1: flip var-1 true. Produces diff #1. ---
        host.setVariableValue('var-1', true);
        broadcaster.triggerNow();
        const diff1 = sent.find((m) => m.type === 'world-state-diff');
        expect(diff1).toBeDefined();
        // DROP diff #1: we deliberately do NOT apply it to the guest (simulating
        // a lost packet / a reconnect gap). The guest never sees var-1 -> true.
        sent.length = 0;

        // --- Host unrelated change #2: flip var-2 true. Produces diff #2. ---
        host.setVariableValue('var-2', true);
        broadcaster.triggerNow();
        const diff2 = sent.find((m) => m.type === 'world-state-diff');
        expect(diff2).toBeDefined();
        if (diff2?.type === 'world-state-diff') {
            // The two diffs have consecutive ticks (1 then 2): a robust protocol
            // could detect the gap from this jump and reconcile.
            if (diff1?.type === 'world-state-diff') {
                expect(diff2.diff.tick).toBe(diff1.diff.tick + 1);
            }
            sync.applyDiff(diff2.diff);
        }

        // diff #2 applied: var-2 matches on both sides (this part works today).
        expect(host.isVariableOn('var-2')).toBe(true);
        expect(guest.isVariableOn('var-2')).toBe(true);

        // The host has var-1 === true. After receiving diff #2 (whose tick proves
        // a diff was skipped), the guest MUST eventually agree. EXPECTED (correct)
        // behavior: the dropped one-shot change is reconciled (e.g. via a
        // tick-gap-triggered snapshot resend). Today the change is lost forever
        // because the broadcaster never re-sends an unchanged value and the sync
        // ignores diff.tick -> guest != host. This assertion FAILS, proving the bug.
        expect(host.isVariableOn('var-1')).toBe(true);
        expect(guest.isVariableOn('var-1')).toBe(true); // FAILS today -> permanent desync
    });

    // SECONDARY (characterization) test, documenting the root cause directly.
    //
    // The cleanest fix is for OnlineStateSync to track the last applied tick and
    // signal that it needs a resync when a gap is observed. No such mechanism
    // exists today: the sync never reads diff.tick. This test asserts the sync
    // can report the last tick it applied, so a coordinator could compare ticks
    // and request a snapshot. It FAILS today (no such API / no tick tracking),
    // which is the deterministic, code-level evidence of the missing reconciliation.
    //
    // LIMITATION: this is a characterization test of an ABSENT feature, not of a
    // wrong computed value. It documents *why* the primary test above cannot
    // converge — the receiver has no way to notice the dropped tick. We assert on
    // a small, well-defined contract (a readable last-applied tick) rather than
    // dictating the exact reconciliation strategy.
    it('OnlineStateSync tracks the last applied diff tick so a gap can be detected', () => {
        const guest = new GameState();
        guest.game.disableSkills = true;
        guest.game.variables = [{ id: 'var-1', value: false }];

        const sync = new OnlineStateSync(guest as never);
        sync.applySnapshot({ enemies: {}, variables: {}, objects: {}, items: {}, players: [] });

        // Apply tick #1, then tick #3 — a clear one-tick gap (#2 was dropped).
        sync.applyDiff({ tick: 1, variables: { 0: 1 } });
        sync.applyDiff({ tick: 3, variables: { 0: 0 } });

        // A reconciliation-capable receiver must expose which tick it last
        // applied so the gap (3 follows 1) can be noticed and a resync requested.
        const syncWithTick = sync as unknown as { lastAppliedTick?: number };
        expect(syncWithTick.lastAppliedTick).toBe(3); // FAILS today: undefined (tick ignored)
    });
});
