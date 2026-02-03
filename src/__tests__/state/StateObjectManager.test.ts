import { describe, expect, it } from 'vitest';
import { StateObjectManager } from '../../runtime/domain/state/StateObjectManager';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';

const createWorldManager = () => ({
  clampRoomIndex: (value: number) => {
    const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.max(0, Math.min(8, numeric));
  },
  clampCoordinate: (value: number) => {
    const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.max(0, Math.min(7, numeric));
  },
});

const createVariableManager = () => ({
  getFirstVariableId: () => 'var-1',
  normalizeVariableId: (value: string | null | undefined) => (value === 'var-1' ? value : null),
});

describe('StateObjectManager', () => {
  it('ensures a player start marker exists and normalizes end text', () => {
    const game = {
      start: { x: 2, y: 3, roomIndex: 1 },
      objects: [],
      variables: [],
    };
    const worldManager = createWorldManager();
    const variableManager = createVariableManager();

    const manager = new StateObjectManager(game, worldManager, variableManager);

    expect((game.objects[0] as { type: string }).type).toBe(ITEM_TYPES.PLAYER_START);
    expect((game.objects[0] as { roomIndex: number }).roomIndex).toBe(1);

    manager.setObjectPosition(ITEM_TYPES.PLAYER_END, 0, 1, 1);
    const longText = 'a'.repeat(StateObjectManager.PLAYER_END_TEXT_LIMIT + 5);
    const normalized = manager.setPlayerEndText(0, longText);
    expect(normalized.length).toBe(StateObjectManager.PLAYER_END_TEXT_LIMIT);
  });

  it('normalizes objects, filters invalid entries, and applies behaviors', () => {
    const game = {
      start: { x: 1, y: 1, roomIndex: 0 },
      objects: [],
      variables: [],
    };
    const worldManager = createWorldManager();
    const variableManager = createVariableManager();
    const manager = new StateObjectManager(game, worldManager, variableManager);

    const normalized = manager.normalizeObjects([
      { type: 'invalid', roomIndex: 0, x: 0, y: 0 },
      { type: ITEM_TYPES.PLAYER_START, roomIndex: 0, x: 1, y: 1 },
      { type: ITEM_TYPES.PLAYER_START, roomIndex: 1, x: 2, y: 2 },
      { type: ITEM_TYPES.PLAYER_END, roomIndex: 0, x: 3, y: 3, endingText: 'End' },
      { type: ITEM_TYPES.PLAYER_END, roomIndex: 0, x: 4, y: 4, endingText: 'Duplicate' },
      { type: ITEM_TYPES.KEY, roomIndex: 2, x: 5, y: 5, collected: true },
      { type: ITEM_TYPES.SWITCH, roomIndex: 2, x: 6, y: 6, on: true, variableId: 'var-1' },
    ]);

    expect(normalized.some((entry) => entry.type === ITEM_TYPES.KEY)).toBe(true);
    expect(normalized.filter((entry) => entry.type === ITEM_TYPES.PLAYER_START)).toHaveLength(1);
    expect(normalized.filter((entry) => entry.type === ITEM_TYPES.PLAYER_END)).toHaveLength(1);

    const key = normalized.find((entry) => entry.type === ITEM_TYPES.KEY);
    expect(key?.isCollectible).toBe(true);
    expect(key?.collected).toBe(true);
    expect(key?.hideWhenCollected).toBe(true);

    const sw = normalized.find((entry) => entry.type === ITEM_TYPES.SWITCH);
    expect(sw?.on).toBe(true);
    expect(sw?.variableId).toBe('var-1');
  });

  it('updates object positions and syncs player start', () => {
    const game = {
      start: { x: 1, y: 1, roomIndex: 0 },
      objects: [],
      variables: [],
    };
    const worldManager = createWorldManager();
    const variableManager = createVariableManager();
    const manager = new StateObjectManager(game, worldManager, variableManager);

    const entry = manager.setObjectPosition(ITEM_TYPES.PLAYER_START, 2, 9, -2);
    expect(entry?.x).toBe(7);
    expect(entry?.y).toBe(0);
    expect(game.start).toEqual({ x: 7, y: 0, roomIndex: 2 });

    const door = manager.setObjectPosition(ITEM_TYPES.DOOR_VARIABLE, 1, 2, 2);
    expect(door?.variableId).toBe('var-1');
  });

  it('syncs switch state from variables', () => {
    const game = {
      start: { x: 1, y: 1, roomIndex: 0 },
      objects: [],
      variables: [],
    };
    const worldManager = createWorldManager();
    const variableManager = createVariableManager();
    const manager = new StateObjectManager(game, worldManager, variableManager);

    manager.setObjectPosition(ITEM_TYPES.SWITCH, 0, 1, 1);
    manager.setObjectVariable(ITEM_TYPES.SWITCH, 0, 'var-1');
    const updated = manager.syncSwitchState('var-1', true);
    const sw = manager.getObjects().find((object) => object.type === ITEM_TYPES.SWITCH);

    expect(updated).toBe(true);
    expect(sw?.on ?? false).toBe(true);
  });

  it('removes objects except player start', () => {
    const game = {
      start: { x: 1, y: 1, roomIndex: 0 },
      objects: [],
      variables: [],
    };
    const worldManager = createWorldManager();
    const variableManager = createVariableManager();
    const manager = new StateObjectManager(game, worldManager, variableManager);

    manager.setObjectPosition(ITEM_TYPES.KEY, 0, 1, 1);
    manager.setObjectPosition(ITEM_TYPES.PLAYER_START, 0, 2, 2);

    manager.removeObject(ITEM_TYPES.KEY, 0);
    expect(manager.getObjects().some((o) => o.type === ITEM_TYPES.KEY)).toBe(false);

    manager.removeObject(ITEM_TYPES.PLAYER_START, 0);
    expect(manager.getObjects().some((o) => o.type === ITEM_TYPES.PLAYER_START)).toBe(true);
  });
});
