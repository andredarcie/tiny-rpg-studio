import { afterEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/3d-renderer/1.0.0/plugin.html?raw';
import { parsePluginHtml } from '../../editor/manager/PluginManager';
import { applyInstalled3dRenderer } from '../../editor/manager/applyInstalled3dRenderer';
import type { GameplayContext } from '../../runtime/infra/GameplayPluginHost';
import type { GameplayFeedback, GameplayPresentation, GameplayScene } from '../../runtime/adapters/renderer/GameplayPresentation';

afterEach(() => vi.restoreAllMocks());

const load = (getPresentationResources?: GameplayContext['getPresentationResources']) => {
    const plugin = parsePluginHtml(source);
    const factory = new Function((plugin.payload?.gameplayJavascript ?? '').replace('export function activate', 'function activate') + ';return activate;') as () => (context: Partial<GameplayContext>) => void;
    let presentation!: GameplayPresentation;
    factory()({ registerGameplayPresentation: provider => { presentation = provider; return () => {}; }, onCleanup: () => {}, requestRedraw: vi.fn(), getPresentationResources });
    return { plugin, presentation };
};

it('attaches only the installed renderer, preserves authored data and synchronizes replacements', () => {
    const { plugin } = load();
    const project = { title: 'World', rooms: [{ walls: [[true]] }] };
    expect(applyInstalled3dRenderer(project, [])).toBe(project);
    const attached = applyInstalled3dRenderer(project, [plugin]);
    expect(attached).toMatchObject({ ...project, gameplayPlugins: [{ id: plugin.id, version: plugin.version }] });
    expect(project).not.toHaveProperty('gameplayPlugins');
    expect(applyInstalled3dRenderer(attached, [plugin])).toBe(attached);
    expect(applyInstalled3dRenderer(attached, [{ ...plugin, version: '2.0.0' }])).toBe(attached);
    expect(applyInstalled3dRenderer(attached, [{ ...plugin, version: '2.0.0' }], true)).toMatchObject({ gameplayPlugins: [{ id: plugin.id, version: '2.0.0' }] });
});

it('turns ninety degrees, waits for the animation before moving, and resets north', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { presentation: p } = load();
    expect(p.direction('up')).toEqual([0, -1]);
    expect(p.direction('right')).toBeNull();
    expect(p.direction('up')).toBeNull();
    expect(p.direction('right')).toBeNull();
    clock.mockReturnValue(299);
    expect(p.direction('up')).toBeNull();
    clock.mockReturnValue(300);
    expect(p.direction('up')).toEqual([1, 0]);
    expect(p.direction('down')).toEqual([-1, 0]);
    p.direction('left');
    clock.mockReturnValue(600);
    expect(p.direction('up')).toEqual([0, -1]);
    p.direction('left');
    clock.mockReturnValue(900);
    expect(p.direction('up')).toEqual([-1, 0]);
    p.reset(); expect(p.direction('up')).toEqual([0, -1]);
});

it.each([
    { initialDirection: 0, expected: [0, -1] }, { initialDirection: 1, expected: [1, 0] },
    { initialDirection: 2, expected: [0, 1] }, { initialDirection: 3, expected: [-1, 0] },
    { initialDirection: 99, expected: [0, -1] }, { initialDirection: '1', expected: [0, -1] },
])('starts immediately in direction $initialDirection and rereads project settings on reset', ({ initialDirection, expected }) => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    let data = { initialDirection };
    const { presentation } = load(() => ({ palette: [], data }));
    expect(presentation.direction('up')).toEqual(expected);
    data = { initialDirection: 2 };
    expect(presentation.direction('up')).toEqual(expected);
    presentation.direction('right'); clock.mockReturnValue(150);
    presentation.reset();
    expect(presentation.direction('up')).toEqual([0, 1]);
    data = { initialDirection: 3 }; presentation.reset();
    expect(presentation.direction('down')).toEqual([1, 0]);
});

it('renders the initial camera angle before movement and resolves settings after activation', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    let data = { initialDirection: 0 };
    const view = render(() => ({ palette: [], data }));
    const north = Array.from(view.draw(scene()).data);
    view.presentation.direction('right'); clock.mockReturnValue(300);
    const east = Array.from(view.draw(scene()).data);
    expect(east).not.toEqual(north);
    view.presentation.reset(); data = { initialDirection: 1 };
    expect(Array.from(view.draw(scene()).data)).toEqual(east);
    expect(view.needsFrame).toBe(false);
    expect(view.presentation.direction('up')).toEqual([1, 0]);
});

