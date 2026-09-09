import type { OnlineClient } from './OnlineClient';

type PlayerStateRef = {
    getPlayer(): {
        x: number;
        y: number;
        roomIndex: number;
        lastX?: number;
        currentLives: number;
        maxLives: number;
        level?: number;
        keys?: number;
        swordType?: string | null;
        swordDurability?: number;
        armorEquipped?: boolean;
        armorDurability?: number;
        bootsEquipped?: boolean;
    } | null;
    getOwnedSkills?(): string[];
};

export class OnlinePositionSender {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private lastX = -1;
    private lastY = -1;
    private lastRoom = -1;
    private client: OnlineClient;
    private gameState: PlayerStateRef;
    private intervalMs: number;
    onRoomChanged: ((roomIndex: number) => void) | null = null;

    constructor(client: OnlineClient, gameState: PlayerStateRef, intervalMs = 50) {
        this.client = client;
        this.gameState = gameState;
        this.intervalMs = intervalMs;
    }

    start(): void {
        if (this.intervalId !== null) return;
        // Send immediately so the other player sees us before we move
        this.sendCurrent(true);
        this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    }

    stop(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /** Call immediately after a move to avoid waiting for the next 50ms poll. */
    sendNow(force = false): void {
        const p = this.gameState.getPlayer();
        if (!p) return;
        if (!force && p.x === this.lastX && p.y === this.lastY && p.roomIndex === this.lastRoom) return;
        this.sendCurrent(false);
    }

    private tick(): void {
        this.sendNow();
    }

    private sendCurrent(force: boolean): void {
        const p = this.gameState.getPlayer();
        if (!p) return;
        const roomChanged = p.roomIndex !== this.lastRoom;
        this.lastX = p.x;
        this.lastY = p.y;
        this.lastRoom = p.roomIndex;
        if (roomChanged && !force) this.onRoomChanged?.(p.roomIndex);
        this.client.send({
            type: 'player-position',
            playerId: this.client.sessionToken,
            roomIndex: p.roomIndex,
            x: p.x,
            y: p.y,
            facing: p.lastX !== undefined && p.lastX > p.x ? 'left' : 'right',
            animFrame: 0,
            hp: p.currentLives,
            maxHp: p.maxLives,
            level: p.level,
            keys: p.keys,
            swordType: p.swordType ?? null,
            swordDurability: p.swordDurability,
            armorEquipped: p.armorEquipped,
            armorDurability: p.armorDurability,
            bootsEquipped: p.bootsEquipped,
            skills: this.gameState.getOwnedSkills?.() ?? [],
        });
    }
}
