import { GameConfig } from '../../config/GameConfig';
import type { GameDefinition } from '../../types/gameState';
import type { TileDefinition } from '../../runtime/domain/definitions/tileTypes';
import { TileDefinitions } from '../../runtime/domain/definitions/TileDefinitions';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameEngine } from '../../runtime/services/GameEngine';
import { GameplayPluginHost, type GameplayContext } from '../../runtime/infra/GameplayPluginHost';
import { parsePluginHtml } from '../../editor/manager/PluginManager';
import source from '../../../public/plugins/3d-renderer/1.1.0/plugin.html?raw';

let engine: GameEngine;
beforeEach(() => {
    vi.useFakeTimers();
    engine = new GameEngine(document.createElement('canvas'), { soundOwner: false });
    engine.importGameData({ title: 'Scene', start: { roomIndex: 0, x: 3, y: 3 }, sprites: [], enemies: [], objects: [] });
    engine.dismissIntroScreen();
    vi.advanceTimersByTime(25);
    vi.spyOn(engine.renderer, 'draw').mockImplementation(() => {});
});
afterEach(() => { engine.destroy(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

const activate = async (isCurrent: () => boolean = () => true) => {
    const plugin = parsePluginHtml(source);
    const host = new GameplayPluginHost(engine, () => [plugin], javascript => {
        const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return {activate};') as () => { activate(context: GameplayContext): void };
        return Promise.resolve(factory());
    });
    await host.load({ ...engine.exportGameData() as GameDefinition, gameplayPlugins: [{ id: plugin.id, version: plugin.version }] }, undefined, true, isCurrent);
    engine.dismissIntroScreen(); vi.advanceTimersByTime(25);
    return host;
};

const turn = (direction: 'left' | 'right') => { engine.handleGameplayDirection(direction); vi.advanceTimersByTime(300); };

it('exposes original layers, room bounds, tile animation/effects, player artwork and status as detached snapshots', () => {
    const game = engine.gameState.game;
    const tile: TileDefinition = { id: 'scene-asset', name: 'Custom terrain', category: 'Terrain', collision: true,
        visualEffect: 'custom:scene', mergeEdges: true, frames: [[['transparent', '#123456']], [['#abcdef', 'transparent']]] };
    game.tileset.tiles.push(tile);
    game.customTileEffects = [{ id: 'custom:scene', name: 'Scene', baseEffectIds: ['glow'], color: '#123456' }];
    game.tileset.maps[1].ground[2][3] = tile.id ?? null;
    game.tileset.maps[1].overlay[2][3] = 'grass';
    game.rooms[1].walls[2][3] = true; game.rooms[1].bg = 8;
    engine.gameState.setPlayerPosition(3, 2, 1);
    engine.tileManager.setAnimationFrameIndex(1);
    const snapshot = engine.getGameplayScene();
    expect(snapshot.world).toEqual({ rows: 3, cols: 3, roomSize: 8, activeRoomIndex: 1 });
    expect(snapshot.rooms?.[1]).toEqual({ index: 1, x: 8, y: 0, width: 8, height: 8,
        exists: true, backgroundIndex: 8, background: engine.renderer.paletteManager.getColor(8) });
    expect(snapshot.cells[2 * 24 + 11]).toMatchObject({ groundTileId: 'scene-asset', overlayTileId: 'grass',
        terrainWall: true, roomIndex: 1, localX: 3, localY: 2 });
    const asset = snapshot.tiles?.find(entry => entry.id === 'scene-asset');
    expect(asset).toMatchObject({ name: 'Custom terrain', category: 'Terrain', collision: true, visualEffect: 'custom:scene', mergeEdges: true,
        frames: [[[null, '#123456']], [['#abcdef', null]]], pixels: [['#abcdef', null]] });
    expect(snapshot.player).toMatchObject({ roomIndex: 1, localX: 3, localY: 2, x: 11.5, y: 2.5,
        lives: engine.gameState.getPlayer()?.currentLives, maxLives: engine.gameState.getPlayer()?.maxLives });
    expect(snapshot.player.pixels?.length).toBeGreaterThan(0);
    expect(snapshot.status).toEqual({ playing: engine.gameState.playing, gameOver: false, dialogActive: false });
    expect(snapshot.animationFrame).toBe(1); expect(snapshot.animationIntervalMs).toBeGreaterThan(0);
    if (!asset || !snapshot.palette || !snapshot.customTileEffects || !snapshot.player.pixels) throw Error('Missing scene resources');
    (asset.frames[0][0] as (string | null)[])[0] = '#000000';
    (snapshot.palette as string[])[8] = '#000000';
    (snapshot.customTileEffects[0].baseEffectIds as string[]).push('sparkle');
    (snapshot.player.pixels[0] as (string | null)[])[0] = '#badbad';
    const next = engine.getGameplayScene();
    expect(next.tiles?.find(entry => entry.id === 'scene-asset')?.frames[0][0][0]).toBeNull();
    expect(next.palette?.[8]).toBe(engine.renderer.paletteManager.getColor(8));
    expect(next.customTileEffects?.[0].baseEffectIds).toEqual(['glow']);
    expect(next.player.pixels?.[0][0]).not.toBe('#badbad');
    engine.tileManager.setAnimationFrameIndex(0);
    expect(engine.getGameplayScene().tiles?.find(entry => entry.id === 'scene-asset')?.pixels).toEqual([[null, '#123456']]);
});

it('provides entity types and unique runtime keys that survive movement and distinguish identical pickups', () => {
    const box = engine.gameState.objectManager.setObjectPosition('push-box', 0, 4, 3);
    if (!box) throw Error('Missing box');
    engine.gameState.game.items = [{ type: 'key', roomIndex: 0, x: 1, y: 1 }, { type: 'key', roomIndex: 0, x: 2, y: 1 }];
    const first = engine.getGameplayScene();
    const boxes = first.entities.filter(entity => entity.kind === 'object' && entity.type === 'push-box');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ roomIndex: 0, localX: 4, localY: 3, x: 4.5, y: 3.5 });
    const keys = first.entities.filter(entity => entity.kind === 'item').map(entity => entity.key);
    expect(keys).toHaveLength(2); expect(new Set(keys).size).toBe(2); expect(keys.every(Boolean)).toBe(true);
    box.x = 5;
    const moved = engine.getGameplayScene().entities.find(entity => entity.key === boxes[0].key);
    expect(moved).toMatchObject({ type: 'push-box', localX: 5, x: 5.5 });
    engine.gameState.game.items[0].collected = true;
    expect(engine.getGameplayScene().entities.filter(entity => entity.kind === 'item').map(entity => entity.key)).toEqual([keys[1]]);
});

it('keeps translation in movement rules, blocks turns during stun/transitions, retains heading across rooms and resets north', async () => {
    const host = await activate();
    const capture = vi.spyOn(engine.renderer, 'captureGameplayFrame');
    const transition = vi.spyOn(engine.renderer.transitionManager, 'start');
    const player = engine.gameState.getPlayer();
    if (!player) throw Error('Player missing');
    turn('right'); expect(player).toMatchObject({ x: 3, y: 3 });
    engine.handleGameplayDirection('up'); expect(player).toMatchObject({ x: 4, y: 3 });
    engine.handleGameplayDirection('down'); expect(player).toMatchObject({ x: 3, y: 3 });
    vi.spyOn(engine.combatStunManager, 'isStunned').mockReturnValue(true);
    turn('left');
    engine.handleGameplayDirection('up'); expect(player.x).toBe(3);
    vi.mocked(engine.combatStunManager.isStunned).mockReturnValue(false);
    engine.movementManager.transitioning = true;
    turn('left');
    engine.movementManager.transitioning = false;
    engine.handleGameplayDirection('up'); expect(player).toMatchObject({ x: 4, y: 3 });
    engine.gameState.game.rooms[0].walls[3][5] = true;
    engine.handleGameplayDirection('up'); expect(player.x).toBe(4);
    engine.gameState.setPlayerPosition(7, 3, 0);
    engine.handleGameplayDirection('up');
    expect(player).toMatchObject({ x: 0, roomIndex: 1 });
    expect(capture).not.toHaveBeenCalled(); expect(transition).not.toHaveBeenCalled();
    expect(engine.movementManager.transitioning).toBe(false); expect(engine.gameState.playing).toBe(true);
    engine.handleGameplayDirection('up'); expect(player).toMatchObject({ x: 1, roomIndex: 1 });
    engine.resetGame(); engine.dismissIntroScreen(); vi.advanceTimersByTime(25);
    engine.handleGameplayDirection('up'); expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 2 });
    engine.gameState.setPlayerPosition(0, 3, 0);
    engine.tryMove(-1, 0);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 0, y: 3, roomIndex: 0 });
    expect(engine.movementManager.transitioning).toBe(false);
    host.remove('3d-renderer'); expect(engine.renderer.gameplayPresentation).toBeNull();
    expect(engine.handleGameplayDirection('left')).toBe(false);
    engine.gameState.setPlayerPosition(7, 3, 0);
    engine.tryMove(1, 0);
    expect(capture).toHaveBeenCalledTimes(2); expect(transition).toHaveBeenCalledOnce();
    expect(engine.movementManager.transitioning).toBe(true);
    vi.advanceTimersByTime(1000);
});

