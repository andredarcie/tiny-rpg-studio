import { describe, it, expect, vi } from 'vitest';
import { NPCManager } from '../../runtime/services/NPCManager';
import type { GameDefinition } from '../../types/gameState';

const makeGameState = (sprites: GameDefinition['sprites'] = []) => {
  const game: GameDefinition = {
    title: 'Game',
    author: 'Author',
    palette: ['#000000', '#111111', '#222222'],
    roomSize: 8,
    world: { rows: 1, cols: 1 },
    rooms: [{ size: 8, bg: 0, tiles: [[0]], walls: [[false]] }],
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
    normalizeVariableId: vi.fn((id: string | null) => (id === 'var-1' ? 'var-1' : null)),
  };
};

describe('NPCManager', () => {
  it('keeps placed NPCs and allows duplicates per scene', () => {
    const sprites = [
      { id: 'npc-999', type: 'invalid', name: 'Bad', text: '', textKey: null, roomIndex: 0, x: 1, y: 1, initialX: 1, initialY: 1, initialRoomIndex: 0, placed: true, conditionVariableId: null, conditionText: '', rewardVariableId: null, conditionalRewardVariableId: null },
      { id: 'npc-1', type: 'old-mage', name: 'Old', text: '', textKey: null, roomIndex: 0, x: 1, y: 1, initialX: 1, initialY: 1, initialRoomIndex: 0, placed: true, conditionVariableId: null, conditionText: '', rewardVariableId: null, conditionalRewardVariableId: null },
      { id: 'npc-2', type: 'old-mage', name: 'Duplicate', text: '', textKey: null, roomIndex: 1, x: 2, y: 2, initialX: 2, initialY: 2, initialRoomIndex: 1, placed: true, conditionVariableId: null, conditionText: '', rewardVariableId: null, conditionalRewardVariableId: null },
    ];

    const gameState = makeGameState(sprites);
    const manager = new NPCManager(gameState as unknown as ConstructorParameters<typeof NPCManager>[0]);

    const normalized = manager.ensureDefaultNPCs();

    // Should keep only valid placed NPCs (no unplaced defaults created)
    expect(normalized.length).toBe(2); // Invalid removed, 2 old-mages kept
    expect(normalized.filter((npc) => npc.type === 'old-mage').length).toBe(2); // Allows duplicates
    expect(normalized.some((npc) => npc.type === 'invalid')).toBe(false); // Invalid removed
  });

  it('creates new NPC instances (allows multiple per type)', () => {
    const gameState = makeGameState([]);
    const manager = new NPCManager(gameState as unknown as ConstructorParameters<typeof NPCManager>[0]);

    const id1 = manager.addNPC({ type: 'old-mage', placed: true, x: 2, y: 3, roomIndex: 0 });

    expect(id1).toBeTruthy();
    if (!id1) {
      throw new Error('Expected NPC id to be assigned.');
    }
    expect(manager.getNPCs().length).toBe(1);

    // Adding same type again creates a NEW instance (not update)
    const id2 = manager.addNPC({ type: 'old-mage', text: 'Custom', textKey: null, roomIndex: 1 });

    expect(id2).toBeTruthy();
    expect(id2).not.toBe(id1); // Different IDs
    expect(manager.getNPCs().length).toBe(2); // 2 instances now
    expect(manager.getNPC(id1)?.text).toBe('I guard old secrets.'); // Original unchanged
    expect(manager.getNPC(id2)?.text).toBe('Custom'); // New one has custom text
  });

  it('clamps NPC positions and updates initial values', () => {
    const gameState = makeGameState([]);
    const manager = new NPCManager(gameState as unknown as ConstructorParameters<typeof NPCManager>[0]);
    const id = manager.addNPC({ type: 'old-mage', placed: true, x: 2, y: 3, roomIndex: 0 });
    if (!id) {
      throw new Error('Expected NPC id to be assigned.');
    }

    // Test clamping within the same room (don't attempt room change)
    manager.setNPCPosition(id, 99, -5, 0);

    const npc = manager.getNPC(id);
    expect(npc?.x).toBe(7);
    expect(npc?.y).toBe(0);
    expect(npc?.roomIndex).toBe(0);
    expect(npc?.initialX).toBe(7);
    expect(npc?.initialY).toBe(0);
  });

  it('updates NPC dialog with string or object input', () => {
    const gameState = makeGameState([]);
    const manager = new NPCManager(gameState as unknown as ConstructorParameters<typeof NPCManager>[0]);
    const id = manager.addNPC({ type: 'old-mage', placed: true });
    if (!id) {
      throw new Error('Expected NPC id to be assigned.');
    }

    manager.updateNPCDialog(id, 'Hello');
    expect(manager.getNPC(id)?.text).toBe('I guard old secrets.');

    manager.updateNPCDialog(id, { text: 'Hello', textKey: null });
    expect(manager.getNPC(id)?.text).toBe('Hello');

    manager.updateNPCDialog(id, { conditionVariableId: 'var-1', conditionText: 'Alt' });
    expect(gameState.normalizeVariableId).toHaveBeenCalledWith('var-1');
    expect(manager.getNPC(id)?.conditionVariableId).toBe('var-1');
    expect(manager.getNPC(id)?.conditionText).toBe('Alt');
  });
});
