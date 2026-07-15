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
  backgroundMusicVideoId: undefined,
  backgroundMusicVolume: 100,
  hideHud: false,
  spriteOutline: true,
  spriteOutlineColor: 1,
  disableSkills: false,
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
    game.skillCustomizations = {
      necromancer: { name: 'Second Wind' }
    };
    const worldManager = {} as StateWorldManager;
    const objectManager = {} as StateObjectManager;
    const variableManager = {} as StateVariableManager;

    const manager = new StateDataManager({ game, worldManager, objectManager, variableManager });

    expect(manager.exportGameData()).toEqual({
      title: game.title,
      author: game.author,
      palette: game.palette,
      backgroundMusicVideoId: undefined,
      backgroundMusicVolume: 100,
      hideHud: false,
      spriteOutline: true,
      spriteOutlineColor: 1,
      disableSkills: false,
      disablePixelFont: false,
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
      skillCustomizations: {
        necromancer: { name: 'Second Wind' }
      },
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
    expect(game.hideHud).toBe(false);
    expect(game.disableSkills).toBe(false);
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

  it('imports hideHud when present', () => {
    const game = makeGame();
    const manager = new StateDataManager({
      game,
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    });

    manager.importGameData({ hideHud: true });

    expect(game.hideHud).toBe(true);
  });

  it('imports spriteOutline false and defaults missing to true', () => {
    const game = makeGame();
    const deps = {
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    };

    const manager = new StateDataManager({ game, ...deps });
    manager.importGameData({ spriteOutline: false, spriteOutlineColor: 9 });
    expect(game.spriteOutline).toBe(false);
    expect(game.spriteOutlineColor).toBe(9);

    manager.importGameData({});
    expect(game.spriteOutline).toBe(true);
    expect(game.spriteOutlineColor).toBe(1);
  });

  it('imports disableSkills when present', () => {
    const game = makeGame();
    const manager = new StateDataManager({
      game,
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    });

    manager.importGameData({ disableSkills: true });

    expect(game.disableSkills).toBe(true);
  });

  it('sanitizes skill customizations on import', () => {
    const game = makeGame();
    const manager = new StateDataManager({
      game,
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    });

    manager.importGameData({
      skillCustomizations: {
        necromancer: { name: '  Second Wind  ' },
        missing: { name: 'Invalid' }
      }
    });

    expect(game.skillCustomizations).toEqual({
      necromancer: { name: 'Second Wind' }
    });
  });

  it('exports backgroundMusicVideoId when configured', () => {
    const game = makeGame();
    game.backgroundMusicVideoId = 't0ihNLLZNi0';
    const manager = new StateDataManager({
      game,
      worldManager: {} as StateWorldManager,
      objectManager: {} as StateObjectManager,
      variableManager: {} as StateVariableManager,
    });

    const exported = manager.exportGameData() as { backgroundMusicVideoId?: string };
    expect(exported.backgroundMusicVideoId).toBe('t0ihNLLZNi0');
  });

  it('exports a normalized backgroundMusicVolume', () => {
    const game = makeGame();
    game.backgroundMusicVolume = 75.8;
    const manager = new StateDataManager({
      game,
      worldManager: {} as StateWorldManager,
      objectManager: {} as StateObjectManager,
      variableManager: {} as StateVariableManager,
    });

    const exported = manager.exportGameData() as { backgroundMusicVolume?: number };
    expect(exported.backgroundMusicVolume).toBe(75);
  });

  it('imports and trims backgroundMusicVideoId', () => {
    const game = makeGame();
    const manager = new StateDataManager({
      game,
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    });

    manager.importGameData({
      backgroundMusicVideoId: '  t0ihNLLZNi0  '
    } as { backgroundMusicVideoId?: string });

    expect(game.backgroundMusicVideoId).toBe('t0ihNLLZNi0');
  });

  it('clears backgroundMusicVideoId when the imported value is invalid', () => {
    const game = makeGame();
    game.backgroundMusicVideoId = 't0ihNLLZNi0';
    const manager = new StateDataManager({
      game,
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    });

    manager.importGameData({
      backgroundMusicVideoId: 'https://example.com/not-youtube'
    } as { backgroundMusicVideoId?: string });

    expect(game.backgroundMusicVideoId).toBeUndefined();
  });

  it.each([
    [75, 75],
    [-10, 0],
    [140, 100],
    [undefined, 100],
    ['80', 100],
    [Number.NaN, 100],
  ])('imports normalized backgroundMusicVolume from %s', (input, expected) => {
    const game = makeGame();
    const manager = new StateDataManager({
      game,
      worldManager: {
        normalizeRooms: vi.fn(() => []),
        normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
        clampCoordinate: vi.fn((v: number) => v),
        clampRoomIndex: vi.fn((v: number) => v),
        setGame: vi.fn(),
      } as unknown as StateWorldManager,
      objectManager: {
        normalizeObjects: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateObjectManager,
      variableManager: {
        normalizeVariables: vi.fn(() => []),
        setGame: vi.fn(),
      } as unknown as StateVariableManager,
    });

    manager.importGameData({ backgroundMusicVolume: input } as { backgroundMusicVolume?: unknown });

    expect(game.backgroundMusicVolume).toBe(expected);
  });
});

describe('StateDataManager - customSprites', () => {
  it('includes customSprites in exportGameData when present', () => {
    const game = makeGame();
    game.customSprites = [
      { group: 'npc', key: 'wizard', frames: [[[1, 2], [3, 4]]] },
    ];
    const manager = new StateDataManager({
      game,
      worldManager: {} as StateWorldManager,
      objectManager: {} as StateObjectManager,
      variableManager: {} as StateVariableManager,
    });

    const exported = manager.exportGameData();
    expect(exported.customSprites).toEqual(game.customSprites);
  });

  it('omits customSprites from exportGameData when absent', () => {
    const game = makeGame();
    const manager = new StateDataManager({
      game,
      worldManager: {} as StateWorldManager,
      objectManager: {} as StateObjectManager,
      variableManager: {} as StateVariableManager,
    });

    const exported = manager.exportGameData();
    expect(exported.customSprites).toBeUndefined();
  });

  const makeImportManagers = () => ({
    worldManager: {
      normalizeRooms: vi.fn(() => []),
      normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
      clampCoordinate: vi.fn((v: number) => v),
      clampRoomIndex: vi.fn((v: number) => v),
      setGame: vi.fn(),
    } as unknown as StateWorldManager,
    objectManager: {
      normalizeObjects: vi.fn(() => []),
      setGame: vi.fn(),
    } as unknown as StateObjectManager,
    variableManager: {
      normalizeVariables: vi.fn(() => []),
      setGame: vi.fn(),
    } as unknown as StateVariableManager,
  });

  it('accepts valid customSprites in importGameData', () => {
    const game = makeGame();
    const manager = new StateDataManager({ game, ...makeImportManagers() });

    const entries = [{ group: 'enemy' as const, key: 'slime', frames: [[[0]]] }];
    manager.importGameData({ customSprites: entries as unknown[] });

    expect(game.customSprites).toEqual(entries);
  });

  it('ignores non-array customSprites in importGameData', () => {
    const game = makeGame();
    game.customSprites = [{ group: 'npc', key: 'x', frames: [] }];
    const manager = new StateDataManager({ game, ...makeImportManagers() });

    manager.importGameData({ customSprites: 'invalido' as unknown as unknown[] });

    // It should either preserve the old value or clear it, but it must not crash.
    // It also must not accept a string as customSprites.
    expect(game.customSprites).toBeUndefined();
  });

  it('exports online config when enabled', () => {
    const game = makeGame();
    game.online = { enabled: true, spawnPoints: [{ role: 'p2', roomIndex: 0, x: 2, y: 3 }] };
    const manager = new StateDataManager({ game, worldManager: {} as StateWorldManager, objectManager: {} as StateObjectManager, variableManager: {} as StateVariableManager });

    const exported = manager.exportGameData();
    expect(exported.online).toEqual({ enabled: true, spawnPoints: [{ role: 'p2', roomIndex: 0, x: 2, y: 3 }] });
  });

  it('omits online from export when disabled', () => {
    const game = makeGame();
    const manager = new StateDataManager({ game, worldManager: {} as StateWorldManager, objectManager: {} as StateObjectManager, variableManager: {} as StateVariableManager });

    const exported = manager.exportGameData();
    expect(exported.online).toBeUndefined();
  });

  const makeImportManager = (game: ReturnType<typeof makeGame>) => new StateDataManager({
    game,
    worldManager: {
      normalizeRooms: vi.fn(() => []),
      normalizeTileMaps: vi.fn(() => [{ ground: [[null]], overlay: [[null]] }]),
      clampCoordinate: vi.fn((v: number) => v),
      clampRoomIndex: vi.fn((v: number) => v),
      setGame: vi.fn(),
    } as unknown as StateWorldManager,
    objectManager: { normalizeObjects: vi.fn(() => []), setGame: vi.fn() } as unknown as StateObjectManager,
    variableManager: { normalizeVariables: vi.fn(() => []), setGame: vi.fn() } as unknown as StateVariableManager,
  });

  it('imports online config and validates spawn points', () => {
    const game = makeGame();
    const manager = makeImportManager(game);

    manager.importGameData({
      online: { enabled: true, spawnPoints: [{ role: 'p2', roomIndex: 1, x: 5, y: 6 }] }
    });

    expect(game.online?.enabled).toBe(true);
    expect(game.online?.spawnPoints).toHaveLength(1);
    expect(game.online?.spawnPoints?.[0]).toMatchObject({ role: 'p2', roomIndex: 1, x: 5, y: 6 });
  });

  it('clears online when importGameData receives no online field', () => {
    const game = makeGame();
    game.online = { enabled: true, spawnPoints: [] };
    const manager = makeImportManager(game);

    manager.importGameData({});
    expect(game.online).toBeUndefined();
  });

  it('clears the field when importGameData receives no customSprites', () => {
    const game = makeGame();
    game.customSprites = [{ group: 'npc', key: 'x', frames: [] }];
    const manager = new StateDataManager({ game, ...makeImportManagers() });

    manager.importGameData({});

    expect(game.customSprites).toBeUndefined();
  });
});