it('uses effective water/lava traversal, live doors, visibility, world dimensions and detached pixels', () => {
    const game = engine.gameState.game;
    const tile = { id: 'test-water', collision: true, category: 'agua', name: 'Agua' };
    vi.spyOn(engine.tileManager, 'getTile').mockReturnValue(tile as never);
    vi.spyOn(engine.tileManager, 'getTilePixels').mockReturnValue([['#ff0000']]);
    game.tileset.maps[0].ground[3][3] = 'test-water';
    const skills = vi.spyOn(engine.gameState, 'hasSkill').mockReturnValue(false);
    const at = () => engine.getGameplayScene().cells[3 * 24 + 3];
    expect(at().solid).toBe(false); expect(at().blocked).toBe(true);
    skills.mockImplementation(id => id === 'water-walker'); expect(at().blocked).toBe(false);
    tile.category = 'perigo'; tile.name = 'Lava'; expect(at().solid).toBe(false); expect(at().blocked).toBe(true);
    skills.mockImplementation(id => id === 'lava-walker'); expect(at().blocked).toBe(false);
    game.tileset.maps[0].ground[3][3] = null;
    const door = engine.gameState.objectManager.setObjectPosition('door-variable', 0, 3, 3);
    if (!door) throw Error('Door missing');
    door.variableId = 'var-1';
    expect(at().blocked).toBe(true); expect(at().solid).toBe(false);
    expect(engine.getGameplayScene().entities.some(entity => entity.id === 'object-0-3-3')).toBe(true);
    engine.gameState.setVariableValue('var-1', true); expect(at().blocked).toBe(false);
    expect(engine.getGameplayScene().entities.some(entity => entity.id === 'object-0-3-3')).toBe(false);
    const box = engine.gameState.objectManager.setObjectPosition('push-box', 0, 4, 3);
    if (!box) throw Error('Box missing');
    expect(engine.getGameplayScene().cells[3 * 24 + 4].blocked).toBe(true);
    box.x = 5; expect(engine.getGameplayScene().cells[3 * 24 + 4].blocked).toBe(false);
    game.tileset.maps[0].ground[3][3] = 'test-water';
    const snapshot = engine.getGameplayScene();
    expect(snapshot).toMatchObject({ width: 24, height: 24, player: { x: 3.5, y: 3.5 } });
    const floor = snapshot.cells[3 * 24 + 3].floor as (string | null)[][];
    floor[0][0] = '#000000'; expect(engine.tileManager.getTilePixels(tile as never)).toEqual([['#ff0000']]);
});

