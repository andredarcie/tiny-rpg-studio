import { describe, it, expect } from 'vitest';
import { StateVariableManager } from '../../runtime/domain/state/StateVariableManager';
import { TextResources } from '../../runtime/adapters/TextResources';
import type { GameDefinition, RuntimeState } from '../../types/gameState';

const makeGame = (): GameDefinition => ({
  title: 'Game',
  author: 'Author',
  palette: ['#000000', '#111111', '#222222'],
  roomSize: 8,
  world: { rows: 1, cols: 1 },
  rooms: [],
  start: { x: 1, y: 1, roomIndex: 0 },
  sprites: [],
  enemies: [],
  items: [],
  objects: [],
  variables: [],
  exits: [],
  tileset: { tiles: [], maps: [], map: { ground: [], overlay: [] } },
});

describe('StateVariableManager', () => {
  it('normalizes variables from presets', () => {
    const game = makeGame();
    const manager = new StateVariableManager(game, null);

    const normalized = manager.normalizeVariables([{ id: 'var-1', value: true }]);

    expect(normalized[0].id).toBe('var-1');
    expect(normalized[0].value).toBe(true);
    expect(normalized[0].name).toBe(TextResources.get('variables.names.var1'));
  });

  it('supports special variable ids and existing definitions', () => {
    const game = makeGame();
    const manager = new StateVariableManager(game, null);
    game.variables = manager.normalizeVariables([]);

    expect(manager.normalizeVariableId('skill:bard')).toBe('skill:bard');
    expect(manager.normalizeVariableId('var-1')).toBe('var-1');
    expect(manager.normalizeVariableId('missing')).toBeNull();
  });

  it('updates runtime and persistent values', () => {
    const game = makeGame();
    const state = { variables: [] } as unknown as RuntimeState;
    const manager = new StateVariableManager(game, state);

    game.variables = manager.normalizeVariables([]);
    state.variables = manager.cloneVariables(game.variables);

    expect(manager.setVariableValue('var-1', true, false)).toBe(true);
    expect(manager.isVariableOn('var-1')).toBe(true);
    expect(game.variables[0].value).toBe(false);

    expect(manager.setVariableValue('var-1', false, true)).toBe(true);
    expect(game.variables[0].value).toBe(false);
    expect(state.variables[0].value).toBe(false);
  });

  it('refreshes preset names for blank values', () => {
    const game = makeGame();
    const state = { variables: [] } as unknown as RuntimeState;
    const manager = new StateVariableManager(game, state);

    game.variables = manager.normalizeVariables([{ id: 'var-1', name: '' }]);
    state.variables = manager.cloneVariables(game.variables);

    manager.refreshPresetNames();

    const gameVars = game.variables as unknown as { name: string }[];
    const stateVars = state.variables as unknown as { name: string }[];
    expect(gameVars[0].name).toBe(TextResources.get('variables.names.var1'));
    expect(stateVars[0].name).toBe(TextResources.get('variables.names.var1'));
  });
});
