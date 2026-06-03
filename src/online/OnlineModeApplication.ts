import { GameEngine } from '../runtime/services/GameEngine';
import { TextResources } from '../runtime/adapters/TextResources';
import { ShareConstants } from '../runtime/infra/share/ShareConstants';
import { OnlineInputRelay } from './client/OnlineInputRelay';
import { OnlineManager } from './client/OnlineManager';
import { resolvePartyKitHost } from './client/PartyKitHost';
import { OnlinePositionSender } from './client/OnlinePositionSender';
import { OnlineRoomTracker } from './client/OnlineRoomTracker';
import { OnlineStateBroadcaster } from './client/OnlineStateBroadcaster';
import { OnlineStateSync } from './client/OnlineStateSync';
import { ConnectionIndicator } from './ui/ConnectionIndicator';
import { LobbyScreen } from './ui/LobbyScreen';
import { OnlineToast } from './ui/OnlineToast';
import { PlayerList } from './ui/PlayerList';
import { PlayerNameModal } from './ui/PlayerNameModal';
import { ServerStatusModal, type ServerStatus } from './ui/ServerStatusModal';
import { WaitingScreen } from './ui/WaitingScreen';

type LoadSharedGame = (gameEngine: GameEngine) => void;

type RemotePlayerState = {
    id: string;
    name: string;
    roomIndex: number;
    x: number;
    y: number;
    alive: boolean;
    playerIndex: number;
    facing: string;
};

const getTextResource = (key: string, fallback = ''): string => {
    const value = TextResources.get(key, fallback) as string;
    return value || fallback || key || '';
};

export class OnlineModeApplication {
    static boot(guid: string, loadSharedGame: LoadSharedGame): void {
        const gameCanvas = document.getElementById('game-canvas');
        if (!(gameCanvas instanceof HTMLCanvasElement)) return;

        const gameEngine = new GameEngine(gameCanvas);
        loadSharedGame(gameEngine);

        this.prepareOnlineLayout();
        const tabsLinks = document.querySelector<HTMLElement>('.tabs-links');
        const partyHost = resolvePartyKitHost();

        const modal = new PlayerNameModal({
            onConfirm: (playerName) => {
                this.connectSession({
                    guid,
                    playerName,
                    partyHost,
                    tabsLinks,
                    gameEngine,
                });
            },
        });
        modal.show();
    }

    private static prepareOnlineLayout(): void {
        document.body.classList.add('online-mode');
        document.body.classList.add('game-mode');
        document.body.classList.remove('editor-mode');
        document.querySelectorAll<HTMLElement>('.tab-button[data-tab="editor"]').forEach((el) => {
            el.style.display = 'none';
        });
        document.getElementById('btn-explore')?.remove();
    }

