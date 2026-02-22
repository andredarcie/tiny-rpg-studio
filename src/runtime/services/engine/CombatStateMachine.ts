/**
 * CombatStateMachine - Manages combat flow through explicit states
 *
 * Benefits:
 * - Clear, predictable combat flow
 * - Easy to debug (state history tracking)
 * - Prevents invalid transitions
 * - Self-documenting (states are explicit)
 */

export const CombatState = {
  IDLE: 'IDLE',                           // No combat happening
  PLAYER_WINDUP: 'PLAYER_WINDUP',         // Player preparing attack (300ms)
  PLAYER_ATTACKING: 'PLAYER_ATTACKING',   // Player applying damage
  ENEMY_WINDUP: 'ENEMY_WINDUP',           // Enemy preparing attack (300ms)
  ENEMY_ATTACKING: 'ENEMY_ATTACKING',     // Enemy applying damage
  ENEMY_DEATH: 'ENEMY_DEATH',             // Enemy death animation (1000ms)
  PLAYER_DEATH: 'PLAYER_DEATH',           // Player death sequence (2500ms)
} as const;

export type CombatState = typeof CombatState[keyof typeof CombatState];

type StateTransition = {
  from: CombatState;
  to: CombatState;
  timestamp: number;
};

type StateChangeCallback = (from: CombatState, to: CombatState) => void;

type CombatContext = {
  enemyId?: string;
  enemyIndex?: number;
  initiator?: 'player' | 'enemy';
  damage?: number;
  playerDamage?: number;
  enemyAttackMissed?: boolean;
};

export class CombatStateMachine {
  private currentState: CombatState;
  private stateHistory: StateTransition[];
  private maxHistorySize: number;
  private onStateChange?: StateChangeCallback;
  private context: CombatContext;

  constructor(options: {
    initialState?: CombatState;
    maxHistorySize?: number;
    onStateChange?: StateChangeCallback;
  } = {}) {
    this.currentState = options.initialState ?? CombatState.IDLE;
    this.stateHistory = [];
    this.maxHistorySize = options.maxHistorySize ?? 50;
    this.onStateChange = options.onStateChange;
    this.context = {};
  }

  /**
   * Get current combat state
   */
  getState(): CombatState {
    return this.currentState;
  }

  /**
   * Check if currently in combat
   */
  isInCombat(): boolean {
    return this.currentState !== CombatState.IDLE;
  }

  /**
   * Check if in specific state
   */
  isInState(state: CombatState): boolean {
    return this.currentState === state;
  }

  /**
   * Get combat context (enemy info, damage, etc)
   */
  getContext(): Readonly<CombatContext> {
    return { ...this.context };
  }

  /**
   * Update combat context
   */
  updateContext(updates: Partial<CombatContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Clear combat context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Get state history (for debugging)
   */
  getHistory(): readonly StateTransition[] {
    return [...this.stateHistory];
  }

  /**
   * Get last N state transitions
   */
  getRecentHistory(count: number): readonly StateTransition[] {
    return this.stateHistory.slice(-count);
  }

  /**
   * Clear state history
   */
  clearHistory(): void {
    this.stateHistory = [];
  }

  /**
   * Transition to new state with validation
   */
  transition(to: CombatState, reason?: string): boolean {
    const from = this.currentState;

    // Validate transition
    if (!this.isValidTransition(from, to)) {
      console.warn(
        `[CombatStateMachine] Invalid transition: ${from} → ${to}`,
        reason ? `(${reason})` : ''
      );
      return false;
    }

    // Record transition
    this.recordTransition(from, to);

    // Update state
    this.currentState = to;

    // Trigger callback
    this.onStateChange?.(from, to);

    return true;
  }

  /**
   * Force transition (bypasses validation) - use with caution
   */
  forceTransition(to: CombatState, reason?: string): void {
    const from = this.currentState;
    console.warn(
      `[CombatStateMachine] Force transition: ${from} → ${to}`,
      reason ? `(${reason})` : ''
    );
    this.recordTransition(from, to);
    this.currentState = to;
    this.onStateChange?.(from, to);
  }

  /**
   * Reset to IDLE state (emergency reset)
   */
  reset(reason?: string): void {
    const from = this.currentState;
    if (from !== CombatState.IDLE) {
      console.log(
        `[CombatStateMachine] Reset to IDLE from ${from}`,
        reason ? `(${reason})` : ''
      );
      this.recordTransition(from, CombatState.IDLE);
      this.currentState = CombatState.IDLE;
      this.clearContext();
      this.onStateChange?.(from, CombatState.IDLE);
    }
  }

  /**
   * Validate if transition is allowed
   */
  private isValidTransition(from: CombatState, to: CombatState): boolean {
    // Same state is always valid (idempotent)
    if (from === to) return true;

    // Define valid transitions
    const validTransitions: Record<CombatState, CombatState[]> = {
      [CombatState.IDLE]: [
        CombatState.PLAYER_WINDUP,
        CombatState.ENEMY_WINDUP,
      ],
      [CombatState.PLAYER_WINDUP]: [
        CombatState.PLAYER_ATTACKING,
        CombatState.IDLE, // Cancel
      ],
      [CombatState.PLAYER_ATTACKING]: [
        CombatState.ENEMY_WINDUP,   // Enemy counter-attacks
        CombatState.ENEMY_DEATH,    // Enemy dies
        CombatState.IDLE,            // No counter-attack
      ],
      [CombatState.ENEMY_WINDUP]: [
        CombatState.ENEMY_ATTACKING,
        CombatState.IDLE, // Cancel
      ],
      [CombatState.ENEMY_ATTACKING]: [
        CombatState.PLAYER_WINDUP,  // Player counter-attacks
        CombatState.PLAYER_DEATH,   // Player dies
        CombatState.IDLE,            // No counter-attack
      ],
      [CombatState.ENEMY_DEATH]: [
        CombatState.IDLE, // Death animation complete
      ],
      [CombatState.PLAYER_DEATH]: [
        // No transitions from player death (game over)
      ],
    };

    const allowedStates = validTransitions[from];
    return allowedStates.includes(to);
  }

  /**
   * Record state transition in history
   */
  private recordTransition(from: CombatState, to: CombatState): void {
    this.stateHistory.push({
      from,
      to,
      timestamp: performance.now(),
    });

    // Trim history if too large
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get human-readable state description
   */
  getStateDescription(state?: CombatState): string {
    const s = state ?? this.currentState;
    const descriptions: Record<CombatState, string> = {
      [CombatState.IDLE]: 'No combat',
      [CombatState.PLAYER_WINDUP]: 'Player preparing attack',
      [CombatState.PLAYER_ATTACKING]: 'Player attacking',
      [CombatState.ENEMY_WINDUP]: 'Enemy preparing attack',
      [CombatState.ENEMY_ATTACKING]: 'Enemy attacking',
      [CombatState.ENEMY_DEATH]: 'Enemy dying',
      [CombatState.PLAYER_DEATH]: 'Player dying',
    };
    return descriptions[s] || 'Unknown state';
  }

  /**
   * Debug: Print current state and recent history
   */
  debug(): void {
    console.group('[CombatStateMachine] Debug Info');
    console.log('Current State:', this.currentState, `(${this.getStateDescription()})`);
    console.log('Context:', this.context);
    console.log('Recent History (last 5):');
    const recent = this.getRecentHistory(5);
    recent.forEach((t, i) => {
      const elapsed = i > 0 ? t.timestamp - recent[i - 1].timestamp : 0;
      console.log(`  ${t.from} → ${t.to} (+${elapsed.toFixed(0)}ms)`);
    });
    console.groupEnd();
  }
}