it.each(['water', 'lava'] as const)('renders the %s visual effect as ground while preserving collision on both layers', effect => {
    const game = engine.gameState.game;
    const tile: TileDefinition = { id: 'edited-tile', name: 'Stone', category: 'Terrain', collision: true,
        visualEffect: effect, frames: [[['#123456']]] };
    game.tileset.tiles.push(tile);
    const map = game.tileset.maps[0];
    const at = () => engine.getGameplayScene().cells[3 * 24 + 4];
    for (const layer of ['ground', 'overlay'] as const) {
        map.ground[3][4] = null; map.overlay[3][4] = null;
        map[layer][3][4] = 'edited-tile';
        tile.visualEffect = effect; tile.collision = true;
        expect(at()).toMatchObject({ solid: false, blocked: true, wall: null, floor: [['#123456']] });
        expect(engine.getGameplayScene().entities.some(entity => entity.id === 'tile-0-4-3')).toBe(false);
        engine.tryMove(1, 0); expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
        tile.visualEffect = 'none'; tile.name = 'Water Lava';
        expect(at()).toMatchObject({ solid: true, blocked: true, wall: [['#123456']] });
        tile.visualEffect = effect; tile.collision = false;
        expect(at()).toMatchObject({ solid: false, blocked: false });
        engine.tryMove(1, 0); expect(engine.gameState.getPlayer()).toMatchObject({ x: 4, y: 3 });
        engine.gameState.setPlayerPosition(3, 3, 0);
    }
    game.rooms[0].walls[3][4] = true;
    expect(at().solid).toBe(true);
});

