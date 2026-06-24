import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RendererCombatAnimator } from '../../runtime/adapters/renderer/RendererCombatAnimator';
import { CombatManager } from '../../runtime/services/engine/CombatManager';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { TextResources } from '../../runtime/adapters/TextResources';
import { GameConfig } from '../../config/GameConfig';
import { createCombatGameState } from '../helpers/createCombatGameState';

/**
 * Failing tests that prove two real bugs in the combat system.
 *
 * These tests encode the CORRECT/EXPECTED behavior, so they FAIL against the
 * current (buggy) source and would PASS once each bug is fixed. No production
 * source is modified by this file.
 */

// ───────────────────────────────────────────────────────────────────────────
// Shared RendererCombatAnimator fixture (mirrors src/__tests__/renderer/RendererCombatAnimator.test.ts)
// ───────────────────────────────────────────────────────────────────────────

type CombatRendererApi = ConstructorParameters<typeof RendererCombatAnimator>[0];

function makeAnimatorRenderer(playerPos: { x: number; y: number } | null = { x: 5, y: 5 }) {
  return {
    canvas: document.createElement('canvas'),
    ctx: null,
    gameState: {
      state: playerPos ? { player: { ...playerPos } } : undefined,
      pauseGame: vi.fn(),
      resumeGame: vi.fn(),
    },
    gameEngine: {},
    tileManager: {},
    paletteManager: {},
    spriteFactory: {},
    canvasHelper: {},
    entityRenderer: {},
    attackTelegraph: { activateTelegraph: vi.fn() },
    draw: vi.fn(),
  };
}

function asAnimatorRendererApi(renderer: ReturnType<typeof makeAnimatorRenderer>): CombatRendererApi {
  return renderer as unknown as CombatRendererApi;
}

