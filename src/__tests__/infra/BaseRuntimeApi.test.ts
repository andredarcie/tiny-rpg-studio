import { describe, expect, it, vi } from 'vitest';
import { createBaseRuntimeApi } from '../../runtime/infra/BaseRuntimeApi';
import type { GameEngine } from '../../runtime/services/GameEngine';

describe('standalone base mutations', () => {
    it('rejects invalid mutations before invoking engine services', () => {
        const engine = { setOnlineConfig: vi.fn(), setMapCell: vi.fn(), setObjectVariableById: vi.fn(), setEnemyExperience: vi.fn(), setItems: vi.fn() };
        const api = createBaseRuntimeApi(engine as unknown as GameEngine);
        expect(() => api.setOnlineConfig({ enabled: true, spawnPoints: [{ role: 'p1', roomIndex: 9, x: 0, y: 0 }] })).toThrow();
        expect(() => api.setMapCell(0, 'ground', 8, 0, null)).toThrow();
        expect(() => api.setObjectVariableById('object', 'var-17')).toThrow();
        expect(() => api.setEnemyExperience('enemy', -1)).toThrow();
        expect(() => api.setItems([{ type: 'dialog', roomIndex: 0, x: -1, y: 0, text: 'hello' }])).toThrow();
        Object.values(engine).forEach(method => expect(method).not.toHaveBeenCalled());
    });
    it('validates complete entity updates and roster limits without mutating the engine', () => {
        const sprite = { id: 'npc', type: 'old-mage', x: 0, y: 0, roomIndex: 0, text: '', placed: true };
        const engine = { exportGameData: () => ({ sprites: [sprite] }), updateNPC: vi.fn(), addSprite: vi.fn() };
        const api = createBaseRuntimeApi(engine as unknown as GameEngine);
        expect(() => api.updateNPC('npc', { x: 8 })).toThrow();
        expect(() => api.addSprite({ ...sprite, id: 'other' })).toThrow();
        expect(engine.updateNPC).not.toHaveBeenCalled();
        expect(engine.addSprite).not.toHaveBeenCalled();
        api.updateNPC('npc', { choiceEnabled: false, rewardVariableId: 'END_GAME' });
        expect(engine.updateNPC).toHaveBeenCalledWith('npc', { choiceEnabled: false, rewardVariableId: 'END_GAME' });
    });
    it('inspects all object wiring and rewards with detached typed results', () => {
        const objects = [{ id: 'gate', type: 'logic-gate-and', roomIndex: 0, x: 1, y: 2, inputVariableId: 'var-1', inputVariableId2: 'var-2', outputVariableId: 'var-3', hiddenInGame: false, containsItemType: 'key', randomItem: false, experience: 0 }];
        const engine = { getObjects: () => objects, getObjectsForRoom: () => objects, setObjectRandomItemById: vi.fn() };
        const api = createBaseRuntimeApi(engine as unknown as GameEngine);
        expect(api.getObjects()).toEqual(objects);
        const result = api.getObjectsForRoom(0);
        result[0].inputVariableId2 = 'var-4';
        expect(objects[0].inputVariableId2).toBe('var-2');
        api.setObjectRandomItemById('gate', false);
        expect(engine.setObjectRandomItemById).toHaveBeenCalledWith('gate', false);
    });
});