it.each([false, true])('renders erased pixels from authored tiles through the actual tile conversion (custom art: %s)', async custom => {
    await activate();
    const layout = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, () => y < 4 ? null : 8));
    const game = engine.gameState.game;
    game.tileset.tiles.push(
        { id: 'cutout', collision: true, visualEffect: 'none', frames: [TileDefinitions.toPixels(layout)] },
        { id: 'behind', collision: true, visualEffect: 'none', frames: [[['#0000ff']]] },
    );
    game.tileset.maps[0].ground[2][3] = 'cutout';
    game.tileset.maps[0].ground[0][3] = 'behind';
    if (custom) engine.setCustomSprites([{ group: 'tile', key: 'cutout', frames: [layout] }]);
    const scene = engine.getGameplayScene();
    expect(scene.cells[2 * scene.width + 3]).toMatchObject({ solid: false, blocked: true, wall: null, floor: null });
    expect(scene.entities.find(entity => entity.id === 'tile-ground-0-3-2')?.pixels[0][0]).toBeNull();
    engine.tryMove(0, -1); expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    let image!: ImageData;
    const buffer = {
        createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: (frame: ImageData) => { image = frame; },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValueOnce(buffer as unknown as CanvasRenderingContext2D);
    const provider = engine.renderer.gameplayPresentation;
    const ctx = engine.renderer.ctx;
    if (!provider || !ctx) throw Error('Missing presentation');
    provider.draw({ ctx, width: 160, height: 160, scene, feedback: { playerFlash: null, attacking: false, texts: [], particles: [] } });
    const pixel = (y: number, x = 80) => Array.from(image.data.slice((y * 160 + x) * 4, (y * 160 + x) * 4 + 3));
    expect(pixel(60)[2]).toBeGreaterThan(pixel(60)[0]);
    expect(pixel(90)[0]).toBeGreaterThan(pixel(90)[2]);
    expect(pixel(90, 155)[0]).toBeLessThan(pixel(90)[0]);
});

it.each(['ground', 'overlay'] as const)('keeps transparent solid %s tiles as billboards across animation frames and responds to artwork edits', layer => {
    const game = engine.gameState.game;
    const opaque = Array.from({ length: 8 }, () => Array<number | null>(8).fill(8));
    const cutout = opaque.map(row => [...row]); cutout[0][0] = null;
    const tile: TileDefinition = { id: 'animated-cutout', collision: true, visualEffect: 'none',
        frames: [TileDefinitions.toPixels(opaque), TileDefinitions.toPixels(cutout)] };
    game.tileset.tiles.push(tile);
    game.tileset.maps[0][layer][3][4] = 'animated-cutout';
    const entityId = layer === 'ground' ? 'tile-ground-0-4-3' : 'tile-0-4-3';
    const inspect = () => {
        const scene = engine.getGameplayScene();
        expect(scene.cells[3 * scene.width + 4]).toMatchObject({ solid: false, blocked: true, wall: null });
        expect(scene.entities.filter(entity => entity.id === entityId)).toHaveLength(1);
    };
    inspect(); engine.tileManager.advanceAnimationFrame(); inspect();
    tile.frames = [TileDefinitions.toPixels(opaque)];
    expect(engine.getGameplayScene().cells[3 * 24 + 4].solid).toBe(true);
    expect(engine.getGameplayScene().entities.some(entity => entity.id === entityId)).toBe(false);
    tile.frames = [TileDefinitions.toPixels(cutout)]; inspect();
    engine.tryMove(1, 0); expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    for (const effect of ['water', 'lava'] as const) {
        tile.visualEffect = effect;
        const scene = engine.getGameplayScene();
        expect(scene.cells[3 * scene.width + 4]).toMatchObject({ solid: false, blocked: true });
        expect(scene.cells[3 * scene.width + 4].floor?.[0][0]).toBeNull();
        expect(scene.entities.some(entity => entity.id === entityId)).toBe(false);
    }
});

