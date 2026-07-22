import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TinyRPG, MAX_VARIABLES } from '../../sdk/index';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';

// Canvas mock (custom-sprite encoding touches the sprite registry).
beforeAll(() => {
    if (typeof HTMLCanvasElement !== 'undefined') {
        const noop = () => {};
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            canvas: document.createElement('canvas'),
            fillRect: noop, clearRect: noop, drawImage: noop,
            getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
            putImageData: noop, createImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
            save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
            beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
            arc: noop, rect: noop, strokeRect: noop, setTransform: noop, resetTransform: noop,
            measureText: (t: string) => ({ width: t.length * 6 }),
            fillText: noop, strokeText: noop, getContextAttributes: () => ({}),
            imageSmoothingEnabled: false, font: '', textAlign: 'left', textBaseline: 'alphabetic',
            fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1
        })) as unknown as HTMLCanvasElement['getContext'];
    }
});

/** Encodes the game and decodes it back to the runtime gameData shape. */
function roundTrip(game: TinyRPG): Record<string, unknown> {
    const decoded = ShareDecoder.decodeShareCode(game.toShareCode());
    expect(decoded).toBeTruthy();
    return decoded as Record<string, unknown>;
}

function objectsOf(decoded: Record<string, unknown>): Array<Record<string, unknown>> {
    return (decoded.objects as Array<Record<string, unknown>> | undefined) ?? [];
}

describe('SDK variables', () => {
    it('allocates sequential var ids', () => {
        const g = new TinyRPG();
        expect(g.variable().id).toBe('var-1');
        expect(g.variable().id).toBe('var-2');
        expect(g.variable('named').id).toBe('var-3');
    });

    it('throws after MAX_VARIABLES allocations', () => {
        const g = new TinyRPG();
        for (let i = 0; i < MAX_VARIABLES; i++) g.variable();
        expect(() => g.variable()).toThrow(/Cannot allocate more than/);
    });

    it('emits initial ON variables in the payload', () => {
        const g = new TinyRPG();
        g.variable('on', { initial: true });
        g.variable('off');
        const vars = g.toSharePayload().variables ?? [];
        expect(vars.find(v => v.id === 'var-1')?.value).toBe(true);
        expect(vars.find(v => v.id === 'var-2')?.value).toBe(false);
    });
});

describe('SDK new object types round-trip', () => {
    it('switch + variable-door + led keep their variable wiring', () => {
        const g = new TinyRPG();
        const v = g.variable('open');
        g.room(0)
            .addSwitch({ x: 1, y: 1, variable: v })
            .addLed({ x: 2, y: 1, variable: v })
            .addVariableDoor({ x: 3, y: 1, variable: v });
        const objs = objectsOf(roundTrip(g));
        expect(objs.find(o => o.type === 'switch')?.variableId).toBe('var-1');
        expect(objs.find(o => o.type === 'logic-led')?.variableId).toBe('var-1');
        expect(objs.find(o => o.type === 'door-variable')?.variableId).toBe('var-1');
    });

    it('logic gate preserves type, inputs and output', () => {
        const g = new TinyRPG();
        const a = g.variable(), b = g.variable(), out = g.variable();
        g.room(0).addLogicGate({ type: 'and', x: 4, y: 4, inputA: a, inputB: b, output: out });
        const gate = objectsOf(roundTrip(g)).find(o => String(o.type).startsWith('logic-gate'));
        expect(gate?.type).toBe('logic-gate-and');
        expect(gate?.inputVariableId).toBe('var-1');
        expect(gate?.inputVariableId2).toBe('var-2');
        expect(gate?.outputVariableId).toBe('var-3');
    });

    it('NOT gate only needs inputA', () => {
        const g = new TinyRPG();
        const a = g.variable(), out = g.variable();
        g.room(0).addLogicGate({ type: 'not', x: 4, y: 4, inputA: a, output: out });
        const gate = objectsOf(roundTrip(g)).find(o => o.type === 'logic-gate-not');
        expect(gate?.inputVariableId).toBe('var-1');
        expect(gate?.outputVariableId).toBe('var-2');
    });

    it('trap (with and without variable), pressure-plate round-trip', () => {
        const g = new TinyRPG();
        const v = g.variable();
        g.room(0)
            .addTrap({ x: 1, y: 1 })
            .addTrap({ x: 2, y: 1, variable: v })
            .addPressurePlate({ x: 3, y: 1, variable: v });
        const objs = objectsOf(roundTrip(g));
        expect(objs.filter(o => o.type === 'trap')).toHaveLength(2);
        expect(objs.find(o => o.type === 'pressure-plate')?.variableId).toBe('var-1');
    });

    it('armor, boots, push-box, xp-scroll round-trip', () => {
        const g = new TinyRPG();
        g.room(0)
            .addArmor({ x: 1, y: 1 })
            .addBoots({ x: 2, y: 1 })
            .addPushBox({ x: 3, y: 1 })
            .addXpScroll({ x: 4, y: 1 });
        const types = objectsOf(roundTrip(g)).map(o => o.type);
        expect(types).toContain('armor');
        expect(types).toContain('boots');
        expect(types).toContain('push-box');
        expect(types).toContain('xp-scroll');
    });

    it('chest with fixed contents and random chest round-trip', () => {
        const g = new TinyRPG();
        g.room(0)
            .addChest({ x: 1, y: 1, contains: 'sword-bronze' })
            .addChest({ x: 2, y: 1, random: true });
        const chests = objectsOf(roundTrip(g)).filter(o => o.type === 'chest');
        expect(chests).toHaveLength(2);
        expect(chests.some(c => c.containsItemType === 'sword-bronze')).toBe(true);
        expect(chests.some(c => c.randomItem === true)).toBe(true);
    });

    it('allows multiple switches but one variable-door per room', () => {
        const g = new TinyRPG();
        const v = g.variable();
        const room = g.room(0);
        room.addSwitch({ x: 1, y: 1, variable: v }).addSwitch({ x: 2, y: 1, variable: v });
        room.addVariableDoor({ x: 3, y: 1, variable: v });
        expect(() => room.addVariableDoor({ x: 4, y: 1, variable: v })).toThrow(/already has a 'door-variable'/);
    });

    it('rejects two objects on the same tile', () => {
        const g = new TinyRPG();
        const v = g.variable();
        const room = g.room(0).addSwitch({ x: 1, y: 1, variable: v });
        expect(() => room.addLed({ x: 1, y: 1, variable: v })).toThrow(/already has an object/);
    });
});

