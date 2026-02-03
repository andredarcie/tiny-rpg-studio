import { describe, it, expect } from 'vitest';
import { StateDialogManager } from '../../runtime/domain/state/StateDialogManager';
import type { RuntimeState } from '../../types/gameState';

describe('StateDialogManager', () => {
  it('returns defaults when state is missing', () => {
    const manager = new StateDialogManager(null);

    expect(manager.getDialog()).toEqual({
      active: false,
      text: '',
      page: 1,
      maxPages: 1,
      meta: null,
    });
  });

  it('sets and resets dialog values', () => {
    const state = {
      dialog: { active: false, text: '', page: 1, maxPages: 1, meta: null },
    } as RuntimeState;

    const manager = new StateDialogManager(state);

    manager.setDialog(true, 'hello');
    expect(state.dialog.active).toBe(true);
    expect(state.dialog.text).toBe('hello');
    expect(state.dialog.page).toBe(1);

    manager.setDialog(false);
    expect(state.dialog.active).toBe(false);
    expect(state.dialog.text).toBe('');
    expect(state.dialog.page).toBe(1);
  });

  it('clamps dialog pages', () => {
    const state = {
      dialog: { active: true, text: 'hi', page: 1, maxPages: 3, meta: null },
    } as RuntimeState;

    const manager = new StateDialogManager(state);

    manager.setPage(2.9);
    expect(state.dialog.page).toBe(2);

    manager.setPage(10);
    expect(state.dialog.page).toBe(3);

    manager.setPage(-5);
    expect(state.dialog.page).toBe(1);
  });
});