it('animates intermediate camera angles, settles exactly on cardinals and cancels on reset', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const view = render();
    const initial = Array.from(view.draw(scene()).data);
    view.presentation.direction('right');
    expect(Array.from(view.draw(scene()).data)).toEqual(initial);
    expect(view.needsFrame).toBe(true);
    clock.mockReturnValue(150);
    const middle = Array.from(view.draw(scene()).data);
    expect(middle).not.toEqual(initial);
    clock.mockReturnValue(300);
    const east = Array.from(view.draw(scene()).data);
    expect(east).not.toEqual(initial); expect(east).not.toEqual(middle);
    expect(view.needsFrame).toBe(false);
    for (let turn = 1; turn < 4; turn++) {
        view.presentation.direction('right'); clock.mockReturnValue((turn + 1) * 300); view.draw(scene());
    }
    expect(Array.from(view.draw(scene()).data)).toEqual(initial);
    view.presentation.direction('left'); clock.mockReturnValue(1350);
    expect(Array.from(view.draw(scene()).data)).not.toEqual(initial);
    view.presentation.reset();
    expect(Array.from(view.draw(scene()).data)).toEqual(initial);
    expect(view.needsFrame).toBe(false);
});

const scene = (): GameplayScene => ({
    width: 8, height: 8, player: { x: 3.5, y: 4.5 }, ceiling: '#000011', floor: '#111100', boundary: '#777777',
    cells: Array.from({ length: 64 }, (_, i) => ({ solid: Math.floor(i / 8) === 1, blocked: Math.floor(i / 8) === 1,
        wall: [['#ff0000']], floor: null, color: '#222222' })), entities: [],
});

const render = (getPresentationResources?: GameplayContext['getPresentationResources']) => {
    let data!: ImageData;
    let needsFrame: boolean | void;
    const buffer = { createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: (image: ImageData) => { data = image; } };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(buffer as unknown as CanvasRenderingContext2D);
    const { presentation } = load(getPresentationResources);
    const ctx = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn() } as unknown as CanvasRenderingContext2D;
    const draw = (world: GameplayScene, playerHit?: GameplayFeedback['playerHit']) => {
        needsFrame = presentation.draw({ ctx, width: 320, height: 320, scene: world, feedback: { playerHit, playerFlash: null, attacking: false, texts: [], particles: [] } });
        return data;
    };
    const at = (x: number, y: number) => Array.from(data.data.slice((y * data.width + x) * 4, (y * data.width + x) * 4 + 3));
    return { draw, at, presentation, get needsFrame() { return needsFrame; } };
};

it.each([
    { x: 3.5, y: 3.5, direction: [0, -1] },
    { x: 4.5, y: 4.5, direction: [1, 0] },
    { x: 3.5, y: 5.5, direction: [0, 1] },
    { x: 2.5, y: 4.5, direction: [-1, 0] },
])('turns toward a hit from ($x, $y) once, using the existing animation and cardinal movement', ({ x, y, direction }) => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const view = render(); const world = scene();
    const initial = Array.from(view.draw(world).data);
    const hit = { sequence: 1, x, y };
    expect(Array.from(view.draw(world, hit).data)).toEqual(initial);
    if (x !== 3.5 || y !== 3.5) {
        expect(view.needsFrame).toBe(true); expect(view.presentation.direction('up')).toBeNull();
        clock.mockReturnValue(150); expect(Array.from(view.draw(world, hit).data)).not.toEqual(initial);
    }
    clock.mockReturnValue(300); view.draw(world, hit);
    expect(view.needsFrame).toBe(false); expect(view.presentation.direction('up')).toEqual(direction);
    view.presentation.direction('right'); view.draw(world, hit);
    clock.mockReturnValue(600); view.draw(world, hit);
    expect(view.presentation.direction('up')).toEqual([-direction[1] || 0, direction[0] || 0]);
});