    private static connectSession({
        guid,
        playerName,
        partyHost,
        tabsLinks,
        gameEngine,
    }: {
        guid: string;
        playerName: string;
        partyHost: string;
        tabsLinks: HTMLElement | null;
        gameEngine: GameEngine;
    }): void {
        const manager = new OnlineManager({ partyHost, roomId: guid, playerName });
        let connectionState: ServerStatus = 'connecting';
        let playerList: PlayerList | null = null;
        let broadcaster: OnlineStateBroadcaster | null = null;
        let sync: OnlineStateSync | null = null;
        let waitingScreen: WaitingScreen | null = null;
        let positionSender: OnlinePositionSender | null = null;
        let spectateCleanup: (() => void) | null = null;

        const belowCanvas = this.createPlayerListRoot();
        const roomTracker = new OnlineRoomTracker();
        const pendingSnapshotTargets: string[] = [];
        const playerMeta = new Map<string, { name: string; playerIndex: number }>();
        const remotePositions = new Map<string, RemotePlayerState>();

        const serverModal = new ServerStatusModal({
            status: connectionState,
            partyHost,
            roomId: guid,
            role: manager.role,
            sessionToken: manager.client.sessionToken,
            players: manager.players,
        });
        this.attachServerButton(tabsLinks, serverModal);

        const syncServerModal = () => {
            serverModal.update({
                status: connectionState,
                role: manager.role,
                players: manager.players,
            });
        };

        manager.onHostPromoted(() => {
            gameEngine.setOnlineMode('online-host');
            gameEngine.startEnemyLoop();
            const gs = gameEngine.gameState;
            if (!broadcaster) {
                broadcaster = new OnlineStateBroadcaster(manager.client, gs);
            }
            broadcaster.start();
            gameEngine.onOnlineStateChanged = () => broadcaster?.triggerNow();
            manager.client.send({ type: 'full-state-snapshot', snapshot: broadcaster.buildSnapshot() });
        });

        manager.client.on('snapshot-request', (msg) => {
            if (!manager.isHost) return;
            if (!broadcaster) {
                pendingSnapshotTargets.push(msg.targetId);
                return;
            }
            manager.client.send({ type: 'full-state-snapshot', snapshot: broadcaster.buildSnapshot(), targetId: msg.targetId });
        });

        manager.onSnapshot((snapshot) => {
            if (!sync) {
                sync = new OnlineStateSync(gameEngine.gameState, () => gameEngine.renderer.draw());
            }
            sync.applySnapshot(snapshot);
        });

        const getPlayerIndex = (id: string) => {
            const meta = playerMeta.get(id);
            if (meta) return meta.playerIndex;
            const p = manager.players.find((pl) => pl.sessionToken === id);
            if (!p) return 1;
            if (p.role === 'host') return 0;
            if (p.role === 'guest') return 1;
            return 2;
        };

        const updateEnemyAiRemotePlayers = () => {
            gameEngine.setRemotePlayersForEnemyAI(
                [...remotePositions.values()]
                    .map((rp) => ({ id: rp.id, x: rp.x, y: rp.y, roomIndex: rp.roomIndex, alive: rp.alive })),
            );
        };

        manager.onPlayerListChanged((players) => {
            players.forEach((p, i) => {
                const idx = p.role === 'host' ? 0 : p.role === 'guest' ? 1 : 2 + i;
                playerMeta.set(p.sessionToken, { name: p.name, playerIndex: idx });
            });
            for (const [id, rp] of remotePositions.entries()) {
                const meta = playerMeta.get(id);
                if (meta) {
                    rp.name = meta.name;
                    rp.playerIndex = meta.playerIndex;
                }
            }
            if (remotePositions.size > 0) {
                gameEngine.renderer.entityRenderer.setRemotePlayers([...remotePositions.values()]);
                gameEngine.renderer.draw();
            }
            playerList?.update(players, manager.client.sessionToken);
            syncServerModal();
        });

        manager.client.on('player-position', (msg) => {
            if (msg.playerId === manager.client.sessionToken) return;
            const existing = remotePositions.get(msg.playerId);
            const name = playerMeta.get(msg.playerId)?.name
                ?? manager.players.find((p) => p.sessionToken === msg.playerId)?.name
                ?? existing?.name
                ?? '';
            const playerIndex = getPlayerIndex(msg.playerId);
            const alive = existing ? existing.alive : true;
            remotePositions.set(msg.playerId, {
                id: msg.playerId,
                name,
                playerIndex,
                roomIndex: msg.roomIndex,
                x: msg.x,
                y: msg.y,
                alive,
                facing: msg.facing,
            });
            if (manager.isHost) {
                roomTracker.updatePlayer(msg.playerId, msg.roomIndex);
                gameEngine.setOnlineActiveRooms(roomTracker.getOccupiedRooms());
                updateEnemyAiRemotePlayers();
            }
            if (!existing || existing.roomIndex !== msg.roomIndex || existing.x !== msg.x || existing.y !== msg.y) {
                gameEngine.renderer.entityRenderer.setRemotePlayers([...remotePositions.values()]);
                gameEngine.renderer.draw();
            }
        });

        manager.client.on('player-leave', (msg) => {
            remotePositions.delete(msg.playerId);
            gameEngine.renderer.entityRenderer.setRemotePlayers([...remotePositions.values()]);
            if (manager.isHost) {
                roomTracker.removePlayer(msg.playerId);
                gameEngine.setOnlineActiveRooms(roomTracker.getOccupiedRooms());
                updateEnemyAiRemotePlayers();
            }
        });

        this.bindGameEngineOutboundEvents(gameEngine, manager);
        this.bindSharedWorldEvents(gameEngine, manager, () => sync, (nextSync) => { sync = nextSync; });

        gameEngine.onOnlinePlayerDefeated = () => {
            manager.client.send({ type: 'player-died', playerId: manager.client.sessionToken });
        };
        gameEngine.onOnlineGameCompletion = () => {
            const name = sessionStorage.getItem('tiny-rpg-player-name') ?? 'Jogador';
            manager.client.send({ type: 'game-over', winnerId: manager.client.sessionToken, winnerName: name });
        };

        manager.onGameStart(() => {
            lobby.dismiss();
            const mode = manager.isHost ? 'online-host' : 'online-guest';
            gameEngine.setOnlineMode(mode);

            if (!manager.isHost) {
                this.applyGuestSpawn(gameEngine);
            }

            playerList = new PlayerList(belowCanvas);
            playerList.update(manager.players, manager.client.sessionToken);

            const localIndex = manager.isHost ? 0 : 1;
            const localName = sessionStorage.getItem('tiny-rpg-player-name') ?? '';
            gameEngine.renderer.entityRenderer.setLocalOnlinePlayer(localName, localIndex);

            const gs = gameEngine.gameState;
            positionSender = new OnlinePositionSender(manager.client, gs);
            if (manager.isHost) {
                positionSender.onRoomChanged = (roomIndex) => {
                    roomTracker.updatePlayer(manager.client.sessionToken, roomIndex);
                    gameEngine.setOnlineActiveRooms(roomTracker.getOccupiedRooms());
                };
            }
            positionSender.start();

            if (manager.isHost) {
                const localRoom = gs.getPlayer()?.roomIndex ?? 0;
                roomTracker.updatePlayer(manager.client.sessionToken, localRoom);
                gameEngine.setOnlineActiveRooms(roomTracker.getOccupiedRooms());
            }

            if (!manager.isHost) {
                this.configureGuestInputRelay(gameEngine, manager, () => positionSender);
            } else {
                this.configureHostInputHandlers(gameEngine, manager, remotePositions);
            }

            if (manager.isHost) {
                broadcaster = new OnlineStateBroadcaster(manager.client, gs);
                broadcaster.start();
                for (const targetId of pendingSnapshotTargets.splice(0)) {
                    manager.client.send({ type: 'full-state-snapshot', snapshot: broadcaster.buildSnapshot(), targetId });
                }
                gameEngine.onOnlineStateChanged = () => broadcaster?.triggerNow();
                gameEngine.onOnlineMove = () => positionSender?.sendNow();
                manager.client.on('variable-changed', (msg) => {
                    const varId = ShareConstants.VARIABLE_IDS[msg.variableIndex];
                    if (varId) {
                        gameEngine.gameState.setVariableValue(varId, msg.newValue);
                        broadcaster?.triggerNow();
                        gameEngine.renderer.draw();
                    }
                });
            } else {
                sync = new OnlineStateSync(gs, () => gameEngine.renderer.draw());
                manager.client.on('world-state-diff', (msg) => {
                    sync?.applyDiff(msg.diff);
                    gameEngine.renderer.draw();
                });

                // Guest: forward NPC reward signals to the host without applying locally.
                // The host will apply the variable and broadcast the authoritative state
                // back via world-state-diff. Using onNpcReward instead of onVariableChanged
                // avoids the infinite loop that arises when applyVariableDiff() calls
                // setVariableValue() which would re-trigger onVariableChanged.
                const varIds = ShareConstants.VARIABLE_IDS;
                gameEngine.dialogManager.onNpcReward = (variableId, value) => {
                    const index = varIds.indexOf(variableId);
                    if (index < 0) return;
                    const encoded = value ? 1 : 0;
                    manager.client.send({ type: 'variable-changed', variableIndex: index, newValue: encoded });
                };
            }
        });

        manager.client.on('player-died', (msg) => {
            if (msg.playerId !== manager.client.sessionToken) {
                const remote = remotePositions.get(msg.playerId);
                if (remote) {
                    remote.alive = false;
                    gameEngine.renderer.entityRenderer.setRemotePlayers([...remotePositions.values()]);
                }
                playerList?.update(manager.players.map((p) => ({
                    ...p,
                    alive: p.sessionToken !== msg.playerId,
                })), manager.client.sessionToken);
                return;
            }

            const getMySpawn = () => {
                const game = gameEngine.getGame() as { online?: { spawnPoints?: Array<{ role: string; roomIndex: number; x: number; y: number }> } };
                const role = manager.isHost ? 'p1' : 'p2';
                return game.online?.spawnPoints?.find((p) => p.role === role) ?? { roomIndex: 0, x: 1, y: 1 };
            };

            positionSender?.stop();
            const spectateId = setInterval(() => {
                const alive = [...remotePositions.values()].filter((rp) => rp.alive);
                if (!alive.length) return;
                const local = gameEngine.gameState.getPlayer();
                const nearest = alive.reduce((a, b) => {
                    const da = Math.abs(a.x - (local?.x ?? 0)) + Math.abs(a.y - (local?.y ?? 0));
                    const db = Math.abs(b.x - (local?.x ?? 0)) + Math.abs(b.y - (local?.y ?? 0));
                    return da <= db ? a : b;
                });
                gameEngine.gameState.setPlayerPosition(nearest.x, nearest.y, nearest.roomIndex);
                gameEngine.renderer.draw();
            }, 100);
            const stopSpectating = () => { clearInterval(spectateId); spectateCleanup = null; };
            spectateCleanup = stopSpectating;

            waitingScreen = new WaitingScreen({
                onRespawn: () => {
                    stopSpectating();
                    const spawn = getMySpawn();
                    gameEngine.gameState.setPlayerPosition(spawn.x, spawn.y, spawn.roomIndex);
                    gameEngine.gameState.healPlayerToFull();
                    gameEngine.gameState.setGameOver(false);
                    gameEngine.gameState.resumeGame('game-over');
                    gameEngine.awaitingRestart = false;
                    gameEngine.startEnemyLoop();
                    positionSender?.start();
                    gameEngine.renderer.draw();
                    manager.client.send({
                        type: 'player-respawned',
                        playerId: manager.client.sessionToken,
                        roomIndex: spawn.roomIndex,
                        x: spawn.x,
                        y: spawn.y,
                    });
                },
            });
            waitingScreen.show(5);
        });

        manager.client.on('player-respawned', (msg) => {
            if (msg.playerId === manager.client.sessionToken) return;
            const remote = remotePositions.get(msg.playerId);
            if (remote) {
                remote.alive = true;
                remote.roomIndex = msg.roomIndex;
                remote.x = msg.x;
                remote.y = msg.y;
                gameEngine.renderer.entityRenderer.setRemotePlayers([...remotePositions.values()]);
            }
            playerList?.update(manager.players.map((p) => ({
                ...p,
                alive: p.sessionToken === msg.playerId ? true : (remotePositions.get(p.sessionToken)?.alive ?? true),
            })), manager.client.sessionToken);
        });

        manager.client.on('player-took-damage', (msg) => {
            if (msg.playerId !== manager.client.sessionToken) return;
            gameEngine.gameState.damagePlayer(msg.damage);
        });

        manager.onGameOver((_winnerId, winnerName) => {
            spectateCleanup?.();
            positionSender?.stop();
            gameEngine.handleGameCompletion();
            this.showGameOverBanner(winnerName);
        });

        const lobby = new LobbyScreen({
            playerName,
            onPlaySolo: () => {
                manager.cancelLobby();
                gameEngine.setOnlineMode('solo');
            },
        });

        manager.client.on('role-changed', (msg) => {
            syncServerModal();
            if (msg.newRole === 'host' && !manager.gameStarted) {
                lobby.show();
            }
        });

        manager.client.on('server-closed', () => {
            if (manager.gameStarted) return;
            this.showServerClosedOverlay();
        });

        const toast = new OnlineToast();
        const connIndicator = new ConnectionIndicator();

        manager.client.onConnectionState((state) => {
            connectionState = state;
            syncServerModal();
            connIndicator.setState(state);
            if (state === 'disconnected') {
                toast.show('⚠️ Conexão perdida. Tentando reconectar...');
            }
        });

        manager.client.on('player-list', (msg) => {
            const prev = manager.players;
            const incoming = msg.players;
            for (const p of incoming) {
                if (p.sessionToken === manager.client.sessionToken) continue;
                const wasPresent = prev.some((x) => x.id === p.id);
                if (!wasPresent) {
                    toast.show(`🟢 ${p.name} entrou na partida`);
                }
            }
            for (const p of prev) {
                if (p.sessionToken === manager.client.sessionToken) continue;
                const stillPresent = incoming.some((x) => x.id === p.id);
                if (!stillPresent) {
                    toast.show(`🔴 ${p.name} saiu da partida`);
                }
            }
        });

        manager.client.on('player-respawned', (msg) => {
            const name = manager.players.find((p) => p.id === msg.playerId)?.name;
            if (name && msg.playerId !== manager.client.sessionToken) {
                toast.show(`✨ ${name} voltou!`);
            }
        });

        manager.connect();
        (globalThis as Record<string, unknown>).__onlineManager = manager;
    }

