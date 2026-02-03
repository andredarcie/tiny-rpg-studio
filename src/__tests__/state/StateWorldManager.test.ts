import { describe, expect, it } from 'vitest';
import { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import type { GameDefinition } from '../../types/gameState';

describe('StateWorldManager', () => {
  it('creates world rooms with coordinates', () => {
    const rooms = StateWorldManager.createWorldRooms(2, 2, 8);

    expect(rooms).toHaveLength(4);
    expect(rooms[0].worldX).toBe(0);
    expect(rooms[0].worldY).toBe(0);
    expect(rooms[3].worldX).toBe(1);
    expect(rooms[3].worldY).toBe(1);
  });

  it('clamps coordinates and room indices', () => {
    const game = {
      title: '',
      author: '',
      palette: ['#000', '#111', '#222'],
      roomSize: 8,
      world: { rows: 2, cols: 2 },
      rooms: StateWorldManager.createWorldRooms(2, 2, 8),
      start: { x: 1, y: 1, roomIndex: 0 },
      sprites: [],
      enemies: [],
      items: [],
      objects: [],
      variables: [],
      exits: [],
      tileset: { tiles: [], maps: [], map: { ground: [], overlay: [] } },
    } satisfies GameDefinition;

    const manager = new StateWorldManager(game);

    expect(manager.clampCoordinate(10)).toBe(7);
    expect(manager.clampCoordinate(-1)).toBe(0);
    expect(manager.clampCoordinate('2.9')).toBe(2);
    expect(manager.clampRoomIndex(10)).toBe(3);
    expect(manager.clampRoomIndex(-1)).toBe(0);
  });

  it('normalizes tile maps from a single map', () => {
    const game = {
      title: '',
      author: '',
      palette: ['#000', '#111', '#222'],
      roomSize: 2,
      world: { rows: 1, cols: 1 },
      rooms: StateWorldManager.createWorldRooms(1, 1, 2),
      start: { x: 1, y: 1, roomIndex: 0 },
      sprites: [],
      enemies: [],
      items: [],
      objects: [],
      variables: [],
      exits: [],
      tileset: { tiles: [], maps: [], map: { ground: [], overlay: [] } },
    } satisfies GameDefinition;

    const manager = new StateWorldManager(game);
    const maps = manager.normalizeTileMaps({ ground: [[1]], overlay: [[null]] }, 2);

    expect(maps).toHaveLength(2);
    expect(maps[0].ground[0][0]).toBe(1);
    expect(maps[1].ground[0][0]).toBeNull();
  });
});
