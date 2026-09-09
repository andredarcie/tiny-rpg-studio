import { describe, expect, it } from 'vitest';
import { SkillDefinitions } from '../../runtime/domain/definitions/SkillDefinitions';
import { StateSkillManager } from '../../runtime/domain/state/StateSkillManager';
import { createRuntimeStateMock } from './mocks';

describe('StateSkillManager', () => {
    it('keeps three default skills outside the six assigned level slots', () => {
        expect(SkillDefinitions.getDefaultSkillOrder()).toEqual([
            'necromancer',
            'charisma',
            'stealth',
            'potion-master',
            'lava-walker',
            'keyless-doors',
            'booksmart',
            'blackmith',
            'blessed',
        ]);

        expect(SkillDefinitions.getAssignedSkillCapacity()).toBe(6);
        expect(SkillDefinitions.buildQueueForLevel(12)).not.toContain('booksmart');
        expect(SkillDefinitions.buildQueueForLevel(12)).not.toContain('blackmith');
        expect(SkillDefinitions.buildQueueForLevel(12)).not.toContain('blessed');
    });

    it('normalizes custom orders and only offers skills moved into assigned slots', () => {
        const order = SkillDefinitions.normalizeSkillOrder([
            'booksmart',
            'necromancer',
            'booksmart',
            'unknown',
        ]);

        expect(order).toHaveLength(9);
        expect(new Set(order)).toHaveLength(9);
        expect(SkillDefinitions.buildQueueForLevel(2, [], [], order).map((id) => id)).toContain('booksmart');
        expect(SkillDefinitions.buildQueueForLevel(12, [], order.slice(0, 6), order)).toEqual([]);
    });

    it('includes description and icon data for level-up overlay choices', () => {
        const state = createRuntimeStateMock();
        const manager = new StateSkillManager(state);

        manager.queueLevelUps(1, 2);
        const overlay = manager.startLevelSelection();

        expect(overlay).not.toBeNull();
        const choices = overlay?.choices ?? [];
        expect(choices.length).toBeGreaterThan(0);

        choices.forEach((choice) => {
            const definition = SkillDefinitions.getById(choice.id);
            expect(definition).not.toBeNull();
            expect(choice.descriptionKey).toBe(definition?.descriptionKey);
            expect(choice.icon).toBe(definition?.icon);
        });
    });
});
