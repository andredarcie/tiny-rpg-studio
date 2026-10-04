import { describe, expect, it, vi } from 'vitest';
import { createAuthoring } from '../../editor/authoring/EditorAuthoring';
import { GameState } from '../../runtime/domain/GameState';
import type { EditorHistoryManager } from '../../editor/modules/EditorHistoryManager';

const setup = () => {
    let project = new GameState().exportGameData() as Record<string, unknown>;
    const host = {
        gameEngine: { exportGameData: () => structuredClone(project) }, projectGeneration: 0,
        history: { stack: [], index: 0, pushSnapshot: vi.fn(), pushCurrentState: vi.fn() } as unknown as EditorHistoryManager,
        restore: vi.fn((data: Record<string, unknown>) => { project = data; }), updateJSON: vi.fn(), persistAuthoring: vi.fn(),
    };
    return { host, authoring: createAuthoring(host) };
};

describe('base authoring contract', () => {
    it('discovers and applies online settings with validation and rollback', () => {
        const { host, authoring } = setup();
        expect(authoring.capabilities().tools.some(tool => tool.function.name === 'set_online')).toBe(true);
        const transaction = authoring.begin();
        const before = transaction.read('project');
        expect(() => transaction.apply('set_online', { enabled: true, spawnPoints: [{ role: 'p3', x: 0, y: 0, roomIndex: 0 }] })).toThrow();
        expect(transaction.read('project')).toEqual(before);
        transaction.apply('set_online', { enabled: true, spawnPoints: [{ role: 'p1', x: 0, y: 0, roomIndex: 0 }] });
        expect(transaction.commit()).toEqual({ changed: true, operations: 1 });
        expect(host.persistAuthoring).toHaveBeenCalledOnce();
    });
    it('clears optional project settings explicitly', () => {
        const { authoring } = setup();
        const transaction = authoring.begin();
        transaction.apply('clear_settings', { settings: ['customPalette', 'skillCustomizations', 'online', 'backgroundMusic'] });
        expect(transaction.read('project')).not.toHaveProperty('customPalette');
        transaction.discard();
    });
});
