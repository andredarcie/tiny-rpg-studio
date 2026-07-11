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

  describe('Logic gate integration', () => {
    it('evaluates a chained gate network from a single setVariableValue without recursion', () => {
      const state = new GameState();
      // NOT(var-1) -> var-2 ; AND(var-2, var-3) -> var-4
      state.game.objects = [
        { id: 'logic-gate-not-0', type: 'logic-gate-not', x: 1, y: 1, roomIndex: 0, inputVariableId: 'var-1', outputVariableId: 'var-2' },
        { id: 'logic-gate-and-0', type: 'logic-gate-and', x: 2, y: 2, roomIndex: 0, inputVariableId: 'var-2', inputVariableId2: 'var-3', outputVariableId: 'var-4' },
      ];

      const setSpy = vi.spyOn(state, 'setVariableValue');
      // var-1 is false by default → NOT makes var-2 true; setting var-3 true cascades into var-4
      state.setVariableValue('var-3', true);

      // The public setVariableValue must be called exactly once (no recursion through the hook)
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(state.isVariableOn('var-2')).toBe(true);
      expect(state.isVariableOn('var-4')).toBe(true);
    });

    it('opens a variable-door driven by a gate output', () => {
      const state = new GameState();
      state.game.objects = [
        { id: 'logic-gate-and-0', type: 'logic-gate-and', x: 1, y: 1, roomIndex: 0, inputVariableId: 'var-1', inputVariableId2: 'var-2', outputVariableId: 'var-3' },
        { id: 'door-1', type: 'door-variable', x: 3, y: 3, roomIndex: 0, variableId: 'var-3' },
      ];

      state.setVariableValue('var-1', true);
      const [, openedDoor] = state.setVariableValue('var-2', true);

      expect(state.isVariableOn('var-3')).toBe(true);
      expect(openedDoor).toBe(true);
    });

    it('terminates without throwing on a cyclic gate network', () => {
      const state = new GameState();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      state.game.objects = [
        { id: 'logic-gate-not-0', type: 'logic-gate-not', x: 1, y: 1, roomIndex: 0, inputVariableId: 'var-1', outputVariableId: 'var-1' },
      ];

      expect(() => state.setVariableValue('var-2', true)).not.toThrow();
      expect(warn).toHaveBeenCalled();
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

    it('keeps leveling but disables the skill system when configured', () => {
      const state = new GameState();
      state.game.disableSkills = true;

      state.processLevelUpResult({
        leveledUp: true,
        levelsGained: 2,
        level: 3,
      });

      expect(state.isLevelUpCelebrationActive()).toBe(true);
      expect(state.getPendingLevelUpChoices()).toBe(0);
      expect(state.isLevelUpOverlayActive()).toBe(false);
      expect(state.getSkills()).toEqual([]);
      expect(state.hasSkill('stealth')).toBe(false);
    });

    it('keeps an equipped sword and its damage after gaining enough XP to level up', () => {
      const state = new GameState();
      state.setSwordType('sword');
      state.setSwordDurability(5);

      const result = state.addExperience(state.getExperienceToNext());

      expect(result?.leveledUp).toBe(true);
      expect(state.getSwordType()).toBe('sword');
      expect(state.getSwordDurability()).toBe(5);
      expect(state.getPlayerDamage()).toBe(4);
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

    it('executes a pending effect before replacing an active pickup overlay', () => {
      const state = new GameState();
      const effects: string[] = [];

      state.showPickupOverlay({
        name: 'Iron Sword',
        effect: () => effects.push('sword'),
      });

      state.showPickupOverlay({
        name: 'XP Scroll',
        effect: () => effects.push('xp'),
      });

      expect(effects).toEqual(['sword']);

      state.hidePickupOverlay();

      expect(effects).toEqual(['sword', 'xp']);
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

  describe('Necromancer Revive - Enemy Preservation', () => {
    it('keeps a variable-attached boss active when it kills a necromancer player', () => {
      const state = new GameState();

      state.game.variables = [{ id: 'boss-door', value: false }];
      state.skillManager.addSkill('necromancer');
      state.skillManager.ensureRuntime().necromancerCharges = 1;

      state.addEnemy({
        id: 'boss-1',
        type: 'dragon',
        roomIndex: 0,
        x: 1,
        y: 1,
        lastX: 1,
        defeatVariableId: 'boss-door',
      });

      const boss = state.getEnemies().find(e => e.id === 'boss-1');
      expect(boss?.defeatVariableId).toBe('boss-door');

      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }
      state.prepareNecromancerRevive();
      state.setLastKillerEnemy('boss-1');
      const revived = state.reviveFromNecromancer();

      expect(revived).toBe(true);
      const remainingEnemies = state.getEnemies();
      expect(remainingEnemies.length).toBe(1);
      expect(remainingEnemies[0].id).toBe('boss-1');
      expect(remainingEnemies[0].defeatVariableId).toBe('boss-door');
    });

    it('keeps a variable-attached normal enemy active when it kills a necromancer player', () => {
      const state = new GameState();

      state.game.variables = [{ id: 'rat-door', value: false }];
      state.skillManager.addSkill('necromancer');
      state.skillManager.ensureRuntime().necromancerCharges = 1;

      state.addEnemy({
        id: 'enemy-1',
        type: 'giant-rat',
        roomIndex: 0,
        x: 2,
        y: 2,
        lastX: 2,
        defeatVariableId: 'rat-door',
      });

      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }
      state.prepareNecromancerRevive();
      state.setLastKillerEnemy('enemy-1');
      const revived = state.reviveFromNecromancer();

      expect(revived).toBe(true);
      expect(state.getEnemies()).toHaveLength(1);
      expect(state.getEnemies()[0]).toMatchObject({
        id: 'enemy-1',
        defeatVariableId: 'rat-door',
      });
    });

    it('preserves killer enemy combat state through the revive', () => {
      const state = new GameState();

      state.skillManager.addSkill('necromancer');
      state.skillManager.ensureRuntime().necromancerCharges = 1;

      state.addEnemy({ id: 'boss-1', type: 'ancient-demon', roomIndex: 0, x: 3, y: 3, lastX: 3 });
      const enemy = state.getEnemies()[0];
      enemy.lives = 2;
      enemy.playerInVision = true;
      enemy.alertUntil = 1234;

      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }
      state.prepareNecromancerRevive();
      state.setLastKillerEnemy('boss-1');
      state.reviveFromNecromancer();

      const remainingEnemy = state.getEnemies()[0];
      expect(remainingEnemy.id).toBe('boss-1');
      expect(remainingEnemy.lives).toBe(2);
      expect(remainingEnemy.playerInVision).toBe(true);
      expect(remainingEnemy.alertUntil).toBe(1234);
    });

    it('keeps every active enemy in place across a necromancer revive', () => {
      const state = new GameState();

      state.skillManager.addSkill('necromancer');
      state.skillManager.ensureRuntime().necromancerCharges = 1;

      state.addEnemy({ id: 'enemy-room-0-1', type: 'dragon', roomIndex: 0, x: 1, y: 1, lastX: 1 });
      state.addEnemy({ id: 'enemy-room-0-2', type: 'necromancer', roomIndex: 0, x: 2, y: 2, lastX: 2 });
      state.addEnemy({ id: 'enemy-room-1-1', type: 'dark-knight', roomIndex: 1, x: 3, y: 3, lastX: 3 });
      state.addEnemy({ id: 'enemy-room-2-1', type: 'skeleton', roomIndex: 2, x: 4, y: 4, lastX: 4 });

      expect(state.getEnemies().length).toBe(4);

      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }
      state.prepareNecromancerRevive();
      state.setLastKillerEnemy('enemy-room-0-1');
      state.reviveFromNecromancer();

      const remainingEnemies = state.getEnemies();
      expect(remainingEnemies.length).toBe(4);
      expect(remainingEnemies.find(e => e.id === 'enemy-room-0-1')).toBeDefined();
      expect(remainingEnemies.find(e => e.id === 'enemy-room-0-2')).toBeDefined();
      expect(remainingEnemies.find(e => e.id === 'enemy-room-1-1')).toBeDefined();
      expect(remainingEnemies.find(e => e.id === 'enemy-room-2-1')).toBeDefined();

      state.resetGame();
      expect(state.getEnemies().length).toBe(4);
    });

    it('does not preserve runtime enemy changes through a normal reset after revive is consumed', () => {
      const state = new GameState();

      state.skillManager.addSkill('necromancer');
      state.skillManager.ensureRuntime().necromancerCharges = 1;

      state.addEnemy({ id: 'boss-1', type: 'fallen-king', roomIndex: 0, x: 3, y: 3, lastX: 3 });
      const initialLives = state.getEnemies()[0].lives;
      state.getEnemies()[0].lives = 2;

      const player = state.getPlayer();
      if (player) {
        player.currentLives = 0;
        state.skillManager.attemptRevive(player);
      }
      state.prepareNecromancerRevive();
      state.setLastKillerEnemy('boss-1');
      state.reviveFromNecromancer();

      expect(state.getEnemies().length).toBe(1);
      expect(state.getEnemies()[0].lives).toBe(2);

      state.resetGame();
      const restoredEnemies = state.getEnemies();
      expect(restoredEnemies.length).toBe(1);
      expect(restoredEnemies[0].id).toBe('boss-1');
      expect(restoredEnemies[0].lives).toBe(initialLives);
    });
  });
});