it('retargets an in-progress turn on another hit without snapping and resets hit tracking', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const view = render(); const world = scene();
    view.presentation.direction('left'); clock.mockReturnValue(150);
    const midway = Array.from(view.draw(world).data);
    const hit = { sequence: 2, x: 4.5, y: 4.5 };
    expect(Array.from(view.draw(world, hit).data)).toEqual(midway);
    clock.mockReturnValue(450); view.draw(world, hit);
    expect(view.presentation.direction('up')).toEqual([1, 0]);
    view.presentation.reset(); view.draw(world);
    expect(view.presentation.direction('up')).toEqual([0, -1]);
    view.draw(world, hit); clock.mockReturnValue(750); view.draw(world, hit);
    expect(view.presentation.direction('up')).toEqual([1, 0]);
});

it('colors the top and bottom void from project palette indices and resolves palette/project changes live', () => {
    const palette = Array<string>(16).fill('#000000'); palette[8] = '#ff0000'; palette[12] = '#00ff00';
    let data: { topColor?: number; bottomColor?: number } = { topColor: 8, bottomColor: 12 };
    const { draw, at } = render(() => ({ palette, data }));
    const world = { ...scene(), player: { x: 3.5, y: 0.001 }, cells: scene().cells.map(cell => ({ ...cell, solid: false })) };
    draw(world); expect(at(80, 0)).toEqual([255, 0, 0]); expect(at(80, 140)[1]).toBeGreaterThan(0);
    data = { topColor: 0, bottomColor: 8 };
    draw(world); expect(at(80, 0)).toEqual([0, 0, 0]); expect(at(80, 140)[0]).toBeGreaterThan(0);
    palette[8] = '#0000ff'; draw(world); expect(at(80, 140)[2]).toBeGreaterThan(0); expect(at(80, 140)[0]).toBe(0);
    data = {}; draw(world); expect(at(80, 0)).toEqual([0, 0, 17]);
    data = { topColor: 16, bottomColor: -1 }; draw(world); expect(at(80, 0)).toEqual([0, 0, 17]);
});

it.each([
    { top: '#0000ff', bottom: '#000000', first: [0, 0, 255], last: [0, 0, 0], middle: [0, 0, 128] },
    { top: '#ff0000', bottom: '#0000ff', first: [255, 0, 0], last: [0, 0, 255], middle: [128, 0, 128] },
])('blends $top into $bottom continuously across the horizon', ({ top, bottom, first, last, middle }) => {
    const palette = Array<string>(16).fill('#000000'); palette[8] = top; palette[12] = bottom;
    const { draw, at } = render(() => ({ palette, data: { topColor: 8, bottomColor: 12 } }));
    const world = { ...scene(), player: { x: 3.5, y: 0.001 }, cells: scene().cells.map(cell => ({ ...cell, solid: false })) };
    draw(world);
    expect(at(80, 0)).toEqual(first); expect(at(80, 159)).toEqual(last);
    for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(at(80, 79)[channel] - middle[channel])).toBeLessThanOrEqual(1);
        expect(Math.abs(at(80, 80)[channel] - middle[channel])).toBeLessThanOrEqual(1);
        for (let y = 1; y < 160; y++) {
            const step = at(80, y)[channel] - at(80, y - 1)[channel];
            expect(Math.abs(step)).toBeLessThanOrEqual(2);
            expect(step * Math.sign(last[channel] - first[channel])).toBeGreaterThanOrEqual(0);
        }
    }
    palette[12] = '#00ff00'; draw(world);
    expect(at(80, 159)).toEqual([0, 255, 0]);
    expect(at(80, 79)[1]).toBeGreaterThan(0); expect(at(80, 79)[1]).toBeLessThan(255);
});