    private static createPlayerListRoot(): HTMLElement {
        const gameContainerEl = document.getElementById('game-container');
        const el = document.createElement('div');
        el.id = 'online-player-list-root';
        Object.assign(el.style, {
            alignSelf: 'stretch',
            marginLeft: 'calc(-1 * clamp(12px, 3vw, 32px))',
            marginRight: 'calc(-1 * clamp(12px, 3vw, 32px))',
            marginBottom: 'calc(-1 * clamp(12px, 3vw, 32px))',
        });
        if (gameContainerEl) {
            gameContainerEl.appendChild(el);
        } else {
            document.body.appendChild(el);
        }
        return el;
    }

    private static attachServerButton(tabsLinks: HTMLElement | null, serverModal: ServerStatusModal): void {
        const serverButton = document.createElement('button');
        serverButton.id = 'btn-online-server';
        serverButton.className = 'tab-action-button tab-action-button--server';
        serverButton.type = 'button';
        serverButton.textContent = getTextResource('buttons.server', 'Server');
        serverButton.addEventListener('click', () => serverModal.show());
        tabsLinks?.appendChild(serverButton);
    }

    private static bindGameEngineOutboundEvents(gameEngine: GameEngine, manager: OnlineManager): void {
        gameEngine.onOnlineEnemyDied = (enemyId, roomIndex) => {
            if (manager.isHost) {
                manager.client.send({ type: 'enemy-died', enemyId, roomIndex });
            }
        };
        gameEngine.enemyManager.onEnemyAttackedRemotePlayer = (playerId, damage) => {
            if (manager.isHost) {
                manager.client.send({ type: 'player-took-damage', playerId, damage });
            }
        };
        gameEngine.onOnlineItemPicked = (itemId, roomIndex) => {
            manager.client.send({ type: 'item-picked', itemId, roomIndex, byPlayerId: manager.client.sessionToken });
        };
        gameEngine.onOnlineObjectTriggered = (objectId, roomIndex, newState) => {
            manager.client.send({ type: 'object-triggered', objectId, roomIndex, newState });
        };
    }

