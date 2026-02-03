import { describe, it, expect, vi } from 'vitest';
import { StateDataManager } from '../../runtime/domain/state/StateDataManager';
import type { GameDefinition, RoomDefinition, VariableDefinition } from '../../types/gameState';
import type { TileDefinition, TileMap } from '../../runtime/domain/definitions/tileTypes';
import type { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import type { StateObjectManager, ObjectEntry } from '../../runtime/domain/state/StateObjectManager';
import type { StateVariableManager } from '../../runtime/domain/state/StateVariableManager';
import { ITEM_TYPES } from '../../runtime/domain/definitions/ItemDefinitions';

const makeGame = (): GameDefinition => ({
  title: 'Old',
  author: 'Author',
  palette: ['#000000', '#111111', '#222222'],
  roomSize: 8,
  world: { rows: 1, cols: 1 },
  rooms: [
    {
      size: 8,
      bg: 0,
      tiles: [[0]],
      walls: [[false]],
    },
  ],
  start: { x: 1, y: 1, roomIndex: 0 },
  sprites: [],
  enemies: [],
  items: [],
  objects: [],
  variables: [],
  exits: [],
  tileset: {
    tiles: [{ id: 1 }, { id: 2 }, { id: 3 }] as TileDefinition[],
    maps: [{ ground: [[null]], overlay: [[null]] }],
    map: { ground: [[null]], overlay: [[null]] },
  },
});

describe('StateDataManager', () => {
  it('exports game data snapshot', () => {
    const game = makeGame();
    const worldManager = {} as StateWorldManager;
    const objectManager = {} as StateObjectManager;
    const variableManager = {} as StateVariableManager;

    const manager = new StateDataManager({ game, worldManager, objectManager, variableManager });

    expect(manager.exportGameData()).toEqual({
      title: game.title,
      author: game.author,
      palette: game.palette,
      roomSize: game.roomSize,
      world: game.world,
      rooms: game.rooms,
      start: game.start,
      sprites: game.sprites,
      enemies: game.enemies,
      items: game.items,
      objects: game.objects,
      variables: game.variables,
      exits: game.exits,
      tileset: game.tileset,
    });
  });

  it('returns null for empty imports', () => {
    const game = makeGame();
    const worldManager = {
      normalizeRooms: vi.fn(),
      normalizeTileMaps: vi.fn(),
      clampCoordinate: vi.fn(),
      clampRoomIndex: vi.fn(),
      setGame: vi.fn(),
    } as unknown as StateWorldManager;
    const objectManager = {
      normalizeObjects: vi.fn(),
      setGame: vi.fn(),
    } as unknown as StateObjectManager;
    const variableManager = {
      normalizeVariables: vi.fn(),
      setGame: vi.fn(),
    } as unknown as StateVariableManager;

    const manager = new StateDataManager({ game, worldManager, objectManager, variableManager });

    expect(manager.importGameData(null)).toBeNull();
    expect(worldManager.normalizeRooms).not.toHaveBeenCalled();
    expect(objectManager.normalizeObjects).not.toHaveBeenCalled();
  });

  it('normalizes and imports game data with defaults', () => {
    const game = makeGame();
    const rooms: RoomDefinition[] = [
      { size: 8, bg: 1, tiles: [[1]], walls: [[true]] },
    ];
    const maps: TileMap[] = [
      { ground: [[1]], overlay: [[null]] },
    ];
    const objects: ObjectEntry[] = [{ id: 'key-0', type: ITEM_TYPES.KEY, roomIndex: 0, x: 0, y: 0 }];
    const variables: VariableDefinition[] = [{ id: 'flag', value: true }];

    const worldManager = {
      normalizeRooms: vi.fn(() => rooms),
      normalizeTileMaps: vi.fn(() => maps),
      clampCoordinate: vi.fn(() => 2),
      clampRoomIndex: vi.fn(() => 1),
      setGame: vi.fn(),
    } as unknown as StateWorldManager;

    const objectManager = {
      normalizeObjects: vi.fn(() => objects),
      setGame: vi.fn(),
    } as unknown as StateObjectManager;

    const variableManager = {
      normalizeVariables: vi.fn(() => variables),
      setGame: vi.fn(),
    } as unknown as StateVariableManager;

    const manager = new StateDataManager({ game, worldManager, objectManager, variableManager });

    const start = manager.importGameData({
      title: 'A long title for my tiny rpg',
      author: 'An author with a long name',
      palette: ['#000', '#111', '#222', '#333'],
      rooms: [],
      tileset: { tiles: undefined, maps: [] },
      start: { x: 10, y: 10, roomIndex: 5 },
      objects: [],
      variables: [],
    });

    expect(start).toEqual({ x: 2, y: 2, roomIndex: 1 });
    expect(game.title.length).toBeLessThanOrEqual(18);
    expect(game.author.length).toBeLessThanOrEqual(18);
    expect(game.palette).toEqual(['#000', '#111', '#222']);
    expect(game.rooms).toBe(rooms);
    expect(game.tileset.maps).toBe(maps);
    expect(game.tileset.map).toBe(maps[0]);
    expect(game.objects).toBe(objects);
    expect(game.variables).toBe(variables);
    expect(worldManager.normalizeRooms).toHaveBeenCalledWith([], 9, 3);
    expect(worldManager.normalizeTileMaps).toHaveBeenCalledWith([], 9);
    expect(objectManager.setGame).toHaveBeenCalledWith(game);
    expect(variableManager.setGame).toHaveBeenCalledWith(game);
  });
});
