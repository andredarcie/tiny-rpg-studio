import { describe, expect, it } from 'vitest';
import { TinyRPG } from '../../sdk';
import { validateBaseProject } from '../../sdk/validation';

describe('base SDK project contract', () => {
    it('loads legacy tileset.map and validates its layers', () => {
        const ground = Array.from({ length: 8 }, () => Array<number>(8).fill(2));
        const overlay = Array.from({ length: 8 }, () => Array<null>(8).fill(null));
        const input = { tileset: { map: { ground, overlay } } };
        const loaded = TinyRPG.fromProjectData(input);
        ground[0][0] = 3;
        expect(loaded.toProjectData().tileset.maps[0]).toEqual({ ground: ground.map(row => row.map(() => 2)), overlay });
        expect(() => TinyRPG.fromProjectData({ tileset: { map: { ground: [[true]] } } })).toThrow();
        expect(TinyRPG.fromProjectData({ tileset: { maps: [{ ground }], map: { ground: overlay } } }).toProjectData().tileset.maps[0].ground).toEqual(ground);
    });

    it('persists imported entity IDs for edits, removals and later additions', () => {
        const source = new TinyRPG();
        source.room(0).addEnemy({ type: 'skeleton', x: 1, y: 1 }).addEnemy({ type: 'skeleton', x: 2, y: 2 })
            .addXpScroll({ x: 3, y: 3 }).addNPC({ type: 'old-mage', x: 4, y: 4 });
        const input = source.toProjectData();
        for (const entity of [...input.enemies, ...input.objects, ...input.sprites]) delete entity.id;
        input.enemies[1].id = 'sdk-enemy-0-0';
        const loaded = TinyRPG.fromProjectData(input);
        const snapshot = loaded.toProjectData();
        const enemyId = snapshot.enemies[0].id ?? '';
        const objectId = snapshot.objects[0].id ?? '';
        const npcId = snapshot.sprites[0].id ?? '';
        expect(enemyId).not.toBe(snapshot.enemies[1].id);
        loaded.room(0).updateEntity('enemies', enemyId, { x: 5 }).updateEntity('objects', objectId, { x: 6 })
            .updateEntity('sprites', npcId, { name: 'Imported' });
        expect(loaded.toProjectData().enemies[0]).toMatchObject({ id: enemyId, x: 5 });
        expect(loaded.toProjectData().objects[0]).toMatchObject({ id: objectId, x: 6 });
        expect(loaded.toProjectData().sprites[0]).toMatchObject({ id: npcId, name: 'Imported' });
        loaded.room(0).removeEntity('enemies', enemyId).removeEntity('objects', objectId).removeEntity('sprites', npcId);
        expect(loaded.toProjectData().enemies[0].id).toBe('sdk-enemy-0-0');
        expect(loaded.toProjectData().objects).toEqual([]);
        expect(loaded.toProjectData().sprites).toEqual([]);
        loaded.room(0).addEnemy({ type: 'skeleton', x: 7, y: 7 });
        expect(new Set(loaded.toProjectData().enemies.map(enemy => enemy.id)).size).toBe(2);
        expect(input.objects[0].id).toBeUndefined();
    });

    it('rejects invalid tile definitions before changing stored tiles', () => {
        const game = new TinyRPG();
        const before = game.toProjectData();
        for (const changes of [{ collision: 'yes' }, { mergeEdges: 1 }, { visualEffect: 'unknown' }, { frames: [[[ '#FFFFFF' ]]] }, { pixels: Array.from({ length: 8 }, () => Array<string>(8).fill('bad')) }, { layouts: [Array.from({ length: 8 }, () => Array<number>(8).fill(16))] }]) {
            expect(() => game.configureTile(0, changes as never)).toThrow();
            expect(() => game.defineTile({ id: 'invalid', ...changes } as never)).toThrow();
            expect(game.toProjectData()).toEqual(before);
        }
        for (const id of [NaN, Infinity, false, {}]) expect(() => game.defineTile({ id } as never)).toThrow();
        const pixels = Array.from({ length: 8 }, () => Array<string>(8).fill('transparent'));
        expect(() => game.defineTile({ id: 'valid', pixels, frames: [pixels], layouts: [Array.from({ length: 8 }, () => Array<null>(8).fill(null))] })).not.toThrow();
    });

    it('rejects invalid layer cells atomically for full layers and cell edits', () => {
        const game = new TinyRPG();
        const room = game.room(0);
        room.setCell('ground', 0, 0, 'floor').setCell('overlay', 0, 0, 1);
        const before = game.toProjectData();
        for (const layer of ['ground', 'overlay'] as const) {
            for (const cell of [undefined, true, {}, NaN, Infinity]) {
                const cells = Array.from({ length: 8 }, () => Array<unknown>(8).fill(null));
                cells[0][0] = cell;
                expect(() => room[layer](cells as never)).toThrow();
                expect(() => room.setCell(layer, 0, 0, cell as never)).toThrow();
                expect(game.toProjectData()).toEqual(before);
            }
            const sparse = Array.from({ length: 8 }, () => new Array<null>(8));
            expect(() => room[layer](sparse)).toThrow();
        }
        expect(() => room.setCell('invalid' as never, 0, 0, null)).toThrow();
        expect(game.toProjectData()).toEqual(before);
    });

    it('validates entity edits and imports with the same base contract', () => {
        for (const experience of [-1, 1.5, NaN, Infinity, 17]) {
            expect(() => validateBaseProject({ enemies: [{ type: 'skeleton', x: 1, y: 1, roomIndex: 0, experience }] })).toThrow();
        }
        for (const fields of [{ endingText: 'a'.repeat(41) }, { experience: -1 }, { id: '' }]) {
            expect(() => validateBaseProject({ objects: [{ type: 'player-end', x: 1, y: 1, roomIndex: 0, ...fields }] })).toThrow();
        }
        expect(() => validateBaseProject({ objects: [{ type: 'switch', x: 1, y: 1, roomIndex: 0 }] })).toThrow();
        expect(() => validateBaseProject({ objects: [{ type: 'logic-gate-and', x: 1, y: 1, roomIndex: 0, inputVariableId: 'var-1', outputVariableId: 'var-2' }] })).toThrow();
        const game = new TinyRPG();
        game.room(0).addEnemy({ type: 'skeleton', x: 1, y: 1 });
        const before = game.toProjectData();
        expect(() => game.room(0).updateEntity('enemies', before.enemies[0].id ?? '', { experience: -1 })).toThrow();
        expect(game.toProjectData()).toEqual(before);
    });

    it('rejects invalid variable metadata and NPC text without allocating storage', () => {
        for (const entry of [{ id: 'var-1', value: 1 }, { id: 'var-1', value: false, color: 'red' }, { id: 'var-1', value: false, name: 3 }]) {
            expect(() => validateBaseProject({ variables: [entry] })).toThrow();
        }
        const game = new TinyRPG();
        expect(() => game.variable(3 as unknown as string)).toThrow();
        expect(game.variable('First').id).toBe('var-1');
        expect(() => game.room(0).addNPC({ type: 'old-mage', x: 1, y: 1, name: 'a'.repeat(81) })).toThrow();
        expect(() => game.room(0).addNPC({ type: 'old-mage', x: 1, y: 1, text: 3 as unknown as string })).toThrow();
    });
    it('rejects malformed base settings, room sizes and sprite dimensions', () => {
        expect(() => TinyRPG.fromProjectData({ hideHud: 'false' })).toThrow();
        expect(() => TinyRPG.fromProjectData({ rooms: [{ size: 8, tiles: [[0]], walls: [[false]] }] })).toThrow();
        expect(() => new TinyRPG().defineSprite({ group: 'enemy', key: 'skeleton', frames: [[[1]]] })).toThrow();
    });

    it('preserves ending branches, zero XP, tile effects and clear operations', () => {
        const game = new TinyRPG().showNewDialogExclamation(false);
        const id = game.createTileEffect('Embers', ['embers']);
        game.configureTile(0, { visualEffect: id, collision: false, mergeEdges: true });
        game.room(0).addNPC({ type: 'old-mage', x: 1, y: 1, disappearAfterDialog: true, rewardVariable: 'END_GAME', conditionalRewardVariable: 'END_GAME',
            choice: { prompt: 'Finish?', yesText: 'Yes', noText: 'No', yesVariable: 'END_GAME', noVariable: 'END_GAME' } });
        game.room(0).addXpScroll({ x: 2, y: 2, experience: 0 });
        const loaded = TinyRPG.fromShareCode(game.toShareCode()).toProjectData();
        expect(loaded.showNewDialogExclamation).toBe(false);
        expect(loaded.sprites.find(npc => npc.type === 'old-mage')).toMatchObject({ disappearAfterDialog: true, rewardVariableId: 'END_GAME', conditionalRewardVariableId: 'END_GAME', choiceYesVariableId: 'END_GAME', choiceNoVariableId: 'END_GAME' });
        expect(loaded.objects.find(object => object.type === 'xp-scroll')?.experience).toBe(0);
        game.removeTileEffect(id);
        expect(game.toProjectData().tileset.tiles.find(tile => tile.id === 0)?.visualEffect).toBe('none');
    });

    it('keeps custom tile IDs and nullable cells through a share and project reload', () => {
        const game = new TinyRPG();
        game.defineTile({ id: 'floor', name: 'Floor', collision: false });
        game.room(0).setCell('ground', 0, 0, 'floor').setCell('overlay', 1, 1, null);
        const loaded = TinyRPG.fromShareCode(game.toShareCode());
        expect(loaded.toProjectData().tileset.maps[0].ground[0][0]).toBe('floor');
        expect(loaded.toProjectData().tileset.tiles.find(tile => tile.id === 'floor')?.name).toBe('Floor');
    });
    it('loads complete base projects and rejects plugin worlds atomically', () => {
        const load = Reflect.get(TinyRPG, 'fromProjectData') as (data: unknown) => TinyRPG;
        expect(load).toBeTypeOf('function');
        const source = new TinyRPG().setTitle('Loaded');
        const loaded = load(source.toProjectData());
        expect(loaded.toProjectData().title).toBe('Loaded');
        expect(() => load({ ...source.toProjectData(), world: { rows: 5, cols: 5 } })).toThrow();
        expect(() => load({ ...source.toProjectData(), gameplayPlugins: [{ id: 'variables-plus', version: '1.0.0' }] })).toThrow();
    });

    it('supports effects, markers, NPC endings, pickups and exits', () => {
        const game = new TinyRPG();
        const effects = Reflect.get(game, 'enableEffects') as (value: boolean) => TinyRPG;
        expect(effects).toBeTypeOf('function');
        effects.call(game, false);
        expect(game.toProjectData()).toMatchObject({ enableEffects: false, roomSize: 8, world: { rows: 3, cols: 3 } });
        const room = game.room(0);
        const addExit = Reflect.get(room, 'addExit') as (value: unknown) => unknown;
        expect(addExit).toBeTypeOf('function');
        addExit.call(room, { x: 2, y: 2, targetRoomIndex: 8, targetX: 0, targetY: 0 });
        expect(Reflect.get(game.toProjectData(), 'exits')).toEqual([{ roomIndex: 0, x: 2, y: 2, targetRoomIndex: 8, targetX: 0, targetY: 0 }]);
    });
    it('does not mutate settings when validation fails', () => {
        const game = new TinyRPG().setBackgroundMusic('dQw4w9WgXcQ', 20);
        const before = game.toProjectData();
        expect(() => game.setBackgroundMusic('abcdefghijk', -1)).toThrow();
        expect(game.toProjectData()).toEqual(before);
    });

    it('copies palette, map and sprite inputs and output snapshots', () => {
        const palette = Array.from({ length: 16 }, () => '#000000');
        const ground = Array.from({ length: 8 }, () => Array<number>(8).fill(1));
        const frames = [Array.from({ length: 8 }, () => Array<number | null>(8).fill(1))];
        const game = new TinyRPG().setPalette(palette).defineSprite({ group: 'enemy', key: 'skeleton', frames });
        game.room(0).ground(ground);
        palette[0] = '#FFFFFF'; ground[0][0] = 2; frames[0][0][0] = 2;
        const output = game.toProjectData();
        expect(output.customPalette?.[0]).toBe('#000000');
        expect(output.tileset.maps[0].ground[0][0]).toBe(1);
        expect(output.customSprites?.[0].frames[0][0][0]).toBe(1);
        if (output.customPalette) output.customPalette[0] = '#FFFFFF';
        expect(game.toProjectData().customPalette?.[0]).toBe('#000000');
    });

    it('keeps failed object wiring from reserving a cell', () => {
        const room = new TinyRPG().room(0);
        expect(() => room.addSwitch({ x: 1, y: 1, variable: 17 })).toThrow();
        expect(() => room.addKey({ x: 1, y: 1 })).not.toThrow();
    });

    it('replaces sprite art instead of accumulating overrides', () => {
        const frames = [Array.from({ length: 8 }, () => Array<number | null>(8).fill(1))];
        const game = new TinyRPG();
        game.defineSprite({ group: 'enemy', key: 'skeleton', frames });
        game.defineSprite({ group: 'enemy', key: 'skeleton', frames });
        expect(game.toProjectData().customSprites).toHaveLength(1);
    });
});
