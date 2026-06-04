import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OnlineStateBroadcaster } from '../../online/client/OnlineStateBroadcaster';
import { OnlineStateSync } from '../../online/client/OnlineStateSync';
import type { OnlineMessage } from '../../online/shared/protocol';
import type { EnemyDefinition } from '../../types/gameState';

describe('online enemy synchronization', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('broadcasts a dead enemy after it disappears from host state', () => {
        const sent: OnlineMessage[] = [];
        const enemies: EnemyDefinition[] = [
            { id: 'e1', type: 'giant-rat', roomIndex: 0, x: 2, y: 3, lastX: 2, lives: 1 },
        ];
        const client = { send: vi.fn((msg: OnlineMessage) => sent.push(msg)) };
        const broadcaster = new OnlineStateBroadcaster(client as never, {
            getEnemies: () => enemies,
        });

        broadcaster.triggerNow();
        expect(sent.at(-1)).toMatchObject({
            type: 'world-state-diff',
            diff: { enemies: { e1: { alive: true, x: 2, y: 3 } } },
        });

        enemies.splice(0, 1);
        broadcaster.triggerNow();

        expect(sent.at(-1)).toMatchObject({
            type: 'world-state-diff',
            diff: { enemies: { e1: { alive: false } } },
        });
    });

    it('marks dead enemies on guests and removes them after the death animation', () => {
        const enemies: EnemyDefinition[] = [
            { id: 'e1', type: 'giant-rat', roomIndex: 0, x: 2, y: 3, lastX: 2, lives: 1 },
        ];
        const draw = vi.fn();
        const sync = new OnlineStateSync({
            getEnemies: () => enemies,
            setVariableValue: vi.fn(),
        }, draw);

        // Guests always receive a snapshot before diffs; seed the initial state.
        sync.applySnapshot({
            enemies: { e1: { x: 2, y: 3, hp: 1, roomIndex: 0, alive: true } },
            variables: {}, objects: {}, items: {}, players: [],
        });
        draw.mockClear();

        sync.applyDiff({
            tick: 1,
            enemies: {
                e1: { x: 2, y: 3, hp: 0, roomIndex: 0, alive: false },
            },
        });

        expect(enemies[0].deathStartTime).toEqual(expect.any(Number));
        expect(enemies).toHaveLength(1);
        expect(draw).toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(enemies).toHaveLength(0);
        expect(draw).toHaveBeenCalledTimes(2);
    });

    it('removes local enemies missing from a host snapshot', () => {
        const enemies: EnemyDefinition[] = [
            { id: 'removed', type: 'giant-rat', roomIndex: 0, x: 2, y: 3, lastX: 2, lives: 1 },
            { id: 'alive', type: 'bandit', roomIndex: 0, x: 4, y: 3, lastX: 4, lives: 2 },
        ];
        const sync = new OnlineStateSync({
            getEnemies: () => enemies,
            setVariableValue: vi.fn(),
        });

        sync.applySnapshot({
            enemies: {
                alive: { x: 5, y: 3, hp: 2, roomIndex: 0, alive: true },
            },
            variables: {},
            objects: {},
            items: {},
            players: [],
        });

        expect(enemies.find((enemy) => enemy.id === 'removed')?.deathStartTime).toEqual(expect.any(Number));
        expect(enemies.find((enemy) => enemy.id === 'alive')?.x).toBe(5);

        vi.advanceTimersByTime(1000);

        expect(enemies.map((enemy) => enemy.id)).toEqual(['alive']);
    });
});
