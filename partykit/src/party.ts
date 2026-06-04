import type * as Party from 'partykit/server';

type OnlineRole = 'host' | 'guest' | 'spectator';

type PlayerState = {
    id: string;
    name: string;
    sessionToken: string;
    role: OnlineRole;
    roomStr: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    level?: number;
    keys?: number;
    swordType?: string | null;
    swordDurability?: number;
    armorEquipped?: boolean;
    bootsEquipped?: boolean;
    skills?: string[];
    connectedAt: number;
};

// Disconnected players kept briefly to support quick reconnection
type DisconnectedPlayer = {
    state: PlayerState;
    disconnectedAt: number;
};

type ChatEntry = {
    id: string;
    playerId: string;
    playerName: string;
    text: string;
    sentAt: number;
};

const RECONNECT_GRACE_MS = 10_000;
const MAX_ACTIVE_PLAYERS = 2;
const MAX_CHAT_MESSAGES = 30;
const MAX_CHAT_MESSAGE_LENGTH = 180;

export default class GameParty implements Party.Server {
    private players = new Map<string, PlayerState>();
    private disconnected = new Map<string, DisconnectedPlayer>();
    private chatMessages: ChatEntry[] = [];
    private gameStarted = false;
    private cancelled = false;

    constructor(readonly party: Party.Party) {}

    onConnect(conn: Party.Connection): void {
        if (this.cancelled) {
            conn.send(JSON.stringify({ type: 'server-closed' }));
            conn.close();
            return;
        }
        // Send current player list so the newcomer can orient themselves
        conn.send(JSON.stringify({
            type: 'player-list',
            players: this.buildPlayerList(),
        }));
        conn.send(JSON.stringify({
            type: 'chat-history',
            messages: this.chatMessages,
        }));
    }

