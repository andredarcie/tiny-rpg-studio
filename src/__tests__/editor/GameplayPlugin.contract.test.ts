import { beforeEach, expect, it } from 'vitest';
import { PluginManager, parsePluginHtml } from '../../editor/manager/PluginManager';
import { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import { StateDataManager } from '../../runtime/domain/state/StateDataManager';
import type { GameDefinition } from '../../types/gameState';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';

beforeEach(() => localStorage.clear());

it('validates and persists a gameplay package while retaining legacy editor packages', () => {
  const legacy = { id: 'old', title: 'Old', shortDescription: 'Old', fullDescription: 'Old' };
  const source = `<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify({ ...legacy, id: 'maps', version: '1', capabilities: ['gameplay'], apiVersion: 1 })}</script><script type="module" data-tiny-rpg-gameplay-plugin>export function activate() {}</script>`;
  const parsed = parsePluginHtml(source);
  const manager = new PluginManager();
  expect(manager.install(legacy)).toBe(true);
  expect(manager.install(parsed)).toBe(true);
  expect(new PluginManager().installed).toEqual([legacy, parsed]);
  expect(() => parsePluginHtml(source.replace('"version":"1",', ''))).toThrow();
  expect(manager.installMany([{ ...parsed, id: 'other' }, { ...parsed, id: 'broken', version: '' }])).toBe(false);
  expect(manager.installed).toEqual([legacy, parsed]);
});

it('retains rectangular worlds and their dependency through import and export', () => {
  const game = { roomSize: 8, world: { rows: 3, cols: 3 }, rooms: [], tileset: { tiles: [], maps: [] } } as unknown as GameDefinition;
  const worldManager = new StateWorldManager(game);
  const manager = new StateDataManager({ game, worldManager, objectManager: { normalizeObjects: () => [], setGame: () => {} } as never, variableManager: { normalizeVariables: () => [], setGame: () => {} } as never });
  const rooms = StateWorldManager.createWorldRooms(3, 5, 8);
  rooms[14].bg = 7;
  manager.importGameData({ world: { rows: 3, cols: 5 }, rooms, gameplayPlugins: [{ id: 'maps', version: '1' }] });
  expect(game.world).toEqual({ rows: 3, cols: 5 });
  expect(game.rooms[14].bg).toBe(7);
  expect(manager.exportGameData().gameplayPlugins).toEqual([{ id: 'maps', version: '1' }]);
});

it('resizes by coordinates and remaps room references when columns change', () => {
  const game = {
    roomSize: 8, world: { rows: 3, cols: 3 }, rooms: StateWorldManager.createWorldRooms(3, 3, 8),
    tileset: { tiles: [], maps: Array.from({ length: 9 }, () => StateWorldManager.createEmptyTileMap(8)) },
    start: { x: 1, y: 1, roomIndex: 4 }, sprites: [{ roomIndex: 4, initialRoomIndex: 4 }],
    enemies: [], items: [], objects: [], exits: [{ roomIndex: 4, targetRoomIndex: 8 }],
  } as unknown as GameDefinition;
  game.rooms[4].bg = 9;
  const world = new StateWorldManager(game);
  world.resizeWorld(3, 5);
  expect(game.world).toEqual({ rows: 3, cols: 5 });
  expect(game.rooms[6].bg).toBe(9);
  expect(game.start.roomIndex).toBe(6);
  expect(game.sprites[0].initialRoomIndex).toBe(6);
  expect(game.exits[0].targetRoomIndex).toBe(12);
  expect(() => world.resizeWorld(6, 1)).toThrow();
});

it('stores plugin projects as complete local snapshots and refuses share URLs', () => {
  const data = { title: 'Wide world', world: { rows: 3, cols: 5 }, rooms: Array.from({ length: 15 }, (_, index) => ({ index })), gameplayPlugins: [{ id: 'maps', version: '1' }] };
  expect(ShareUtils.buildShareUrl(data)).toBe('');
  const stored = ShareUtils.buildStoredProject(data);
  expect(stored.startsWith('snapshot:')).toBe(true);
  expect(ShareUtils.readStoredProject(stored)).toEqual(data);
});