describe('SDK NPC and enemy variable wiring', () => {
    it('NPC conditional dialog + rewards survive round-trip', () => {
        const g = new TinyRPG();
        const cond = g.variable(), reward = g.variable();
        g.room(0).addNPC({
            type: 'old-mage', x: 2, y: 2, text: 'Hi',
            conditionVariable: cond, conditionText: 'Done!',
            rewardVariable: reward,
        });
        const sprites = (roundTrip(g).sprites as Array<Record<string, unknown>> | undefined) ?? [];
        const npc = sprites.find(s => s.type === 'old-mage');
        expect(npc?.conditionVariableId).toBe('var-1');
        expect(npc?.conditionText).toBe('Done!');
        expect(npc?.rewardVariableId).toBe('var-2');
    });

    it('NPC definitive choice and branch rewards survive round-trip', () => {
        const g = new TinyRPG();
        const yes = g.variable(), no = g.variable();
        g.room(0).addNPC({
            type: 'old-mage', x: 2, y: 2, text: 'Decide.',
            choice: {
                prompt: 'Restart the clock?',
                yesText: 'Then the city lives.',
                noText: 'Then let it sleep.',
                yesVariable: yes,
                noVariable: no,
            },
        });
        const sprites = (roundTrip(g).sprites as Array<Record<string, unknown>> | undefined) ?? [];
        const npc = sprites.find(s => s.type === 'old-mage');
        expect(npc?.choiceEnabled).toBe(true);
        expect(npc?.choicePrompt).toBe('Restart the clock?');
        expect(npc?.choiceYesText).toBe('Then the city lives.');
        expect(npc?.choiceNoText).toBe('Then let it sleep.');
        expect(npc?.choiceYesVariableId).toBe('var-1');
        expect(npc?.choiceNoVariableId).toBe('var-2');
    });

    it('NPC choice works without optional branch rewards', () => {
        const g = new TinyRPG();
        g.room(0).addNPC({
            type: 'knight', x: 1, y: 1,
            choice: {
                prompt: 'Open the gate?',
                yesText: 'The gate opens.',
                noText: 'The gate stays shut.',
            },
        });
        const sprites = (roundTrip(g).sprites as Array<Record<string, unknown>> | undefined) ?? [];
        const npc = sprites.find(s => s.type === 'knight');
        expect(npc?.choiceEnabled).toBe(true);
        expect(npc?.choiceYesVariableId).toBeNull();
        expect(npc?.choiceNoVariableId).toBeNull();
    });

    it('enemy defeat variable survives round-trip', () => {
        const g = new TinyRPG();
        const slain = g.variable();
        g.room(0).addEnemy({ type: 'dragon', x: 3, y: 3, defeatVariable: slain });
        const enemies = (roundTrip(g).enemies as Array<Record<string, unknown>> | undefined) ?? [];
        expect(enemies[0]?.defeatVariableId).toBe('var-1');
    });
});