it.each(['wall', 'sprite', 'floor'] as const)('fades distant %s pixels subtly toward the live void gradient', surface => {
    const palette = Array<string>(16).fill('#000000');
    const data = { topColor: 8, bottomColor: 12, distanceGradient: true };
    const { draw, at } = render(() => ({ palette, data }));
    const base = scene();
    const world = { ...base, cells: base.cells.map(cell => ({ ...cell, solid: surface === 'wall' && cell.solid,
        wall: [['#808080']], floor: [['#808080']] })),
        entities: surface === 'sprite' ? [{ id: 'npc', x: 3.5, y: 1.5, pixels: [['#808080']] }] : [] };
    const farY = surface === 'floor' ? 120 : 80;
    const unshaded = surface === 'wall' ? 100 : 128;
    draw(world); const darkFar = at(80, farY)[0];
    draw({ ...world, player: { x: 3.5, y: 2.5 } });
    const darkNear = at(80, surface === 'floor' ? 159 : 80)[0];
    expect(darkFar).toBeLessThan(darkNear); expect(darkNear).toBeLessThan(unshaded);
    palette[8] = '#ffffff'; palette[12] = '#ffffff';
    draw(world); const lightFar = at(80, farY)[0];
    draw({ ...world, player: { x: 3.5, y: 2.5 } });
    const lightNear = at(80, surface === 'floor' ? 159 : 80)[0];
    expect(lightFar).toBeGreaterThan(lightNear); expect(lightNear).toBeGreaterThan(unshaded);
    expect(lightFar).toBeLessThan(unshaded + 42); expect(darkFar).toBeGreaterThan(unshaded - 42);
    palette[12] = '#000000'; draw(world);
    const blended = at(80, farY)[0];
    expect(blended).toBeGreaterThan(darkFar); expect(blended).toBeLessThan(lightFar);
    if (surface !== 'floor') expect(at(80, 70)[0]).toBeGreaterThan(at(80, 90)[0]);
    const sky = at(80, 0);
    data.distanceGradient = false; draw(world);
    expect(at(80, farY)).toEqual([unshaded, unshaded, unshaded]);
    expect(at(80, 0)).toEqual(sky);
    draw({ ...world, player: { x: 3.5, y: 2.5 } });
    expect(at(80, surface === 'floor' ? 159 : 80)).toEqual([unshaded, unshaded, unshaded]);
    data.distanceGradient = true; draw(world);
    expect(at(80, farY)[0]).toBe(blended);
});

it('projects axis-aligned walls without fish-eye, samples textures and bounds rays', () => {
    const { draw, at, presentation } = render();
    const image = draw(scene());
    const middle = Math.floor(image.width / 2);
    const rows = (x: number) => Array.from({ length: image.height }, (_, y) => at(x, y)).filter(([r, g, b]) => r > g && r > b).length;
    expect(rows(8)).toBe(rows(middle));
    expect(at(middle, Math.floor(image.height / 2))[0]).toBeGreaterThan(100);
    presentation.direction('right');
    const boundaryImage = draw({ ...scene(), cells: scene().cells.map(cell => ({ ...cell, solid: false })) });
    expect(Array.from(boundaryImage.data).every(Number.isFinite)).toBe(true);
    expect(at(middle, Math.floor(image.height / 2))).toEqual([9, 9, 8]);
});

it('leaves the background visible at every world edge and at the maximum ray distance', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { draw, at, presentation } = render();
    const world = { ...scene(), ceiling: '#0000ff', floor: '#00ff00', boundary: '#ff00ff',
        cells: scene().cells.map(cell => ({ ...cell, solid: false, blocked: false, floor: null, color: '#00ff00' })) };
    const positions = [{ x: 3.5, y: 0.001 }, { x: 7.999, y: 3.5 }, { x: 3.5, y: 7.999 }, { x: 0.001, y: 3.5 }];
    for (let heading = 0; heading < 4; heading++) {
        if (heading) { presentation.direction('right'); clock.mockReturnValue(heading * 300); }
        const frame = draw({ ...world, player: positions[heading] });
        expect(at(80, 0)).toEqual([0, 0, 255]);
        expect(at(80, 140)[1]).toBeGreaterThan(0);
        expect(frame.data.every((value, index) => index % 4 !== 0 || value === 0)).toBe(true);
    }
    presentation.reset(); presentation.direction('right'); clock.mockReturnValue(1200);
    const distant = draw({ ...world, width: 40, height: 40, player: { x: 0.5, y: 20.5 },
        cells: Array.from({ length: 1600 }, () => world.cells[0]) });
    expect(distant.data.every((value, index) => index % 4 !== 0 || value === 0)).toBe(true);
    expect(distant.data.every((value, index) => index % 4 !== 3 || value === 255)).toBe(true);
});

it('occludes sprites behind walls and preserves transparent billboard pixels', () => {
    const { draw, at } = render(); const world = scene();
    const entity = { id: 'npc', x: 3.5, y: 0.5, pixels: [['#00ff00']] };
    const base = draw(world); const x = Math.floor(base.width / 2); const y = Math.floor(base.height / 2);
    const wall = at(x, y);
    draw({ ...world, entities: [entity] }); expect(at(x, y)).toEqual(wall);
    draw({ ...world, entities: [{ ...entity, y: 3, pixels: [[null]] }] }); expect(at(x, y)).toEqual(wall);
    draw({ ...world, entities: [{ ...entity, y: 3 }] }); expect(at(x, y)[1]).toBeGreaterThan(at(x, y)[0]);
    draw({ ...world, cells: world.cells.map(cell => ({ ...cell, solid: false })), entities: [entity] });
    expect(at(x, y)[1]).toBeGreaterThan(at(x, y)[0]);
});

