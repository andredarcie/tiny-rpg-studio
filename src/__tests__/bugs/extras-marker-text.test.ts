import { describe, expect, it, vi } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { NPCManager } from '../../runtime/services/NPCManager';
import { EditorNpcService } from '../../editor/modules/EditorNpcService';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';

describe('Extras marker dialogue independence', () => {
  it.each(['thought-bubble', 'wooden-sign'])('keeps %s text separate when editing and saving', (type) => {
    vi.useFakeTimers();
    try {
      const state = new GameState();
      const npcs = new NPCManager(state);
      const first = npcs.createNPC(type, 0);
      const second = npcs.createNPC(type, 1);
      if (!first || !second) throw Error('Missing Extras markers');
      npcs.setNPCPosition(first.id, 2, 2, 0);
      npcs.setNPCPosition(second.id, 3, 3, 1);
      const selection = { selectedNpcId: first.id };
      const service = new EditorNpcService({
        state: selection,
        gameEngine: { getSprites: () => npcs.getNPCs() },
        renderService: { renderNpcs: () => npcs.ensureDefaultNPCs() },
        updateJSON: vi.fn(),
        history: { pushCurrentState: vi.fn() },
      } as unknown as ConstructorParameters<typeof EditorNpcService>[0]);

      service.updateNpcText('First marker');
      selection.selectedNpcId = second.id;
      service.updateNpcText('Second marker');
      expect(npcs.getNPCs().map(npc => npc.text)).toEqual(['First marker', 'Second marker']);

      const saved = state.exportGameData();
      const restored = new GameState();
      restored.importGameData(JSON.parse(JSON.stringify(saved)));
      new NPCManager(restored).ensureDefaultNPCs();
      expect(restored.game.sprites.map(npc => npc.text)).toEqual(['First marker', 'Second marker']);

      const shared = ShareDecoder.decodeShareCode(ShareEncoder.buildShareCode(
        saved as Parameters<typeof ShareEncoder.buildShareCode>[0],
      )) as { sprites: { id: string; text: string }[] };
      expect(shared.sprites.map(npc => npc.text)).toEqual(['First marker', 'Second marker']);
      expect(shared.sprites.map(npc => npc.id)).toEqual([first.id, second.id]);
      const storedProject = ShareUtils.buildStoredProject(saved as Record<string, unknown>);
      const loadedProject = ShareUtils.readStoredProject(storedProject);
      expect(loadedProject).not.toBeNull();
      restored.importGameData(loadedProject);
      const restoredNpcs = new NPCManager(restored);
      restoredNpcs.ensureDefaultNPCs();
      const loadedSecond = restoredNpcs.getNPCs().find(npc => npc.roomIndex === 1);
      if (!loadedSecond) throw Error('Missing second marker after loading');
      const restoredService = new EditorNpcService({
        state: { selectedNpcId: loadedSecond.id },
        gameEngine: { getSprites: () => restoredNpcs.getNPCs() },
        renderService: { renderNpcs: () => restoredNpcs.ensureDefaultNPCs() },
        updateJSON: vi.fn(),
        history: { pushCurrentState: vi.fn() },
      } as unknown as ConstructorParameters<typeof EditorNpcService>[0]);
      restoredService.updateNpcText('Edited after loading');
      expect(restored.game.sprites.map(npc => npc.text)).toEqual(['First marker', 'Edited after loading']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('repairs duplicate saved IDs without replacing another marker identity or text', () => {
    const state = new GameState();
    state.importGameData({
      sprites: [
        { id: 'npc-1', type: 'thought-bubble', text: 'First', roomIndex: 0 },
        { id: 'npc-1', type: 'thought-bubble', text: 'Second', roomIndex: 1 },
        { id: 'npc-10000', type: 'wooden-sign', text: 'Sign', roomIndex: 0 },
      ],
    });
    const npcs = new NPCManager(state);
    npcs.ensureDefaultNPCs();
    const sprites = npcs.getNPCs();
    expect(new Set(sprites.map(npc => npc.id)).size).toBe(3);
    expect(sprites[0].id).toBe('npc-1');
    expect(sprites[2].id).toBe('npc-10000');
    npcs.updateNPC(sprites[1].id, { text: 'Edited second', textKey: null });
    expect(sprites.map(npc => npc.text)).toEqual(['First', 'Edited second', 'Sign']);
    const ids = sprites.map(npc => npc.id);
    npcs.ensureDefaultNPCs();
    expect(npcs.getNPCs().map(npc => npc.id)).toEqual(ids);
  });
});
