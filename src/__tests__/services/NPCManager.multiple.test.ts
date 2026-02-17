import { describe, it, expect, vi } from 'vitest';
import { NPCManager } from '../../runtime/services/NPCManager';
import type { GameDefinition } from '../../types/gameState';

const makeGameState = (sprites: GameDefinition['sprites'] = []) => {
  const game: GameDefinition = {
    title: 'Game',
    author: 'Author',
    palette: ['#000000', '#111111', '#222222'],
    roomSize: 8,
    world: { rows: 1, cols: 2 },
    rooms: [
      { size: 8, bg: 0, tiles: [[0]], walls: [[false]] },
      { size: 8, bg: 0, tiles: [[0]], walls: [[false]] }
    ],
    start: { x: 1, y: 1, roomIndex: 0 },
    sprites,
    enemies: [],
    items: [],
    objects: [],
    variables: [],
    exits: [],
    tileset: { tiles: [], maps: [], map: { ground: [], overlay: [] } },
  };

  return {
    game,
    normalizeVariableId: vi.fn((id: string | null) => id),
  };
};

describe('NPCManager - Multiple Instances Per Type', () => {
  it('should allow placing same NPC type in multiple rooms', () => {
    const gameState = makeGameState([]);
    const manager = new NPCManager(gameState as unknown as ConstructorParameters<typeof NPCManager>[0]);

    // Create mage in room 0
    const npc1 = manager.createNPC('old-mage', 0);
    expect(npc1).toBeTruthy();
    if (!npc1) throw new Error('Expected NPC to be created');
    expect(npc1.type).toBe('old-mage');
    expect(npc1.roomIndex).toBe(0);
    expect(npc1.placed).toBe(false);

    // Place it
    manager.setNPCPosition(npc1.id, 3, 4, 0);
    const npc1After = manager.getNPC(npc1.id);
    expect(npc1After).toBeTruthy();
    expect(npc1After?.x).toBe(3);
    expect(npc1After?.y).toBe(4);
    expect(npc1After?.roomIndex).toBe(0);
    expect(npc1After?.placed).toBe(true);

    // Create ANOTHER mage in room 1
    const npc2 = manager.createNPC('old-mage', 1);
    expect(npc2).toBeTruthy();
    if (!npc2) throw new Error('Expected NPC to be created');
    expect(npc2.type).toBe('old-mage');
    expect(npc2.roomIndex).toBe(1);
    expect(npc2.id).not.toBe(npc1.id); // Different IDs

    // Place it
    manager.setNPCPosition(npc2.id, 5, 6, 1);
    const npc2After = manager.getNPC(npc2.id);
    expect(npc2After).toBeTruthy();
    expect(npc2After?.x).toBe(5);
    expect(npc2After?.y).toBe(6);
    expect(npc2After?.roomIndex).toBe(1);
    expect(npc2After?.placed).toBe(true);

    // Both should exist
    const allNPCs = manager.getNPCs();
    expect(allNPCs.length).toBe(2);

    const magesInRoom0 = allNPCs.filter(n => n.type === 'old-mage' && n.roomIndex === 0 && n.placed);
    const magesInRoom1 = allNPCs.filter(n => n.type === 'old-mage' && n.roomIndex === 1 && n.placed);

    expect(magesInRoom0.length).toBe(1);
    expect(magesInRoom1.length).toBe(1);

    // Call ensureDefaultNPCs - should NOT remove any
    manager.ensureDefaultNPCs();
    const afterEnsure = manager.getNPCs();
    expect(afterEnsure.length).toBe(2);

    const magesInRoom0After = afterEnsure.filter(n => n.type === 'old-mage' && n.roomIndex === 0 && n.placed);
    const magesInRoom1After = afterEnsure.filter(n => n.type === 'old-mage' && n.roomIndex === 1 && n.placed);

    expect(magesInRoom0After.length).toBe(1);
    expect(magesInRoom1After.length).toBe(1);

    // Verify original NPC still exists with correct data
    const npc1Final = manager.getNPC(npc1.id);
    expect(npc1Final).toBeTruthy();
    expect(npc1Final?.x).toBe(3);
    expect(npc1Final?.y).toBe(4);
    expect(npc1Final?.roomIndex).toBe(0);
  });
});
