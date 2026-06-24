import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyManager } from '../../runtime/services/engine/EnemyManager';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { TextResources } from '../../runtime/adapters/TextResources';
import { GameConfig } from '../../config/GameConfig';
import { createEnemyGameState } from '../helpers/createEnemyGameState';
import { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import { StateEnemyManager } from '../../runtime/domain/state/StateEnemyManager';
import type { GameDefinition, RuntimeState } from '../../types/gameState';

/**
 * Failing tests that prove three real bugs in the enemy subsystem.
 *
 * These tests encode the CORRECT / EXPECTED behavior, so they FAIL against the
 * current (buggy) production code and would PASS once each bug is fixed. They do
 * NOT modify or fix production source.
 */

// Shared stubs so EnemyManager / CombatManager use deterministic enemy data.
const baseEnemyDefinition = {
  type: 'rat',
  id: 'enemy-test',
  name: 'Test Enemy',
  nameKey: 'enemies.names.test',
  description: 'test',
  lives: 1,
  damage: 1,
  missChance: 0,
  experience: 1,
  hasEyes: true,
  sprite: [],
};

const renderer = {
  draw: vi.fn(),
  flashScreen: vi.fn(),
  showCombatIndicator: vi.fn(),
  spawnEnemyLifeLoss: vi.fn(),
  applyGrayscaleFilter: vi.fn(),
  removeGrayscaleFilter: vi.fn(),
};

const tileManager = {
  getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
  getTile: vi.fn(() => null),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(TextResources, 'get').mockImplementation((...args: unknown[]) => {
    const fallback = args[1] as string | undefined;
    return fallback || 'text';
  });
  vi.spyOn(TextResources, 'format').mockImplementation((...args: unknown[]) => {
    const fallback = args[2] as string | undefined;
    return fallback || 'text';
  });
  vi.spyOn(EnemyDefinitions, 'normalizeType').mockImplementation((type: string | null | undefined) => type ?? 'rat');
  vi.spyOn(EnemyDefinitions, 'getEnemyDefinition').mockImplementation(() => {
    const data = { ...baseEnemyDefinition };
    return {
      ...data,
      matchesType: (type: string) => data.type === type,
      getExperienceReward: () => data.experience,
      getMissChance: () => data.missChance,
      lives: data.lives,
    } as never;
  });
  vi.spyOn(EnemyDefinitions, 'getExperienceReward').mockImplementation(() => 1);
  vi.spyOn(EnemyDefinitions, 'getMissChance').mockImplementation(() => null);
});