it('shows farther walls, ceiling and sprites through null wall pixels while opaque pixels still occlude', () => {
    const { draw, at } = render(); const world = scene();
    const cells = world.cells.map((cell, index) => ({ ...cell,
        solid: Math.floor(index / 8) === 1 || Math.floor(index / 8) === 3,
        wall: Math.floor(index / 8) === 3 ? [[null], ['#ff0000']] : [['#0000ff']],
    }));
    draw({ ...world, cells });
    expect(at(80, 60)[2]).toBeGreaterThan(at(80, 60)[0]);
    expect(at(80, 0)).toEqual([0, 0, 17]);
    expect(at(80, 90)[0]).toBeGreaterThan(at(80, 90)[2]);
    draw({ ...world, cells, entities: [{ id: 'npc', x: 3.5, y: 2.5, pixels: [['#00ff00']] }] });
    expect(at(80, 60)[1]).toBeGreaterThan(at(80, 60)[2]);
    expect(at(80, 90)[0]).toBeGreaterThan(at(80, 90)[1]);
});

it('preserves floor visibility through several transparent walls, actual black pixels and untextured wall fallback', () => {
    const { draw, at } = render(); const world = scene();
    const cells = world.cells.map((cell, index) => ({ ...cell, solid: Math.floor(index / 8) <= 3,
        wall: Math.floor(index / 8) === 1 ? [['#0000ff']] : [[null]], floor: [['#00ff00']],
    }));
    draw({ ...world, cells });
    expect(at(80, 80)[2]).toBeGreaterThan(100);
    expect(at(80, 150)[1]).toBeGreaterThan(at(80, 150)[0]);
    for (let x = 0; x < 8; x++) cells[3 * 8 + x].wall = [['#000000']];
    draw({ ...world, cells }); expect(at(80, 80)).toEqual([0, 0, 0]);
    draw({ ...world, cells: cells.map(cell => ({ ...cell, wall: null })) });
    const fallback = at(80, 80);
    expect(fallback[0]).toBeGreaterThan(0); expect(fallback[0]).toBe(fallback[1]); expect(fallback[1]).toBe(fallback[2]);
});

it('bounds near-wall and corner rays and refreshes animated textures and floor colors', () => {
    const { draw, at } = render();
    const world = scene();
    const near = { ...world, player: { x: 3.5, y: 2.001 } };
    const image = draw(near);
    expect(at(80, 80)[0]).toBeGreaterThan(190);
    expect(image.data.filter((_, index) => index % 4 === 3).every(alpha => alpha === 255)).toBe(true);
    const corner = { ...world, player: { x: 3 + 0.5 * Math.tan(Math.PI / 6) * (1 - 1 / 160), y: 4.5 },
        cells: world.cells.map((cell, index) => ({ ...cell, solid: index === 4 * 8 + 2, wall: [['#00ff00']] })) };
    draw(corner); expect(at(0, 80)[1]).toBeGreaterThan(at(0, 80)[0]);
    const blue = { ...world, cells: world.cells.map(cell => ({ ...cell, wall: [['#0000ff']], floor: [['#00ff00']] })) };
    draw(blue); expect(at(80, 80)[2]).toBeGreaterThan(100); expect(at(80, 159)[1]).toBeGreaterThan(at(80, 159)[0]);
    draw(world); expect(at(80, 80)[0]).toBeGreaterThan(100); expect(at(80, 80)[2]).toBeLessThan(5);
});

it('reuses a bounded low-resolution buffer for dense scenes', () => {
    const { draw } = render(); const world = scene();
    const dense = { ...world, entities: Array.from({ length: 300 }, (_, i) => ({ id: String(i), x: i % 8 + 0.5, y: Math.floor(i / 8) % 8 + 0.5, pixels: [['#00ff00', null]] })) };
    const first = draw(dense); const second = draw(dense);
    expect(second).toBe(first); expect(second.width).toBe(160);
    expect(second.data.length).toBeLessThanOrEqual(160 * 240 * 4);
});
