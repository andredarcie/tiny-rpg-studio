import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { TextResources } from '../../adapters/TextResources';
import { GameConfig } from '../../../config/GameConfig';
import { CombatManager } from './CombatManager';
import type {
  GameStateApi,
  RendererApi,
  CombatStunManagerApi,
  StatePlayerManagerApi,
  TileManagerApi,
  EnemyManagerOptions,
  PlayerState,
  GameData,
  EnemyState,
  EnemyMovementResult,
  EnemyInput,
  EnemyDefinitionData,
} from '../../../types/managerTypes';
import { EnemyMovementResult as EnemyMovementResultConst } from '../../../types/managerTypes';

const getEnemyLocaleText = (key: string, fallback = ''): string => {
  const value = TextResources.get(key, fallback) as string;
  return value || fallback || '';
};

class EnemyManager {
  gameState: GameStateApi;
  renderer: RendererApi;
  tileManager: TileManagerApi;
  combatManager: CombatManager;
  onPlayerDefeated: () => void;
  interval: number;
  enemyMoveTimer: ReturnType<typeof setInterval> | null;
  directions: number[][];
  dialogManager: EnemyManagerOptions['dialogManager'] | null;
  fallbackMissChance: number;
  combatStunManager: CombatStunManagerApi | null;
  playerManager: StatePlayerManagerApi | null;

  constructor(gameState: GameStateApi, renderer: RendererApi, tileManager: TileManagerApi, options: EnemyManagerOptions = {}) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.tileManager = tileManager;
    this.onPlayerDefeated = options.onPlayerDefeated || (() => {});
    this.interval = options.interval || GameConfig.enemy.movementInterval;
    this.enemyMoveTimer = null;
    this.directions = options.directions || this.defaultDirections();
    this.dialogManager = options.dialogManager || null;

    // Normalize miss chance inline (before CombatManager creation)
    const rawMissChance = options.missChance === undefined ? GameConfig.enemy.fallbackMissChance : options.missChance;
    const numeric = Number(rawMissChance);
    this.fallbackMissChance = Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0.25;

    this.combatStunManager = options.combatStunManager ?? null;
    this.playerManager = options.playerManager ?? null;

