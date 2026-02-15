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
   * Main combat handler - processes player vs enemy collision
   */
  handleEnemyCollision(
    enemyIndex: number,
    options: { skipAssassinate?: boolean; initiator?: 'player' | 'enemy' } = {}
  ): void {
    let initiator = options.initiator || 'player';

    // Check attack cooldown first
    if (this.playerManager?.isOnAttackCooldown()) {
      this.renderer.showCombatIndicator(getEnemyLocaleText('combat.tooSoon', 'Too soon!'), { duration: 500 });
      return;
    }

    // Check damage cooldown (room change protection)
    if (this.gameState.isPlayerOnDamageCooldown()) {
      this.renderer.showCombatIndicator(getEnemyLocaleText('combat.cooldown', ''), { duration: 700 });
      return;
    }

    const enemies = this.gameState.getEnemies();
    if (enemyIndex < 0 || enemyIndex >= enemies.length) return;
    const enemy = enemies[enemyIndex];

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
    const gameStateWithDamage = this.gameState as GameStateApi & { getPlayerDamage?: () => number };
    const playerDamage = gameStateWithDamage.getPlayerDamage ? gameStateWithDamage.getPlayerDamage() : 1;

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
      // Player hits enemy
      entityRenderer.flashEntity(enemy.id || `${enemy.type}-${enemy.x}-${enemy.y}`, '#FFFFFF', 120);

      // Enemy loses life
      const previousLives = enemy.lives || 1;
      enemy.lives = previousLives - playerDamage;

      // Consume sword durability
      const gameStateWithDurability = this.gameState as typeof this.gameState & { consumeSwordDurability?: () => boolean };
      if (gameStateWithDurability.consumeSwordDurability) {
        gameStateWithDurability.consumeSwordDurability();
      }

      // Spawn multiple life loss squares (one per damage point)
      this.spawnMultipleLifeLoss(enemy, previousLives, playerDamage);

      const enemyDefeated = enemy.lives <= 0;

      if (enemyDefeated) {
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

      // Player counter-attacks
      combatAnimator.startLungeAttack('player', enemyPos, () => {
        entityRenderer.flashEntity(enemy.id || `${enemy.type}-${enemy.x}-${enemy.y}`, '#FFFFFF', 120);

        const previousLives = enemy.lives || 1;
        enemy.lives = previousLives - playerDamage;

        // Consume sword durability
        const gameStateWithDurability = this.gameState as typeof this.gameState & { consumeSwordDurability?: () => boolean };
        if (gameStateWithDurability.consumeSwordDurability) {
          gameStateWithDurability.consumeSwordDurability();
        }

        // Spawn multiple life loss squares (one per damage point)
        this.spawnMultipleLifeLoss(enemy, previousLives, playerDamage);

        const enemyDefeated = enemy.lives <= 0;

        if (enemyDefeated) {
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

    entityRenderer.flashEntity('player', '#FF004D', 120);
    cameraShake.triggerFromDamage(damage);

    if (reduction > 0) {
      const text = reduction >= damage
        ? getEnemyLocaleText('combat.block.full', '')
        : formatEnemyLocaleText('combat.block.partial', { value: reduction }, '');
      this.renderer.showCombatIndicator(text, { duration: 700 });
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
        this.renderer.showCombatIndicator(text, { duration: 700 });
      }
    }

    // Player attacks enemy with sword damage
    const previousLives = enemy.lives || 1;
    enemy.lives = previousLives - playerDamage;

    // Consume sword durability
    const gameStateWithDurability = this.gameState as typeof this.gameState & { consumeSwordDurability?: () => boolean };
    if (gameStateWithDurability.consumeSwordDurability) {
      gameStateWithDurability.consumeSwordDurability();
    }

    // Spawn multiple life loss squares (one per damage point)
    this.spawnMultipleLifeLoss(enemy, previousLives, playerDamage);

    const enemyDefeated = enemy.lives <= 0;

    if (enemyDefeated && enemy.id) {
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
   * Play enemy death animation with flashing
   */
  private playEnemyDeathAnimation(enemy: EnemyState, onComplete: () => void): void {
    if (!this.renderer.entityRenderer) {
      onComplete();
      return;
    }

    const entityId = enemy.id || `${enemy.type}-${enemy.x}-${enemy.y}`;
    let flashCount = 0;
    const maxFlashes = 6;
    const flashInterval = 50;

    const flashLoop = () => {
      if (flashCount >= maxFlashes) {
        onComplete();
        return;
      }

      const flashColor = flashCount % 2 === 0 ? '#FFFFFF' : '#000000';
      this.renderer.entityRenderer?.flashEntity(entityId, flashColor, flashInterval);
      flashCount++;

      const timer = setTimeout(flashLoop, flashInterval);
      this.animationTimers.add(timer);
    };

    flashLoop();
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
    this.renderer.showCombatIndicator(deathMessage, { duration: 2500 });

    // Wait for death sequence to complete, then trigger game over
    this.deathSequenceTimer = setTimeout(() => {
      this.deathSequenceTimer = null;

      // Remove grayscale filter
      this.renderer.removeGrayscaleFilter();

      // Resume game (will be paused again by game over screen)
      this.gameState.resumeGame('player-death');

      // Trigger game over
      this.onPlayerDefeated();
    }, 2500);
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
    this.renderer.showCombatIndicator('Miss', { duration: 500 });
  }
}

export { CombatManager };
