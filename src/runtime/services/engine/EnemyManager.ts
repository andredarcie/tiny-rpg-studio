import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { TextResources } from '../../adapters/TextResources';
import { GameConfig } from '../../../config/GameConfig';
import { isTrapActive } from '../../domain/state/TrapState';
import { CombatManager } from './CombatManager';
import { soundEngine } from '../SoundEngine';
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
  windupTimers: Set<ReturnType<typeof setTimeout>>;
  private windupTimersByEnemy: Map<string, Set<ReturnType<typeof setTimeout>>> = new Map();
  activeRooms: ReadonlySet<number> | null = null;
  private remotePlayers: Array<{ id: string; x: number; y: number; roomIndex: number; alive?: boolean }> = [];
  onEnemyAttackedRemotePlayer: ((playerId: string, damage: number) => void) | null = null;
  onGuestAttack: ((enemyId: string) => void) | null = null;
  onEnemyStateChanged: (() => void) | null = null;

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
    this.onEnemyStateChanged = options.onEnemyStateChanged ?? null;
    this.windupTimers = new Set();

    // Initialize CombatManager with callbacks
    this.combatManager = new CombatManager(gameState, renderer, {
      onPlayerDefeated: this.onPlayerDefeated,
      fallbackMissChance: this.fallbackMissChance,
      combatStunManager: this.combatStunManager,
      playerManager: this.playerManager,
      onEnemyDefeated: (enemyId: string, enemy: EnemyState) => {
        this.handleEnemyDefeated(enemyId, enemy);
        options.onEnemyDefeated?.(enemyId, enemy);
      },
      shouldStartLevelOverlay: () => {
        return this.shouldStartLevelOverlay();
      },
    });
  }

  isInCombat(): boolean {
    return this.combatManager.isInCombat() || this.windupTimers.size > 0;
  }

  getEnemyDefinitions(): unknown {
    return this.gameState.getEnemyDefinitions?.();
  }

  getActiveEnemies(): EnemyState[] {
    return this.gameState.getEnemies();
  }

  addEnemy(enemy: EnemyInput): string | null {
    const id = enemy.id || this.generateEnemyId();
    const type = this.normalizeEnemyType(enemy.type);
    const maxLives = this.getEnemyMaxLives(type);
    const addedId = this.gameState.addEnemy?.({
      id,
      type,
      roomIndex: enemy.roomIndex ?? 0,
      x: enemy.x,
      y: enemy.y,
      lastX: enemy.lastX ?? enemy.x,
      lastY: enemy.lastY ?? enemy.y,
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
    this.gameState.removeEnemy?.(enemyId);
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

  setActiveRooms(rooms: ReadonlySet<number> | null): void {
    this.activeRooms = rooms;
  }

  setRemotePlayers(players: Array<{ id: string; x: number; y: number; roomIndex: number; alive?: boolean }>): void {
    this.remotePlayers = players;
  }

  private findNearestTarget(
    enemy: EnemyState,
    localPlayer: { x: number; y: number; roomIndex: number } | null,
  ): { x: number; y: number; roomIndex: number; remoteId?: string } | null {
    type Candidate = { x: number; y: number; roomIndex: number; remoteId?: string; dist: number };
    const candidates: Candidate[] = [];
    if (localPlayer && localPlayer.roomIndex === enemy.roomIndex) {
      const dist = Math.abs(localPlayer.x - enemy.x) + Math.abs(localPlayer.y - enemy.y);
      candidates.push({ x: localPlayer.x, y: localPlayer.y, roomIndex: localPlayer.roomIndex, dist });
    }
    for (const rp of this.remotePlayers) {
      if (rp.roomIndex === enemy.roomIndex && rp.alive !== false) {
        const dist = Math.abs(rp.x - enemy.x) + Math.abs(rp.y - enemy.y);
        candidates.push({ x: rp.x, y: rp.y, roomIndex: rp.roomIndex, remoteId: rp.id, dist });
      }
    }
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (a.dist <= b.dist ? a : b));
  }

  private trackWindupTimer(enemyId: string | undefined, timer: ReturnType<typeof setTimeout>): void {
    this.windupTimers.add(timer);
    if (enemyId) {
      let timers = this.windupTimersByEnemy.get(enemyId);
      if (!timers) {
        timers = new Set();
        this.windupTimersByEnemy.set(enemyId, timers);
      }
      timers.add(timer);
    }
  }

  cancelWindupTimersForEnemy(enemyId: string): void {
    const timers = this.windupTimersByEnemy.get(enemyId);
    if (!timers) return;
    for (const t of timers) {
      clearTimeout(t);
      this.windupTimers.delete(t);
    }
    this.windupTimersByEnemy.delete(enemyId);
  }

  private triggerCollisionWithTarget(
    enemy: EnemyState,
    enemyIndex: number,
    target: { x: number; y: number; roomIndex: number; remoteId?: string },
  ): void {
    if (target.remoteId) {
      const remoteId = target.remoteId;
      if (enemy.id) {
        this.triggerEnemyWindup(enemy.id, { x: enemy.x, y: enemy.y }, { x: target.x, y: target.y });
        const timer = setTimeout(() => {
          this.windupTimers.delete(timer);
          this.windupTimersByEnemy.get(enemy.id)?.delete(timer);
          // Guard: don't attack if the enemy has died in the meantime
          if (EnemyDefinitions.isDying(enemy)) return;
          // Re-check melee range against the remote player's CURRENT position so a
          // guest can escape during the wind-up, exactly like the local player can
          // (CombatManager.checkCombatRangeOrCancel). Skip if they moved away, left
          // the room, or died while the wind-up animation played.
          const rp = this.remotePlayers.find((p) => p.id === remoteId);
          if (!rp || rp.alive === false || rp.roomIndex !== enemy.roomIndex) return;
          if (Math.max(Math.abs(rp.x - enemy.x), Math.abs(rp.y - enemy.y)) > 1) return;
          this.onEnemyAttackedRemotePlayer?.(remoteId, 1);
        }, GameConfig.combat.lungeAnimationDuration);
        this.trackWindupTimer(enemy.id, timer);
      } else {
        this.onEnemyAttackedRemotePlayer?.(remoteId, 1);
      }
    } else {
      if (enemy.id) {
        this.triggerEnemyWindup(enemy.id, { x: enemy.x, y: enemy.y }, { x: target.x, y: target.y });
        const timer = setTimeout(() => {
          this.windupTimers.delete(timer);
          this.windupTimersByEnemy.get(enemy.id)?.delete(timer);
          if (EnemyDefinitions.isDying(enemy)) return;
          // Resolve the originally-captured enemy by identity: the shared array
          // may have shifted (an earlier enemy removed) during the wind-up, which
          // would leave the captured numeric index pointing at the wrong enemy.
          const currentIndex = this.gameState.getEnemies().indexOf(enemy);
          if (currentIndex < 0) return;
          this.handleEnemyCollision(currentIndex, { initiator: 'enemy' });
        }, GameConfig.combat.lungeAnimationDuration);
        this.trackWindupTimer(enemy.id, timer);
      } else {
        this.handleEnemyCollision(enemyIndex, { initiator: 'enemy' });
      }
    }
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
    // Cancel all pending wind-up timers
    this.windupTimers.forEach(timer => clearTimeout(timer));
    this.windupTimers.clear();
    this.windupTimersByEnemy.clear();
  }

  tick(): void {
    if (!this.gameState.playing) return;
    if (this.gameState.isEditorModeActive()) return;

    const enemies = this.gameState.getEnemies();
    if (!this.hasMovableEnemies(enemies)) return;

    const game = this.gameState.getGame?.();
    if (!game) return;

    const player = this.gameState.getPlayer();
    this.evaluateVision(player);
    let moved = false;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      // Skip dying enemies (in death animation) - they should not move
      if (EnemyDefinitions.isDying(enemy)) {
        continue;
      }

      // Only simulate enemies in an active room. Online-host sets activeRooms
      // explicitly; in solo we scope to the player's current room so off-screen
      // rooms aren't simulated (and don't force a redraw every tick). See AP-7.
      if (!this.isRoomActive(enemy.roomIndex, player)) {
        continue;
      }

      // Use nearest player (local or remote) as the chase/movement target
      const nearestTarget = this.findNearestTarget(enemy, player) ?? player;

      const result =
        enemy.playerInVision
          ? this.tryChaseEnemy(enemy, i, game, nearestTarget, enemies)
          : this.tryMoveEnemy(enemies, i, game, nearestTarget);
      if (result === EnemyMovementResultConst.Moved) {
        moved = true;
      } else if (result === EnemyMovementResultConst.Collided) {
        moved = true;
        break;
      }
    }

    if (moved) {
      this.renderer.draw();
      this.onEnemyStateChanged?.();
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

    if (defeatResult?.leveledUp) {
      soundEngine.play('levelUp');
      if (this.shouldStartLevelOverlay()) {
        this.gameState.startLevelUpSelectionIfNeeded();
      }
    }
  }


  checkCollisionAt(x: number, y: number): void {
    const enemies = this.gameState.getEnemies();
    const playerRoom = this.gameState.getPlayer().roomIndex;
    const index = enemies.findIndex(
      (enemy) => enemy.roomIndex === playerRoom && enemy.x === x && enemy.y === y,
    );
    if (index !== -1) {
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

  findFreeDirection(enemy: EnemyState, game: GameData, enemies: EnemyState[], enemyIndex: number): number[] | null {
    const currentDir = [enemy.moveDirectionX ?? 0, enemy.moveDirectionY ?? 0];

    // Try all directions except the current blocked one
    const allDirections = this.directions.filter(dir =>
      !(dir[0] === 0 && dir[1] === 0) // Exclude [0,0] (no movement)
    );

    // Shuffle directions to avoid predictable patterns
    const shuffledDirections = allDirections.sort(() => Math.random() - 0.5);

    for (const dir of shuffledDirections) {
      // Skip the current direction that's blocked
      if (dir[0] === currentDir[0] && dir[1] === currentDir[1]) {
        continue;
      }

      const target = this.getTargetPosition(enemy, dir);
      if (this.canEnterTile(enemy.roomIndex, target.x, target.y, game, enemies, enemyIndex)) {
        return dir;
      }
    }

    return null; // No free direction found
  }

  tryMoveEnemy(
    enemies: EnemyState[],
    index: number,
    game: GameData,
    player: { x: number; y: number; roomIndex: number; remoteId?: string } | null,
  ): EnemyMovementResult {
    if (index < 0 || index >= enemies.length) {
      return EnemyMovementResultConst.None;
    }
    const enemy = enemies[index];
    enemy.type = this.normalizeEnemyType(enemy.type);
    if (enemy.playerInVision) return EnemyMovementResultConst.None;

    // Movement inertia: keep moving in same direction for stability
    let dir: number[];
    const hasActiveDirection = typeof enemy.moveDirectionSteps === 'number' && enemy.moveDirectionSteps > 0;

    if (hasActiveDirection && typeof enemy.moveDirectionX === 'number' && typeof enemy.moveDirectionY === 'number') {
      // Continue in current direction
      dir = [enemy.moveDirectionX, enemy.moveDirectionY];
      enemy.moveDirectionSteps = (enemy.moveDirectionSteps ?? 0) - 1;
    } else {
      // Pick new direction and commit to it for 2 moves
      dir = this.pickRandomDirection();
      enemy.moveDirectionX = dir[0];
      enemy.moveDirectionY = dir[1];
      enemy.moveDirectionSteps = 2; // Move in this direction for 2 steps
    }

    const target = this.getTargetPosition(enemy, dir);
    const roomIndex = enemy.roomIndex;

    // Don't move into any player's tile - trigger collision combat
    if (player && player.roomIndex === roomIndex && player.x === target.x && player.y === target.y) {
      this.triggerCollisionWithTarget(enemy, index, player);
      return EnemyMovementResultConst.Collided;
    }

    if (!this.canEnterTile(roomIndex, target.x, target.y, game, enemies, index)) {
      // Can't move in current direction - try to find an unblocked direction
      const freeDirection = this.findFreeDirection(enemy, game, enemies, index);
      if (freeDirection) {
        // Found a free direction - commit to it
        enemy.moveDirectionX = freeDirection[0];
        enemy.moveDirectionY = freeDirection[1];
        enemy.moveDirectionSteps = 2;

        // Try to move in the new direction
        const newTarget = this.getTargetPosition(enemy, freeDirection);

        // Don't move into any player's tile
        if (player && player.roomIndex === roomIndex && player.x === newTarget.x && player.y === newTarget.y) {
          this.triggerCollisionWithTarget(enemy, index, player);
          return EnemyMovementResultConst.Collided;
        }

        // Move to the new position
        enemy.lastX = enemy.x;
        enemy.lastY = enemy.y;
        enemy.x = newTarget.x;
        enemy.y = newTarget.y;

        return this.resolvePostMove(roomIndex, newTarget.x, newTarget.y, index)
          ? EnemyMovementResultConst.Collided
          : EnemyMovementResultConst.Moved;
      } else {
        // No free direction found - stay in place
        enemy.moveDirectionSteps = 0;
        return EnemyMovementResultConst.None;
      }
    }

    // Update last known positions before moving
    enemy.lastX = enemy.x;
    enemy.lastY = enemy.y;
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
    player: { x: number; y: number; roomIndex: number; remoteId?: string },
    enemies: EnemyState[],
  ): EnemyMovementResult {
    const directions = this.getChaseDirections(enemy, player);
    for (const direction of directions) {
      const target = this.getTargetPosition(enemy, direction);
      const roomIndex = enemy.roomIndex;

      // Don't move into any player's tile - trigger collision combat
      if (player.roomIndex === roomIndex && player.x === target.x && player.y === target.y) {
        this.triggerCollisionWithTarget(enemy, index, player);
        return EnemyMovementResultConst.Collided;
      }

      if (!this.canEnterTile(roomIndex, target.x, target.y, game, enemies, index)) {
        continue;
      }
      // Update last known positions before moving
      enemy.lastX = enemy.x;
      enemy.lastY = enemy.y;
      enemy.x = target.x;
      enemy.y = target.y;
      return this.resolvePostMove(roomIndex, target.x, target.y, index)
        ? EnemyMovementResultConst.Collided
        : EnemyMovementResultConst.Moved;
    }
    return EnemyMovementResultConst.None;
  }

  moveChasingEnemies(player: { x: number; y: number; roomIndex: number; remoteId?: string } | null): void {
    if (!player) return;
    const enemies = this.getActiveEnemies();
    const game = this.gameState.getGame?.();
    if (!game) return;

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
      this.onEnemyStateChanged?.();
    }
  }

  /**
   * Check if enemy can see player based on directional vision
   * Enemies can ONLY see in the direction they are facing - NEVER 360°
   */
  private canEnemySeePlayer(enemy: EnemyState, player: { x: number; y: number }): boolean {
    // Get last known positions (default to current position if never set)
    const lastX = typeof enemy.lastX === 'number' ? enemy.lastX : enemy.x;
    const lastY = typeof enemy.lastY === 'number' ? enemy.lastY : enemy.y;

    // Calculate movement deltas
    const deltaX = enemy.x - lastX;
    const deltaY = enemy.y - lastY;

    // Determine which axis had more movement to decide primary facing direction
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Stopped after having a vertical history (moved, then stopped): face down.
    if (absDeltaX === 0 && absDeltaY === 0 && typeof enemy.lastY === 'number') {
      return player.y >= enemy.y;
    }
    // Stopped with NO vertical history (a freshly-spawned, never-moved enemy):
    // keep the default right-facing AND, like any stopped enemy, also notice
    // anything strictly below it. Still blind up-and-to-the-left, so not 360°.
    if (absDeltaX === 0 && absDeltaY === 0) {
      return player.x >= enemy.x || player.y > enemy.y;
    }

    // If enemy is moving or has moved primarily horizontally
    if (absDeltaX >= absDeltaY) {
      // Facing direction based on X movement (or default to right if no movement)
      const facingRight = deltaX >= 0;
      // Can ONLY see in facing direction
      return facingRight ? player.x >= enemy.x : player.x <= enemy.x;
    } else {
      // Facing direction based on Y movement
      const facingDown = deltaY >= 0;
      // Can ONLY see in facing direction
      return facingDown ? player.y >= enemy.y : player.y <= enemy.y;
    }
  }

  /**
   * Whether an enemy's room should be simulated this tick. Online-host scopes to
   * the set of rooms with active players (`activeRooms`); in solo we scope to the
   * player's current room so enemies off-screen aren't simulated. See AP-7.
   */
  private isRoomActive(roomIndex: number, player: { roomIndex: number } | null): boolean {
    if (this.activeRooms !== null) return this.activeRooms.has(roomIndex);
    if (!player) return true;
    return roomIndex === player.roomIndex;
  }

  evaluateVision(player: PlayerState | null): void {
    if (!player) return;
    const now = this.getNow();
    const enemies = this.getActiveEnemies();
    const visionRange = GameConfig.enemy.vision.range;
    const alertDuration = GameConfig.enemy.vision.alertDuration;
    for (const enemy of enemies) {
      // Skip dying enemies (in death animation) - they should not detect player
      if (EnemyDefinitions.isDying(enemy)) {
        enemy.playerInVision = false;
        enemy.alertStart = null;
        enemy.alertUntil = null;
        continue;
      }

      // Enemies outside the active room can't see the player — clear their vision
      // cheaply without the distance/facing math. See AP-7.
      if (!this.isRoomActive(enemy.roomIndex, player)) {
        enemy.playerInVision = false;
        enemy.alertStart = null;
        enemy.alertUntil = null;
        continue;
      }

      // Use nearest player (local or remote) for vision check
      const target = this.findNearestTarget(enemy, player);
      if (!target) {
        enemy.playerInVision = false;
        enemy.alertStart = null;
        enemy.alertUntil = null;
        continue;
      }

      const dx = Math.abs(target.x - enemy.x);
      const dy = Math.abs(target.y - enemy.y);
      const inRange = dx <= visionRange && dy <= visionRange;
      const canSee = this.canEnemySeePlayer(enemy, target);
      const inVision = inRange && canSee;
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

  private getChaseDirections(enemy: EnemyState, player: { x: number; y: number }): number[][] {
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
    if (this.isNpcAt(game, roomIndex, x, y)) return false;
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
    const blockingObject = this.gameState.getObjectAt?.(roomIndex, x, y);
    const objects = this.gameState.getObjectsAt?.(roomIndex, x, y)
      ?? (blockingObject ? [blockingObject] : []);
    return objects.some((object) => {
      if (object.type === OT.DOOR && !object.opened) return true;
      if (object.type === OT.DOOR_VARIABLE) {
        const isOpen = object.variableId ? this.gameState.isVariableOn?.(object.variableId) : false;
        return !isOpen;
      }
      return object.type === OT.TRAP
        && object.solid === true
        && isTrapActive(object, (variableId) => this.gameState.isVariableOn?.(variableId) ?? false);
    });
  }

  isOccupied(enemies: EnemyState[], movingIndex: number, roomIndex: number, x: number, y: number): boolean {
    return enemies.some((other, index) => index !== movingIndex && other.roomIndex === roomIndex && other.x === x && other.y === y);
  }

  isNpcAt(game: GameData, roomIndex: number, x: number, y: number): boolean {
    if (!Array.isArray(game.sprites)) return false;
    return game.sprites.some((npc) => npc.placed && npc.roomIndex === roomIndex && npc.x === x && npc.y === y);
  }

  resolvePostMove(roomIndex: number, x: number, y: number, enemyIndex: number): boolean {
    const player = this.gameState.getPlayer();
    if (player.roomIndex === roomIndex && player.x === x && player.y === y) {
      this.handleEnemyCollision(enemyIndex, { initiator: 'enemy' });
      return true;
    }
    // Check remote players
    for (const rp of this.remotePlayers) {
      if (rp.roomIndex === roomIndex && rp.x === x && rp.y === y) {
        const enemies = this.gameState.getEnemies();
        const enemy = enemies[enemyIndex];
        this.triggerCollisionWithTarget(enemy, enemyIndex, { ...rp, remoteId: rp.id });
        return true;
      }
    }
    return false;
  }

  collideAt(roomIndex: number, x: number, y: number): boolean {
    const enemies = this.gameState.getEnemies();
    const index = enemies.findIndex((enemy) => enemy.roomIndex === roomIndex && enemy.x === x && enemy.y === y);
    if (index === -1) return false;
    const enemy = enemies[index];
    // In online-guest mode, relay attack to Host instead of processing locally
    if (this.onGuestAttack && enemy.id) {
      this.onGuestAttack(enemy.id);
      return true;
    }
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
    const definition = this.getEnemyDefinition(type) as EnemyDefinitionData & { lives?: number };
    if (typeof definition.lives === 'number' && Number.isFinite(definition.lives)) {
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
    variableId = this.gameState.normalizeVariableId?.(variableId) ?? null;
    if (!variableId) return null;
    // Defeating an enemy is GAMEPLAY, so by default it only sets the runtime
    // variable (which opens the gate for this playthrough). It must NOT persist
    // into the authored definition — doing so left the variable stuck ON forever
    // in the editor and made a fresh game start with the gate already open even
    // though the boss had respawned. Persisting remains opt-in per enemy config.
    const persist = baseConfig?.persist !== undefined ? Boolean(baseConfig.persist) : false;
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
    const result = this.gameState.setVariableValue?.(config.variableId, true, config.persist);
    const [updated] = result ?? [false];
    const isActive = this.gameState.isVariableOn?.(config.variableId);
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
