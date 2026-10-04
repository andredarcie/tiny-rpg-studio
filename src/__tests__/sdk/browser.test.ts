import { TinyRPG } from '../../sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const stubs = vi.hoisted(() => ({ destroy: vi.fn(), importGameData: vi.fn(), getState: vi.fn(() => ({ player: { x: 1 } })) }));
vi.mock('../../runtime/services/GameEngine', () => ({ GameEngine: class {
    destroy = stubs.destroy;
    importGameData = stubs.importGameData;
    getState = stubs.getState;
} }));
import { createRuntime } from '../../sdk/browser';

describe('browser SDK lifecycle', () => {
    beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; document.body.className = ''; });
    it('creates an owned canvas and tears down once', () => {
        const container = document.createElement('div'); document.body.append(container);
        const api = createRuntime({ container });
        expect(container.querySelector('canvas')).toBeTruthy();
        api.destroy(); api.destroy();
        expect(container.children).toHaveLength(0);
        expect(stubs.destroy).toHaveBeenCalledTimes(1);
        expect(document.body.classList.contains('game-mode')).toBe(false);
    });
    it('cleans up after import fails', () => {
        const container = document.createElement('div'); document.body.append(container);
        stubs.importGameData.mockImplementationOnce(() => { throw Error('failed import'); });
        expect(() => createRuntime({ container, project: new TinyRPG().toProjectData() })).toThrow('failed import');
        expect(container.children).toHaveLength(0);
        expect(stubs.destroy).toHaveBeenCalledTimes(1);
    });
});
