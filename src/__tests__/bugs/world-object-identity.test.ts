import { describe, expect, it } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';

describe('world object persistence', () => {
  it('imports distant objects beside NPCs and custom sprites without clamping them to the old world', () => {
    const state = new GameState();
    const project = {
      ...(state.exportGameData() as Record<string, unknown>),
      world: { rows: 5, cols: 5 },
      objects: [
        { id: 'key-24', type: 'key', roomIndex: 24, x: 2, y: 2 },
        { id: 'door-variable-24', type: 'door-variable', roomIndex: 24, x: 3, y: 2, variableId: 'var-2' },
      ],
      sprites: [{ id: 'npc-24', roomIndex: 24, x: 1, y: 1 }],
      customSprites: [{ id: 'custom-24', type: 'npc', data: 'sprite' }],
    };
    state.importGameData(project as never);
    expect(state.game.objects.filter(object => object.type === 'key' || object.type === 'door-variable'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'key-24', roomIndex: 24 }),
        expect.objectContaining({ id: 'door-variable-24', roomIndex: 24, variableId: 'var-2' }),
      ]));
    expect(state.game.sprites).toEqual(project.sprites);
    expect(state.game.customSprites).toEqual(project.customSprites);
    state.importGameData({ ...project, world: { rows: 3, cols: 3 }, objects: [{ type: 'key', roomIndex: 8, x: 2, y: 2 }] } as never);
    expect(state.game.objects.find(object => object.type === 'key')?.roomIndex).toBe(8);
  });

  it('keeps remapped and newly placed doors independently editable', () => {
    const state = new GameState();
    const oldDoor = state.objectManager.setObjectPosition('door-variable', 3, 2, 2);
    expect(oldDoor).not.toBeNull();
    new StateWorldManager(state.game).resizeWorld(5, 5);
    const newDoor = state.objectManager.setObjectPosition('door-variable', 3, 3, 3);
    if (!newDoor) throw Error('New door missing');
    const movedDoor = state.game.objects.find(object => object.type === 'door-variable' && object.roomIndex === 5);
    expect(movedDoor?.id).toBe('door-variable-5');
    expect(newDoor.id).not.toBe(movedDoor?.id);
    state.objectManager.setObjectVariableById(newDoor.id, 'var-2');
    expect(newDoor.variableId).toBe('var-2');
    expect(movedDoor?.variableId).toBe('var-1');
  });

  it('repairs duplicate saved IDs while preserving unrelated imported IDs', () => {
    const state = new GameState();
    const project = {
      ...(state.exportGameData() as Record<string, unknown>),
      world: { rows: 5, cols: 5 },
      objects: [
        { id: 'door-variable-3', type: 'door-variable', roomIndex: 5, x: 2, y: 2, variableId: 'var-1' },
        { id: 'door-variable-3', type: 'door-variable', roomIndex: 3, x: 3, y: 3, variableId: 'var-1' },
        { id: 'custom-key', type: 'key', roomIndex: 24, x: 1, y: 1 },
      ],
    };
    state.importGameData(project as never);
    const doors = state.game.objects.filter(object => object.type === 'door-variable');
    expect(new Set(doors.map(door => door.id)).size).toBe(2);
    expect(doors.find(door => door.roomIndex === 5)?.id).toBe('door-variable-5');
    expect(doors.find(door => door.roomIndex === 3)?.id).toBe('door-variable-3');
    expect(state.game.objects.find(object => object.type === 'key')?.id).toBe('custom-key');
    const doorInRoom3 = doors.find(door => door.roomIndex === 3);
    if (!doorInRoom3) throw Error('Room 3 door missing');
    state.objectManager.setObjectVariableById(doorInRoom3.id, 'var-2');
    expect(doorInRoom3.variableId).toBe('var-2');
    expect(doors.find(door => door.roomIndex === 5)?.variableId).toBe('var-1');
  });
});