describe('BUG A (CRITICAL): stale enemyIndex race in the enemy wind-up timer', () => {
  /**
   * BUG: src/runtime/services/engine/EnemyManager.ts:219-227 (triggerCollisionWithTarget).
   *
   * When a local-player collision schedules the enemy wind-up, the setTimeout
   * captures the NUMERIC `enemyIndex`. On fire (after GameConfig.combat.lungeAnimationDuration,
   * ~700ms) it calls `this.handleEnemyCollision(enemyIndex, { initiator: 'enemy' })`, and
   * CombatManager.handleEnemyCollision (CombatManager.ts:146-148) resolves the attacker as
   * `enemies[enemyIndex]`.
   *
   * If a DIFFERENT enemy positioned EARLIER in the shared `state.enemies` array is removed
   * during the wind-up window (handleEnemyDefeated -> enemies.splice, EnemyManager.ts:336),
   * every later index shifts left by one. The captured numeric index now points at the WRONG
   * enemy (or out of bounds). The `EnemyDefinitions.isDying(enemy)` guard at line 224 inspects
   * the captured enemy OBJECT, not the index, so it does not catch the mismatch.
   *
   * EXPECTED (correct behavior): the wind-up must resolve the ORIGINALLY-captured enemy by
   * identity, so handleEnemyCollision is invoked with an index that maps back to the SAME
   * enemy object that started the wind-up.
   *
   * TODAY: the index still points at the original slot, which now holds a different enemy,
   * so the assertion below fails.
   */
  it('resolves the wind-up against the originally-captured enemy after an earlier enemy is removed', () => {
    vi.useFakeTimers();

    // Three enemies in the shared array. The attacker (index 2) is adjacent to the player
    // and chasing, so its chase step triggers the wind-up. "victim" sits at index 0.
    const earlier = { id: 'earlier-0', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0, lives: 1 };
    const middle = { id: 'middle-1', type: 'rat', roomIndex: 0, x: 7, y: 7, lastX: 7, lives: 1 };
    const attacker = {
      id: 'attacker-2',
      type: 'rat',
      roomIndex: 0,
      x: 3,
      y: 2,
      lastX: 2, // moved right -> faces the player on its right, so it "sees" the player
      lives: 1,
      playerInVision: true,
    };
    const enemies = [earlier, middle, attacker];

    const player = { roomIndex: 0, x: 4, y: 2, lastX: 4 };
    const gameState = createEnemyGameState({
      getEnemies: vi.fn(() => enemies),
      getPlayer: vi.fn(() => player),
      getGame: vi.fn(() => ({ rooms: [{ walls: [] }], sprites: [] })),
      isPlayerOnDamageCooldown: vi.fn(() => false),
    });

    const manager = new EnemyManager(gameState, renderer, tileManager);

    // Capture which enemy index the wind-up timer ultimately fires with, and resolve it
    // against the array AT THAT MOMENT (i.e. after the splice) — that is what the real
    // CombatManager.handleEnemyCollision does (enemies[enemyIndex]).
    // Resolve the attacker the same way CombatManager.handleEnemyCollision does:
    // enemies[enemyIndex] against the array AT FIRE TIME (i.e. after the splice).
    let resolvedEnemyAtFire: { id: string } | undefined;
    const collisionSpy = vi
      .spyOn(manager, 'handleEnemyCollision')
      .mockImplementation((index: number) => {
        resolvedEnemyAtFire = enemies[index];
      });

    // Drive the smallest path that schedules the wind-up: the attacker is adjacent to the
    // player and chasing, so tick() -> tryChaseEnemy() hits the "don't move into player's
    // tile" branch -> triggerCollisionWithTarget() -> schedules the wind-up setTimeout
    // capturing the attacker's index (2).
    manager.tick();

    // A wind-up timer must have been scheduled (not fired yet).
    expect(manager.isInCombat()).toBe(true);
    expect(collisionSpy).not.toHaveBeenCalled();

    // During the wind-up window, an EARLIER enemy is defeated and removed from the shared
    // array (handleEnemyDefeated -> splice). Indices now shift: attacker moves from 2 -> 1.
    enemies.splice(0, 1); // remove "earlier-0"

    // Fire the wind-up timer.
    vi.advanceTimersByTime(GameConfig.combat.lungeAnimationDuration);

    expect(collisionSpy).toHaveBeenCalledTimes(1);

    // EXPECTED: the wind-up resolves the SAME enemy that started it (the attacker, by id).
    // Root cause TODAY: the timer captured the STALE numeric index 2 (the attacker's slot at
    // schedule time). After splicing index 0, only indices 0..1 remain, so enemies[2] is now
    // undefined and resolvedEnemyAtFire is NOT the attacker -> this assertion fails. Once the
    // wind-up resolves by enemy identity instead of a captured numeric index, it will pass.
    expect(resolvedEnemyAtFire?.id).toBe('attacker-2');

    vi.useRealTimers();
  });
});

describe('BUG B (MEDIUM): StateEnemyManager.addEnemy drops `lives`', () => {
  /**
   * BUG: src/runtime/domain/state/StateEnemyManager.ts:87-101 (addEnemy).
   *
   * EnemyManager.addEnemy (EnemyManager.ts:104-114) passes `lives: maxLives` (and lastY)
   * down to gameState.addEnemy, but StateEnemyManager.addEnemy builds its stored `entry`
   * WITHOUT `lives`. The enemy is therefore persisted with `lives === undefined`.
   *
   * EXPECTED: the stored enemy read back via getEnemies() has a numeric `lives` equal to
   * the enemy's maxLives.
   *
   * TODAY: stored `lives` is undefined -> the assertion fails.
   */
  it('stores a numeric `lives` equal to maxLives on the added enemy', () => {
    // Build a real StateEnemyManager (the unit under test) with a minimal world manager.
    const game = {
      enemies: [],
      variables: [],
      rooms: [{}],
      worldRows: 1,
      worldCols: 1,
      roomSize: 8,
    } as unknown as GameDefinition;
    const state = { enemies: [] } as unknown as RuntimeState;
    const worldManager = new StateWorldManager(game);
    const stateEnemyManager = new StateEnemyManager(game, state, worldManager);

    // EnemyManager.addEnemy is the public path; it computes maxLives (1 for our stubbed
    // definition) and forwards `lives` to gameState.addEnemy -> StateEnemyManager.addEnemy.
    const gameState = createEnemyGameState({
      addEnemy: vi.fn((enemy: unknown) => stateEnemyManager.addEnemy(enemy as never)),
      getEnemies: vi.fn(() => stateEnemyManager.getEnemies()),
    });
    const manager = new EnemyManager(gameState, renderer, tileManager);

    const expectedLives = manager.getEnemyMaxLives('rat'); // 1 from stubbed definition
    expect(expectedLives).toBe(1);

    const id = manager.addEnemy({ type: 'rat', roomIndex: 0, x: 1, y: 1 });
    expect(id).toBeTruthy();

    const stored = stateEnemyManager.getEnemies().find((e) => e.id === id);
    expect(stored).toBeDefined();

    // EXPECTED: lives persisted as a number equal to maxLives.
    // TODAY: StateEnemyManager.addEnemy omits `lives`, so stored.lives is undefined.
    expect(typeof stored?.lives).toBe('number');
    expect(stored?.lives).toBe(expectedLives);
  });
});

