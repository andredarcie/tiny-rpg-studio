import { describe, it, expect, vi } from 'vitest';
import { CombatStateMachine, CombatState } from '../../runtime/services/engine/CombatStateMachine';

describe('CombatStateMachine', () => {
  describe('Initialization', () => {
    it('should start in IDLE state by default', () => {
      const sm = new CombatStateMachine();
      expect(sm.getState()).toBe(CombatState.IDLE);
      expect(sm.isInCombat()).toBe(false);
    });

    it('should allow custom initial state', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_WINDUP });
      expect(sm.getState()).toBe(CombatState.PLAYER_WINDUP);
      expect(sm.isInCombat()).toBe(true);
    });

    it('should initialize with empty context', () => {
      const sm = new CombatStateMachine();
      expect(sm.getContext()).toEqual({});
    });
  });

  describe('State Queries', () => {
    it('should correctly identify combat states', () => {
      const sm = new CombatStateMachine();
      expect(sm.isInCombat()).toBe(false);

      sm.transition(CombatState.PLAYER_WINDUP);
      expect(sm.isInCombat()).toBe(true);

      sm.transition(CombatState.PLAYER_ATTACKING);
      expect(sm.isInCombat()).toBe(true);

      sm.transition(CombatState.IDLE);
      expect(sm.isInCombat()).toBe(false);
    });

    it('should check specific states correctly', () => {
      const sm = new CombatStateMachine();
      expect(sm.isInState(CombatState.IDLE)).toBe(true);
      expect(sm.isInState(CombatState.PLAYER_WINDUP)).toBe(false);

      sm.transition(CombatState.PLAYER_WINDUP);
      expect(sm.isInState(CombatState.IDLE)).toBe(false);
      expect(sm.isInState(CombatState.PLAYER_WINDUP)).toBe(true);
    });
  });

  describe('Context Management', () => {
    it('should update context', () => {
      const sm = new CombatStateMachine();
      sm.updateContext({ enemyId: 'enemy-1', damage: 2 });
      expect(sm.getContext()).toEqual({ enemyId: 'enemy-1', damage: 2 });
    });

    it('should merge context updates', () => {
      const sm = new CombatStateMachine();
      sm.updateContext({ enemyId: 'enemy-1' });
      sm.updateContext({ damage: 2 });
      expect(sm.getContext()).toEqual({ enemyId: 'enemy-1', damage: 2 });
    });

    it('should clear context', () => {
      const sm = new CombatStateMachine();
      sm.updateContext({ enemyId: 'enemy-1', damage: 2 });
      sm.clearContext();
      expect(sm.getContext()).toEqual({});
    });

    it('should return readonly context', () => {
      const sm = new CombatStateMachine();
      sm.updateContext({ enemyId: 'enemy-1' });
      const ctx = sm.getContext();
      expect(ctx.enemyId).toBe('enemy-1');
      // Context should be a copy, not the original
      expect(ctx).not.toBe(sm.getContext());
    });
  });

  describe('Valid Transitions', () => {
    it('should allow IDLE → PLAYER_WINDUP', () => {
      const sm = new CombatStateMachine();
      expect(sm.transition(CombatState.PLAYER_WINDUP)).toBe(true);
      expect(sm.getState()).toBe(CombatState.PLAYER_WINDUP);
    });

    it('should allow IDLE → ENEMY_WINDUP', () => {
      const sm = new CombatStateMachine();
      expect(sm.transition(CombatState.ENEMY_WINDUP)).toBe(true);
      expect(sm.getState()).toBe(CombatState.ENEMY_WINDUP);
    });

    it('should allow PLAYER_WINDUP → PLAYER_ATTACKING', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_WINDUP });
      expect(sm.transition(CombatState.PLAYER_ATTACKING)).toBe(true);
      expect(sm.getState()).toBe(CombatState.PLAYER_ATTACKING);
    });

    it('should allow PLAYER_ATTACKING → ENEMY_WINDUP (counter-attack)', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_ATTACKING });
      expect(sm.transition(CombatState.ENEMY_WINDUP)).toBe(true);
      expect(sm.getState()).toBe(CombatState.ENEMY_WINDUP);
    });

    it('should allow PLAYER_ATTACKING → ENEMY_DEATH', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_ATTACKING });
      expect(sm.transition(CombatState.ENEMY_DEATH)).toBe(true);
      expect(sm.getState()).toBe(CombatState.ENEMY_DEATH);
    });

    it('should allow ENEMY_DEATH → IDLE', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.ENEMY_DEATH });
      expect(sm.transition(CombatState.IDLE)).toBe(true);
      expect(sm.getState()).toBe(CombatState.IDLE);
    });

    it('should allow ENEMY_ATTACKING → PLAYER_DEATH', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.ENEMY_ATTACKING });
      expect(sm.transition(CombatState.PLAYER_DEATH)).toBe(true);
      expect(sm.getState()).toBe(CombatState.PLAYER_DEATH);
    });
  });

  describe('Invalid Transitions', () => {
    it('should reject IDLE → PLAYER_ATTACKING (must go through WINDUP)', () => {
      const sm = new CombatStateMachine();
      expect(sm.transition(CombatState.PLAYER_ATTACKING)).toBe(false);
      expect(sm.getState()).toBe(CombatState.IDLE); // State unchanged
    });

    it('should reject PLAYER_WINDUP → ENEMY_DEATH', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_WINDUP });
      expect(sm.transition(CombatState.ENEMY_DEATH)).toBe(false);
      expect(sm.getState()).toBe(CombatState.PLAYER_WINDUP);
    });

    it('should reject PLAYER_DEATH → IDLE (no resurrection)', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_DEATH });
      expect(sm.transition(CombatState.IDLE)).toBe(false);
      expect(sm.getState()).toBe(CombatState.PLAYER_DEATH);
    });

    it('should reject any transition from PLAYER_DEATH', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_DEATH });
      expect(sm.transition(CombatState.IDLE)).toBe(false);
      expect(sm.transition(CombatState.PLAYER_WINDUP)).toBe(false);
      expect(sm.transition(CombatState.ENEMY_WINDUP)).toBe(false);
      expect(sm.getState()).toBe(CombatState.PLAYER_DEATH);
    });

    it('should include reason in invalid transition warning when provided', () => {
      const sm = new CombatStateMachine();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(sm.transition(CombatState.PLAYER_ATTACKING, 'skip windup')).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith(
        '[CombatStateMachine] Invalid transition: IDLE â†’ PLAYER_ATTACKING',
        '(skip windup)',
      );
      warnSpy.mockRestore();
    });
  });

  describe('Idempotent Transitions', () => {
    it('should allow same-state transitions', () => {
      const sm = new CombatStateMachine();
      expect(sm.transition(CombatState.IDLE)).toBe(true);
      expect(sm.getState()).toBe(CombatState.IDLE);

      sm.transition(CombatState.PLAYER_WINDUP);
      expect(sm.transition(CombatState.PLAYER_WINDUP)).toBe(true);
      expect(sm.getState()).toBe(CombatState.PLAYER_WINDUP);
    });
  });

  describe('State Callbacks', () => {
    it('should trigger callback on state change', () => {
      const callback = vi.fn();
      const sm = new CombatStateMachine({ onStateChange: callback });

      sm.transition(CombatState.PLAYER_WINDUP);
      expect(callback).toHaveBeenCalledWith(CombatState.IDLE, CombatState.PLAYER_WINDUP);
    });

    it('should not trigger callback on invalid transition', () => {
      const callback = vi.fn();
      const sm = new CombatStateMachine({ onStateChange: callback });

      sm.transition(CombatState.PLAYER_ATTACKING); // Invalid from IDLE
      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger callback multiple times', () => {
      const callback = vi.fn();
      const sm = new CombatStateMachine({ onStateChange: callback });

      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);
      sm.transition(CombatState.IDLE);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, CombatState.IDLE, CombatState.PLAYER_WINDUP);
      expect(callback).toHaveBeenNthCalledWith(2, CombatState.PLAYER_WINDUP, CombatState.PLAYER_ATTACKING);
      expect(callback).toHaveBeenNthCalledWith(3, CombatState.PLAYER_ATTACKING, CombatState.IDLE);
    });
  });

  describe('State History', () => {
    it('should record state transitions', () => {
      const sm = new CombatStateMachine();
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);

      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(CombatState.IDLE);
      expect(history[0].to).toBe(CombatState.PLAYER_WINDUP);
      expect(history[1].from).toBe(CombatState.PLAYER_WINDUP);
      expect(history[1].to).toBe(CombatState.PLAYER_ATTACKING);
    });

    it('should include timestamps in history', () => {
      const sm = new CombatStateMachine();
      const before = performance.now();
      sm.transition(CombatState.PLAYER_WINDUP);
      const after = performance.now();

      const history = sm.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should get recent history', () => {
      const sm = new CombatStateMachine();
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);
      sm.transition(CombatState.IDLE);
      sm.transition(CombatState.ENEMY_WINDUP);

      const recent = sm.getRecentHistory(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].to).toBe(CombatState.IDLE);
      expect(recent[1].to).toBe(CombatState.ENEMY_WINDUP);
    });

    it('should clear history', () => {
      const sm = new CombatStateMachine();
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);
      expect(sm.getHistory()).toHaveLength(2);

      sm.clearHistory();
      expect(sm.getHistory()).toHaveLength(0);
    });

    it('should limit history size', () => {
      const sm = new CombatStateMachine({ maxHistorySize: 3 });
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);
      sm.transition(CombatState.IDLE);
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);

      const history = sm.getHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Reset', () => {
    it('should reset to IDLE', () => {
      const sm = new CombatStateMachine();
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);
      sm.updateContext({ enemyId: 'enemy-1' });

      sm.reset('test reset');

      expect(sm.getState()).toBe(CombatState.IDLE);
      expect(sm.getContext()).toEqual({});
    });

    it('should trigger callback on reset', () => {
      const callback = vi.fn();
      const sm = new CombatStateMachine({ onStateChange: callback, initialState: CombatState.PLAYER_WINDUP });

      sm.reset();

      expect(callback).toHaveBeenCalledWith(CombatState.PLAYER_WINDUP, CombatState.IDLE);
    });

    it('should be idempotent when already IDLE', () => {
      const callback = vi.fn();
      const sm = new CombatStateMachine({ onStateChange: callback });

      sm.reset();

      expect(callback).not.toHaveBeenCalled();
      expect(sm.getState()).toBe(CombatState.IDLE);
    });
  });

  describe('Force Transition', () => {
    it('should allow any transition', () => {
      const sm = new CombatStateMachine();
      sm.forceTransition(CombatState.PLAYER_ATTACKING, 'test');
      expect(sm.getState()).toBe(CombatState.PLAYER_ATTACKING);
    });

    it('should trigger callback', () => {
      const callback = vi.fn();
      const sm = new CombatStateMachine({ onStateChange: callback });

      sm.forceTransition(CombatState.ENEMY_DEATH);

      expect(callback).toHaveBeenCalledWith(CombatState.IDLE, CombatState.ENEMY_DEATH);
    });

    it('should log force transition without reason', () => {
      const sm = new CombatStateMachine();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      sm.forceTransition(CombatState.ENEMY_ATTACKING);

      expect(warnSpy).toHaveBeenCalledWith(
        '[CombatStateMachine] Force transition: IDLE â†’ ENEMY_ATTACKING',
        '',
      );
      warnSpy.mockRestore();
    });
  });

  describe('Full Combat Flow', () => {
    it('should handle player-initiated combat flow', () => {
      const sm = new CombatStateMachine();

      // Player attacks
      expect(sm.transition(CombatState.PLAYER_WINDUP)).toBe(true);
      expect(sm.transition(CombatState.PLAYER_ATTACKING)).toBe(true);

      // Enemy counter-attacks
      expect(sm.transition(CombatState.ENEMY_WINDUP)).toBe(true);
      expect(sm.transition(CombatState.ENEMY_ATTACKING)).toBe(true);

      // Combat ends
      expect(sm.transition(CombatState.IDLE)).toBe(true);
    });

    it('should handle enemy-initiated combat flow', () => {
      const sm = new CombatStateMachine();

      // Enemy attacks first
      expect(sm.transition(CombatState.ENEMY_WINDUP)).toBe(true);
      expect(sm.transition(CombatState.ENEMY_ATTACKING)).toBe(true);

      // Player counter-attacks
      expect(sm.transition(CombatState.PLAYER_WINDUP)).toBe(true);
      expect(sm.transition(CombatState.PLAYER_ATTACKING)).toBe(true);

      // Combat ends
      expect(sm.transition(CombatState.IDLE)).toBe(true);
    });

    it('should handle enemy death', () => {
      const sm = new CombatStateMachine();

      // Player attacks
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);

      // Enemy dies (no counter-attack)
      expect(sm.transition(CombatState.ENEMY_DEATH)).toBe(true);

      // Death animation completes
      expect(sm.transition(CombatState.IDLE)).toBe(true);
    });

    it('should handle player death', () => {
      const sm = new CombatStateMachine();

      // Enemy attacks
      sm.transition(CombatState.ENEMY_WINDUP);
      sm.transition(CombatState.ENEMY_ATTACKING);

      // Player dies
      expect(sm.transition(CombatState.PLAYER_DEATH)).toBe(true);

      // No further transitions allowed
      expect(sm.transition(CombatState.IDLE)).toBe(false);
    });
  });

  describe('State Descriptions', () => {
    it('should provide human-readable descriptions', () => {
      const sm = new CombatStateMachine();
      expect(sm.getStateDescription(CombatState.IDLE)).toBe('No combat');
      expect(sm.getStateDescription(CombatState.PLAYER_WINDUP)).toBe('Player preparing attack');
      expect(sm.getStateDescription(CombatState.ENEMY_DEATH)).toBe('Enemy dying');
    });

    it('should describe current state when no argument', () => {
      const sm = new CombatStateMachine({ initialState: CombatState.PLAYER_ATTACKING });
      expect(sm.getStateDescription()).toBe('Player attacking');
    });

    it('should fall back to unknown for unsupported state values', () => {
      const sm = new CombatStateMachine();
      expect(sm.getStateDescription('NOPE' as unknown as CombatState)).toBe('Unknown state');
    });
  });

  describe('Debug Output', () => {
    it('prints grouped debug information with recent history', () => {
      const sm = new CombatStateMachine();
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sm.updateContext({ enemyId: 'e1', damage: 2 });
      sm.transition(CombatState.PLAYER_WINDUP);
      sm.transition(CombatState.PLAYER_ATTACKING);
      sm.transition(CombatState.IDLE);
      sm.debug();

      expect(groupSpy).toHaveBeenCalledWith('[CombatStateMachine] Debug Info');
      expect(logSpy).toHaveBeenCalledWith(
        'Current State:',
        CombatState.IDLE,
        '(No combat)',
      );
      expect(logSpy).toHaveBeenCalledWith('Context:', expect.objectContaining({ enemyId: 'e1', damage: 2 }));
      expect(logSpy).toHaveBeenCalledWith('Recent History (last 5):');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('IDLE â†’ PLAYER_WINDUP'));
      expect(groupEndSpy).toHaveBeenCalled();

      groupSpy.mockRestore();
      groupEndSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
