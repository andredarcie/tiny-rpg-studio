export type OnlineRole = 'host' | 'guest';

export type PlayerInfo = {
    id: string;
    name: string;
    sessionToken: string;
    role: OnlineRole;
    room: string;
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
};

export type OnlineSpawnPointNet = {
    role: string;
    roomIndex: number;
    x: number;
    y: number;
};

export type EnemyNetState = {
    x: number;
    y: number;
    hp: number;
    roomIndex: number;
    alive?: boolean;
    playerInVision?: boolean;
};

export type ObjectNetState = {
    collected: boolean;
    on: boolean;
    opened?: boolean;
    x?: number;
    y?: number;
};

export type WorldStateDiff = {
    tick: number;
    enemies?: Record<string, EnemyNetState>;
    variables?: Record<number, number>;
    objects?: Record<string, ObjectNetState>;
    items?: Record<string, boolean>;
};

export type FullStateSnapshot = {
    enemies: Record<string, EnemyNetState>;
    variables: Record<number, number>;
    objects: Record<string, ObjectNetState>;
    items: Record<string, boolean>;
    players: PlayerInfo[];
};

// ── Message types ──────────────────────────────────────────────────────────

export type PlayerJoinMsg = {
    type: 'player-join';
    name: string;
    sessionToken: string;
};

export type PlayerLeaveMsg = {
    type: 'player-leave';
    playerId: string;
};

export type PlayerListMsg = {
    type: 'player-list';
    players: PlayerInfo[];
};

export type ServerClosedMsg = {
    type: 'server-closed';
};

export type RoleChangedMsg = {
    type: 'role-changed';
    newRole: OnlineRole;
};

export type HostLeftMsg = {
    type: 'host-left';
};

export type GameStartMsg = {
    type: 'game-start';
};

export type GameOverMsg = {
    type: 'game-over';
    winnerId: string;
    winnerName: string;
};

export type LobbyCancelledMsg = {
    type: 'lobby-cancelled';
};

export type FullStateSnapshotMsg = {
    type: 'full-state-snapshot';
    snapshot: FullStateSnapshot;
    targetId?: string;
};

export type WorldStateDiffMsg = {
    type: 'world-state-diff';
    diff: WorldStateDiff;
};

export type PlayerPositionMsg = {
    type: 'player-position';
    playerId: string;
    roomIndex: number;
    x: number;
    y: number;
    facing: string;
    animFrame: number;
    hp: number;
    maxHp: number;
    level?: number;
    keys?: number;
    swordType?: string | null;
    swordDurability?: number;
    armorEquipped?: boolean;
    bootsEquipped?: boolean;
    skills?: string[];
};

export type PlayerInputMsg = {
    type: 'player-input';
    playerId: string;
    action: 'move' | 'attack' | 'interact';
    dx?: number;
    dy?: number;
    enemyId?: string;
    damage?: number;
};

export type EnemyDiedMsg = {
    type: 'enemy-died';
    enemyId: string;
    roomIndex: number;
};

export type ItemPickedMsg = {
    type: 'item-picked';
    itemId: string;
    roomIndex: number;
    byPlayerId: string;
};

export type ObjectTriggeredMsg = {
    type: 'object-triggered';
    objectId: string;
    roomIndex: number;
    newState: boolean;
    byPlayerId?: string;
};

export type VariableChangedMsg = {
    type: 'variable-changed';
    variableIndex: number;
    newValue: number;
};

export type PlayerDiedMsg = {
    type: 'player-died';
    playerId: string;
};

export type PlayerRespawnedMsg = {
    type: 'player-respawned';
    playerId: string;
    roomIndex: number;
    x: number;
    y: number;
};

export type PlayerTookDamageMsg = {
    type: 'player-took-damage';
    playerId: string;
    damage: number;
};

export type SnapshotRequestMsg = {
    type: 'snapshot-request';
    targetId: string;
};

export type PingMsg = {
    type: 'ping';
    sentAt: number;
};

export type PongMsg = {
    type: 'pong';
    sentAt: number;
};

export type ServerFullMsg = {
    type: 'server-full';
};

export type KickPlayerMsg = {
    type: 'kick-player';
    targetToken: string;
};

export type PlayerKickedMsg = {
    type: 'player-kicked';
};

export type ChatEntry = {
    id: string;
    playerId: string;
    playerName: string;
    text: string;
    sentAt: number;
};

export type ChatMessageMsg = {
    type: 'chat-message';
    message: ChatEntry;
};

export type ChatHistoryMsg = {
    type: 'chat-history';
    messages: ChatEntry[];
};

export type OnlineMessage =
    | PlayerJoinMsg
    | PlayerLeaveMsg
    | PlayerListMsg
    | ServerClosedMsg
    | RoleChangedMsg
    | HostLeftMsg
    | GameStartMsg
    | GameOverMsg
    | LobbyCancelledMsg
    | FullStateSnapshotMsg
    | WorldStateDiffMsg
    | PlayerPositionMsg
    | PlayerInputMsg
    | EnemyDiedMsg
    | ItemPickedMsg
    | ObjectTriggeredMsg
    | VariableChangedMsg
    | PlayerDiedMsg
    | PlayerRespawnedMsg
    | PlayerTookDamageMsg
    | SnapshotRequestMsg
    | ChatMessageMsg
    | ChatHistoryMsg
    | ServerFullMsg
    | KickPlayerMsg
    | PlayerKickedMsg
    | PingMsg
    | PongMsg;

export type OnlineMessageType = OnlineMessage['type'];
