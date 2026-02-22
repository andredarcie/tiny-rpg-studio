import type { CombatManager } from '../../runtime/services/engine/CombatManager';
import { createMockGameState, type MockGameState } from './createMockGameState';

type CombatManagerGameState = ConstructorParameters<typeof CombatManager>[0];

/**
 * Creates a mock GameState for CombatManager tests.
 * Uses the centralized mock factory to ensure type safety and completeness.
 */
export const createCombatGameState = (
  overrides: Partial<MockGameState> = {}
): CombatManagerGameState => {
  return createMockGameState(overrides) as CombatManagerGameState;
};
