import { GameConfig } from '../../../config/GameConfig';
import type { GameState } from '../../domain/GameState';
import { normalizeNpcWanderSpeed, resetNpcWanderFacing, updateNpcWanderFacing } from '../../domain/npcMovement';
import type { NPCInstance, NPCManager } from '../NPCManager';
import type { EnemyManager } from './EnemyManager';

type Options = {
    gameState: GameState;
    npcManager: NPCManager;
    enemyManager: EnemyManager;
    draw: () => void;
    isOnline: () => boolean;
};

type Movement = { elapsed: number; direction: number; steps: number };
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TICK_MS = 25;

export class NpcMovementManager {
    private timer: ReturnType<typeof setInterval> | null = null;
    private movements = new Map<string, Movement>();
    private lastTime = 0;
    private pauseRevision = 0;

    private readonly options: Options;

    constructor(options: Options) { this.options = options; }

    start(): void {
        this.stop();
        this.lastTime = Date.now();
        this.timer = setInterval(() => this.tick(), TICK_MS);
    }

    stop(restorePositions = false): void {
        let moved = false;
        if (restorePositions) {
            for (const npc of this.options.npcManager.getNPCs()) {
                if (!npc.wander) continue;
                moved = moved || npc.x !== npc.initialX || npc.y !== npc.initialY || npc.roomIndex !== npc.initialRoomIndex;
                resetNpcWanderFacing(npc);
                npc.x = npc.initialX;
                npc.y = npc.initialY;
                npc.roomIndex = npc.initialRoomIndex;
            }
        }
        if (moved) this.options.draw();
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
        this.reset();
    }

    reset(): void {
        this.movements.clear();
        this.lastTime = Date.now();
        this.pauseRevision = this.options.gameState.lifecycle.pauseRevision;
    }

    private canMove(npc: NPCInstance, x: number, y: number): boolean {
        const { gameState, enemyManager } = this.options;
        const game = gameState.getGame();
        const size = game.rooms[npc.roomIndex]?.size ?? game.roomSize;
        if (x < 0 || y < 0 || x >= size || y >= size) return false;
        const player = gameState.getPlayer();
        if (player && player.roomIndex === npc.roomIndex && player.x === x && player.y === y) return false;
        return enemyManager.canEnterTile(npc.roomIndex, x, y, game as never, gameState.getEnemies(), -1);
    }

    private move(npc: NPCInstance, movement: Movement): boolean {
        if (movement.steps <= 0) {
            movement.direction = Math.floor(Math.random() * DIRECTIONS.length);
            movement.steps = 2;
        }
        const first = movement.direction;
        const alternatives = DIRECTIONS.map((_, index) => index).filter(index => index !== first);
        for (let i = alternatives.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [alternatives[i], alternatives[j]] = [alternatives[j], alternatives[i]];
        }
        for (const direction of [first, ...alternatives]) {
            const [dx, dy] = DIRECTIONS[direction];
            if (!this.canMove(npc, npc.x + dx, npc.y + dy)) continue;
            updateNpcWanderFacing(npc, dx);
            npc.x += dx;
            npc.y += dy;
            if (direction !== first) movement.steps = 2;
            movement.direction = direction;
            movement.steps--;
            return true;
        }
        movement.steps = 0;
        return false;
    }

    tick(): void {
        const now = Date.now();
        const elapsed = Math.max(0, now - this.lastTime);
        this.lastTime = now;
        const { gameState, npcManager, draw, isOnline } = this.options;
        if (this.timer === null || !gameState.playing || gameState.isEditorModeActive() || gameState.isGameOver() || isOnline()) {
            this.reset();
            return;
        }
        if (this.pauseRevision !== gameState.lifecycle.pauseRevision) {
            this.reset();
            return;
        }
        let moved = false;
        const activeIds = new Set<string>();
        for (const npc of npcManager.getNPCs()) {
            const speed = normalizeNpcWanderSpeed(npc.wanderSpeed);
            if (!npc.wander || speed === 0 || !npc.placed || npc.disappeared || npc.roomIndex !== gameState.getPlayer()?.roomIndex) continue;
            activeIds.add(npc.id);
            const movement = this.movements.get(npc.id) ?? { elapsed: 0, direction: 0, steps: 0 };
            this.movements.set(npc.id, movement);
            movement.elapsed += elapsed * speed;
            if (movement.elapsed + 0.00001 < GameConfig.enemy.movementInterval) continue;
            movement.elapsed %= GameConfig.enemy.movementInterval;
            moved = this.move(npc, movement) || moved;
        }
        for (const id of this.movements.keys()) if (!activeIds.has(id)) this.movements.delete(id);
        if (moved) draw();
    }
}
