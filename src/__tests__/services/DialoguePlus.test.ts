import { describe, expect, it, vi } from 'vitest';
import { NPCManager } from '../../runtime/services/NPCManager';
import { InteractionManager } from '../../runtime/services/engine/InteractionManager';
import { createInteractionGameState } from '../helpers/createInteractionGameState';
import { DialogManager } from '../../runtime/services/engine/DialogManager';
import { shouldDrawUnreadNpcDialogMarker } from '../../runtime/adapters/renderer/RendererNpcDialogMarker';
import { dialoguePlusChoiceKey, dialoguePlusReadKey, type DialoguePlusNpc } from '../../runtime/domain/dialoguePlus';

describe('Dialogue+ integration', () => {
  it('normalizes blocks and preserves an empty authoritative array', () => {
    const gameState = {
      game: { rooms: [{}], sprites: [] },
      normalizeVariableId: (id: string | null) => id === 'var-1' ? id : null,
    };
    const manager = new NPCManager(gameState as never);
    const npc = manager.normalizeNPC({
      type: 'old-mage',
      dialoguePlus: [
        { id: 'one', kind: 'alternative', conditionVariableId: 'var-1', text: 'First', rewardVariableId: 'var-1', disappearAfterDialog: true },
        { id: 'one', kind: 'choice', prompt: 'Second' },
        { id: '', kind: 'alternative', text: 'Invalid' },
      ],
    });
    expect(npc.dialoguePlus).toHaveLength(1);
    expect(npc.dialoguePlus?.[0]).toMatchObject({ id: 'one', kind: 'alternative', text: 'First', disappearAfterDialog: true });
    expect(manager.normalizeNPC({ type: 'old-mage', dialoguePlus: [] }).dialoguePlus).toEqual([]);
  });

  it('shows one dialogue per interaction and advances when a reward is active', () => {
    const state = createInteractionGameState() as ReturnType<typeof createInteractionGameState> & {
      hasUnreadNpcDialog: (npcId: string, key: string | null) => boolean;
    };
    const active = new Set<string>();
    const read = new Set<string>();
    (state.isVariableOn as ReturnType<typeof vi.fn>).mockImplementation((id: string) => active.has(id));
    state.hasUnreadNpcDialog = (_npcId, key) => !key || !read.has(key);
    const dialogs: string[] = [];
    const dialog = {
      showDialog: vi.fn((text: string, meta?: Record<string, unknown>) => {
        dialogs.push(text);
        if (meta?.npcDialogVariantKey) read.add(meta.npcDialogVariantKey as string);
      }),
      showChoiceDialog: vi.fn((text: string, _options: unknown, meta?: Record<string, unknown>) => {
        dialogs.push(text);
        if (meta?.npcDialogVariantKey) read.add(meta.npcDialogVariantKey as string);
      }),
      setNextDialog: vi.fn(),
    };
    const manager = new InteractionManager(state, dialog);
    manager.setNpcDialogueSequence((npc) => npc.dialoguePlus);
    const npc = {
      id: 'npc-1', roomIndex: 0, x: 1, y: 1, text: 'Default', rewardVariableId: 'var-1',
      dialoguePlus: [
        { id: 'a', kind: 'alternative' as const, conditionVariableId: 'var-1', text: 'A', rewardVariableId: 'var-2', disappearAfterDialog: false },
        { id: 'b', kind: 'alternative' as const, conditionVariableId: 'var-2', text: 'B', rewardVariableId: null, disappearAfterDialog: false },
        { id: 'c', kind: 'choice' as const, prompt: 'C', yesText: 'Yes', noText: 'No', yesVariableId: null, noVariableId: null, disappearAfterDialog: false },
      ],
    };
    expect(manager.openNpcDialog(npc)).toBe(true);
    expect(dialogs).toEqual(['Default']);
    active.add('var-1');
    expect(manager.openNpcDialog(npc)).toBe(true);
    expect(dialogs).toEqual(['Default', 'A']);
    active.add('var-2');
    expect(manager.openNpcDialog(npc)).toBe(true);
    expect(dialogs).toEqual(['Default', 'A', 'B']);
    expect(manager.openNpcDialog(npc)).toBe(true);
    expect(dialogs).toEqual(['Default', 'A', 'B', 'C']);
    expect(dialog.setNextDialog).not.toHaveBeenCalled();
  });

  it('moves through unread active alternatives without replaying the default', () => {
    const state = createInteractionGameState() as ReturnType<typeof createInteractionGameState> & {
      hasUnreadNpcDialog: (npcId: string, key: string | null) => boolean;
    };
    const read = new Set<string>();
    (state.isVariableOn as ReturnType<typeof vi.fn>).mockReturnValue(true);
    state.hasUnreadNpcDialog = (_npcId, key) => !key || !read.has(key);
    const texts: string[] = [];
    const dialog = { showDialog: vi.fn((text: string, meta?: Record<string, unknown>) => {
      texts.push(text);
      read.add(meta?.npcDialogVariantKey as string);
    }) };
    const manager = new InteractionManager(state, dialog);
    manager.setNpcDialogueSequence(npc => npc.dialoguePlus);
    const npc = { id: 'npc-1', roomIndex: 0, x: 1, y: 1, text: 'Default', dialoguePlus: [
      { id: 'first', kind: 'alternative' as const, conditionVariableId: 'var-1', text: 'First', rewardVariableId: null, disappearAfterDialog: false },
      { id: 'second', kind: 'alternative' as const, conditionVariableId: 'var-2', text: 'Second', rewardVariableId: null, disappearAfterDialog: false },
    ] };
    manager.openNpcDialog(npc);
    manager.openNpcDialog(npc);
    manager.openNpcDialog(npc);
    expect(texts).toEqual(['First', 'Second', 'First']);
  });

  it('stops a reward-giving default after its reward is active', () => {
    const state = createInteractionGameState();
    (state.isVariableOn as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const dialog = { showDialog: vi.fn() };
    const manager = new InteractionManager(state, dialog);
    manager.setNpcDialogueSequence(npc => npc.dialoguePlus);
    expect(manager.openNpcDialog({ id: 'npc-1', roomIndex: 0, x: 1, y: 1,
      text: 'One time', rewardVariableId: 'var-1', dialoguePlus: [] })).toBe(false);
    expect(dialog.showDialog).not.toHaveBeenCalled();
  });

  it('waits for another interaction after a reward activates the next dialogue', () => {
    const variables = new Set<string>();
    const shown: string[] = [];
    let activeDialog = false;
    const state = {
      pauseGame: vi.fn(), resumeGame: vi.fn(),
      getDialog: () => ({ active: activeDialog }),
      setDialog: (active: boolean, text = '') => {
        activeDialog = active;
        if (active) shown.push(text);
      },
      setVariableValue: (id: string) => { variables.add(id); return [true, false]; },
      isVariableOn: (id: string) => variables.has(id),
      normalizeVariableId: (id: string | null) => id,
      hasUnreadNpcDialog: () => true,
    };
    const dialog = new DialogManager(state as never, { draw: vi.fn(), setIconOverPlayer: vi.fn() });
    const interaction = new InteractionManager(state as never, dialog);
    interaction.setNpcDialogueSequence(npc => npc.dialoguePlus);
    const npc = { id: 'npc-1', roomIndex: 0, x: 1, y: 1, text: 'Default', rewardVariableId: 'var-1', dialoguePlus: [
      { id: 'after', kind: 'alternative' as const, conditionVariableId: 'var-1', text: 'After', rewardVariableId: null, disappearAfterDialog: false },
    ] };
    interaction.openNpcDialog(npc);
    dialog.closeDialog();
    expect(variables.has('var-1')).toBe(true);
    expect(shown).toEqual(['Default']);
    interaction.openNpcDialog(npc);
    expect(shown).toEqual(['Default', 'After']);
  });

  it('locks choice blocks independently and clears the sequence after disappearance', () => {
    const markNpcChoiceAnswered = vi.fn();
    const state = {
      pauseGame: vi.fn(), resumeGame: vi.fn(), setDialog: vi.fn(),
      getDialog: vi.fn(() => ({ active: true, choice: { selectedIndex: 0, options: [
        { key: 'yes', label: 'Yes', text: '', rewardVariableId: null },
        { key: 'no', label: 'No', text: '', rewardVariableId: null },
      ] } })),
      markNpcChoiceAnswered,
    };
    const manager = new DialogManager(state as never, { draw: vi.fn(), setIconOverPlayer: vi.fn() });
    const next = vi.fn();
    const disappear = vi.fn();
    manager.onNpcDisappear = disappear;
    manager.showChoiceDialog('Choose', state.getDialog().choice.options as never, {
      npcId: 'npc-1', npcChoiceKey: dialoguePlusChoiceKey('npc-1', 'choice-a'), disappearNpcId: 'npc-1',
    });
    manager.setNextDialog(next);
    manager.confirmChoiceSelection();
    expect(markNpcChoiceAnswered).toHaveBeenCalledWith(dialoguePlusChoiceKey('npc-1', 'choice-a'));
    expect(markNpcChoiceAnswered).not.toHaveBeenCalledWith(dialoguePlusChoiceKey('npc-1', 'choice-b'));
    expect(disappear).toHaveBeenCalledWith('npc-1');
    expect(next).not.toHaveBeenCalled();
  });

  it('marks unread later blocks even when default text is empty', () => {
    const npc = {
      id: 'npc-1', text: '', dialoguePlus: [
        { id: 'first', kind: 'alternative' as const, text: 'First', conditionVariableId: 'var-1', rewardVariableId: null, disappearAfterDialog: false },
        { id: 'second', kind: 'choice' as const, prompt: 'Second', yesText: '', noText: '', yesVariableId: null, noVariableId: null, disappearAfterDialog: false },
      ],
    };
    const state = {
      npcDialogueSequence: (value: DialoguePlusNpc) => value.dialoguePlus,
      isVariableOn: () => true,
      normalizeVariableId: (id: string | null) => id,
      hasAnsweredChoice: () => false,
      hasUnreadNpcDialog: (_id: string, key: string | null) => key === dialoguePlusReadKey('second'),
    };
    expect(shouldDrawUnreadNpcDialogMarker(state, npc)).toBe(true);
    expect(shouldDrawUnreadNpcDialogMarker({ ...state, npcDialogueSequence: null }, npc)).toBe(false);
  });
});
