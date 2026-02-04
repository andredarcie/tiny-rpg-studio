import type { EnemyManager } from '../../runtime/services/engine/EnemyManager';
import { createMockGameState, type MockGameState } from './createMockGameState';

type EnemyManagerGameState = ConstructorParameters<typeof EnemyManager>[0];

/**
 * Creates a mock GameState for EnemyManager tests.
 * Uses the centralized mock factory to ensure type safety and completeness.
 */
export const createEnemyGameState = (
  overrides: Partial<MockGameState> = {}
): EnemyManagerGameState => {
  return createMockGameState(overrides) as EnemyManagerGameState;
};