    // Initialize CombatManager with callbacks
    this.combatManager = new CombatManager(gameState, renderer, {
      onPlayerDefeated: this.onPlayerDefeated,
      fallbackMissChance: this.fallbackMissChance,
      combatStunManager: this.combatStunManager,
      playerManager: this.playerManager,
      onEnemyDefeated: (enemyId: string, enemy: EnemyState) => {
        this.handleEnemyDefeated(enemyId, enemy);
      },
      onCheckAllEnemiesCleared: () => {
        this.checkAllEnemiesCleared();
      },
      shouldStartLevelOverlay: () => {
        return this.shouldStartLevelOverlay();
      },
    });
  }

  getEnemyDefinitions(): unknown {
    return this.gameState.getEnemyDefinitions();
  }

  getActiveEnemies(): EnemyState[] {
    return this.gameState.getEnemies();
  }

  addEnemy(enemy: EnemyInput): string | null {
    const id = enemy.id || this.generateEnemyId();
    const type = this.normalizeEnemyType(enemy.type);
    const maxLives = this.getEnemyMaxLives(type);
    const addedId = this.gameState.addEnemy({
      id,
      type,
      roomIndex: enemy.roomIndex ?? 0,
      x: enemy.x,
      y: enemy.y,
      lastX: enemy.lastX ?? enemy.x,
      lives: maxLives,
      defeatVariableId: enemy.defeatVariableId ?? null,
    });
    if (!addedId) {
      return null;
    }
    this.renderer.draw();
    return addedId;
  }

  removeEnemy(enemyId: string): void {
    this.gameState.removeEnemy(enemyId);
    this.renderer.draw();
  }

  generateEnemyId(): string {
    const cryptoCandidate =
      typeof crypto !== 'undefined'
        ? crypto
        : (globalThis as Partial<typeof globalThis>).crypto;
    if (cryptoCandidate) {
      const randomUUID = (cryptoCandidate as { randomUUID?: () => string }).randomUUID;
      if (typeof randomUUID === 'function') {
        return randomUUID.call(cryptoCandidate);
      }
    }
    return `enemy-${Math.random().toString(36).slice(2, 10)}`;
  }

  start(): void {
    if (this.enemyMoveTimer) {
      clearInterval(this.enemyMoveTimer);
    }
    // Cancel death sequence to prevent race conditions on game restart
    this.combatManager.cancelDeathSequence();
    // Migrate enemy lives from old system to new system
    this.migrateEnemyLives();
    this.enemyMoveTimer = setInterval(() => this.tick(), this.interval);
  }

  stop(): void {
    if (this.enemyMoveTimer) {
      clearInterval(this.enemyMoveTimer);
      this.enemyMoveTimer = null;
    }
    // Cancel death sequence to prevent race conditions on game reset
    this.combatManager.cancelDeathSequence();
  }

  tick(): void {
    if (!this.gameState.playing) return;
    if (this.gameState.isEditorModeActive()) return;

    const enemies = this.gameState.getEnemies();
    if (!this.hasMovableEnemies(enemies)) return;

    const game = this.gameState.getGame();
    const player = this.gameState.getPlayer();
    this.evaluateVision(player);
    let moved = false;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const result =
        enemy.playerInVision
          ? this.tryChaseEnemy(enemy, i, game, player, enemies)
          : this.tryMoveEnemy(enemies, i, game, player);
      if (result === EnemyMovementResultConst.Moved) {
        moved = true;
      } else if (result === EnemyMovementResultConst.Collided) {
        moved = true;
        break;
      }
    }

    if (moved) {
      this.renderer.draw();
    }
  }

  handleEnemyCollision(
    enemyIndex: number,
    options: { skipAssassinate?: boolean; initiator?: 'player' | 'enemy' } = {}
  ): void {
    // Delegate to CombatManager
    this.combatManager.handleEnemyCollision(enemyIndex, options);
  }

  /**
   * Handle enemy defeat - called by CombatManager
   * Removes enemy from array, triggers defeat variable, awards XP, checks level up
   */
  private handleEnemyDefeated(enemyId: string, enemy: EnemyState): void {
    const enemies = this.gameState.getEnemies();

    // Find enemy index by ID (safe against race conditions during async operations)
    const enemyIndex = enemies.findIndex(e => e.id === enemyId);

    // If enemy not found, it may have been removed already
    if (enemyIndex === -1) {
      console.warn(`Enemy ${enemyId} not found in array, may have been removed already`);
      return;
    }

    // Clear attack telegraph warning
    this.renderer.attackTelegraph?.deactivateTelegraph(enemyId);

    // Remove enemy from array
    enemies.splice(enemyIndex, 1);

    // Trigger defeat variable if configured
    this.tryTriggerDefeatVariable(enemy);

    // Award experience
    const experienceReward = this.getExperienceReward(enemy.type);
    const defeatResult = this.gameState.handleEnemyDefeated(experienceReward);

    // Check if leveled up and should start level overlay
    if (defeatResult?.leveledUp && this.shouldStartLevelOverlay()) {
      this.gameState.startLevelUpSelectionIfNeeded();
    }
  }


  checkCollisionAt(x: number, y: number): void {
    const enemies = this.gameState.getEnemies();
    const playerRoom = this.gameState.getPlayer().roomIndex;
    const index = enemies.findIndex(
      (enemy) => enemy.roomIndex === playerRoom && enemy.x === x && enemy.y === y,
    );
    if (index !== -1) {
      const enemy = enemies[index];
      if (this.canAssassinate(enemy)) {
        this.assassinateEnemy(index);
        return;
      }
      this.handleEnemyCollision(index);
    }
  }

  clamp(v: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, v));
  }

  getRoomSize(): number {
    return 8;
  }

  defaultDirections(): number[][] {
    return [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
  }

  hasMovableEnemies(enemies: EnemyState[]): boolean {
    return Array.isArray(enemies) && enemies.length > 0;
  }

  tryMoveEnemy(enemies: EnemyState[], index: number, game: GameData, player: PlayerState | null): EnemyMovementResult {
    if (index < 0 || index >= enemies.length) {
      return EnemyMovementResultConst.None;
    }
    const enemy = enemies[index];
    enemy.type = this.normalizeEnemyType(enemy.type);
    if (enemy.playerInVision) return EnemyMovementResultConst.None;

    const dir = this.pickRandomDirection();
    const target = this.getTargetPosition(enemy, dir);
    const roomIndex = enemy.roomIndex;

    // Don't move into player's tile - trigger collision combat
    if (player && player.roomIndex === roomIndex && player.x === target.x && player.y === target.y) {
      // Trigger wind-up animation before attack
      if (enemy.id) {
        this.triggerEnemyWindup(enemy.id, { x: enemy.x, y: enemy.y }, { x: player.x, y: player.y });
      }
      // Trigger collision without moving - enemy initiated
      this.handleEnemyCollision(index, { initiator: 'enemy' });
      return EnemyMovementResultConst.Collided;
    }

    if (!this.canEnterTile(roomIndex, target.x, target.y, game, enemies, index)) {
      return EnemyMovementResultConst.None;
    }

    enemy.lastX = enemy.x;
    enemy.x = target.x;
    enemy.y = target.y;

    return this.resolvePostMove(roomIndex, target.x, target.y, index)
      ? EnemyMovementResultConst.Collided
      : EnemyMovementResultConst.Moved;
  }

  pickRandomDirection(): number[] {
    const base = this.directions;
    return base[Math.floor(Math.random() * base.length)];
  }

  getTargetPosition(enemy: EnemyState, direction: number[]): { x: number; y: number } {
    const size = this.getRoomSize();
    return {
      x: this.clamp(enemy.x + direction[0], 0, size - 1),
      y: this.clamp(enemy.y + direction[1], 0, size - 1),
    };
  }

  private tryChaseEnemy(
    enemy: EnemyState,
    index: number,
    game: GameData,
    player: PlayerState,
    enemies: EnemyState[],
  ): EnemyMovementResult {
    const directions = this.getChaseDirections(enemy, player);
    for (const direction of directions) {
      const target = this.getTargetPosition(enemy, direction);
      const roomIndex = enemy.roomIndex;

      // Don't move into player's tile - trigger collision combat
      if (player.roomIndex === roomIndex && player.x === target.x && player.y === target.y) {
        // Trigger wind-up animation before attack
        if (enemy.id) {
          this.triggerEnemyWindup(enemy.id, { x: enemy.x, y: enemy.y }, { x: player.x, y: player.y });
        }
        // Trigger collision without moving - enemy initiated
        this.handleEnemyCollision(index, { initiator: 'enemy' });
        return EnemyMovementResultConst.Collided;
      }

      if (!this.canEnterTile(roomIndex, target.x, target.y, game, enemies, index)) {
        continue;
      }
      enemy.lastX = enemy.x;
      enemy.x = target.x;
      enemy.y = target.y;
      return this.resolvePostMove(roomIndex, target.x, target.y, index)
        ? EnemyMovementResultConst.Collided
        : EnemyMovementResultConst.Moved;
    }
    return EnemyMovementResultConst.None;
  }

  moveChasingEnemies(player: PlayerState | null): void {
    if (!player) return;
    const enemies = this.getActiveEnemies();
    const game = this.gameState.getGame();
    let moved = false;
    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];
      if (!enemy.playerInVision) continue;
      const result = this.tryChaseEnemy(enemy, index, game, player, enemies);
      if (result === EnemyMovementResultConst.Moved) {
        moved = true;
      } else if (result === EnemyMovementResultConst.Collided) {
        moved = true;
        break;
      }
    }
    if (moved) {
      this.renderer.draw();
    }
  }

  evaluateVision(player: PlayerState | null): void {
    if (!player) return;
    const now = this.getNow();
    const enemies = this.getActiveEnemies();
    const visionRange = GameConfig.enemy.vision.range;
    const alertDuration = GameConfig.enemy.vision.alertDuration;
    for (const enemy of enemies) {
      if (enemy.roomIndex !== player.roomIndex) {
        enemy.playerInVision = false;
        enemy.alertStart = null;
        enemy.alertUntil = null;
        continue;
      }
      if (this.canAssassinate(enemy)) {
        enemy.playerInVision = false;
        enemy.alertStart = null;
        enemy.alertUntil = null;
        continue;
      }
      const dx = Math.abs(player.x - enemy.x);
      const dy = Math.abs(player.y - enemy.y);
      const inVision = dx <= visionRange && dy <= visionRange;
      if (inVision) {
        if (!enemy.playerInVision) {
          enemy.playerInVision = true;
          enemy.alertStart = now;
          enemy.alertUntil = now + alertDuration;
        }
      } else {
        enemy.playerInVision = false;
        enemy.alertStart = null;
        enemy.alertUntil = null;
      }
    }
  }

  private getChaseDirections(enemy: EnemyState, player: PlayerState): number[][] {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const candidate: number[][] = [];
    const signX = Math.sign(dx);
    const signY = Math.sign(dy);

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (signX) candidate.push([signX, 0]);
      if (signY) candidate.push([0, signY]);
    } else {
      if (signY) candidate.push([0, signY]);
      if (signX) candidate.push([signX, 0]);
    }
    if (signX && !candidate.some((dir) => dir[0] === signX && dir[1] === 0)) {
      candidate.push([signX, 0]);
    }
    if (signY && !candidate.some((dir) => dir[0] === 0 && dir[1] === signY)) {
      candidate.push([0, signY]);
    }
    if (!candidate.length) {
      candidate.push([0, 0]);
    }
    return candidate;
  }

  canEnterTile(roomIndex: number, x: number, y: number, game: GameData, enemies: EnemyState[], movingIndex: number): boolean {
    if (roomIndex < 0 || roomIndex >= game.rooms.length) return false;
    const room = game.rooms[roomIndex];
    const walls = room.walls;
    if (walls && Array.isArray(walls[y]) && walls[y][x]) return false;
    if (this.isTileBlocked(roomIndex, x, y)) return false;
    if (this.hasBlockingObject(roomIndex, x, y)) return false;
    return !this.isOccupied(enemies, movingIndex, roomIndex, x, y);
  }

  isTileBlocked(roomIndex: number, x: number, y: number): boolean {
    const tileMap = this.tileManager.getTileMap(roomIndex);
    if (!tileMap) return false;
    const groundRow = Array.isArray(tileMap.ground) ? tileMap.ground[y] : undefined;
    const overlayRow = Array.isArray(tileMap.overlay) ? tileMap.overlay[y] : undefined;
    const groundId = groundRow ? groundRow[x] : null;
    const overlayId = overlayRow ? overlayRow[x] : null;
    const candidateId = overlayId ?? groundId;
    if (candidateId === null) return false;
    const tile = this.tileManager.getTile(candidateId);
    return Boolean(tile && tile.collision);
  }

  hasBlockingObject(roomIndex: number, x: number, y: number): boolean {
    const OT = ITEM_TYPES;
    const blockingObject = this.gameState.getObjectAt(roomIndex, x, y);
    if (!blockingObject) return false;
    if (blockingObject.type === OT.DOOR && !blockingObject.opened) return true;
    if (blockingObject.type === OT.DOOR_VARIABLE) {
      const isOpen = blockingObject.variableId ? this.gameState.isVariableOn(blockingObject.variableId) : false;
      return !isOpen;
    }
    return false;
  }

  isOccupied(enemies: EnemyState[], movingIndex: number, roomIndex: number, x: number, y: number): boolean {
    return enemies.some((other, index) => index !== movingIndex && other.roomIndex === roomIndex && other.x === x && other.y === y);
  }

  resolvePostMove(roomIndex: number, x: number, y: number, enemyIndex: number): boolean {
    const player = this.gameState.getPlayer();
    if (player.roomIndex === roomIndex && player.x === x && player.y === y) {
      if (this.tryStealthAssassination(enemyIndex)) {
        return true;
      }
      this.handleEnemyCollision(enemyIndex, { skipAssassinate: true, initiator: 'enemy' });
      return true;
    }
    return false;
  }

  collideAt(roomIndex: number, x: number, y: number): boolean {
    const enemies = this.gameState.getEnemies();
    const index = enemies.findIndex((enemy) => enemy.roomIndex === roomIndex && enemy.x === x && enemy.y === y);
    if (index === -1) return false;
    this.handleEnemyCollision(index);
    return true;
  }

  normalizeEnemyType(type: string): string {
    return EnemyDefinitions.normalizeType(type);
  }

  getEnemyDefinition(type: string): EnemyDefinitionData | null {
    return EnemyDefinitions.getEnemyDefinition(type);
  }

  enemyHasEyes(enemy: EnemyState): boolean {
    const definition = this.getEnemyDefinition(enemy.type);
    if (!definition) return true;
    if (definition.hasEyes === false) return false;
    return true;
  }

  canAssassinate(enemy: EnemyState): boolean {
    return this.combatManager.canAssassinate(enemy);
  }

  tryStealthAssassination(enemyIndex: number): boolean {
    return this.combatManager.tryStealthAssassination(enemyIndex);
  }

  assassinateEnemy(enemyIndex: number): void {
    this.combatManager.assassinateEnemy(enemyIndex);
  }

  showStealthKillFeedback(): void {
    this.combatManager.showStealthKillFeedback();
  }

  showStealthMissFeedback(): void {
    this.combatManager.showStealthMissFeedback();
  }

  shouldStartLevelOverlay(): boolean {
    const pendingChoices = this.gameState.getPendingLevelUpChoices();
    return pendingChoices > 0;
  }

  getEnemyDamage(type: string): number {
    return this.combatManager.getEnemyDamage(type);
  }

  /**
   * Get enemy max lives from definition
   * Lives define how many gray squares appear above enemy head
   * Giant Rat (vida 1) = 1 square, Ancient Demon (vida 8) = 8 squares
   */
  getEnemyMaxLives(type: string): number {
    const definition = this.getEnemyDefinition(type);
    if (definition && typeof definition.lives === 'number' && Number.isFinite(definition.lives)) {
      const livesValue = Number(definition.lives);
      return Math.max(1, livesValue);
    }
    return 1; // Fallback to 1 life if definition not found
  }

  /**
   * Migrate all enemies from old tiered system to new lives-based system
   * Called once when game starts to fix enemies saved with old system
   */
  migrateEnemyLives(): void {
    const enemies = this.gameState.getEnemies();
    enemies.forEach(enemy => {
      const expectedLives = this.getEnemyMaxLives(enemy.type);

      // Migrate if lives don't match expected (old system had different values)
      // Only migrate if lives seem to be from initialization (1-4 range from old tiers)
      // AND they don't match the new expected value
      const looksLikeOldSystem =
        typeof enemy.lives === 'number' &&
        enemy.lives >= 1 &&
        enemy.lives <= 4 &&
        enemy.lives !== expectedLives;

      if (looksLikeOldSystem) {
        enemy.lives = expectedLives;
      }

      // Also fix if lives are missing or invalid
      if (typeof enemy.lives !== 'number' || enemy.lives <= 0) {
        enemy.lives = expectedLives;
      }
    });
  }

  /**
   * Ensure enemy has lives initialized
   * Only resets lives if they are missing or invalid
   * Does NOT migrate during combat - migration happens at game start
   */
  ensureEnemyLives(enemy: EnemyState): void {
    this.combatManager.ensureEnemyLives(enemy);
  }

  getExperienceReward(type: string): number {
    return EnemyDefinitions.getExperienceReward(type);
  }

  getEnemyMissChance(type: string): number {
    return this.combatManager.getEnemyMissChance(type);
  }

  checkAllEnemiesCleared(): void {
    const remaining = this.gameState.getEnemies().length;
    if (remaining <= 0) {
      const text = getEnemyLocaleText('game.clearAllEnemies', '');
      if (text) {
        if (this.dialogManager && this.dialogManager.showDialog) {
          this.dialogManager.showDialog(text);
        }
      }
    }
  }

  normalizeMissChance(value: number): number {
    return this.combatManager.normalizeMissChance(value);
  }

  attackMissed(chance?: number): boolean {
    return this.combatManager.attackMissed(chance);
  }

    getDefeatVariableConfig(enemy: EnemyState): { variableId: string; persist: boolean; message: string | null } | null {
    const definition = this.getEnemyDefinition(enemy.type);
    const baseConfig =
      definition?.activateVariableOnDefeat && typeof definition.activateVariableOnDefeat === 'object'
        ? definition.activateVariableOnDefeat
        : null;
    let variableId = typeof enemy.defeatVariableId === 'string' ? enemy.defeatVariableId : null;
    if (!variableId) {
      const fallbackId = typeof baseConfig?.variableId === 'string' ? baseConfig.variableId : null;
      variableId = fallbackId;
    }
    variableId = this.gameState.normalizeVariableId(variableId);
    if (!variableId) return null;
    const persist = baseConfig?.persist !== undefined ? Boolean(baseConfig.persist) : true;
    let message = null;
    if (typeof baseConfig?.message === 'string' && baseConfig.message.trim().length) {
      message = baseConfig.message.trim();
    } else if (baseConfig?.messageKey) {
      message = getEnemyLocaleText(baseConfig.messageKey, baseConfig.message || '');
    } else if (definition?.defeatActivationMessageKey) {
      message = getEnemyLocaleText(
        definition.defeatActivationMessageKey,
        definition.defeatActivationMessage?.trim() || '',
      );
    } else if (typeof definition?.defeatActivationMessage === 'string' && definition.defeatActivationMessage.trim().length) {
      message = definition.defeatActivationMessage.trim();
    }
    return { variableId, persist, message };
  }

  tryTriggerDefeatVariable(enemy: EnemyState): boolean {
    const config = this.getDefeatVariableConfig(enemy);
    if (!config) return false;
    const [updated] = this.gameState.setVariableValue(config.variableId, true, config.persist);
    const isActive = this.gameState.isVariableOn(config.variableId);
    if (!updated && !isActive) {
      return false;
    }

    if (config.message) {
      this.renderer.showCombatIndicator(config.message, { duration: 900 });
    }
    return true;
  }

  showMissFeedback(): void {
    this.combatManager.showMissFeedback();
  }

  /**
   * Trigger wind-up animation for enemy attack (one-time, not continuous)
   * Called right before enemy executes attack
   */
  triggerEnemyWindup(enemyId: string, enemyPos: { x: number; y: number }, playerPos: { x: number; y: number }): void {
    const telegraphConfig = GameConfig.combat.telegraph;
    if (!telegraphConfig.enabled) return;

    const attackTelegraph = this.renderer.attackTelegraph;
    if (!attackTelegraph) return;

    // Calculate direction from enemy to player
    const directionToPlayer = {
      x: playerPos.x - enemyPos.x,
      y: playerPos.y - enemyPos.y
    };

    attackTelegraph.activateTelegraph(enemyId, directionToPlayer);
  }

  getNow() {
    const perf = (globalThis as Partial<typeof globalThis>).performance;
    if (perf) {
      return perf.now();
    }
    return Date.now();
  }

  /**
   * Check if there's an enemy adjacent (within 1 tile) to the given position
   */
  hasEnemyNear(roomIndex: number, x: number, y: number): boolean {
    const enemies = this.gameState.getEnemies();
    if (!Array.isArray(enemies) || enemies.length === 0) {
      return false;
    }

    // Check all 8 adjacent positions (including diagonals)
    return enemies.some(enemy => {
      if (enemy.roomIndex !== roomIndex) return false;
      if (typeof enemy.x !== 'number' || typeof enemy.y !== 'number') return false;

      // Check if enemy is at player's position or adjacent
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });
  }
}

export { EnemyManager };
