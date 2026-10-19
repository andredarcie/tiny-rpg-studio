import { getNpcWanderFacing } from '../../runtime/domain/npcMovement';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { NPCManager } from '../../runtime/services/NPCManager';
import { EnemyManager } from '../../runtime/services/engine/EnemyManager';
import { NpcMovementManager } from '../../runtime/services/engine/NpcMovementManager';
import { GameConfig } from '../../config/GameConfig';

function required<T>(value: T | null | undefined): T {
    if (value == null) throw Error('Missing test entity');
    return value;
}

function fixture(speed = 1) {
    const state = new GameState();
    state.playing = true;
    state.editorMode = false;
    const player = required(state.getPlayer());
    Object.assign(player, { x: 7, y: 7, roomIndex: 0 });
    const npcs = new NPCManager(state);
    const npc = required(npcs.createNPC('old-mage'));
    npcs.setNPCPosition(npc.id, 2, 2);
    npcs.updateNPC(npc.id, { wander: true, wanderSpeed: speed });
    const draw = vi.fn();
    const tiles = { getTileMap: vi.fn(() => ({ ground: [] as number[][], overlay: [] as number[][] })), getTile: vi.fn((_id: unknown): { collision: boolean } | null => null) };
    const enemies = new EnemyManager(state as never, { draw } as never, tiles as never);
    const isOnline = vi.fn(() => false);
    const movement = new NpcMovementManager({ gameState: state, npcManager: npcs, enemyManager: enemies, draw, isOnline });
    npcs.onReset = () => movement.reset();
    movement.start();
    return { state, npcs, npc, draw, tiles, movement, isOnline };
}

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('NPC wandering simulation', () => {
    it.each([0.5, 1, 2])('moves at %sx cadence without enemies and keeps direction for two steps', speed => {
        const { npc, draw } = fixture(speed);
        const interval = GameConfig.enemy.movementInterval / speed;
        vi.advanceTimersByTime(interval - 1);
        expect(npc.x).toBe(2);
        vi.advanceTimersByTime(1);
        expect(npc.x).toBe(3);
        vi.advanceTimersByTime(interval);
        expect(npc.x).toBe(4);
        expect(draw).toHaveBeenCalledTimes(2);
    });
    it('updates facing on successful horizontal moves and retains it through vertical moves and pauses', () => {
        const { state, npc, npcs } = fixture();
        vi.mocked(Math.random).mockReturnValue(0.3);
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(1);
        expect(getNpcWanderFacing(npc)).toBe(-1);
        state.pauseGame('dialog');
        vi.advanceTimersByTime(2000);
        expect(getNpcWanderFacing(npc)).toBe(-1);
        state.resumeGame('dialog');
        vi.advanceTimersByTime(1400);
        expect(npc).toMatchObject({ x: 0, y: 3 });
        expect(getNpcWanderFacing(npc)).toBe(-1);
        npcs.resetNPCs();
        expect(getNpcWanderFacing(npc)).toBe(1);
        expect(npc).toMatchObject({ x: 2, y: 2 });
    });
    it('preserves facing when NPC inspection normalizes the roster', () => {
        const { npc, npcs } = fixture();
        vi.mocked(Math.random).mockReturnValue(0.3);
        vi.advanceTimersByTime(700);
        npcs.ensureDefaultNPCs();
        expect(getNpcWanderFacing(required(npcs.getNPC(npc.id)))).toBe(-1);
    });
    it('does not change facing for a blocked horizontal direction when it moves vertically instead', () => {
        const { state, npc } = fixture();
        vi.mocked(Math.random).mockReturnValue(0.3);
        state.game.rooms[0].walls[2][1] = true;
        vi.advanceTimersByTime(700);
        expect(npc).toMatchObject({ x: 2, y: 3 });
        expect(getNpcWanderFacing(npc)).toBe(1);
    });
    it('does not move at zero speed', () => {
        const { npc, draw } = fixture(0);
        vi.advanceTimersByTime(10000);
        expect(npc.x).toBe(2);
        expect(draw).not.toHaveBeenCalled();
    });
    it('maintains separate instance timing', () => {
        const { npcs, npc } = fixture(2);
        const other = required(npcs.createNPC('old-mage'));
        npcs.setNPCPosition(other.id, 2, 5);
        npcs.updateNPC(other.id, { wander: true, wanderSpeed: 0.5 });
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(4);
        expect(other.x).toBe(2);
        vi.advanceTimersByTime(700);
        expect(other.x).toBe(3);
    });
    it('resets elapsed time during dialogue and resumes without catch-up', () => {
        const { state, npc } = fixture();
        vi.advanceTimersByTime(600);
        state.pauseGame('dialog');
        vi.advanceTimersByTime(5000);
        expect(npc.x).toBe(2);
        state.resumeGame('dialog');
        vi.advanceTimersByTime(699);
        expect(npc.x).toBe(2);
        vi.advanceTimersByTime(1);
        expect(npc.x).toBe(3);
    });
    it.each(['editor', 'paused', 'game-over', 'online-host', 'online-guest', 'unplaced', 'disappeared', 'inactive-room', 'disabled'])('does not simulate %s NPCs', guard => {
        const { state, npc, draw, isOnline } = fixture();
        if (guard === 'editor') state.editorMode = true;
        if (guard === 'paused') state.playing = false;
        if (guard === 'game-over') state.setGameOver(true);
        if (guard.startsWith('online')) isOnline.mockReturnValue(true);
        if (guard === 'unplaced') npc.placed = false;
        if (guard === 'disappeared') npc.disappeared = true;
        if (guard === 'inactive-room') npc.roomIndex = 1;
        if (guard === 'disabled') npc.wander = false;
        vi.advanceTimersByTime(5000);
        expect(npc.x).toBe(2);
        expect(draw).not.toHaveBeenCalled();
    });
    it('clears timing even when dialogue opens and closes between ticks', () => {
        const { state, npc } = fixture();
        vi.advanceTimersByTime(675);
        state.pauseGame('dialog');
        state.resumeGame('dialog');
        vi.advanceTimersByTime(25);
        expect(npc.x).toBe(2);
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(3);
    });
    it('restores solo positions before switching to online without restoring disappeared NPCs', () => {
        const { movement, npc } = fixture();
        vi.advanceTimersByTime(700);
        npc.disappeared = true;
        movement.stop(true);
        expect(npc).toMatchObject({ x: 2, y: 2, disappeared: true, wander: true });
    });
    it('stops on teardown and resets authored positions and timing on restart', () => {
        const { movement, npcs, npc } = fixture();
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(3);
        movement.stop();
        vi.advanceTimersByTime(3000);
        expect(npc.x).toBe(3);
        npcs.resetNPCs();
        expect(npc.x).toBe(2);
        expect(npc.wander).toBe(true);
        movement.start();
        vi.advanceTimersByTime(699);
        expect(npc.x).toBe(2);
        vi.advanceTimersByTime(1);
        expect(npc.x).toBe(3);
    });
    it.each(['wall', 'tile', 'door', 'variable-door', 'trap', 'npc', 'enemy', 'player'])('avoids %s with blocked-direction fallback', obstacle => {
        const { state, npc, npcs, tiles } = fixture();
        if (obstacle === 'wall') state.game.rooms[0].walls[2][3] = true;
        if (obstacle === 'tile') { tiles.getTileMap.mockReturnValue({ ground: [[], [], [0, 0, 0, 1]], overlay: [] }); tiles.getTile.mockImplementation(id => id === 1 ? { collision: true } : null); }
        if (['door', 'variable-door', 'trap'].includes(obstacle)) state.game.objects.push({ id: 'block', type: obstacle === 'variable-door' ? 'door-variable' : obstacle, x: 3, y: 2, roomIndex: 0, solid: true } as never);
        if (obstacle === 'npc') { const other = required(npcs.createNPC('old-mage')); npcs.setNPCPosition(other.id, 3, 2); }
        if (obstacle === 'enemy') state.state.enemies.push({ id: 'enemy', type: 'slime', x: 3, y: 2, roomIndex: 0 } as never);
        if (obstacle === 'player') Object.assign(required(state.getPlayer()), { x: 3, y: 2 });
        vi.advanceTimersByTime(700);
        expect({ x: npc.x, y: npc.y }).not.toEqual({ x: 3, y: 2 });
        expect({ x: npc.x, y: npc.y }).not.toEqual({ x: 2, y: 2 });
    });
    it('stays still when surrounded and never crosses room edges', () => {
        const { state, npc } = fixture(2);
        for (const [x, y] of [[3, 2], [1, 2], [2, 3], [2, 1]]) state.game.rooms[0].walls[y][x] = true;
        vi.advanceTimersByTime(1400);
        expect(npc).toMatchObject({ x: 2, y: 2 });
        npc.x = 7; npc.y = 7;
        vi.advanceTimersByTime(10000);
        expect(npc.x).toBeGreaterThanOrEqual(0);
        expect(npc.x).toBeLessThan(8);
        expect(npc.y).toBeGreaterThanOrEqual(0);
        expect(npc.y).toBeLessThan(8);
        expect(npc.roomIndex).toBe(0);
    });
});
