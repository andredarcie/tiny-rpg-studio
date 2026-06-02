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

  it('resetRuntime resets switch, pressure-plate and chest back to default state', () => {
    const game = { start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] };
    const manager = new StateObjectManager(game, createWorldManager(), createVariableManager());

    manager.setObjectPosition(ITEM_TYPES.SWITCH, 0, 1, 1);
    manager.setObjectPosition(ITEM_TYPES.PRESSURE_PLATE, 0, 2, 2);
    manager.setObjectPosition(ITEM_TYPES.CHEST, 0, 3, 3);

    const sw = manager.getObjects().find((o) => o.type === ITEM_TYPES.SWITCH);
    const plate = manager.getObjects().find((o) => o.type === ITEM_TYPES.PRESSURE_PLATE);
    const chest = manager.getObjects().find((o) => o.type === ITEM_TYPES.CHEST);
    if (!sw || !plate || !chest) throw new Error('objects not found');

    sw.on = true;
    plate.activated = true;
    chest.opened = true;

    manager.resetRuntime();

    expect(sw.on).toBe(false);
    expect(plate.activated).toBe(false);
    expect(chest.opened).toBe(false);
  });
});

describe('StateObjectManager - logic gates', () => {
  const createGateVariableManager = () => {
    const valid = new Set(['var-1', 'var-2', 'var-3']);
    return {
      getFirstVariableId: () => 'var-1',
      normalizeVariableId: (value: string | null | undefined) => (typeof value === 'string' && valid.has(value) ? value : null),
    };
  };

  const createGame = () => ({ start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] });

  it('preserves logic gate variable fields through normalizeObjects', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    const normalized = manager.normalizeObjects([
      { type: ITEM_TYPES.LOGIC_GATE_AND, roomIndex: 0, x: 1, y: 1, inputVariableId: 'var-1', inputVariableId2: 'var-2', outputVariableId: 'var-3' },
    ]);
    const gate = normalized.find((o) => o.type === ITEM_TYPES.LOGIC_GATE_AND);
    expect(gate?.inputVariableId).toBe('var-1');
    expect(gate?.inputVariableId2).toBe('var-2');
    expect(gate?.outputVariableId).toBe('var-3');
  });

  it('discards invalid variable ids to null', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    const normalized = manager.normalizeObjects([
      { type: ITEM_TYPES.LOGIC_GATE_NOT, roomIndex: 0, x: 1, y: 1, inputVariableId: 'bogus', outputVariableId: 'var-1' },
    ]);
    const gate = normalized.find((o) => o.type === ITEM_TYPES.LOGIC_GATE_NOT);
    expect(gate?.inputVariableId).toBeNull();
    expect(gate?.outputVariableId).toBe('var-1');
  });

  it('applies first-wins on duplicate outputs', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    const normalized = manager.normalizeObjects([
      { type: ITEM_TYPES.LOGIC_GATE_AND, roomIndex: 0, x: 1, y: 1, outputVariableId: 'var-3' },
      { type: ITEM_TYPES.LOGIC_GATE_OR, roomIndex: 1, x: 1, y: 1, outputVariableId: 'var-3' },
    ]);
    const first = normalized.find((o) => o.type === ITEM_TYPES.LOGIC_GATE_AND);
    const second = normalized.find((o) => o.type === ITEM_TYPES.LOGIC_GATE_OR);
    expect(first?.outputVariableId).toBe('var-3');
    expect(second?.outputVariableId).toBeNull();
  });

  it('computes isLogicGate / isSingleInputGate / isLed flags', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_NOT, 0, 1, 1);
    manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_AND, 0, 2, 2);
    manager.setObjectPosition(ITEM_TYPES.LOGIC_LED, 0, 3, 3);
    const objects = manager.getObjects();
    const not = objects.find((o) => o.type === ITEM_TYPES.LOGIC_GATE_NOT);
    const and = objects.find((o) => o.type === ITEM_TYPES.LOGIC_GATE_AND);
    const led = objects.find((o) => o.type === ITEM_TYPES.LOGIC_LED);
    expect(not?.isLogicGate).toBe(true);
    expect(not?.isSingleInputGate).toBe(true);
    expect(and?.isSingleInputGate).toBe(false);
    expect(led?.isLed).toBe(true);
  });

  it('gives a freshly placed LED a fallback variable', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    manager.setObjectPosition(ITEM_TYPES.LOGIC_LED, 0, 3, 3);
    const led = manager.getObjects().find((o) => o.type === ITEM_TYPES.LOGIC_LED);
    expect(led?.variableId).toBe('var-1');
  });

  it('isLogicGateOutput reflects configured outputs', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_AND, 0, 1, 1);
    manager.setGateOutputVariable(ITEM_TYPES.LOGIC_GATE_AND, 0, 'var-3');
    expect(manager.isLogicGateOutput('var-3')).toBe(true);
    expect(manager.isLogicGateOutput('var-2')).toBe(false);
  });

  it('rejects an output already used by another gate', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createGateVariableManager());
    manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_AND, 0, 1, 1);
    manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_OR, 1, 1, 1);
    manager.setGateOutputVariable(ITEM_TYPES.LOGIC_GATE_AND, 0, 'var-3');
    const result = manager.setGateOutputVariable(ITEM_TYPES.LOGIC_GATE_OR, 1, 'var-3');
    expect(result).toBeNull();
    const or = manager.getObjects().find((o) => o.type === ITEM_TYPES.LOGIC_GATE_OR);
    expect(or?.outputVariableId).toBeNull();
  });
});

