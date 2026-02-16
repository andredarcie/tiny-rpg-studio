import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { TextResources } from '../../adapters/TextResources';
import { GameConfig } from '../../../config/GameConfig';
import type {
  GameStateApi,
  RendererApi,
  CombatAnimatorApi,
  CameraShakeApi,
  EntityRendererApi,
  CombatStunManagerApi,
  StatePlayerManagerApi,
  PlayerState,
  EnemyState,
  CombatManagerOptions,
} from '../../../types/managerTypes';

const getEnemyLocaleText = (key: string, fallback = ''): string => {
  const value = TextResources.get(key, fallback) as string;
  return value || fallback || '';
};

const formatEnemyLocaleText = (
  key: string,
  params: Record<string, string | number | boolean> = {},
  fallback = '',
): string => {
  const value = TextResources.format(key, params, fallback) as string;
  return value || fallback || '';
};

const getEnemyLocalizedName = (enemyType: string): string => {
  const definition = EnemyDefinitions.getEnemyDefinition(enemyType);
  if (definition && definition.nameKey) {
    return getEnemyLocaleText(definition.nameKey, definition.name || enemyType);
  }
  return enemyType;
};

/**
 * CombatManager - Handles all combat-related logic
 *
 * Responsibilities:
 * - Player vs Enemy combat
 * - Damage calculation
 * - Combat animations
 * - Death sequences
 * - Stealth/assassination mechanics
 */
class CombatManager {
  gameState: GameStateApi;
  renderer: RendererApi;
  onPlayerDefeated: () => void;
  fallbackMissChance: number;
  combatStunManager: CombatStunManagerApi | null;
  playerManager: StatePlayerManagerApi | null;
  onEnemyDefeated: (enemyId: string, enemy: EnemyState) => void;
  onCheckAllEnemiesCleared: () => void;
  shouldStartLevelOverlay: () => boolean;
  deathSequenceTimer: ReturnType<typeof setTimeout> | null;
  animationTimers: Set<ReturnType<typeof setTimeout>>;

