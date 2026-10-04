import { describe, expect, it } from 'vitest';
import { TinyRPG } from '../../sdk';
import { GameState } from '../../runtime/domain/GameState';

describe('SDK authoring serialization', () => {
    it('preserves variable colors through shares and engine reloads', () => {
        const project = new TinyRPG().toProjectData();
        project.variables[0] = { ...project.variables[0], color: '#123456' };
        const shared = TinyRPG.fromShareCode(TinyRPG.fromProjectData(project).toShareCode()).toProjectData();
        const state = new GameState();
        state.importGameData(shared);
        const reloaded = TinyRPG.fromProjectData(state.exportGameData()).toProjectData();
        expect(reloaded.variables[0]).toMatchObject({ id: 'var-1', color: '#123456' });
    });
    it('omits pickup progress from exported item definitions', () => {
        const state = new GameState();
        state.game.items = [{ type: 'key', roomIndex: 0, x: 1, y: 2, collected: true }];
        const exported = state.exportGameData() as { items: unknown[] };
        expect(exported.items).toEqual([{ type: 'key', roomIndex: 0, x: 1, y: 2 }]);
        expect(state.game.items[0].collected).toBe(true);
    });
    it('allocates fresh IDs when adding entities to a loaded project', () => {
        const game = new TinyRPG();
        game.room(0).addPushBox({ x: 1, y: 2 });
        const loaded = TinyRPG.fromProjectData(game.toProjectData());
        loaded.room(0).addPushBox({ x: 3, y: 2 });
        const ids = loaded.toProjectData().objects.map(entry => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
    it('preserves authored object IDs through engine import and updates', () => {
        const game = new TinyRPG();
        game.room(0).addPushBox({ x: 1, y: 2 });
        const project = game.toProjectData();
        const state = new GameState(); state.importGameData(project);
        const source = project.objects[0];
        expect(state.game.objects.find(entry => entry.type === 'push-box')?.id).toBe(source.id);
        if (!source.id) throw Error('Missing ID');
        game.room(0).updateEntity('objects', source.id, { x: 3 });
        expect(game.toProjectData().objects[0]).toMatchObject({ id: source.id, x: 3 });
    });
    it('keeps names, IDs, room metadata and string tiles through shares', () => {
        const game = new TinyRPG();
        game.room(0).addNPC({ type: 'old-mage', name: 'Merlin', x: 1, y: 1, text: 'Welcome' });
        const loaded = TinyRPG.fromShareCode(game.toShareCode()).toProjectData();
        expect(loaded.sprites[0]).toMatchObject({ id: 'npc-old-mage', name: 'Merlin' });
        expect(loaded.rooms[0]).toEqual(game.toProjectData().rooms[0]);
    });
    it('exports detached definitions after pickups and box movement', () => {
        const state = new GameState();
        const game = new TinyRPG();
        game.room(0).addPushBox({ x: 1, y: 2 });
        state.importGameData(game.toProjectData());
        const box = state.game.objects.find(entry => entry.type === 'push-box');
        if (!box) throw Error('Missing box');
        box.originalX = 1; box.originalY = 2; box.x = 4; box.y = 5; box.collected = true;
        const exported = state.exportGameData() as { objects: typeof state.game.objects; title: string };
        const definition = exported.objects.find(entry => entry.type === 'push-box');
        expect(definition).toMatchObject({ x: 1, y: 2 });
        for (const key of ['collected', 'opened', 'activated', 'originalX', 'originalY', '_activatedBy']) expect(definition).not.toHaveProperty(key);
        exported.title = 'Changed'; exported.objects[0].x = 7;
        expect(state.game.title).not.toBe('Changed');
        expect(box.x).toBe(4);
    });
});