describe('StateObjectManager - multi-instance (logic category)', () => {
  const createGame = () => ({ start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] });
  const createVarManager = () => ({
    getFirstVariableId: () => 'var-1',
    normalizeVariableId: (value: string | null | undefined) =>
      (typeof value === 'string' && /^var-[1-9]$/.test(value) ? value : null),
  });

  it('places up to 4 NOT gates in the same room with distinct ids', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    for (let i = 0; i < 4; i++) {
      expect(manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_NOT, 0, i, 0)).not.toBeNull();
    }
    const gates = manager.getObjects().filter((o) => o.type === ITEM_TYPES.LOGIC_GATE_NOT);
    expect(gates.length).toBe(4);
    expect(new Set(gates.map((g) => g.id)).size).toBe(4);
  });

  it('rejects the 5th instance of the same type in a room (limit)', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    for (let i = 0; i < 4; i++) manager.setObjectPosition(ITEM_TYPES.LOGIC_LED, 0, i, 0);
    expect(manager.setObjectPosition(ITEM_TYPES.LOGIC_LED, 0, 5, 0)).toBeNull();
    expect(manager.getObjects().filter((o) => o.type === ITEM_TYPES.LOGIC_LED).length).toBe(4);
  });

  it('counts the limit per type, allowing 4 NOT + 4 AND in the same room', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    for (let i = 0; i < 4; i++) manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_NOT, 0, i, 0);
    for (let i = 0; i < 4; i++) manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_AND, 0, i, 1);
    expect(manager.getObjects().filter((o) => o.type === ITEM_TYPES.LOGIC_GATE_NOT).length).toBe(4);
    expect(manager.getObjects().filter((o) => o.type === ITEM_TYPES.LOGIC_GATE_AND).length).toBe(4);
  });

  it('is idempotent when re-placing the same type on the same tile (no duplicate)', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    const first = manager.setObjectPosition(ITEM_TYPES.LOGIC_LED, 0, 2, 2);
    const again = manager.setObjectPosition(ITEM_TYPES.LOGIC_LED, 0, 2, 2);
    expect(again?.id).toBe(first?.id);
    expect(manager.getObjects().filter((o) => o.type === ITEM_TYPES.LOGIC_LED).length).toBe(1);
  });

  it('removeObjectById removes only the targeted instance', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_OR, 0, 1, 0);
    const second = manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_OR, 0, 2, 0);
    manager.removeObjectById(second?.id ?? '');
    const remaining = manager.getObjects().filter((o) => o.type === ITEM_TYPES.LOGIC_GATE_OR);
    expect(remaining.length).toBe(1);
    expect(remaining[0].x).toBe(1);
  });

  it('configures a specific instance by id', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    const a = manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_AND, 0, 1, 0);
    const b = manager.setObjectPosition(ITEM_TYPES.LOGIC_GATE_AND, 0, 2, 0);
    const aId = a?.id ?? '';
    const bId = b?.id ?? '';
    manager.setGateOutputVariableById(aId, 'var-3');
    manager.setGateOutputVariableById(bId, 'var-4');
    expect(manager.getObjects().find((o) => o.id === aId)?.outputVariableId).toBe('var-3');
    expect(manager.getObjects().find((o) => o.id === bId)?.outputVariableId).toBe('var-4');
  });

  it('keeps single-instance types at one per room', () => {
    const manager = new StateObjectManager(createGame(), createWorldManager(), createVarManager());
    manager.setObjectPosition(ITEM_TYPES.KEY, 0, 1, 0);
    manager.setObjectPosition(ITEM_TYPES.KEY, 0, 3, 0); // moves the existing key
    expect(manager.getObjects().filter((o) => o.type === ITEM_TYPES.KEY).length).toBe(1);
  });
});
