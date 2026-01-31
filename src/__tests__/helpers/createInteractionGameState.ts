import type { InteractionManager } from '../../runtime/services/engine/InteractionManager';
import { createMockGameState, type MockGameState } from './createMockGameState';

type InteractionManagerGameState = ConstructorParameters<typeof InteractionManager>[0];

/**
 * Creates a mock GameState for InteractionManager tests.
 * Uses the centralized mock factory to ensure type safety and completeness.
 */
export const createInteractionGameState = (
  overrides: Partial<MockGameState> = {}
): InteractionManagerGameState => {
  return createMockGameState(overrides) as InteractionManagerGameState;
};
