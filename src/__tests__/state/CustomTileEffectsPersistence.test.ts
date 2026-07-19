import { describe, expect, it, vi } from 'vitest';
import { StateDataManager } from '../../runtime/domain/state/StateDataManager';
import type { StateObjectManager } from '../../runtime/domain/state/StateObjectManager';
import type { StateVariableManager } from '../../runtime/domain/state/StateVariableManager';
import type { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import type { GameDefinition } from '../../types/gameState';

function game(): GameDefinition {
  const map = { ground: [[0]], overlay: [[null]] };
  return {
    title: 'FX', author: '', palette: ['#000', '#111', '#fff'], roomSize: 8,
    world: { rows: 1, cols: 1 }, rooms: [], start: { x: 1, y: 1, roomIndex: 0 },
    sprites: [], enemies: [], items: [], objects: [], variables: [], exits: [],
    tileset: { tiles: [{ id: 0 }], maps: [map], map },
  };
}

function manager(target: GameDefinition) {
  return new StateDataManager({
    game: target,
    worldManager: {
      normalizeRooms: vi.fn(() => []),
      normalizeTileMaps: vi.fn(() => [{ ground: [[0]], overlay: [[null]] }]),
      clampCoordinate: vi.fn((value: number) => value),
      clampRoomIndex: vi.fn((value: number) => value),
      setGame: vi.fn(),
    } as unknown as StateWorldManager,
    objectManager: { normalizeObjects: vi.fn(() => []), setGame: vi.fn() } as unknown as StateObjectManager,
    variableManager: { normalizeVariables: vi.fn(() => []), setGame: vi.fn() } as unknown as StateVariableManager,
  });
}

describe('custom tile effect state persistence', () => {
  it('exports used and unused normalized definitions', () => {
    const target = game();
    target.customTileEffects = [
      { id: 'custom:0', name: 'Glow', baseEffectIds: ['glow'] },
      { id: 'custom:1', name: 'Unused', baseEffectIds: ['sparkle'] },
    ];
    target.tileset.tiles[0].visualEffect = 'custom:0';
    const exported = manager(target).exportGameData();
    expect(exported.customTileEffects).toEqual(target.customTileEffects);
    expect((exported.tileset?.tiles as Array<{ visualEffect?: string }>)[0].visualEffect).toBe('custom:0');
  });

  it('normalizes definitions before sanitizing direct JSON tile assignments', () => {
    const target = game();
    manager(target).importGameData({
      customTileEffects: [
        { id: 'custom:0', name: ' Glow ', baseEffectIds: ['glow', 'unknown' as never] },
      ],
      tileset: {
        tiles: [
          { id: 0, visualEffect: 'custom:0' },
          { id: 1, name: 'Water', category: 'Agua', visualEffect: 'custom:missing' },
        ],
      },
    });
    expect(target.customTileEffects).toEqual([
      { id: 'custom:0', name: 'Glow', baseEffectIds: ['glow'] },
    ]);
    expect(target.tileset.tiles.map((tile) => tile.visualEffect)).toEqual(['custom:0', 'none']);
  });

  it('clears absent definitions on a later import', () => {
    const target = game();
    target.customTileEffects = [{ id: 'custom:0', name: 'Glow', baseEffectIds: ['glow'] }];
    manager(target).importGameData({});
    expect(target.customTileEffects).toBeUndefined();
  });
});