    private static bindSharedWorldEvents(
        gameEngine: GameEngine,
        manager: OnlineManager,
        getSync: () => OnlineStateSync | null,
        setSync: (sync: OnlineStateSync) => void,
    ): void {
        manager.client.on('enemy-died', (msg) => {
            let sync = getSync();
            if (!sync) {
                sync = new OnlineStateSync(gameEngine.gameState, () => gameEngine.renderer.draw());
                setSync(sync);
            }
            sync.applyEnemyDeath(msg.enemyId, { roomIndex: msg.roomIndex });
        });
        manager.client.on('item-picked', (msg) => {
            if (msg.byPlayerId === manager.client.sessionToken) return;
            const game = gameEngine.getGame() as { items?: Array<{ roomIndex: number; x: number; y: number; collected?: boolean }> };
            const item = game.items?.find((it) => `item-${it.roomIndex}-${it.x}-${it.y}` === msg.itemId);
            if (item) {
                item.collected = true;
                gameEngine.renderer.draw();
            }
        });
        manager.client.on('object-triggered', (msg) => {
            const objs = gameEngine.gameState.getObjectsForRoom(msg.roomIndex) as Array<{
                id?: string;
                roomIndex: number;
                x: number;
                y: number;
                on?: boolean;
                opened?: boolean;
                isLockedDoor?: boolean;
            }>;
            const obj = objs.find((o) => (o.id ?? `obj-${o.roomIndex}-${o.x}-${o.y}`) === msg.objectId);
            if (obj) {
                obj.on = msg.newState;
                if ('opened' in obj || obj.isLockedDoor) {
                    obj.opened = msg.newState;
                }
                gameEngine.renderer.draw();
            }
        });
    }

