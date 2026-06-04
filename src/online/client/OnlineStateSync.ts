import type { WorldStateDiff, FullStateSnapshot, EnemyNetState } from '../shared/protocol';
import type { EnemyDefinition } from '../../types/gameState';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';

type GameStateRef = {
    getEnemies(): EnemyDefinition[];
    setVariableValue(id: string | number, value: unknown): [boolean, boolean] | boolean;
    getObjects?(): unknown;
    getGame?(): { items?: Array<{ roomIndex: number; x: number; y: number; collected?: boolean }> };
};

// Lerp speed per animation frame (fraction of remaining distance)
const LERP_SPEED = 0.22;
const LERP_THRESHOLD = 0.02; // stop when within this fraction of a tile

export class OnlineStateSync {
    private gameState: GameStateRef;
    private onDraw: (() => void) | null = null;
    private rafId: number | null = null;
    private enemyRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Diffs that arrived before the first snapshot are buffered and replayed
    // after the snapshot is applied, preventing the snapshot from overwriting
    // changes that are newer than the snapshot's capture time.
    private _snapshotApplied = false;
    private pendingDiffs: WorldStateDiff[] = [];

    get snapshotApplied(): boolean { return this._snapshotApplied; }

    constructor(gameState: GameStateRef, onDraw?: () => void) {
        this.gameState = gameState;
        this.onDraw = onDraw ?? null;
    }

    applyDiff(diff: WorldStateDiff): void {
        if (!this._snapshotApplied) {
            this.pendingDiffs.push(diff);
            return;
        }
        this.applyDiffFields(diff);
    }

    applySnapshot(snapshot: FullStateSnapshot): void {
        const enemies = this.gameState.getEnemies();
        const snapshotEnemyIds = new Set(Object.keys(snapshot.enemies));
        for (const [id, netState] of Object.entries(snapshot.enemies)) {
            const enemy = enemies.find((e) => e.id === id);
            if (netState.alive === false) {
                this.applyEnemyDeath(id, netState);
                continue;
            }
            if (enemy) {
                enemy.x = netState.x;
                enemy.y = netState.y;
                enemy._vx = netState.x;
                enemy._vy = netState.y;
                enemy.lastX = enemy.x;
                enemy.lives = netState.hp;
                enemy.roomIndex = netState.roomIndex;
                if (netState.playerInVision !== undefined) enemy.playerInVision = netState.playerInVision;
            }
        }
        for (const enemy of [...enemies]) {
            if (!snapshotEnemyIds.has(enemy.id)) {
                this.applyEnemyDeath(enemy.id, enemy);
            }
        }
        this.applyVariableDiff(snapshot.variables);
        this.applyObjectDiff(snapshot.objects);
        this.applyItemDiff(snapshot.items);
        // Flush diffs that arrived before the snapshot; they represent changes
        // newer than the snapshot's capture time, so apply them on top.
        this._snapshotApplied = true;
        for (const diff of this.pendingDiffs.splice(0)) {
            this.applyDiffFields(diff);
        }
        this.onDraw?.();
    }

    reset(): void {
        this._snapshotApplied = false;
        this.pendingDiffs = [];
    }

    private applyDiffFields(diff: WorldStateDiff): void {
        if (diff.enemies) this.applyEnemyDiff(diff.enemies);
        if (diff.variables) this.applyVariableDiff(diff.variables);
        if (diff.objects) this.applyObjectDiff(diff.objects);
        if (diff.items) this.applyItemDiff(diff.items);
    }

    applyEnemyDeath(enemyId: string, fallbackState?: Partial<EnemyNetState>): void {
        const enemies = this.gameState.getEnemies();
        const enemy = enemies.find((e) => e.id === enemyId);
        if (!enemy) return;

        if (fallbackState) {
            if (typeof fallbackState.x === 'number') enemy.x = fallbackState.x;
            if (typeof fallbackState.y === 'number') enemy.y = fallbackState.y;
            if (typeof fallbackState.roomIndex === 'number') enemy.roomIndex = fallbackState.roomIndex;
            if (typeof fallbackState.hp === 'number') enemy.lives = fallbackState.hp;
        }

        if (typeof enemy.deathStartTime !== 'number') {
            enemy.deathStartTime = performance.now();
        }

        if (!this.enemyRemovalTimers.has(enemyId)) {
            const timer = setTimeout(() => {
                this.enemyRemovalTimers.delete(enemyId);
                const idx = this.gameState.getEnemies().findIndex((entry) => entry.id === enemyId);
                if (idx >= 0) {
                    this.gameState.getEnemies().splice(idx, 1);
                    this.onDraw?.();
                }
            }, 1000);
            this.enemyRemovalTimers.set(enemyId, timer);
        }

        this.onDraw?.();
    }