it('rejects scene conflicts and leaves dialogs on their existing keyboard path', async () => {
    await activate();
    expect(() => engine.registerGameplayPresentation({ draw: vi.fn(), direction: vi.fn(), reset: vi.fn() })).toThrow(/already registered/);
    engine.showDialog('Hello');
    const player = structuredClone(engine.gameState.getPlayer());
    turn('right');
    expect(engine.gameState.getPlayer()).toEqual(player);
    engine.closeDialog();
    engine.handleGameplayDirection('up'); expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 2 });
});

it('keeps enemy combat authoritative and snapshots damage feedback on the existing animation clock', async () => {
    await activate(); engine.enemyManager.stop();
    engine.addEnemy({ type: 'giant-rat', x: 4, y: 3, roomIndex: 0 });
    const enemy = engine.gameState.getEnemies()[0];
    enemy.lives = 10;
    vi.spyOn(engine.gameState, 'isPlayerOnDamageCooldown').mockReturnValue(false);
    vi.spyOn(engine.gameState.playerManager, 'isOnAttackCooldown').mockReturnValue(false);
    turn('right'); engine.handleGameplayDirection('up');
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    expect(engine.renderer.attackTelegraph.getWindupOffset('player')).not.toBeNull();
    vi.advanceTimersByTime(GameConfig.combat.lungeAnimationDuration + 1);
    expect(enemy.lives).toBeLessThan(10);
    expect(engine.getGameplayScene().entities.find(entity => entity.id === enemy.id)).toMatchObject({ lives: enemy.lives });
    expect(engine.renderer.entityRenderer.snapshotLifeLoss()[0]).toMatchObject({ text: '-1', x: 4.5, y: 3.5 });
    vi.advanceTimersByTime(1000);
    expect(engine.renderer.entityRenderer.snapshotLifeLoss()).toEqual([]);
    expect(engine.renderer.attackTelegraph.getWindupOffset('player')).toBeNull();
});

