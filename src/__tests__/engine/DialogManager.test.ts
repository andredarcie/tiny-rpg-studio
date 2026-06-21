import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogManager } from '../../runtime/services/engine/DialogManager';
import type { DialogChoiceOption, DialogChoiceState } from '../../types/gameState';

describe('DialogManager', () => {
  const pauseGame = vi.fn();
  const resumeGame = vi.fn();
  const setDialog = vi.fn();
  const setVariableValue = vi.fn();
  const getDialog = vi.fn(() => ({ active: true }));
  const renderer = {
    draw: vi.fn(),
    setIconOverPlayer: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows dialog and pauses with a default reason', () => {
    const manager = new DialogManager(
      { pauseGame, resumeGame, setDialog, getDialog, setVariableValue },
      renderer,
    );

    manager.showDialog('hello');

    expect(pauseGame).toHaveBeenCalledWith('dialog');
    expect(setDialog).toHaveBeenCalledWith(true, 'hello', null);
  });

  it('completes dialog rewards and sets door icon', () => {
    const manager = new DialogManager(
      { pauseGame, resumeGame, setDialog, getDialog, setVariableValue },
      renderer,
    );
    setVariableValue.mockReturnValue([true, true]);

    manager.showDialog('hi', { setVariableId: 'var-1', rewardAllowed: true });
    manager.completeDialog();

    expect(setVariableValue).toHaveBeenCalledWith('var-1', true);
    expect(renderer.setIconOverPlayer).toHaveBeenCalledWith('door-variable');
  });

  it('marks npc dialog variant as read when dialog starts', () => {
    const markNpcDialogAsRead = vi.fn();
    const manager = new DialogManager(
      {
        pauseGame,
        resumeGame,
        setDialog,
        getDialog,
        setVariableValue,
        markNpcDialogAsRead,
      } as unknown as ConstructorParameters<typeof DialogManager>[0],
      renderer,
    );

    manager.showDialog('hi', {
      npcId: 'npc-1',
      npcDialogVariantKey: 'default:hi',
    } as never);

    expect(markNpcDialogAsRead).toHaveBeenCalledWith('npc-1', 'default:hi');
  });

  it('keeps reward behavior while also marking npc dialog variant as read', () => {
    const markNpcDialogAsRead = vi.fn();
    const manager = new DialogManager(
      {
        pauseGame,
        resumeGame,
        setDialog,
        getDialog,
        setVariableValue,
        markNpcDialogAsRead,
      } as unknown as ConstructorParameters<typeof DialogManager>[0],
      renderer,
    );
    setVariableValue.mockReturnValue([true, true]);

    manager.showDialog('hi', {
      setVariableId: 'var-1',
      rewardAllowed: true,
      npcId: 'npc-9',
      npcDialogVariantKey: 'conditional:var-1:hi',
    } as never);

    expect(markNpcDialogAsRead).toHaveBeenCalledWith('npc-9', 'conditional:var-1:hi');

    manager.completeDialog();

    expect(setVariableValue).toHaveBeenCalledWith('var-1', true);
    expect(renderer.setIconOverPlayer).toHaveBeenCalledWith('door-variable');
  });

  it('closes dialog, resumes game, and redraws', () => {
    const manager = new DialogManager(
      { pauseGame, resumeGame, setDialog, getDialog, setVariableValue },
      renderer,
    );

    manager.showDialog('hi', { pauseReason: 'cutscene' });
    manager.closeDialog();

    expect(setDialog).toHaveBeenCalledWith(false);
    expect(resumeGame).toHaveBeenCalledWith('cutscene');
    expect(renderer.draw).toHaveBeenCalled();
  });

  it('does nothing when closing without an active dialog', () => {
    const manager = new DialogManager(
      {
        pauseGame,
        resumeGame,
        setDialog,
        getDialog: () => ({ active: false }),
        setVariableValue,
      },
      renderer,
    );

    manager.closeDialog();

    expect(resumeGame).not.toHaveBeenCalled();
    expect(renderer.draw).not.toHaveBeenCalled();
  });

  it('calls onNpcReward instead of setVariableValue when the callback is set', () => {
    const manager = new DialogManager(
      { pauseGame, resumeGame, setDialog, getDialog, setVariableValue },
      renderer,
    );
    const onNpcReward = vi.fn();
    manager.onNpcReward = onNpcReward;

    manager.showDialog('hi', { setVariableId: 'var-2', rewardAllowed: true });
    manager.completeDialog();

    expect(onNpcReward).toHaveBeenCalledWith('var-2', true);
    expect(setVariableValue).not.toHaveBeenCalled();
  });

  it('falls back to setVariableValue when onNpcReward is not set', () => {
    const manager = new DialogManager(
      { pauseGame, resumeGame, setDialog, getDialog, setVariableValue },
      renderer,
    );
    setVariableValue.mockReturnValue([true, false]);

    manager.showDialog('hi', { setVariableId: 'var-3', rewardAllowed: true });
    manager.completeDialog();

    expect(setVariableValue).toHaveBeenCalledWith('var-3', true);
  });

  it('runs a queued follow-up dialog once after closing', () => {
    const manager = new DialogManager(
      { pauseGame, resumeGame, setDialog, getDialog, setVariableValue },
      renderer,
    );
    const followUp = vi.fn();

    manager.showDialog('first');
    manager.setNextDialog(followUp);
    manager.closeDialog();
    expect(followUp).toHaveBeenCalledTimes(1);

    // The follow-up is cleared, so a subsequent close does not re-run it.
    manager.closeDialog();
    expect(followUp).toHaveBeenCalledTimes(1);
  });
});