    private static applyGuestSpawn(gameEngine: GameEngine): void {
        const game = gameEngine.getGame();
        const spawn = (game as { online?: { spawnPoints?: Array<{ role: string; roomIndex: number; x: number; y: number }> } })
            .online?.spawnPoints?.find((p) => p.role === 'p2');
        if (spawn) {
            gameEngine.gameState.setPlayerPosition(spawn.x, spawn.y, spawn.roomIndex);
        }
    }

    private static configureGuestInputRelay(
        gameEngine: GameEngine,
        manager: OnlineManager,
        getPositionSender: () => OnlinePositionSender | null,
    ): void {
        const relay = new OnlineInputRelay(manager.client);
        gameEngine.onOnlineMove = (dx, dy) => {
            relay.sendMove(dx, dy);
            getPositionSender()?.sendNow();
        };
        gameEngine.onOnlineInteract = () => relay.sendInteract();
        gameEngine.enemyManager.onGuestAttack = (enemyId) => {
            const damage = gameEngine.prepareOnlineGuestAttack(enemyId);
            if (damage === null) return;
            relay.sendAttack(enemyId, damage);
            getPositionSender()?.sendNow(true);
        };
    }

    private static configureHostInputHandlers(
        gameEngine: GameEngine,
        manager: OnlineManager,
        remotePositions: Map<string, RemotePlayerState>,
    ): void {
        manager.client.on('player-input', (msg) => {
            if (msg.playerId === manager.client.sessionToken) return;
            const guestPos = remotePositions.get(msg.playerId);
            if (msg.action === 'attack' && msg.enemyId) {
                gameEngine.processGuestAttackDamage(msg.enemyId, msg.damage);
            } else if (msg.action === 'interact') {
                if (guestPos) gameEngine.processGuestInteract(guestPos.x, guestPos.y, guestPos.roomIndex);
            } else if (msg.action === 'move' && msg.dx !== undefined && msg.dy !== undefined) {
                if (guestPos) gameEngine.processGuestMove(guestPos.x, guestPos.y, guestPos.roomIndex, msg.dx, msg.dy);
            }
        });
    }

