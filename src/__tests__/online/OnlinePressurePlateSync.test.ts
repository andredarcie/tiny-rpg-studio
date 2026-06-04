import { describe, expect, it, vi } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { GameEngine } from '../../runtime/services/GameEngine';
import { InteractionManager } from '../../runtime/services/engine/InteractionManager';
import { OnlineStateBroadcaster } from '../../online/client/OnlineStateBroadcaster';
import { OnlineStateSync } from '../../online/client/OnlineStateSync';
import type { OnlineMessage } from '../../online/shared/protocol';

/**
 * Reproduces a production bug reported in online mode:
 *
 *   "The guest pulls the lever (switch); it really toggles and both clients see
 *    the change. BUT on the guest the lever does not influence the pressure
 *    plate, while on the host it does."
 *
 * A pressure plate's visual/active state is driven by `isVariableOn(variableId)`
 * (see RendererEntityRenderer). A switch wired to that same variable therefore
 * "influences" the plate by toggling the variable.
 *
 * Pressure plates are meant to be HOST-AUTHORITATIVE: the host evaluates every
 * player's position and broadcasts the resulting variable, and the guest only
 * mirrors it (see itemTypes.ts PRESSURE_PLATE comment, and the `guestMode` guard
 * inside InteractionManager.handleSwitch).
 *
 * The bug: InteractionManager.checkPressurePlates() is NOT guarded by guestMode,
 * so the guest re-evaluates pressure plates locally from its own position only.
 * When the guest moves off a plate it writes `setVariableValue(var, false)`,
 * clobbering the value the host had set via the lever. Because the broadcaster
 * only emits diffs and the host's value never changed, the host never re-syncs
 * the variable — leaving the guest permanently out of sync.
 */

function buildState() {
    const state = new GameState();
    state.game.variables = [{ id: 'var-1', value: false }];
    state.game.objects = [
        // Lever (switch) and pressure plate are wired to the same variable, so the
        // lever drives the plate's lit/active state.
        { id: 'switch-0', type: 'switch', x: 1, y: 1, roomIndex: 0, on: false, variableId: 'var-1' },
        { id: 'plate-0', type: 'pressure-plate', x: 3, y: 3, roomIndex: 0, activated: false, variableId: 'var-1' },
    ];
    return state;
}

describe('online pressure-plate sync (lever -> plate)', () => {
    it('guest keeps the lever-driven plate lit; local plate eval must not clobber the synced variable', () => {
        const host = buildState();
        const guest = buildState();
        const dialog = { showDialog: vi.fn() };

        const hostInteraction = new InteractionManager(host as never, dialog);
        const guestInteraction = new InteractionManager(guest as never, dialog);
        guestInteraction.guestMode = true; // guest is non-authoritative

        const sent: OnlineMessage[] = [];
        const client = { send: vi.fn((m: OnlineMessage) => sent.push(m)) };
        const broadcaster = new OnlineStateBroadcaster(client as never, host as never);
        const sync = new OnlineStateSync(guest as never);
        sync.applySnapshot({ enemies: {}, variables: {}, objects: {}, items: {}, players: [] });

        const flushDiff = () => {
            sent.length = 0;
            broadcaster.triggerNow();
            const diffMsg = sent.find((m) => m.type === 'world-state-diff');
            if (diffMsg?.type === 'world-state-diff') sync.applyDiff(diffMsg.diff);
        };

        // Seed broadcaster baseline (everything false).
        broadcaster.triggerNow();

        // 1) Guest pulls the lever. The host applies it authoritatively and broadcasts.
        hostInteraction.handleSwitchInteractAt(1, 1, 0);
        flushDiff();

        // The lever toggled and BOTH clients see the plate lit. (This part works today.)
        expect(host.isVariableOn('var-1')).toBe(true);
        expect(guest.isVariableOn('var-1')).toBe(true);

        // 2) Guest wanders across the plate tile and steps off again — ordinary play.
        //    The guest's local pressure-plate evaluation runs each frame.
        guest.setPlayerPosition(3, 3, 0);
        guestInteraction.handlePlayerInteractions(); // on the plate
        guest.setPlayerPosition(3, 4, 0);
        guestInteraction.handlePlayerInteractions(); // off the plate

        // 3) The host's authoritative value never changed (the lever is still on),
        //    so the broadcaster sends no correction.
        flushDiff();

        // The host still shows the plate lit (lever is on)...
        expect(host.isVariableOn('var-1')).toBe(true);
        // ...and the guest MUST too. Today the guest's local eval clobbered it to
        // false and the host never re-synced it -> the lever stops influencing the
        // plate on the guest. This assertion currently FAILS, reproducing the bug.
        expect(guest.isVariableOn('var-1')).toBe(true);
    });

    // The production symptom: the guest sees the lever flip but the plate stays dark.
    // The lever's visual `on` is delivered by the (reliable) `object-triggered`
    // message, while the plate is derived from the variable, which depends on a
    // SEPARATE world-state-diff. If that diff is late/missed/overwritten, the lever
    // updates but the plate does not. The guest must propagate the switch's variable
    // straight from the `object-triggered` signal so everything derived from it
    // (pressure plates, variable-doors, LEDs, gates) updates together with the lever.
    it('guest applies a switch object-trigger and lights the plate WITHOUT any variable diff', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const engine = new GameEngine(canvas);
        engine.setOnlineMode('online-guest');

        engine.gameState.game.variables = [{ id: 'var-1', value: false }];
        engine.gameState.game.objects = [
            { id: 'switch-0', type: 'switch', x: 1, y: 1, roomIndex: 0, on: false, variableId: 'var-1' },
            { id: 'plate-0', type: 'pressure-plate', x: 3, y: 3, roomIndex: 0, activated: false, variableId: 'var-1' },
        ];

        // Guest receives ONLY the lever signal (object-triggered). No world-state-diff.
        engine.applyRemoteObjectTriggered('switch-0', 0, true);

        const lever = (engine.gameState.getObjectsForRoom(0) as Array<{ id: string; on?: boolean }>)
            .find((o) => o.id === 'switch-0');
        // The lever flips (this already worked) ...
        expect(lever?.on).toBe(true);
        // ... and the plate, derived from the same variable, lights up too.
        expect(engine.isVariableOn('var-1')).toBe(true);
    });
});
