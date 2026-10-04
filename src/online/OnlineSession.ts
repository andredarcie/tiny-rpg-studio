import type { GameEngine } from '../runtime/services/GameEngine';
import { OnlineManager, type OnlineManagerOptions } from './client/OnlineManager';
import { OnlinePositionSender } from './client/OnlinePositionSender';
import { OnlineStateBroadcaster } from './client/OnlineStateBroadcaster';
import { OnlineStateSync } from './client/OnlineStateSync';
import { OnlineInputRelay } from './client/OnlineInputRelay';
import { ShareConstants } from '../runtime/infra/share/ShareConstants';

export type OnlineSessionOptions = OnlineManagerOptions;
export type OnlineSession = { start(): void; disconnect(): void };
type Remote = { id: string; name: string; roomIndex: number; x: number; y: number; alive: boolean; playerIndex: number; facing: string };

export function connectOnlineSession(engine: GameEngine, options: OnlineSessionOptions): OnlineSession {
    if (!engine.gameState.game.online?.enabled) throw Error('Enable online mode in the project before connecting');
    const manager = new OnlineManager(options);
    const sender = new OnlinePositionSender(manager.client, engine.gameState);
    const broadcaster = new OnlineStateBroadcaster(manager.client, engine.gameState);
    const sync = new OnlineStateSync(engine.gameState, () => engine.draw());
    const relay = new OnlineInputRelay(manager.client);
    const remote = new Map<string, Remote>();
    const unsubscribe: (() => void)[] = [];
    let disconnected = false;
    const renderPlayers = () => {
        engine.renderer.entityRenderer.setRemotePlayers([...remote.values()]);
        engine.online.setRemotePlayersForEnemyAI([...remote.values()]);
        engine.online.setActiveRooms(new Set([engine.gameState.getPlayer()?.roomIndex ?? 0, ...[...remote.values()].filter(player => player.alive).map(player => player.roomIndex)]));
    };
    const configureRole = () => {
        engine.online.setMode(manager.isHost ? 'online-host' : 'online-guest');
        if (manager.isHost) { broadcaster.start(); engine.online.onStateChanged = () => broadcaster.triggerNow(); }
        else { broadcaster.stop(); engine.online.onStateChanged = () => sender.sendNow(true); }
        engine.dialogManager.onNpcReward = manager.isHost ? null : (variableId, value) => {
            const index = ShareConstants.VARIABLE_IDS.indexOf(variableId);
            if (index >= 0) manager.client.send({ type: 'variable-changed', variableIndex: index, newValue: value ? 1 : 0 });
        };
        renderPlayers();
    };
    sender.onRoomChanged = () => { if (manager.isHost) renderPlayers(); };
    const removeRemote = (id: string) => {
        const player = remote.get(id);
        remote.delete(id);
        renderPlayers();
        if (manager.isHost && player) {
            engine.online.checkPressurePlatesForGuest(-1, -1, -1);
            engine.online.resetPushBoxesForRoom(player.roomIndex);
        }
    };
    manager.onHostPromoted(() => {
        configureRole();
        manager.client.send({ type: 'full-state-snapshot', snapshot: broadcaster.buildSnapshot() });
    });
    manager.onGameStart(() => {
        configureRole();
        if (!manager.isHost) sync.reset();
        const spawn = engine.gameState.game.online?.spawnPoints?.find(point => point.role === (manager.isHost ? 'p1' : 'p2'));
        if (spawn) engine.gameState.setPlayerPosition(spawn.x, spawn.y, spawn.roomIndex);
        sender.stop();
        sender.start();
        renderPlayers();
        if (manager.isHost) manager.client.send({ type: 'full-state-snapshot', snapshot: broadcaster.buildSnapshot() });
        engine.draw();
    });
    manager.onSnapshot(snapshot => { if (!manager.isHost) sync.applySnapshot(snapshot); });
    manager.onGameOver(() => engine.handleGameCompletion());
    unsubscribe.push(manager.client.on('world-state-diff', message => { if (!manager.isHost) sync.applyDiff(message.diff); }));
    unsubscribe.push(manager.client.on('snapshot-request', message => { if (manager.isHost) manager.client.send({ type: 'full-state-snapshot', snapshot: broadcaster.buildSnapshot(), targetId: message.targetId }); }));
    unsubscribe.push(manager.client.on('player-position', message => {
        if (message.playerId === manager.client.sessionToken) return;
        const previous = remote.get(message.playerId);
        remote.set(message.playerId, { id: message.playerId, name: '', roomIndex: message.roomIndex, x: message.x, y: message.y, alive: message.hp > 0, playerIndex: manager.isHost ? 1 : 0, facing: message.facing });
        renderPlayers();
        if (manager.isHost) {
            if (previous && previous.roomIndex !== message.roomIndex) engine.online.resetPushBoxesForRoom(previous.roomIndex);
            if (!previous || previous.x !== message.x || previous.y !== message.y || previous.roomIndex !== message.roomIndex) {
                engine.online.checkPressurePlatesForGuest(message.x, message.y, message.roomIndex);
            }
        }
        engine.draw();
    }));
    unsubscribe.push(manager.client.on('player-list', message => {
        const tokens = new Set(message.players.map(player => player.sessionToken));
        for (const id of remote.keys()) if (!tokens.has(id)) removeRemote(id);
        renderPlayers();
    }));
    unsubscribe.push(manager.client.on('player-leave', message => removeRemote(message.playerId)));
    unsubscribe.push(manager.client.on('player-input', message => {
        if (!manager.isHost || message.playerId === manager.client.sessionToken) return;
        const position = remote.get(message.playerId);
        if (message.action === 'attack' && message.enemyId) engine.online.processGuestAttackDamage(message.enemyId, message.damage);
        else if (message.action === 'interact') {
            const x = message.x ?? position?.x, y = message.y ?? position?.y, room = message.roomIndex ?? position?.roomIndex;
            if (x !== undefined && y !== undefined && room !== undefined) engine.online.processGuestInteract(x, y, room);
        } else if (message.action === 'move' && position && message.dx !== undefined && message.dy !== undefined) engine.online.processGuestMove(position.x, position.y, position.roomIndex, message.dx, message.dy);
    }));
    unsubscribe.push(manager.client.on('enemy-died', message => { if (!manager.isHost && sync.snapshotApplied) sync.applyEnemyDeath(message.enemyId, { roomIndex: message.roomIndex }); }));
    unsubscribe.push(manager.client.on('object-triggered', message => { if (message.byPlayerId !== manager.client.sessionToken) engine.online.applyRemoteObjectTriggered(message.objectId, message.roomIndex, message.newState); }));
    unsubscribe.push(manager.client.on('item-picked', message => {
        if (message.byPlayerId === manager.client.sessionToken) return;
        const object = engine.gameState.game.objects.find(entry => entry.id === message.itemId);
        const item = engine.gameState.game.items.find(entry => `item-${entry.roomIndex}-${entry.x}-${entry.y}` === message.itemId);
        if (object) object.collected = true; if (item) item.collected = true; engine.draw();
    }));
    unsubscribe.push(manager.client.on('variable-changed', message => {
        if (manager.isHost) { const id = ShareConstants.VARIABLE_IDS[message.variableIndex]; if (id) engine.setRuntimeVariable(id, Boolean(message.newValue)); }
    }));
    unsubscribe.push(manager.client.on('player-took-damage', message => { if (message.playerId === manager.client.sessionToken) engine.gameState.damagePlayer(message.damage); }));
    unsubscribe.push(manager.client.on('player-died', message => { const player = remote.get(message.playerId); if (player) player.alive = false; renderPlayers(); }));
    unsubscribe.push(manager.client.on('player-respawned', message => { const player = remote.get(message.playerId); if (player) Object.assign(player, { alive: true, x: message.x, y: message.y, roomIndex: message.roomIndex }); renderPlayers(); }));
    engine.online.onMove = (dx, dy) => { if (!manager.isHost) relay.sendMove(dx, dy); sender.sendNow(); };
    engine.online.onInteract = (x, y, room) => { if (!manager.isHost) relay.sendInteract(x, y, room); };
    engine.enemyManager.onGuestAttack = enemyId => { const damage = engine.online.prepareGuestAttack(enemyId); if (damage !== null) relay.sendAttack(enemyId, damage); };
    engine.enemyManager.onEnemyAttackedRemotePlayer = (playerId, damage) => { if (manager.isHost) manager.client.send({ type: 'player-took-damage', playerId, damage }); };
    engine.online.onEnemyDied = (enemyId, roomIndex) => { if (manager.isHost) manager.client.send({ type: 'enemy-died', enemyId, roomIndex }); };
    engine.online.onItemPicked = (itemId, roomIndex) => { manager.client.send({ type: 'item-picked', itemId, roomIndex, byPlayerId: manager.client.sessionToken }); if (!manager.isHost) sender.sendNow(true); };
    engine.online.onObjectTriggered = (objectId, roomIndex, newState) => { manager.client.send({ type: 'object-triggered', objectId, roomIndex, newState, byPlayerId: manager.client.sessionToken }); if (!manager.isHost) sender.sendNow(true); };
    engine.online.onPlayerDefeated = () => manager.client.send({ type: 'player-died', playerId: manager.client.sessionToken });
    engine.online.onGameCompletion = () => manager.client.send({ type: 'game-over', winnerId: manager.client.sessionToken, winnerName: options.playerName });
    engine.online.onRespawned = () => { const player = engine.gameState.getPlayer(); if (player) manager.client.send({ type: 'player-respawned', playerId: manager.client.sessionToken, x: player.x, y: player.y, roomIndex: player.roomIndex }); };
    const disconnect = () => {
        if (disconnected) return; disconnected = true;
        unsubscribe.forEach(remove => remove()); sender.stop(); broadcaster.stop(); sync.dispose(); manager.disconnect();
        for (const key of ['onMove', 'onInteract', 'onEnemyDied', 'onItemPicked', 'onObjectTriggered', 'onPlayerDefeated', 'onGameCompletion', 'onRespawned', 'onStateChanged'] as const) engine.online[key] = null;
        sender.onRoomChanged = null; engine.dialogManager.onNpcReward = null;
        engine.enemyManager.onGuestAttack = null; engine.enemyManager.onEnemyAttackedRemotePlayer = null;
        remote.clear(); engine.renderer.entityRenderer.setRemotePlayers([]); engine.online.setRemotePlayersForEnemyAI([]); engine.online.setActiveRooms(null); engine.online.setMode('solo');
    };
    try { manager.connect(); } catch (error) { disconnect(); throw error; }
    return { start: () => { if (disconnected) throw Error('Session is disconnected'); manager.client.send({ type: 'game-start' }); }, disconnect };
}
