import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEngine } from '../../runtime/services/GameEngine';
const mocks = vi.hoisted(() => ({ isHost: true, applySnapshot: vi.fn(), applyDiff: vi.fn(), dispose: vi.fn(), reset: vi.fn(), send: vi.fn(), sendNow: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), handlers: new Map<string, (message: never) => void>(), start: vi.fn(), stop: vi.fn() }));
vi.mock('../../online/client/OnlineManager', () => ({ OnlineManager: class {
    get isHost() { return mocks.isHost; }
    client = { sessionToken: 'me', on: (event: string, callback: (message: never) => void) => { mocks.handlers.set(event, callback); return () => mocks.handlers.delete(event); }, send: mocks.send };
    connect = mocks.connect;
    disconnect = mocks.disconnect;
    onGameStart(callback: (message: never) => void) { mocks.handlers.set('game-start', callback); }
    onHostPromoted(callback: (message: never) => void) { mocks.handlers.set('host-promoted', callback); }
    onSnapshot(callback: (message: never) => void) { mocks.handlers.set('snapshot', callback); }
    onGameOver(callback: (message: never) => void) { mocks.handlers.set('game-over', callback); }
} }));
vi.mock('../../online/client/OnlinePositionSender', () => ({ OnlinePositionSender: class { start = mocks.start; stop = mocks.stop; sendNow = mocks.sendNow; } }));
vi.mock('../../online/client/OnlineStateBroadcaster', () => ({ OnlineStateBroadcaster: class { start = mocks.start; stop = mocks.stop; triggerNow = vi.fn(); buildSnapshot() { return {}; } } }));
vi.mock('../../online/client/OnlineStateSync', () => ({ OnlineStateSync: class { reset = mocks.reset; applySnapshot = mocks.applySnapshot; applyDiff = mocks.applyDiff; dispose = mocks.dispose; } }));
import { connectOnlineSession } from '../../online/OnlineSession';

describe('embedded multiplayer lifecycle', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.handlers.clear(); mocks.isHost = true; });
    it('applies host snapshots and diffs to the guest and removes subscriptions on disconnect', () => {
        mocks.isHost = false;
        const engine = { gameState: { game: { online: { enabled: true, spawnPoints: [{ role: 'p2', x: 2, y: 3, roomIndex: 1 }] } }, setPlayerPosition: vi.fn(), getPlayer: () => ({ roomIndex: 0 }) }, dialogManager: { onNpcReward: null }, online: { setMode: vi.fn(), setRemotePlayersForEnemyAI: vi.fn(), setActiveRooms: vi.fn(), checkPressurePlatesForGuest: vi.fn(), resetPushBoxesForRoom: vi.fn() }, enemyManager: {}, renderer: { entityRenderer: { setRemotePlayers: vi.fn() } }, handleGameCompletion: vi.fn(), draw: vi.fn() };
        const session = connectOnlineSession(engine as unknown as GameEngine, { partyHost: 'test', roomId: 'room', playerName: 'Guest' });
        mocks.handlers.get('game-start')?.(undefined as never);
        expect(engine.online.setMode).toHaveBeenCalledWith('online-guest');
        expect(engine.gameState.setPlayerPosition).toHaveBeenCalledWith(2, 3, 1);
        const snapshot = { variables: [true] }; const diff = { variables: [false] };
        mocks.handlers.get('snapshot')?.(snapshot as never);
        mocks.handlers.get('world-state-diff')?.({ diff } as never);
        expect(mocks.applySnapshot).toHaveBeenCalledWith(snapshot);
        expect(mocks.applyDiff).toHaveBeenCalledWith(diff);
        mocks.handlers.get('game-start')?.(undefined as never);
        expect(mocks.reset).toHaveBeenCalledTimes(2);
        const runtime = engine as unknown as GameEngine;
        runtime.dialogManager.onNpcReward?.('var-1', true);
        expect(mocks.send).toHaveBeenCalledWith({ type: 'variable-changed', variableIndex: 0, newValue: 1 });
        runtime.online.onStateChanged?.();
        expect(mocks.sendNow).toHaveBeenCalledWith(true);
        session.disconnect();
        expect(runtime.dialogManager.onNpcReward).toBeNull();
        expect(mocks.handlers.has('world-state-diff')).toBe(false);
        expect(mocks.dispose).toHaveBeenCalledOnce();
    });
    it('uses the existing engine, switches host mode, and disconnects exactly once', () => {
        const engine = { gameState: { game: { online: { enabled: true } }, setPlayerPosition: vi.fn(), getPlayer: () => ({ roomIndex: 0 }) }, dialogManager: { onNpcReward: null }, online: { setMode: vi.fn(), setRemotePlayersForEnemyAI: vi.fn(), setActiveRooms: vi.fn(), checkPressurePlatesForGuest: vi.fn(), resetPushBoxesForRoom: vi.fn() }, enemyManager: {}, renderer: { entityRenderer: { setRemotePlayers: vi.fn() } }, handleGameCompletion: vi.fn(), draw: vi.fn() };
        const session = connectOnlineSession(engine as unknown as GameEngine, { partyHost: 'test', roomId: 'room', playerName: 'Player' });
        expect(mocks.connect).toHaveBeenCalledOnce();
        mocks.handlers.get('game-start')?.(undefined as never);
        expect(engine.online.setMode).toHaveBeenCalledWith('online-host');
        mocks.handlers.get('player-position')?.({ playerId: 'guest', roomIndex: 1, x: 2, y: 3, hp: 5, facing: 'right' } as never);
        expect(engine.online.checkPressurePlatesForGuest).toHaveBeenCalledWith(2, 3, 1);
        expect(engine.online.setActiveRooms).toHaveBeenLastCalledWith(new Set([0, 1]));
        mocks.handlers.get('player-position')?.({ playerId: 'guest', roomIndex: 2, x: 1, y: 1, hp: 5, facing: 'right' } as never);
        expect(engine.online.resetPushBoxesForRoom).toHaveBeenCalledWith(1);
        mocks.handlers.get('player-leave')?.({ playerId: 'guest' } as never);
        expect(engine.online.resetPushBoxesForRoom).toHaveBeenCalledWith(2);
        expect(engine.online.checkPressurePlatesForGuest).toHaveBeenLastCalledWith(-1, -1, -1);
        expect(engine.online.setActiveRooms).toHaveBeenLastCalledWith(new Set([0]));
        session.disconnect(); session.disconnect();
        expect(mocks.disconnect).toHaveBeenCalledOnce();
        expect(engine.online.setMode).toHaveBeenLastCalledWith('solo');
    });
});