    private static showGameOverBanner(winnerName: string): void {
        const banner = document.createElement('div');
        banner.textContent = `★ ${winnerName} completou o jogo!`;
        Object.assign(banner.style, {
            position: 'fixed',
            top: 'clamp(8px, 2vw, 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--panel, #151821)',
            border: '4px solid var(--border, #232734)',
            borderLeft: '4px solid var(--accent, #5bfa8e)',
            color: 'var(--accent, #5bfa8e)',
            padding: '8px 16px',
            fontFamily: 'var(--ui-font-family, monospace)',
            fontWeight: 'bold',
            zIndex: '9999',
            maxWidth: 'calc(100vw - 24px)',
        });
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 5000);
    }

    private static showServerClosedOverlay(): void {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(14,15,19,0.94)',
            zIndex: '10001',
            fontFamily: 'var(--ui-font-family, monospace)',
            padding: '16px',
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            background: 'var(--panel, #151821)',
            border: '4px solid var(--border, #232734)',
            borderTop: '4px solid #ff4040',
            padding: 'clamp(16px, 4vw, 24px)',
            textAlign: 'center',
            color: 'var(--text, #fff)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: 'min(280px, calc(100vw - 32px))',
        });
        const title = document.createElement('div');
        title.textContent = 'Sala encerrada';
        title.style.color = '#ff4040';
        title.style.fontWeight = 'bold';
        const msg = document.createElement('div');
        msg.textContent = 'O host encerrou a partida antes de ela começar.';
        msg.style.color = 'rgba(255,255,255,0.6)';
        const reloadBtn = document.createElement('button');
        reloadBtn.textContent = 'Voltar ao início';
        Object.assign(reloadBtn.style, {
            background: 'var(--accent, #5bfa8e)',
            border: 'none',
            color: 'var(--bg, #0e0f13)',
            padding: '7px',
            width: '100%',
            fontFamily: 'var(--ui-font-family, monospace)',
            fontWeight: 'bold',
            cursor: 'pointer',
        });
        reloadBtn.addEventListener('click', () => {
            globalThis.location.href = `${globalThis.location.origin}${globalThis.location.pathname}`;
        });
        box.append(title, msg, reloadBtn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

}
