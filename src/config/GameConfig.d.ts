/**
 * Centralized game configuration
 *
 * This file contains all constants and configurable values for the game runtime.
 * Uses GameConfigSchema for type safety and validation.
 */
import { GameConfigSchema } from './GameConfigSchema';
/**
 * Validated and immutable game configuration instance
 *
 * All values are validated at instantiation time to ensure correctness.
 */
export declare const GameConfig: GameConfigSchema;
/**
 * Type helper for game configuration
 */
export type GameConfigType = typeof GameConfig;