it.each([false, true])('reports the actual attacker to presentation feedback only when an enemy connects (miss: %s)', async missed => {
    await activate(); engine.enemyManager.stop();
    engine.addEnemy({ type: 'giant-rat', x: 2, y: 3, roomIndex: 0 });
    const enemy = engine.gameState.getEnemies()[0]; enemy.lives = 10;
    vi.spyOn(engine.gameState, 'isPlayerOnDamageCooldown').mockReturnValue(false);
    vi.spyOn(engine.gameState.playerManager, 'isOnAttackCooldown').mockReturnValue(false);
    vi.spyOn(engine.enemyManager.combatManager, 'attackMissed').mockReturnValue(missed);
    const hit = vi.spyOn(engine.renderer, 'recordPlayerHit');
    engine.enemyManager.combatManager.handleEnemyCollision(0, { initiator: 'enemy' });
    expect(hit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(GameConfig.combat.knockbackDuration + 32);
    if (missed) expect(hit).not.toHaveBeenCalled();
    else { expect(hit).toHaveBeenCalledOnce(); expect(hit).toHaveBeenCalledWith(enemy); }
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
});

it('turns toward an autonomous enemy attack while the player stands still, before the counter-attack', async () => {
    await activate(); engine.enemyManager.stop();
    engine.addEnemy({ type: 'giant-rat', x: 2, y: 3, roomIndex: 0 });
    const enemy = engine.gameState.getEnemies()[0]; enemy.lives = 10; enemy.lastX = 1;
    vi.spyOn(engine.gameState, 'isPlayerOnDamageCooldown').mockReturnValue(false);
    vi.spyOn(engine.gameState.playerManager, 'isOnAttackCooldown').mockReturnValue(false);
    vi.spyOn(engine.enemyManager.combatManager, 'attackMissed').mockReturnValue(false);
    const provider = engine.renderer.gameplayPresentation;
    if (!provider || !engine.renderer.ctx) throw Error('Missing presentation');
    Object.assign(engine.renderer.ctx, { clip: vi.fn() });
    vi.mocked(engine.renderer.draw).mockRestore();
    const hit = vi.spyOn(engine.renderer, 'recordPlayerHit');
    expect(provider.direction('up')).toEqual([0, -1]);
    engine.enemyManager.tick();
    expect(engine.renderer.attackTelegraph.getWindupOffset(enemy.id)).not.toBeNull();
    expect(provider.direction('up')).toBeNull();
    vi.advanceTimersByTime(332);
    expect(provider.direction('up')).toEqual([-1, 0]);
    expect(hit).not.toHaveBeenCalled();
    expect(engine.renderer.attackTelegraph.getWindupOffset('player')).toBeNull();
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
});

it('resolves rectangular worlds, custom sprites, palette edits and remote players at draw time', () => {
    engine.gameState.worldManager.resizeWorld(2, 5);
    engine.gameState.setPlayerPosition(1, 1, 9);
    engine.addSprite({ id: 'guide', type: 'old-mage', x: 2, y: 1, roomIndex: 9, placed: true });
    engine.setCustomSprites([{ group: 'npc', key: 'old-mage', frames: [Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => x === y ? 8 : null))] }]);
    engine.renderer.entityRenderer.setRemotePlayers([
        { id: 'guest', name: 'Guest', x: 3, y: 1, roomIndex: 9, alive: true, playerIndex: 1 },
        { id: 'dead', name: 'Dead', x: 4, y: 1, roomIndex: 9, alive: false, playerIndex: 2 },
    ]);
    const scene = engine.getGameplayScene();
    expect(scene).toMatchObject({ width: 40, height: 16, player: { x: 33.5, y: 9.5 } });
    expect(scene.entities.find(entity => entity.id === 'guide')).toMatchObject({ x: 34.5, y: 9.5 });
    expect(scene.entities.find(entity => entity.id === 'guest')).toMatchObject({ x: 35.5, y: 9.5 });
    expect(scene.entities.some(entity => entity.id === 'dead' || entity.id === 'player')).toBe(false);
    expect(scene.entities.find(entity => entity.id === 'guide')?.pixels[0][1]).toBeNull();
    const palette = [...engine.renderer.paletteManager.getActivePalette()]; palette[8] = '#123456'; engine.setCustomPalette(palette);
    expect(engine.getGameplayScene().entities.find(entity => entity.id === 'guide')?.pixels[0][0]).toBe('#123456');
});