  constructor(
    gameState: GameStateApi,
    renderer: RendererApi,
    options: CombatManagerOptions = {}
  ) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.onPlayerDefeated = options.onPlayerDefeated || (() => {});
    this.fallbackMissChance = this.normalizeMissChance(
      options.fallbackMissChance ?? GameConfig.enemy.fallbackMissChance
    );
    this.combatStunManager = options.combatStunManager ?? null;
    this.playerManager = options.playerManager ?? null;
    this.onEnemyDefeated = options.onEnemyDefeated || (() => {});
    this.onCheckAllEnemiesCleared = options.onCheckAllEnemiesCleared || (() => {});
    this.shouldStartLevelOverlay = options.shouldStartLevelOverlay || (() => false);
    this.deathSequenceTimer = null;
    this.animationTimers = new Set();
  }

  /**
   * Check if two entities are within melee range (up to 2 tiles away)
   */
  private isInMeleeRange(pos1: { x: number; y: number; roomIndex?: number }, pos2: { x: number; y: number; roomIndex?: number }): boolean {
    // Must be in same room
    if (pos1.roomIndex !== undefined && pos2.roomIndex !== undefined && pos1.roomIndex !== pos2.roomIndex) {
      return false;
    }

    // Calculate chebyshev distance (max of dx, dy)
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);

    // Melee range is up to 2 tiles away (allows player to escape if they run far enough)
    return Math.max(dx, dy) <= 2;
  }

  /**
   * Check if enemy and player are still in range for attack.
   * If out of range, cancels the attack and refreshes the display.
   * @returns true if in range (continue attack), false if out of range (cancel attack)
   */
  private checkCombatRangeOrCancel(enemy: EnemyState): boolean {
    const currentPlayer = this.gameState.getPlayer();
    if (!this.isInMeleeRange(enemy, currentPlayer)) {
      // Out of range - one of them escaped during animation
      this.renderer.draw();
      return false;
    }
    return true;
  }

  /**
   * Main combat handler - processes player vs enemy collision
   */
  handleEnemyCollision(
    enemyIndex: number,
    options: { skipAssassinate?: boolean; initiator?: 'player' | 'enemy' } = {}
  ): void {
    let initiator = options.initiator || 'player';

    // Check attack cooldown first
    if (this.playerManager?.isOnAttackCooldown()) {
      return;
    }

    // Check damage cooldown (room change protection)
    if (this.gameState.isPlayerOnDamageCooldown()) {
      this.renderer.showCombatIndicator(getEnemyLocaleText('combat.cooldown', ''), { duration: GameConfig.combat.messageDuration.cooldown });
      return;
    }

    const enemies = this.gameState.getEnemies();
    if (enemyIndex < 0 || enemyIndex >= enemies.length) return;
    const enemy = enemies[enemyIndex];

    // Skip combat if enemy is already dying (in death animation)
    if (EnemyDefinitions.isDying(enemy)) {
      return;
    }

    // Ensure enemy has ID (required for safe removal during async operations)
    if (!enemy.id) {
      console.error('Enemy missing ID, cannot process combat safely');
      return;
    }

    // Ensure enemy has lives initialized
    this.ensureEnemyLives(enemy);

    // Assassin skill: always attack first against weak enemies (3 lives or less)
    const hasStealth = this.gameState.hasSkill('stealth');
    if (hasStealth && typeof enemy.lives === 'number' && enemy.lives <= 3) {
      initiator = 'player';
    }

    const missChance = this.getEnemyMissChance(enemy.type);
    const attackMissed = this.attackMissed(missChance);
    const damage = this.getEnemyDamage(enemy.type);

    // Type-safe player damage retrieval
    const playerDamage = this.gameState.getPlayerDamage?.() ?? 1;

    const player = this.gameState.getPlayer();
    const enemyPos = { x: enemy.x, y: enemy.y };

    // Check if combat systems are available (backward compatibility)
    const hasCombatSystems = Boolean(
      this.renderer.combatAnimator &&
      this.renderer.cameraShake &&
      this.renderer.floatingText &&
      this.renderer.particleSystem &&
      this.renderer.entityRenderer
    );

    if (!hasCombatSystems) {
      // Fallback to old synchronous combat
      this.handleCombatLegacy(enemyIndex, enemy, missChance, attackMissed, damage, playerDamage);
      return;
    }

    // New animated combat flow
    this.handleAnimatedCombat(enemyIndex, enemy, damage, playerDamage, player, enemyPos, initiator, attackMissed);
  }

  /**
   * Animated combat with turn-based system
   */
  private handleAnimatedCombat(
    enemyIndex: number,
    enemy: EnemyState,
    damage: number,
    playerDamage: number,
    player: PlayerState,
    enemyPos: { x: number; y: number },
    initiator: 'player' | 'enemy',
    attackMissed: boolean
  ): void {
    const combatAnimator = this.renderer.combatAnimator;
    const entityRenderer = this.renderer.entityRenderer;
    const cameraShake = this.renderer.cameraShake;

    if (!combatAnimator || !entityRenderer || !cameraShake) return;

    // Update last attack time
    if (this.playerManager?.player) {
      this.playerManager.player.lastAttackTime = performance.now();
    }

    if (initiator === 'player') {
      this.handlePlayerInitiatedCombat(enemyIndex, enemy, damage, playerDamage, player, enemyPos, combatAnimator, entityRenderer, cameraShake, attackMissed);
    } else {
      this.handleEnemyInitiatedCombat(enemyIndex, enemy, damage, playerDamage, player, enemyPos, combatAnimator, entityRenderer, cameraShake, attackMissed);
    }
  }

  /**
   * Player attacks first, enemy counter-attacks
   */
  private handlePlayerInitiatedCombat(
    _enemyIndex: number,
    enemy: EnemyState,
    damage: number,
    playerDamage: number,
    player: PlayerState,
    enemyPos: { x: number; y: number },
    combatAnimator: CombatAnimatorApi,
    entityRenderer: EntityRendererApi,
    cameraShake: CameraShakeApi,
    enemyAttackMissed: boolean
  ): void {
    combatAnimator.startLungeAttack('player', enemyPos, () => {
      if (!this.checkCombatRangeOrCancel(enemy)) return;

      // Player hits enemy (consolidated damage logic)
      const result = this.applyDamageToEnemy(enemy, playerDamage, player, entityRenderer, {
        showBackstabMessage: true
      });

      if (result.defeated) {
        // Enemy dies - no counter-attack
        this.playEnemyDeathAnimation(enemy, () => {
          if (enemy.id) {
            this.onEnemyDefeated(enemy.id, enemy);
          }
          this.onCheckAllEnemiesCleared();
          this.renderer.draw();
        });
      } else {
        // Enemy counter-attacks
        const direction = this.calculateKnockbackDirection(player, enemy);
        combatAnimator.startKnockback('player', direction, () => {
          if (!this.checkCombatRangeOrCancel(enemy)) return;

          if (enemyAttackMissed) {
            // Enemy missed the counter-attack
            this.showMissFeedback();
            this.renderer.draw();
          } else {
            // Enemy hits player
            this.applyDamageToPlayer(damage, enemy, entityRenderer, cameraShake);
          }
        });
      }
    });
  }

  /**
   * Enemy attacks first, player counter-attacks
   */
  private handleEnemyInitiatedCombat(
    _enemyIndex: number,
    enemy: EnemyState,
    damage: number,
    playerDamage: number,
    player: PlayerState,
    enemyPos: { x: number; y: number },
    combatAnimator: CombatAnimatorApi,
    entityRenderer: EntityRendererApi,
    cameraShake: CameraShakeApi,
    enemyAttackMissed: boolean
  ): void {
    const direction = this.calculateKnockbackDirection(player, enemy);

    combatAnimator.startKnockback('player', direction, () => {
      if (!this.checkCombatRangeOrCancel(enemy)) return;

      let playerLives: number;

      if (enemyAttackMissed) {
        // Enemy missed the initial attack
        this.showMissFeedback();
        playerLives = this.gameState.getLives();
        this.renderer.draw();
      } else {
        // Enemy hits player
        playerLives = this.applyDamageToPlayer(damage, enemy, entityRenderer, cameraShake);
      }

      if (playerLives <= 0) {
        // Player died
        return;
      }

      // Player counter-attacks (consolidated damage logic)
      combatAnimator.startLungeAttack('player', enemyPos, () => {
        if (!this.checkCombatRangeOrCancel(enemy)) return;

        const result = this.applyDamageToEnemy(enemy, playerDamage, player, entityRenderer, {
          showBackstabMessage: true
        });

        if (result.defeated) {
          this.playEnemyDeathAnimation(enemy, () => {
            if (enemy.id) {
              this.onEnemyDefeated(enemy.id, enemy);
            }
            this.onCheckAllEnemiesCleared();
            this.renderer.draw();
          });
        } else {
          this.renderer.draw();
        }
      });
    });
  }

  /**
   * Apply damage to player and handle death
   */
  private applyDamageToPlayer(
    damage: number,
    enemy: EnemyState,
    entityRenderer: EntityRendererApi,
    cameraShake: CameraShakeApi
  ): number {
    const playerLives = this.gameState.damagePlayer(damage);
    const reduction = this.gameState.consumeLastDamageReduction();

    entityRenderer.flashEntity('player', '#FF004D', GameConfig.combat.entityFlashDuration);
    cameraShake.triggerFromDamage(damage);

    if (reduction > 0) {
      const text = reduction >= damage
        ? getEnemyLocaleText('combat.block.full', '')
        : formatEnemyLocaleText('combat.block.partial', { value: reduction }, '');
      this.renderer.showCombatIndicator(text, { duration: GameConfig.combat.messageDuration.cooldown });
    }

    this.combatStunManager?.applyStun();

    if (playerLives <= 0) {
      // Record which enemy killed the player
      this.gameState.setLastKillerEnemy?.(enemy.id || null);
      this.renderer.draw();
      this.playPlayerDeathSequence(enemy.type);
    } else {
      this.renderer.draw();
    }

    return playerLives;
  }

  /**
   * Apply damage to enemy with backstab bonus, durability consumption, and visual feedback
   *
   * Single source of truth for all enemy damage logic.
   * Used by: handlePlayerInitiatedCombat, handleEnemyInitiatedCombat, handleCombatLegacy
   *
   * @returns Object with defeated status and actual damage dealt
   */
  private applyDamageToEnemy(
    enemy: EnemyState,
    baseDamage: number,
    player: PlayerState,
    entityRenderer: EntityRendererApi,
    options: {
      showBackstabMessage?: boolean;
    } = {}
  ): { defeated: boolean; actualDamage: number } {
    // Check for backstab bonus
    const isBackstab = this.isBackstab(player, enemy);
    const finalDamage = baseDamage + (isBackstab ? 1 : 0);

    // Show backstab message if applicable
    if (isBackstab && options.showBackstabMessage) {
      const backstabText = getEnemyLocaleText('combat.backstab', 'Backstab!');
      this.renderer.showCombatIndicator(backstabText, { duration: GameConfig.combat.messageDuration.standard });
    }

    // Apply damage to enemy
    const previousLives = enemy.lives || 1;
    enemy.lives = previousLives - finalDamage;

    // Consume sword durability (type-safe)
    this.gameState.consumeSwordDurability?.();

    // Flash enemy
    const enemyId = enemy.id || `${enemy.type}-${enemy.x}-${enemy.y}`;
    entityRenderer.flashEntity(enemyId, '#FFFFFF', GameConfig.combat.entityFlashDuration);

    // Spawn multiple life loss squares (one per damage point)
    this.spawnMultipleLifeLoss(enemy, previousLives, finalDamage);

    // Check if enemy is defeated
    const defeated = enemy.lives <= 0;

    return { defeated, actualDamage: finalDamage };
  }

  /**
   * Legacy synchronous combat (backward compatibility)
   */
  private handleCombatLegacy(
    _enemyIndex: number,
    enemy: EnemyState,
    _missChance: number,
    attackMissed: boolean,
    damage: number,
    playerDamage: number
  ): void {
    let playerLives = this.gameState.getLives(); // Initialize with current lives

    if (attackMissed) {
      this.showMissFeedback();
    } else {
      playerLives = this.gameState.damagePlayer(damage);
      const reduction = this.gameState.consumeLastDamageReduction();

      if (reduction > 0) {
        const text = reduction >= damage
          ? getEnemyLocaleText('combat.block.full', '')
          : formatEnemyLocaleText('combat.block.partial', { value: reduction }, '');
        this.renderer.showCombatIndicator(text, { duration: GameConfig.combat.messageDuration.cooldown });
      }
    }

    // Player attacks enemy (consolidated damage logic)
    const player = this.gameState.getPlayer();
    // Note: entityRenderer not available in legacy mode, pass dummy that no-ops
    const dummyEntityRenderer: EntityRendererApi = {
      flashEntity: () => {} // No-op in legacy mode
    };

    const result = this.applyDamageToEnemy(enemy, playerDamage, player, dummyEntityRenderer, {
      showBackstabMessage: true
    });

    if (result.defeated && enemy.id) {
      this.onEnemyDefeated(enemy.id, enemy);
      this.onCheckAllEnemiesCleared();
      this.renderer.flashScreen({ intensity: 0.8, duration: 160 });
    }

    // Check if player died
    if (playerLives <= 0) {
      // Record which enemy killed the player
      this.gameState.setLastKillerEnemy?.(enemy.id || null);
      this.renderer.draw();
      this.playPlayerDeathSequence(enemy.type);
      return;
    }

    this.renderer.draw();
  }

  /**
   * Play enemy death animation (rotation + fade)
   *
   * Animation phases:
   * 1. Rotation (0-500ms): Sprite rotates 90° clockwise (falls to side)
   * 2. Fade + Float (500-1000ms): Sprite fades out while floating upward
   *
   * The animation is rendered by RendererEntityRenderer when deathStartTime is set.
   */
  private playEnemyDeathAnimation(enemy: EnemyState, onComplete: () => void): void {
    // Guard: Skip if already dying
    if (EnemyDefinitions.isDying(enemy)) {
      console.warn('[Combat] Enemy already dying, skipping animation');
      onComplete();
      return;
    }

    // Mark enemy as dying (triggers rotation/fade animation in renderer)
    enemy.deathStartTime = performance.now();

    // Schedule cleanup after animation completes
    const timer = setTimeout(() => {
      this.animationTimers.delete(timer);
      onComplete();
    }, GameConfig.combat.deathAnimationDuration);

    this.animationTimers.add(timer);
  }

  /**
   * Play player death sequence: grayscale, pause, show death message, then game over
   */
  private playPlayerDeathSequence(enemyType: string): void {
    // Cancel any existing death sequence
    this.cancelDeathSequence();

    // Apply grayscale filter to canvas
    this.renderer.applyGrayscaleFilter();

    // Pause the game
    this.gameState.pauseGame('player-death');

    // Get localized enemy name
    const enemyName = getEnemyLocalizedName(enemyType);

    // Show death message "Killed by [Enemy Name]"
    const deathMessage = formatEnemyLocaleText('combat.killedBy', { enemy: enemyName }, '');
    this.renderer.showCombatIndicator(deathMessage, { duration: GameConfig.combat.messageDuration.death });

    // Wait for death sequence to complete, then trigger game over
    this.deathSequenceTimer = setTimeout(() => {
      this.deathSequenceTimer = null;

      // Remove grayscale filter
      this.renderer.removeGrayscaleFilter();

      // Resume game (will be paused again by game over screen)
      this.gameState.resumeGame('player-death');

      // Trigger game over
      this.onPlayerDefeated();
    }, GameConfig.combat.messageDuration.death);
  }

  /**
   * Cancel death sequence timer and clean up death state
   */
  cancelDeathSequence(): void {
    if (this.deathSequenceTimer) {
      clearTimeout(this.deathSequenceTimer);
      this.deathSequenceTimer = null;
    }
    // Clean up death sequence side effects
    this.renderer.removeGrayscaleFilter();
    this.gameState.resumeGame('player-death');
    // Clean up any orphan animation timers
    this.clearAnimationTimers();
  }

  /**
   * Clear all animation timers
   */
  private clearAnimationTimers(): void {
    this.animationTimers.forEach(timer => clearTimeout(timer));
    this.animationTimers.clear();
  }

  /**
   * Calculate knockback direction from attacker to target
   */
  private calculateKnockbackDirection(player: PlayerState, enemy: EnemyState): { x: number; y: number } {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    return {
      x: dx === 0 ? 0 : (dx > 0 ? 1 : -1),
      y: dy === 0 ? 0 : (dy > 0 ? 1 : -1)
    };
  }

  /**
   * Check if player is attacking enemy from behind (backstab/flanking)
   * Enemy is considered to be facing the direction they last moved
   */
  private isBackstab(player: PlayerState, enemy: EnemyState): boolean {
    // Check if enemy has moved horizontally or vertically
    const movedHorizontally = typeof enemy.lastX === 'number' && enemy.lastX !== enemy.x;
    const movedVertically = typeof enemy.lastY === 'number' && enemy.lastY !== enemy.y;

    // If enemy hasn't moved at all, no backstab
    if (!movedHorizontally && !movedVertically) {
      return false;
    }

    // If enemy moved both horizontally and vertically, prioritize the larger movement
    if (movedHorizontally && movedVertically) {
      const horizontalDelta = Math.abs(enemy.x - (enemy.lastX || enemy.x));
      const verticalDelta = Math.abs(enemy.y - (enemy.lastY || enemy.y));

      // Prioritize the direction with larger movement (vertical wins ties)
      if (verticalDelta >= horizontalDelta) {
        // Vertical movement is larger or equal - check vertical backstab
        const enemyFacingDown = enemy.y > (enemy.lastY || enemy.y);
        return enemyFacingDown ? player.y < enemy.y : player.y > enemy.y;
      } else {
        // Horizontal movement is larger - check horizontal backstab
        const enemyFacingRight = enemy.x > (enemy.lastX || enemy.x);
        return enemyFacingRight ? player.x < enemy.x : player.x > enemy.x;
      }
    }

    // Only moved horizontally
    if (movedHorizontally) {
      const enemyFacingRight = enemy.x > enemy.lastX;
      return enemyFacingRight ? player.x < enemy.x : player.x > enemy.x;
    }

    // Only moved vertically
    if (movedVertically) {
      const enemyFacingDown = enemy.y > enemy.lastY;
      return enemyFacingDown ? player.y < enemy.y : player.y > enemy.y;
    }

    return false;
  }

  // ========== Damage & Stats ==========

  getEnemyDamage(type: string): number {
    const definition = EnemyDefinitions.getEnemyDefinition(type);
    if (definition && typeof definition.damage === 'number' && Number.isFinite(definition.damage)) {
      return Math.max(1, definition.damage);
    }
    return 1;
  }

  getEnemyMissChance(type: string): number {
    const explicit = EnemyDefinitions.getMissChance(type);
    if (explicit !== null) {
      return this.normalizeMissChance(explicit);
    }
    return this.fallbackMissChance;
  }

  normalizeMissChance(value: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0.25;
    }
    return Math.max(0, Math.min(1, numeric));
  }

  attackMissed(chance?: number): boolean {
    const normalized = chance === undefined
      ? this.normalizeMissChance(this.fallbackMissChance)
      : this.normalizeMissChance(chance);

    if (normalized <= 0) return false;
    if (normalized >= 1) return true;
    return Math.random() < normalized;
  }

  ensureEnemyLives(enemy: EnemyState): void {
    if (typeof enemy.lives !== 'number' || enemy.lives <= 0) {
      const definition = EnemyDefinitions.getEnemyDefinition(enemy.type);
      if (definition && typeof definition.lives === 'number' && Number.isFinite(definition.lives)) {
        enemy.lives = Math.max(1, definition.lives);
      } else {
        enemy.lives = 1;
      }
    }
  }

  /**
   * Spawns multiple life loss squares based on damage dealt
   */
  private spawnMultipleLifeLoss(enemy: EnemyState, previousLives: number, damageDealt: number): void {
    // Validate inputs
    if (typeof enemy.x !== 'number' || typeof enemy.y !== 'number') return;
    if (!Number.isFinite(previousLives) || !Number.isFinite(damageDealt)) return;
    if (damageDealt <= 0) return;

    // Spawn one square for each point of damage
    const clampedDamage = Math.min(damageDealt, previousLives);
    for (let i = 0; i < clampedDamage; i++) {
      const lostLifeIndex = previousLives - 1 - i;
      if (lostLifeIndex >= 0) {
        this.renderer.spawnEnemyLifeLoss(enemy.x, enemy.y, lostLifeIndex);
      }
    }
  }

  showMissFeedback(): void {
    this.renderer.showCombatIndicator('Miss', { duration: GameConfig.combat.messageDuration.standard });
  }
}

export { CombatManager };