describe('DialogManager — choice dialog', () => {
  function makeChoiceGameState() {
    const dialog: { active: boolean; text: string; choice: DialogChoiceState | null } = {
      active: false,
      text: '',
      choice: null,
    };
    const api = {
      pauseGame: vi.fn(),
      resumeGame: vi.fn(),
      setVariableValue: vi.fn(() => [true, false] as [boolean, boolean]),
      markNpcDialogAsRead: vi.fn(),
      markNpcChoiceAnswered: vi.fn(),
      getDialog: () => dialog,
      setDialog: vi.fn((active: boolean, text: string = '') => {
        dialog.active = active;
        dialog.text = active ? text : '';
        if (!active) dialog.choice = null;
      }),
      setDialogChoice: vi.fn((choice: DialogChoiceState | null) => {
        dialog.choice = choice;
      }),
      setChoicePhase: vi.fn((phase: DialogChoiceState['phase']) => {
        if (dialog.choice) dialog.choice.phase = phase;
      }),
      setChoiceSelection: vi.fn((index: number) => {
        if (dialog.choice) dialog.choice.selectedIndex = index;
      }),
    };
    return { api, dialog };
  }

  const renderer = { draw: vi.fn(), setIconOverPlayer: vi.fn() };
  const options: DialogChoiceOption[] = [
    { key: 'yes', label: 'Yes', text: 'Great!', rewardVariableId: 'var-3' },
    { key: 'no', label: 'No', text: '', rewardVariableId: 'var-5' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a choice dialog in the prompt phase', () => {
    const { api } = makeChoiceGameState();
    const manager = new DialogManager(api as unknown as ConstructorParameters<typeof DialogManager>[0], renderer);

    manager.showChoiceDialog('Accept?', options, { npcId: 'npc-1', npcDialogVariantKey: 'choice:Accept?' });

    expect(api.pauseGame).toHaveBeenCalledWith('dialog');
    expect(api.setDialog).toHaveBeenCalledWith(true, 'Accept?', expect.objectContaining({ npcId: 'npc-1' }));
    expect(api.markNpcDialogAsRead).toHaveBeenCalledWith('npc-1', 'choice:Accept?');
    expect(api.setDialogChoice).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'prompt', selectedIndex: 0, options }),
    );
  });

  it('confirming a branch with text switches to the branch message and arms the reward', () => {
    const { api, dialog } = makeChoiceGameState();
    const manager = new DialogManager(api as unknown as ConstructorParameters<typeof DialogManager>[0], renderer);

    manager.showChoiceDialog('Accept?', options, { npcId: 'npc-1' });
    api.setChoiceSelection(0); // Yes (has text)
    manager.confirmChoiceSelection();

    // The choice locks for the playthrough as soon as it is confirmed.
    expect(api.markNpcChoiceAnswered).toHaveBeenCalledWith('npc-1');
    expect(api.setDialog).toHaveBeenLastCalledWith(true, 'Great!', expect.objectContaining({ setVariableId: 'var-3' }));
    expect(dialog.choice?.phase).toBe('branch');

    // The reward is applied only when the branch message closes.
    manager.completeDialog();
    expect(api.setVariableValue).toHaveBeenCalledWith('var-3', true);
  });

  it('confirming a branch with no text closes immediately and applies its reward', () => {
    const { api } = makeChoiceGameState();
    const manager = new DialogManager(api as unknown as ConstructorParameters<typeof DialogManager>[0], renderer);

    manager.showChoiceDialog('Accept?', options);
    api.setChoiceSelection(1); // No (empty text)
    manager.confirmChoiceSelection();

    expect(api.setVariableValue).toHaveBeenCalledWith('var-5', true);
    expect(api.setDialog).toHaveBeenLastCalledWith(false);
    expect(api.resumeGame).toHaveBeenCalled();
  });

  it('forwards the branch reward via onNpcReward in guest mode', () => {
    const { api } = makeChoiceGameState();
    const manager = new DialogManager(api as unknown as ConstructorParameters<typeof DialogManager>[0], renderer);
    const onNpcReward = vi.fn();
    manager.onNpcReward = onNpcReward;

    manager.showChoiceDialog('Accept?', options);
    api.setChoiceSelection(1); // No (empty text -> closes immediately)
    manager.confirmChoiceSelection();

    expect(onNpcReward).toHaveBeenCalledWith('var-5', true);
    expect(api.setVariableValue).not.toHaveBeenCalled();
  });
});
