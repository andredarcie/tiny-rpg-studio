import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../runtime/domain/GameState';

describe('GameState', () => {
  it('initializes core defaults and clamps current room', () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
      addEventListener: vi.fn(),
    } as unknown as Document;

    try {
      const state = new GameState();
      const game = state.getGame();

      expect(game.title).toBe('My Tiny RPG Game');
      expect(game.rooms.length).toBe(9);
      expect(state.getPlayer()?.x).toBe(1);

      state.getState().player.roomIndex = 999;
      const currentRoom = state.getCurrentRoom();
      expect(currentRoom).toBe(game.rooms[game.rooms.length - 1]);
    } finally {
      globalThis.document = originalDocument as Document;
    }
  });

  describe('resetGame (freeze bug fixes)', () => {
    let originalDocument: Document;

    beforeEach(() => {
      originalDocument = globalThis.document;
      globalThis.document = { addEventListener: vi.fn() } as unknown as Document;
    });

    afterEach(() => {
      globalThis.document = originalDocument;
    });

    it('clears ALL pause reasons so playing is true after reset', () => {
      const state = new GameState();

      // Simulate multiple pause reasons that could accumulate during combat + level up
      state.pauseGame('level-up');
      state.pauseGame('player-death');
      state.pauseGame('level-up-celebration');
      expect(state.playing).toBe(false);

      state.resetGame();

      // After reset, game must be fully unpaused (playing = true)
      // so the player can walk and enemies can move
      expect(state.playing).toBe(true);
    });

    it('clears orphaned level-up-celebration pause reason (main freeze cause)', () => {
      const state = new GameState();

      // This happens when player levels up during combat and resets before dismissing
      state.pauseGame('level-up-celebration');
      expect(state.playing).toBe(false);

      state.resetGame();

      expect(state.playing).toBe(true);
    });

    it('clears orphaned level-up pause reason on reset', () => {
      const state = new GameState();

      // This happens when level-up skill selection overlay was active during reset
      state.pauseGame('level-up');
      expect(state.playing).toBe(false);

      state.resetGame();

      expect(state.playing).toBe(true);
    });

    it('clears any unknown orphaned pause reasons on reset', () => {
      const state = new GameState();

      // Simulate an unexpected pause reason (defensive - should not happen but could)
      state.pauseGame('some-future-feature');
      expect(state.playing).toBe(false);

      state.resetGame();

      expect(state.playing).toBe(true);
    });

    it('runs the level-up presentation hook when an overlay starts directly', () => {
      const state = new GameState();
      const sync = vi.fn();
      state.setLevelUpOverlayPresentationSync(sync);

      state.queueLevelUpChoices(1, 2);

      expect(sync).toHaveBeenCalledTimes(1);
      expect(state.isLevelUpOverlayActive()).toBe(true);
    });

    it('runs the level-up presentation hook after celebration resumes selection', () => {
      const state = new GameState();
      const sync = vi.fn();
      state.setLevelUpOverlayPresentationSync(sync);

      state.showLevelUpCelebration(2, { durationMs: 1000 });
      state.queueLevelUpChoices(1, 2);
      expect(sync).not.toHaveBeenCalled();

      state.hideLevelUpCelebration();

      expect(sync).toHaveBeenCalledTimes(1);
      expect(state.isLevelUpOverlayActive()).toBe(true);
    });

    it('clears npc read dialog variants from the current session on reset', () => {
      const state = new GameState();
      const gameStateWithNpcDialogs = state as unknown as {
        hasUnreadNpcDialog: (npcId: string, variantKey: string | null) => boolean;
        markNpcDialogAsRead: (npcId: string, variantKey: string | null) => void;
      };

      gameStateWithNpcDialogs.markNpcDialogAsRead('npc-1', 'default:Oi');
      expect(gameStateWithNpcDialogs.hasUnreadNpcDialog('npc-1', 'default:Oi')).toBe(false);

      state.resetGame();

      expect(gameStateWithNpcDialogs.hasUnreadNpcDialog('npc-1', 'default:Oi')).toBe(true);
    });
  });
});