describe('BUG C (MEDIUM): never-moved enemy vision defaults to facing right instead of "face down"', () => {
  /**
   * BUG: src/runtime/services/engine/EnemyManager.ts:570-601 (canEnemySeePlayer).
   *
   * The "stopped -> face down" branch (lines 583-587) is gated on
   * `typeof enemy.lastY === 'number'`. A freshly placed enemy that has NEVER moved has
   * lastY undefined, so that branch is skipped. Execution falls through to the horizontal
   * branch (line 590, absDeltaX >= absDeltaY with both deltas 0), where
   * `facingRight = deltaX >= 0` is true, so the enemy only detects players to its RIGHT.
   *
   * The function's own documented stopped semantics (line 586: `return player.y >= enemy.y`)
   * say a stopped enemy "faces down by default". A never-moved enemy is also stopped, so by
   * that intent it should detect a player positioned directly BELOW it.
   *
   * EXPECTED: a never-moved enemy detects a player below it (face-down default), consistent
   * with the stopped-branch behavior.
   *
   * TODAY: lastY is undefined, the face-down branch is skipped, and the facing-right
   * fallthrough does NOT see a player that is below-and-to-the-left -> the assertion fails.
   *
   * Test geometry (makes the correct-vs-wrong distinction unambiguous):
   *   enemy at (3,3), player at (2,4) — i.e. one tile DOWN and one tile LEFT.
   *   - Documented stopped/face-down branch returns `player.y >= enemy.y` -> 4 >= 3 -> TRUE
   *     (should detect).
   *   - Buggy facing-right fallthrough returns `player.x >= enemy.x` -> 2 >= 3 -> FALSE
   *     (does not detect).
   * Both axes are within the vision range (range = 2, dx = 1, dy = 1).
   *
   * NOTE on ambiguity: a documented "spawn defaults to RIGHT" test exists elsewhere in the
   * suite (player to the right IS seen). This test does not contradict that — it pins the
   * face-down intent of the STOPPED branch for the below-left case, which the never-moved
   * fallthrough silently drops.
   */
  it('detects a player below a never-moved enemy (documented face-down default)', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    // Never-moved enemy: lastX === x and lastY is intentionally absent (undefined).
    const enemy: { id: string; type: string; roomIndex: number; x: number; y: number; lastX: number; playerInVision?: boolean } = {
      id: 'spawned',
      type: 'rat',
      roomIndex: 0,
      x: 3,
      y: 3,
      lastX: 3, // never moved horizontally
      // lastY: undefined  -> stopped/face-down branch is skipped today
    };

    // Player one tile DOWN and one tile LEFT of the enemy. Per the stopped branch's
    // `player.y >= enemy.y` rule, a "stopped, face-down" enemy should see this player.
    const playerBelowLeft = { roomIndex: 0, x: 2, y: 4 };

    const gameState = createEnemyGameState({
      getEnemies: vi.fn(() => [enemy]),
      getPlayer: vi.fn(() => playerBelowLeft),
    });
    const manager = new EnemyManager(gameState, renderer, tileManager);

    manager.evaluateVision(playerBelowLeft);

    // EXPECTED: face-down default detects the player below.
    // TODAY: facingRight fallthrough requires player.x >= enemy.x (2 >= 3 is FALSE), so the
    // documented face-down detection is lost -> this assertion fails.
    expect(enemy.playerInVision).toBe(true);
  });
});