it('animates free look before movement and blocks looking while movement is held, stunned, or transitioning', async () => {
    const host = await activate(); engine.enemyManager.stop();
    engine.gameState.game.pluginData = { '3d-renderer': { mouseSupport: true } };
    const provider = engine.renderer.gameplayPresentation;
    if (!provider?.look) throw Error('Missing free look');
    const look = vi.spyOn(provider, 'look');
    expect(engine.handleGameplayLook(Math.PI / 3)).toBe(true);
    engine.handleGameplayDirection('up');
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    vi.advanceTimersByTime(300); provider.direction('up'); await Promise.resolve();
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 4, y: 3 });
    engine.handleGameplayDirection('down');
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    const previousMode = document.body.className;
    document.body.className = 'game-mode';
    try {
        engine.inputManager.beginHeldDirection('test', 'up');
        expect(engine.inputManager.isMovementHeld()).toBe(true);
        engine.handleGameplayLook(Math.PI / 2); expect(look).toHaveBeenLastCalledWith(0);
        engine.inputManager.endHeldDirection('test');
        engine.handleGameplayLook(-0.1); expect(look).toHaveBeenLastCalledWith(-0.1);
        engine.movementManager.transitioning = true;
        engine.handleGameplayLook(Math.PI); expect(look).toHaveBeenLastCalledWith(0);
        engine.movementManager.transitioning = false;
        vi.spyOn(engine.combatStunManager, 'isStunned').mockReturnValue(true);
        engine.handleGameplayLook(Math.PI); expect(look).toHaveBeenLastCalledWith(0);
        vi.mocked(engine.combatStunManager.isStunned).mockReturnValue(false);
        const dialog = engine.gameState.getDialog();
        vi.spyOn(engine.gameState, 'getDialog').mockReturnValue({ ...dialog, active: true });
        engine.handleGameplayLook(Math.PI); expect(look).toHaveBeenLastCalledWith(0);
        vi.mocked(engine.gameState.getDialog).mockRestore();
        vi.spyOn(engine, 'isEditorModeActive').mockReturnValue(true);
        look.mockClear(); expect(engine.handleGameplayLook(Math.PI)).toBe(false); expect(look).not.toHaveBeenCalled();
        vi.mocked(engine.isEditorModeActive).mockRestore();
        expect(engine.handleGameplayLook(Number.NaN)).toBe(false);
        host.remove('3d-renderer');
        expect(engine.handleGameplayLook(Math.PI)).toBe(false);
        expect(engine.inputManager.isMovementHeld()).toBe(false);
    } finally { document.body.className = previousMode; }
});


it.each(['up', 'down'] as const)('finishes a free-look alignment animation before a single %s step', async command => {
    await activate(); engine.enemyManager.stop();
    engine.gameState.game.pluginData = { '3d-renderer': { mouseSupport: true } };
    const ctx = engine.renderer.ctx; if (!ctx) throw Error('Missing context');
    Object.assign(ctx, { clip: vi.fn() });
    vi.mocked(engine.renderer.draw).mockRestore();
    engine.handleGameplayLook(Math.PI / 3);
    engine.handleGameplayDirection(command);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    await vi.advanceTimersByTimeAsync(150);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    await vi.advanceTimersByTimeAsync(182);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: command === 'up' ? 4 : 2, y: 3 });
    await vi.advanceTimersByTimeAsync(300);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: command === 'up' ? 4 : 2, y: 3 });
});


it.each(['wall', 'stun', 'reset', 'remove'] as const)('rechecks movement and cancels pending alignment steps on %s', async interruption => {
    const host = await activate(); engine.enemyManager.stop();
    engine.gameState.game.pluginData = { '3d-renderer': { mouseSupport: true } };
    const ctx = engine.renderer.ctx; if (!ctx) throw Error('Missing context');
    Object.assign(ctx, { clip: vi.fn() }); vi.mocked(engine.renderer.draw).mockRestore();
    engine.handleGameplayLook(Math.PI / 3); engine.handleGameplayDirection('up');
    await vi.advanceTimersByTimeAsync(100);
    if (interruption === 'wall') engine.gameState.game.rooms[0].walls[3][4] = true;
    if (interruption === 'stun') vi.spyOn(engine.combatStunManager, 'isStunned').mockReturnValue(true);
    if (interruption === 'reset') engine.resetGame();
    if (interruption === 'remove') host.remove('3d-renderer');
    await vi.advanceTimersByTimeAsync(400);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
});


it('completes animated movement after the editor loading transaction has expired', async () => {
    let current = true;
    await activate(() => current); engine.enemyManager.stop();
    current = false;
    engine.gameState.game.pluginData = { '3d-renderer': { mouseSupport: true } };
    const ctx = engine.renderer.ctx; if (!ctx) throw Error('Missing context');
    Object.assign(ctx, { clip: vi.fn() }); vi.mocked(engine.renderer.draw).mockRestore();
    engine.handleGameplayLook(Math.PI / 3); engine.handleGameplayDirection('up');
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 3, y: 3 });
    await vi.advanceTimersByTimeAsync(332);
    expect(engine.gameState.getPlayer()).toMatchObject({ x: 4, y: 3 });
});
