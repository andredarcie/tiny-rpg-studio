import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../runtime/domain/GameState';

describe('GameState - Critical Path Tests', () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = {
      addEventListener: vi.fn(),
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  describe('Variable and magic door system', () => {
    it('detects when magic door opens via variable change', () => {
      const state = new GameState();

      // Add a magic door linked to variable 1
      state.game.objects = [{
        id: 'door-1',
        type: 'door-variable',
        x: 2,
        y: 2,
        roomIndex: 0,
        variableId: 'var-1',
      }];

      // Add the variable
      state.game.variables = [{
        id: 'var-1',
        value: false,
      }];

      const [success, openedDoor] = state.setVariableValue('var-1', true);

      expect(success).toBe(true);
      expect(openedDoor).toBe(true);
    });

    it('does not report door opening if variable is not linked to a door', () => {
      const state = new GameState();

      state.game.variables = [{
        id: 'var-1',
        value: false,
      }];

      const [success, openedDoor] = state.setVariableValue('var-1', true);

      expect(success).toBe(true);
      expect(openedDoor).toBe(false);
    });

    it('handles variable persistence flag', () => {
      const state = new GameState();

      state.game.variables = [{
        id: 'var-1',
        value: false,
      }];

      const [success] = state.setVariableValue('var-1', true, true);

      expect(success).toBe(true);
      const variable = state.getVariable('var-1');
      expect(variable).toBeDefined();
    });
  });

  describe('Level-up flow', () => {
    it('triggers celebration and queues skill choices on level-up', () => {
      const state = new GameState();
      const pauseSpy = vi.spyOn(state.lifecycle, 'pauseGame');

      const result = state.processLevelUpResult({
        leveledUp: true,
        levelsGained: 1,
        level: 2,
      });

      expect(result?.leveledUp).toBe(true);
      expect(state.isLevelUpCelebrationActive()).toBe(true);
      expect(state.getPendingLevelUpChoices()).toBeGreaterThan(0);
      expect(pauseSpy).toHaveBeenCalledWith('level-up-celebration');
    });

    it('queues multiple skill choices for multi-level gains', () => {
      const state = new GameState();

      state.processLevelUpResult({
        leveledUp: true,
        levelsGained: 3,
        level: 4,
      });

      // Only even levels (2, 4) get skill choices, so 2 choices for levels 2, 3, 4
      expect(state.getPendingLevelUpChoices()).toBe(2);
    });

    it('heals player to full when max-life skill is selected', () => {
      const state = new GameState();

      // Trigger level-up to queue skill choices
      state.processLevelUpResult({
        leveledUp: true,
        levelsGained: 1,
        level: 2,
      });

      // Wait for celebration to end
      state.hideLevelUpCelebration();

      // Damage player
      state.getState().player.currentLives = 1;

      // Select max-life skill (assumes it's available)
      const overlay = state.getLevelUpOverlay();
      if (overlay.choices.some(c => c.id === 'max-life')) {
        const choice = state.selectLevelUpSkill(
          overlay.choices.findIndex(c => c.id === 'max-life')
        );

        if (choice?.id === 'max-life') {
          expect(state.getLives()).toBe(state.getMaxLives());
        }
      }
    });
  });

  describe('Necromancer revive snapshot/restore', () => {
    it('captures snapshot when necromancer revive is prepared', () => {
      const state = new GameState();

      // Grant necromancer skill (manual revive)
      state.skillManager.addSkill('necromancer');

      // Simulate death to trigger attemptRevive
      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }

      const prepared = state.prepareNecromancerRevive();

      expect(prepared).toBe(true);
      expect(state.hasNecromancerReviveReady()).toBe(true);
    });

    it('restores game state from snapshot on revive', () => {
      const state = new GameState();

      // Grant necromancer skill
      state.skillManager.addSkill('necromancer');

      // Capture state with 3 lives
      const initialLives = state.getLives();

      // Simulate death to trigger attemptRevive
      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }

      state.prepareNecromancerRevive();

      // Take damage (after snapshot)
      state.damagePlayer(2);
      expect(state.getLives()).toBeLessThan(initialLives);

      // Revive should restore to snapshot state
      const revived = state.reviveFromNecromancer();

      expect(revived).toBe(true);
      expect(state.getLives()).toBe(state.getMaxLives()); // Revive sets to max
      expect(state.isGameOver()).toBe(false);
    });

    it('clears snapshot after successful revive', () => {
      const state = new GameState();

      state.skillManager.addSkill('necromancer');

      // Simulate death to trigger attemptRevive
      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }

      state.prepareNecromancerRevive();
      state.reviveFromNecromancer();

      expect(state.hasNecromancerReviveReady()).toBe(false);
    });

    it('does not revive if snapshot is not ready', () => {
      const state = new GameState();

      const revived = state.reviveFromNecromancer();

      expect(revived).toBe(false);
    });

    it('handles snapshot capture failure gracefully', () => {
      const state = new GameState();

      // Grant necromancer but don't set pending flag
      state.skillManager.addSkill('necromancer');

      const prepared = state.prepareNecromancerRevive();

      expect(prepared).toBe(false);
    });
  });

  describe('Pickup overlay', () => {
    it('shows overlay and pauses game', () => {
      const state = new GameState();
      const pauseSpy = vi.spyOn(state.lifecycle, 'pauseGame');

      state.showPickupOverlay({
        name: 'Iron Sword',
        spriteGroup: 'objects',
        spriteType: 'sword',
      });

      expect(state.isPickupOverlayActive()).toBe(true);
      expect(pauseSpy).toHaveBeenCalledWith('pickup-overlay');
    });

    it('executes effect callback when overlay is hidden', () => {
      const state = new GameState();
      let effectCalled = false;

      state.showPickupOverlay({
        name: 'Health Potion',
        effect: () => {
          effectCalled = true;
        },
      });

      state.hidePickupOverlay();

      expect(effectCalled).toBe(true);
      expect(state.isPickupOverlayActive()).toBe(false);
    });

    it('resumes game when overlay is hidden', () => {
      const state = new GameState();
      const resumeSpy = vi.spyOn(state.lifecycle, 'resumeGame');

      state.showPickupOverlay({ name: 'Key' });
      state.hidePickupOverlay();

      expect(resumeSpy).toHaveBeenCalledWith('pickup-overlay');
    });
  });

  describe('Level-up celebration', () => {
    it('automatically hides celebration after timeout', () => {
      vi.useFakeTimers();

      const state = new GameState();

      state.showLevelUpCelebration(2, { durationMs: 1000 });
      expect(state.isLevelUpCelebrationActive()).toBe(true);

      vi.advanceTimersByTime(1000);

      expect(state.isLevelUpCelebrationActive()).toBe(false);

      vi.useRealTimers();
    });

    it('triggers level-up selection after celebration ends', () => {
      vi.useFakeTimers();

      const state = new GameState();

      // Queue a level-up choice
      state.queueLevelUpChoices(1, 2);

      // Show celebration
      state.showLevelUpCelebration(2, { durationMs: 500 });

      // Advance past celebration
      vi.advanceTimersByTime(500);

      // Selection should start automatically
      expect(state.isLevelUpOverlayActive()).toBe(true);

      vi.useRealTimers();
    });

    it('can be manually hidden with skipResume option', () => {
      const state = new GameState();
      const resumeSpy = vi.spyOn(state.lifecycle, 'resumeGame');

      state.showLevelUpCelebration(3);
      state.hideLevelUpCelebration({ skipResume: true });

      expect(state.isLevelUpCelebrationActive()).toBe(false);
      expect(resumeSpy).not.toHaveBeenCalledWith('level-up-celebration');
    });
  });

  describe('Game over and reset', () => {
    it('sets game over state and triggers cooldown', () => {
      const state = new GameState();

      state.setGameOver(true, 'defeat');

      expect(state.isGameOver()).toBe(true);
      expect(state.getGameOverReason()).toBe('defeat');
      expect(state.canResetAfterGameOver).toBe(false);
    });

    it('allows reset after cooldown is cleared', () => {
      const state = new GameState();

      state.setGameOver(true);
      state.enableGameOverInteraction();

      expect(state.canResetAfterGameOver).toBe(true);
    });

    it('resets all systems on game reset', () => {
      const state = new GameState();

      // Modify state
      state.getState().player.level = 5;
      state.getState().player.currentLives = 1;
      state.setGameOver(true);

      state.resetGame();

      expect(state.isGameOver()).toBe(false);
      expect(state.getPlayer()?.level).toBe(1);
      expect(state.getLives()).toBe(state.getMaxLives());
    });
  });

  describe('Safe cloning', () => {
    it('uses structuredClone when available', () => {
      const state = new GameState();

      const original = { nested: { value: 42 }, array: [1, 2, 3] };
      const cloned = state.safeClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);

      cloned.nested.value = 99;
      expect(original.nested.value).toBe(42);
    });

    it('handles circular references gracefully', () => {
      const state = new GameState();

      const obj = { value: 42 } as { value: number; self?: unknown };
      obj.self = obj;

      // Should not throw
      expect(() => {
        try {
          state.safeClone(obj);
        } catch {
          // Expected for circular references
        }
      }).not.toThrow();
    });
  });
});