describe('SDK game-level flags', () => {
    it('background music id + volume', () => {
        const g = new TinyRPG().setBackgroundMusic('dQw4w9WgXcQ', 40);
        const p = g.toSharePayload();
        expect(p.backgroundMusicVideoId).toBe('dQw4w9WgXcQ');
        expect(p.backgroundMusicVolume).toBe(40);
        const decoded = roundTrip(g);
        expect(decoded.backgroundMusicVideoId).toBe('dQw4w9WgXcQ');
    });

    it('accepts a full YouTube URL', () => {
        const p = new TinyRPG()
            .setBackgroundMusic('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
            .toSharePayload();
        expect(p.backgroundMusicVideoId).toBe('dQw4w9WgXcQ');
    });

    it('disableSkills and disablePixelFont round-trip', () => {
        const g = new TinyRPG().disableSkills().disablePixelFont();
        const decoded = roundTrip(g);
        expect(decoded.disableSkills).toBe(true);
        expect(decoded.disablePixelFont).toBe(true);
    });

    it('enableOnline sets the online flag', () => {
        const p = new TinyRPG().enableOnline().toSharePayload();
        expect(p.online?.enabled).toBe(true);
    });

    it('validation: invalid music id, bad volume, unknown skill', () => {
        expect(() => new TinyRPG().setBackgroundMusic('nope')).toThrow(/Invalid YouTube/);
        expect(() => new TinyRPG().setBackgroundMusic('dQw4w9WgXcQ', 200)).toThrow(/volume must be/);
        expect(() => new TinyRPG().setSkillOrder(['not-a-skill'])).toThrow(/Unknown skill/);
    });
});

describe('SDK custom sprites', () => {
    const frame8 = () => Array.from({ length: 8 }, () => Array(8).fill(0) as (number | null)[]);

    it('round-trips a custom enemy sprite', () => {
        const g = new TinyRPG();
        const f = frame8();
        f[0][0] = 8; f[7][7] = null;
        g.defineSprite({ group: 'enemy', key: 'skeleton', frames: [f] });
        const decoded = roundTrip(g);
        const sprites = (decoded.customSprites as Array<Record<string, unknown>> | undefined) ?? [];
        const entry = sprites.find(s => s.group === 'enemy' && s.key === 'skeleton');
        expect(entry).toBeTruthy();
        const frames = entry?.frames as (number | null)[][][];
        expect(frames[0][0][0]).toBe(8);
        expect(frames[0][7][7]).toBeNull();
    });

    it('supports multiple frames and the on variant', () => {
        const g = new TinyRPG();
        g.defineSprite({ group: 'object', key: 'mything', variant: 'on', frames: [frame8(), frame8()] });
        const sprites = (roundTrip(g).customSprites as Array<Record<string, unknown>> | undefined) ?? [];
        const entry = sprites.find(s => s.key === 'mything');
        expect(entry?.variant).toBe('on');
        expect((entry?.frames as unknown[]).length).toBe(2);
    });

    it('validation: bad group, empty frames, out-of-range pixel, ragged matrix', () => {
        expect(() => new TinyRPG().defineSprite({ group: 'bogus' as never, key: 'k', frames: [frame8()] }))
            .toThrow(/Unknown sprite group/);
        expect(() => new TinyRPG().defineSprite({ group: 'tile', key: 'k', frames: [] }))
            .toThrow(/at least one frame/);
        const bad = frame8(); bad[0][0] = 99;
        expect(() => new TinyRPG().defineSprite({ group: 'tile', key: 'k', frames: [bad] }))
            .toThrow(/\[0, 15\] or null/);
        const ragged = frame8(); ragged[1] = [0, 0];
        expect(() => new TinyRPG().defineSprite({ group: 'tile', key: 'k', frames: [ragged] }))
            .toThrow(/rectangular/);
    });
});