describe('Combat bugs (failing tests proving real defects)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUG A (CRITICAL): RendererCombatAnimator lunge timer is never cancellable.
  //
  // File: src/runtime/adapters/renderer/RendererCombatAnimator.ts
  //   - startLungeAttack() lines 88-91 schedules
  //       setTimeout(() => onComplete?.(), GameConfig.combat.lungeAnimationDuration)
  //     but the returned timer handle is NEVER stored on the instance.
  //   - cancel() lines 195-213 only clears `animation.rafId` and `hitstopTimer`;
  //     it has no reference to the lunge timer, so it cannot clear it.
  //
  // Assertion proves: after cancel(), the leaked lunge setTimeout still fires
  // onComplete once timers advance past lungeAnimationDuration. Correct behavior
  // is that cancel() should also clear the lunge timer, so onComplete must NOT
  // be called after cancel().
  // ─────────────────────────────────────────────────────────────────────────
  it('BUG A: cancel() must clear the pending lunge timer so onComplete never fires after cancel', () => {
    const renderer = makeAnimatorRenderer({ x: 5, y: 5 });
    const animator = new RendererCombatAnimator(asAnimatorRendererApi(renderer));

    const onComplete = vi.fn();
    animator.startLungeAttack('player', { x: 6, y: 5 }, onComplete);

    // Cancel before the lunge duration elapses.
    animator.cancel();

    // Advance well past the lunge animation duration.
    vi.advanceTimersByTime(GameConfig.combat.lungeAnimationDuration + 100);

    // EXPECTED (correct behavior): cancel() should have cleared the lunge timer,
    // so the callback must NOT run. TODAY the timer leaks and onComplete fires,
    // making this assertion fail and proving the bug.
    expect(onComplete).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUG B (HIGH): CombatManager.isInCombat() returns false during the player's
  // counter-attack in the enemy-initiated combat path.
  //
  // File: src/runtime/services/engine/CombatManager.ts
  //   - handleEnemyInitiatedCombat() calls applyDamageToPlayer() at line 314.
  //   - applyDamageToPlayer() (lines 363-395), when the player SURVIVES, calls
  //     finishCombat() at line 391, which sets combatActive = false.
  //   - Only AFTER that does handleEnemyInitiatedCombat() start the player's
  //     counter-attack lunge at line 325 (combatAnimator.startLungeAttack(...)).
  //   => isInCombat() is already false while the counter-attack is being driven.
  //
  // Variant used: full-path drive. The mocked combatAnimator invokes its
  // onComplete callbacks synchronously (same pattern as
  // src/__tests__/engine/CombatManager.test.ts createRenderer()), so we can
  // capture isInCombat() at the exact moment the player's counter-attack lunge
  // is started.
  //
  // Assertion proves: combat must remain active (isInCombat() === true) from the
  // start of combat through the player's counter-attack lunge. TODAY it has
  // already flipped to false at that point, so the assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('BUG B: isInCombat() must remain true while the player counter-attack lunge runs', () => {
    // Capture isInCombat() at the moment the player's counter-attack lunge starts.
    let combatActiveAtCounterAttack: boolean | null = null;

    const getSpy = vi.spyOn(TextResources, 'get');
    const formatSpy = vi.spyOn(TextResources, 'format');
    const getDefinitionSpy = vi.spyOn(EnemyDefinitions, 'getEnemyDefinition');
    const getMissChanceSpy = vi.spyOn(EnemyDefinitions, 'getMissChance');

    const baseEnemyDefinition = {
      type: 'rat',
      id: 'enemy-test',
      name: 'Test Enemy',
      nameKey: 'enemies.names.rat',
      description: 'test',
      damage: 1,
      lives: 3,
      missChance: 0,
      experience: 1,
      hasEyes: true,
      sprite: [],
    };

    getSpy.mockImplementation((_key: string | null | undefined, fallback?: string) => fallback || 'text');
    formatSpy.mockImplementation((_key: string | null | undefined, _params?: Record<string, string | number | boolean>, fallback?: string) => fallback || 'text');
    getDefinitionSpy.mockImplementation(() => baseEnemyDefinition as never);
    // No explicit miss chance -> falls back to manager fallbackMissChance (set to 0 below).
    getMissChanceSpy.mockImplementation(() => null);

    // startKnockback (enemy's first attack) invokes onComplete synchronously.
    const startKnockbackMock = vi.fn();
    startKnockbackMock.mockImplementation((_entity: unknown, _direction: unknown, onComplete?: () => void) => {
      if (onComplete) onComplete();
    });

    // startLungeAttack (player's counter-attack). Record the combat state at the
    // instant the counter-attack lunge is initiated, THEN invoke onComplete.
    const startLungeAttackMock = vi.fn();
    startLungeAttackMock.mockImplementation((_attacker: unknown, _target: unknown, onComplete?: () => void) => {
      combatActiveAtCounterAttack = manager.isInCombat();
      if (onComplete) onComplete();
    });

    const renderer = {
      draw: vi.fn(),
      flashScreen: vi.fn(),
      showCombatIndicator: vi.fn(),
      spawnEnemyLifeLoss: vi.fn(),
      applyGrayscaleFilter: vi.fn(),
      removeGrayscaleFilter: vi.fn(),
      combatAnimator: {
        startLungeAttack: startLungeAttackMock,
        startKnockback: startKnockbackMock,
        freezeFrame: vi.fn(),
      },
      cameraShake: {
        triggerFromDamage: vi.fn(),
      },
      floatingText: {
        spawnDamageNumber: vi.fn(),
      },
      particleSystem: {
        spawnImpactAtTile: vi.fn(),
        spawnCriticalImpact: vi.fn(),
        spawnDeath: vi.fn(),
      },
      entityRenderer: {
        flashEntity: vi.fn(),
      },
      startSwordSwing: vi.fn(),
    };

    // Enemy adjacent to player so the post-animation melee re-check passes.
    // Enemy survives the counter-attack (3 lives, player deals 1) so the
    // sequence runs through the counter-attack lunge rather than the death path.
    const gameState = createCombatGameState({
      getEnemies: vi.fn(() => [{ id: 'e1', type: 'rat', roomIndex: 0, x: 1, y: 1, lastX: 1, lives: 3 }]),
      getPlayer: vi.fn(() => ({ roomIndex: 0, x: 1, y: 1, lives: 3, level: 1 })),
      getPlayerDamage: vi.fn(() => 1),
      damagePlayer: vi.fn(() => 2), // Player survives the enemy's hit (2 lives left).
      getLives: vi.fn(() => 3),
    });

    // fallbackMissChance: 0 -> both attacks always hit, so the enemy's first
    // attack lands and the player's counter-attack proceeds.
    const manager = new CombatManager(gameState, renderer, { fallbackMissChance: 0 });

    manager.handleEnemyCollision(0, { initiator: 'enemy' });

    // Sanity: the counter-attack lunge actually ran (otherwise this would be a
    // setup error, not the bug assertion).
    expect(startLungeAttackMock).toHaveBeenCalled();
    expect(combatActiveAtCounterAttack).not.toBeNull();

    // EXPECTED (correct behavior): combat is still active while the player's
    // counter-attack lunge runs. TODAY applyDamageToPlayer() already called
    // finishCombat() (combatActive = false) before the lunge started, so the
    // captured value is false and this assertion fails — proving the bug.
    expect(combatActiveAtCounterAttack).toBe(true);

    getSpy.mockRestore();
    formatSpy.mockRestore();
    getDefinitionSpy.mockRestore();
    getMissChanceSpy.mockRestore();
  });
});