    onMessage(message: string, sender: Party.Connection): void {
        let msg: Record<string, unknown>;
        try {
            msg = JSON.parse(message) as Record<string, unknown>;
        } catch {
            return;
        }

        switch (msg.type) {
            case 'player-join': {
                this.handlePlayerJoin(msg, sender);
                break;
            }
            case 'player-position': {
                this.handlePlayerPosition(message, msg, sender);
                break;
            }
            case 'world-state-diff': {
                const player = this.players.get(sender.id);
                if (player?.role === 'host') {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'full-state-snapshot': {
                const player = this.players.get(sender.id);
                if (player?.role !== 'host') break;
                // If snapshot has a targetId, send only to that connection; otherwise broadcast
                const parsed = JSON.parse(message) as { targetId?: string };
                if (parsed.targetId) {
                    const target = [...this.party.getConnections()].find((c) => c.id === parsed.targetId);
                    target?.send(message);
                } else {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'player-input': {
                const player = this.players.get(sender.id);
                if (player && player.role !== 'spectator') {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'lobby-cancelled': {
                const player = this.players.get(sender.id);
                if (player?.role === 'host') {
                    this.cancelled = true;
                    this.gameStarted = false;
                    this.party.broadcast(JSON.stringify({ type: 'server-closed' }), [sender.id]);
                }
                break;
            }
            case 'player-died':
            case 'player-respawned': {
                // Any active player can die/respawn — relay from any non-spectator
                const dyingPlayer = this.players.get(sender.id);
                if (dyingPlayer && dyingPlayer.role !== 'spectator') {
                    if (msg.type === 'player-died') dyingPlayer.alive = false;
                    if (msg.type === 'player-respawned') dyingPlayer.alive = true;
                    this.party.broadcast(message, [sender.id]);
                    this.broadcastPlayerList();
                }
                break;
            }
            case 'player-took-damage':
            case 'enemy-died': {
                const player = this.players.get(sender.id);
                if (player?.role === 'host') {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'game-over': {
                // Any active player can win (guest reaching the end tile sends this too)
                const player = this.players.get(sender.id);
                if (player && player.role !== 'spectator') {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'variable-changed': {
                // Variables are global — relay from any active player (not spectators)
                const player = this.players.get(sender.id);
                if (player && player.role !== 'spectator') {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'item-picked':
            case 'object-triggered': {
                // Any active player can trigger these; broadcast to all others
                const player = this.players.get(sender.id);
                if (player && player.role !== 'spectator') {
                    this.party.broadcast(message, [sender.id]);
                }
                break;
            }
            case 'chat-message': {
                this.handleChatMessage(msg, sender);
                break;
            }
            default:
                break;
        }
    }

    onError(conn: Party.Connection): void {
        this.onClose(conn);
    }

    onClose(conn: Party.Connection): void {
        const player = this.players.get(conn.id);
        if (!player) return;

        // Keep in disconnected map for reconnection grace period
        this.disconnected.set(player.sessionToken, {
            state: player,
            disconnectedAt: Date.now(),
        });
        this.players.delete(conn.id);

        if (player.role === 'host') {
            // Promote oldest guest to host
            const nextHost = this.findOldestActivePlayer('guest');
            if (nextHost) {
                nextHost.role = 'host';
                this.party.broadcast(JSON.stringify({ type: 'host-left' }));
                const nextConn = [...this.party.getConnections()].find((c) => c.id === nextHost.id);
                nextConn?.send(JSON.stringify({ type: 'role-changed', newRole: 'host' }));
            }
            // Downgrade the disconnected entry so the original host rejoins as guest
            // if they reconnect within the grace period — prevents two simultaneous hosts.
            const entry = this.disconnected.get(player.sessionToken);
            if (entry) entry.state.role = nextHost ? 'guest' : 'host';
        }

        // Use sessionToken so clients can match against their remotePositions map
        this.party.broadcast(JSON.stringify({ type: 'player-leave', playerId: player.sessionToken }));
        this.broadcastPlayerList();
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private handlePlayerJoin(msg: Record<string, unknown>, sender: Party.Connection): void {
        const name = typeof msg.name === 'string' ? msg.name.slice(0, 16) : 'Player';
        const sessionToken = typeof msg.sessionToken === 'string' ? msg.sessionToken : sender.id;

        // Check for reconnection within grace period
        this.purgeExpiredDisconnected();
        const prior = this.disconnected.get(sessionToken);
        if (prior && !this.cancelled) {
            this.disconnected.delete(sessionToken);
            // Safety net: if someone else was promoted to host while this player
            // was disconnected, they must rejoin as guest to avoid two hosts.
            const hasActiveHost = [...this.players.values()].some((p) => p.role === 'host');
            if (prior.state.role === 'host' && hasActiveHost) {
                prior.state.role = 'guest';
            }
            const restored: PlayerState = { ...prior.state, id: sender.id };
            this.players.set(sender.id, restored);
            sender.send(JSON.stringify({ type: 'role-changed', newRole: restored.role }));
            this.broadcastPlayerList();
            return;
        }

        // New player — determine role
        const activeCount = [...this.players.values()].filter((p) => p.role !== 'spectator').length;
        let role: OnlineRole;
        if (this.players.size === 0) {
            role = 'host';
        } else if (activeCount < MAX_ACTIVE_PLAYERS) {
            role = 'guest';
        } else {
            role = 'spectator';
        }

        const player: PlayerState = {
            id: sender.id,
            name,
            sessionToken,
            role,
            roomStr: '0',
            x: 0,
            y: 0,
            hp: 3,
            maxHp: 3,
            alive: true,
            level: 1,
            keys: 0,
            swordType: null,
            swordDurability: 0,
            armorEquipped: false,
            bootsEquipped: false,
            skills: [],
            connectedAt: Date.now(),
        };
        this.players.set(sender.id, player);

        // Inform the newcomer of their role
        sender.send(JSON.stringify({ type: 'role-changed', newRole: role }));
        this.broadcastPlayerList();

        // Trigger game-start when second active player connects
        const newActiveCount = [...this.players.values()].filter((p) => p.role !== 'spectator').length;
        if (!this.gameStarted && newActiveCount >= MAX_ACTIVE_PLAYERS) {
            this.gameStarted = true;
            this.party.broadcast(JSON.stringify({ type: 'game-start' }));
        } else if (this.gameStarted && (role === 'guest' || role === 'spectator')) {
            // Game already in progress — ask the Host to send a full-state-snapshot to this newcomer
            const host = this.findOldestActivePlayer('host');
            if (host) {
                const hostConn = [...this.party.getConnections()].find((c) => c.id === host.id);
                hostConn?.send(JSON.stringify({ type: 'snapshot-request', targetId: sender.id }));
            }
        }
    }

    private handlePlayerPosition(rawMessage: string, msg: Record<string, unknown>, sender: Party.Connection): void {
        const player = this.players.get(sender.id);
        if (!player) return;
        if (typeof msg.roomIndex === 'number') player.roomStr = String(msg.roomIndex);
        if (typeof msg.x === 'number') player.x = msg.x;
        if (typeof msg.y === 'number') player.y = msg.y;
        if (typeof msg.hp === 'number') player.hp = msg.hp;
        if (typeof msg.maxHp === 'number') player.maxHp = msg.maxHp;
        if (typeof msg.level === 'number') player.level = msg.level;
        if (typeof msg.keys === 'number') player.keys = msg.keys;
        if (typeof msg.swordType === 'string' || msg.swordType === null) player.swordType = msg.swordType;
        if (typeof msg.swordDurability === 'number') player.swordDurability = msg.swordDurability;
        if (typeof msg.armorEquipped === 'boolean') player.armorEquipped = msg.armorEquipped;
        if (typeof msg.bootsEquipped === 'boolean') player.bootsEquipped = msg.bootsEquipped;
        if (Array.isArray(msg.skills)) {
            player.skills = msg.skills.filter((skill): skill is string => typeof skill === 'string' && skill.length > 0);
        }
        this.party.broadcast(rawMessage, [sender.id]);
    }

    private handleChatMessage(msg: Record<string, unknown>, sender: Party.Connection): void {
        const player = this.players.get(sender.id);
        if (!player) return;
        const rawMessage = msg.message as { text?: unknown } | undefined;
        const text = typeof rawMessage?.text === 'string'
            ? rawMessage.text.trim().replace(/\s+/g, ' ').slice(0, MAX_CHAT_MESSAGE_LENGTH)
            : '';
        if (!text) return;

        const entry: ChatEntry = {
            id: `${Date.now()}-${sender.id}`,
            playerId: player.sessionToken,
            playerName: player.name,
            text,
            sentAt: Date.now(),
        };
        this.chatMessages.push(entry);
        if (this.chatMessages.length > MAX_CHAT_MESSAGES) {
            this.chatMessages = this.chatMessages.slice(-MAX_CHAT_MESSAGES);
        }
        this.party.broadcast(JSON.stringify({ type: 'chat-message', message: entry }));
    }

    private buildPlayerList() {
        return [...this.players.values()].map((p) => ({
            id: p.id,
            name: p.name,
            sessionToken: p.sessionToken,
            role: p.role,
            room: p.roomStr,
            x: p.x,
            y: p.y,
            hp: p.hp,
            maxHp: p.maxHp,
            alive: p.alive,
            level: p.level,
            keys: p.keys,
            swordType: p.swordType ?? null,
            swordDurability: p.swordDurability,
            armorEquipped: p.armorEquipped,
            bootsEquipped: p.bootsEquipped,
            skills: p.skills ?? [],
        }));
    }

    private broadcastPlayerList(): void {
        this.party.broadcast(JSON.stringify({
            type: 'player-list',
            players: this.buildPlayerList(),
        }));
    }

    private findOldestActivePlayer(role: OnlineRole): PlayerState | null {
        let oldest: PlayerState | null = null;
        for (const p of this.players.values()) {
            if (p.role === role && (!oldest || p.connectedAt < oldest.connectedAt)) {
                oldest = p;
            }
        }
        return oldest;
    }

    private purgeExpiredDisconnected(): void {
        const now = Date.now();
        for (const [token, entry] of this.disconnected.entries()) {
            if (now - entry.disconnectedAt > RECONNECT_GRACE_MS) {
                this.disconnected.delete(token);
            }
        }
    }
}