    private applyEnemyDiff(enemies: WorldStateDiff['enemies']): void {
        if (!enemies) return;
        let anyMoved = false;
        const localEnemies = this.gameState.getEnemies();
        for (const [id, netState] of Object.entries(enemies)) {
            if (netState.alive === false) {
                this.applyEnemyDeath(id, netState);
                continue;
            }
            const enemy = localEnemies.find((e) => e.id === id);
            if (!enemy) continue;

            const moved = enemy.x !== netState.x || enemy.y !== netState.y;
            if (moved) {
                // Start visual interpolation from current visual position (or logic position)
                enemy._vx = enemy._vx ?? enemy.x;
                enemy._vy = enemy._vy ?? enemy.y;
                anyMoved = true;
            }

            enemy.lastX = enemy.x;
            enemy.x = netState.x;
            enemy.y = netState.y;
            enemy.lives = netState.hp;
            enemy.roomIndex = netState.roomIndex;
            if (netState.playerInVision !== undefined) enemy.playerInVision = netState.playerInVision;
        }

        if (anyMoved) this.scheduleInterpolation();
    }

    private scheduleInterpolation(): void {
        if (this.rafId !== null) return; // already running
        const tick = () => {
            const enemies = this.gameState.getEnemies();
            let stillMoving = false;
            for (const enemy of enemies) {
                if (enemy._vx === undefined || enemy._vy === undefined) continue;
                const dx = enemy.x - enemy._vx;
                const dy = enemy.y - enemy._vy;
                if (Math.abs(dx) < LERP_THRESHOLD && Math.abs(dy) < LERP_THRESHOLD) {
                    enemy._vx = enemy.x;
                    enemy._vy = enemy.y;
                } else {
                    enemy._vx += dx * LERP_SPEED;
                    enemy._vy += dy * LERP_SPEED;
                    stillMoving = true;
                }
            }
            this.onDraw?.();
            if (stillMoving) {
                this.rafId = requestAnimationFrame(tick);
            } else {
                this.rafId = null;
            }
        };
        this.rafId = requestAnimationFrame(tick);
    }

    private applyVariableDiff(variables: Record<number, number>): void {
        const ids = ShareConstants.VARIABLE_IDS;
        for (const [idx, val] of Object.entries(variables)) {
            const varId = ids[Number(idx)];
            if (varId) this.gameState.setVariableValue(varId, val);
        }
    }

    private applyObjectDiff(objects: Record<string, { collected: boolean; on: boolean; opened?: boolean; x?: number; y?: number }>): void {
        if (typeof this.gameState.getObjects !== 'function') return;
        const raw = this.gameState.getObjects();
        const localObjs = Array.isArray(raw)
            ? (raw as Array<{ id: string; type?: string; collected?: boolean; on?: boolean; opened?: boolean; x?: number; y?: number }>)
            : [];
        for (const [id, state] of Object.entries(objects)) {
            const obj = localObjs.find((o) => o.id === id);
            if (!obj) continue;
            obj.collected = state.collected;
            obj.on = state.on;
            if (state.opened !== undefined) obj.opened = state.opened;
            if (state.x !== undefined) obj.x = state.x;
            if (state.y !== undefined) obj.y = state.y;
        }
    }

    private applyItemDiff(items: Record<string, boolean>): void {
        const game = this.gameState.getGame?.();
        if (!game || !Array.isArray(game.items)) return;
        for (const [id, collected] of Object.entries(items)) {
            const item = game.items.find((it) => {
                const itemId = `item-${it.roomIndex}-${it.x}-${it.y}`;
                return itemId === id;
            });
            if (item) item.collected = collected;
        }
    }
}
