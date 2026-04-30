import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogManager } from '../../runtime/services/engine/DialogManager';

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
});
