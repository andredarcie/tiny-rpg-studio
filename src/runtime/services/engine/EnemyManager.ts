import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { TextResources } from '../../adapters/TextResources';
import type { EnemyDefinition } from '../../../types/gameState';
import { GameConfig } from '../../../config/GameConfig';

type GameStateApi = {
  playing: boolean;
  isEditorModeActive?: () => boolean;
  getEnemyDefinitions: () => unknown;
  getEnemies: () => EnemyState[];
  addEnemy: (enemy: EnemyState) => string | null;
  removeEnemy: (id: string) => void;
  getGame: () => GameData;
  getPlayer: () => PlayerState;
  isPlayerOnDamageCooldown: () => boolean;
  damagePlayer: (amount: number) => number;
  consumeLastDamageReduction: () => number;
  consumeRecentReviveFlag?: () => boolean;
  handleEnemyDefeated: (xp: number) => { leveledUp?: boolean } | null;
  getPendingLevelUpChoices?: () => number;
  startLevelUpSelectionIfNeeded?: () => void;
  prepareNecromancerRevive?: () => void;
  isVariableOn: (id: string) => boolean;
  normalizeVariableId: (id: string | null) => string | null;
  setVariableValue: (id: string, value: boolean, persist?: boolean) => Array<boolean | undefined>;
  getObjectAt?: (roomIndex: number, x: number, y: number) => GameObjectState | null;
  hasSkill?: (skillId: string) => boolean;
};

type RendererApi = {
  draw: () => void;
  flashScreen: (payload: Record<string, unknown>) => void;
  showCombatIndicator: (text: string, options?: Record<string, unknown>) => void;
};

type TileManagerApi = {
  getTileMap: (roomIndex: number) => TileMapState | null;
  getTile: (tileId: string | number) => TileDefinition | null;
};

type Options = {
  onPlayerDefeated?: () => void;
  interval?: number;
  directions?: number[][];
  dialogManager?: { showDialog?: (text: string) => void } | null;
  missChance?: number;
};

type PlayerState = {
  roomIndex: number;
  x: number;
  y: number;
};

type RoomState = {
  walls?: boolean[][];
};

type GameData = {
  rooms: RoomState[];
};

type EnemyState = EnemyDefinition;

const EnemyMovementResult = {
  None: 'none',
  Moved: 'moved',
  Collided: 'collided',
} as const;

type EnemyMovementResult = typeof EnemyMovementResult[keyof typeof EnemyMovementResult];

type EnemyInput = {
  id?: string;
  type: string;
  roomIndex?: number;
  x: number;
  y: number;
  lastX?: number;
  defeatVariableId?: string | null;
};

type GameObjectState = {
  type: string;
  opened?: boolean;
  variableId?: string | null;
};

type TileMapState = {
  ground?: (string | number | null)[][];
  overlay?: (string | number | null)[][];
};

type TileDefinition = {
  collision?: boolean;
};

type DefeatVariableConfig = {
  variableId?: string;
  persist?: boolean;
  message?: string;
  messageKey?: string;
};

type EnemyDefinitionData = {
  hasEyes?: boolean;
  damage?: number;
  activateVariableOnDefeat?: DefeatVariableConfig | null;
  defeatActivationMessageKey?: string;
  defeatActivationMessage?: string;
};

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

class EnemyManager {
  gameState: GameStateApi;
  renderer: RendererApi;
  tileManager: TileManagerApi;
  onPlayerDefeated: () => void;
  interval: number;
  enemyMoveTimer: ReturnType<typeof setInterval> | null;
  directions: number[][];
  dialogManager: Options['dialogManager'] | null;
  fallbackMissChance: number;

  constructor(gameState: GameStateApi, renderer: RendererApi, tileManager: TileManagerApi, options: Options = {}) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.tileManager = tileManager;
    this.onPlayerDefeated = options.onPlayerDefeated || (() => {});
    this.interval = options.interval || GameConfig.enemy.movementInterval;
    this.enemyMoveTimer = null;
    this.directions = options.directions || this.defaultDirections();
    this.dialogManager = options.dialogManager || null;
    this.fallbackMissChance = this.normalizeMissChance(
      options.missChance === undefined ? GameConfig.enemy.fallbackMissChance : options.missChance
    );
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
    const addedId = this.gameState.addEnemy({
      id,
      type,
      roomIndex: enemy.roomIndex ?? 0,
      x: enemy.x,
      y: enemy.y,
      lastX: enemy.lastX ?? enemy.x,
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
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : globalThis.crypto;
    if (cryptoObj && cryptoObj.randomUUID) {
      return cryptoObj.randomUUID();
    }
    return `enemy-${Math.random().toString(36).slice(2, 10)}`;
  }

  start(): void {
    if (this.enemyMoveTimer) {
      clearInterval(this.enemyMoveTimer);
    }
    this.enemyMoveTimer = setInterval(() => this.tick(), this.interval);
  }

  stop(): void {
    if (this.enemyMoveTimer) {
      clearInterval(this.enemyMoveTimer);
      this.enemyMoveTimer = null;
    }
  }

  tick(): void {
    if (!this.gameState.playing) return;
    if (this.gameState.isEditorModeActive?.()) return;

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
          : this.tryMoveEnemy(enemies, i, game);
      if (result === EnemyMovementResult.Moved) {
        moved = true;
      } else if (result === EnemyMovementResult.Collided) {
        moved = true;
        break;
      }
    }

    if (moved) {
      this.renderer.draw();
    }
  }

  handleEnemyCollision(enemyIndex: number): void {
    if (this.gameState.isPlayerOnDamageCooldown()) {
      this.renderer.showCombatIndicator(getEnemyLocaleText('combat.cooldown', ''), { duration: 700 });
      return;
    }

    const enemies = this.gameState.getEnemies();
    const enemy = enemies[enemyIndex];
    if (!enemy) return;
    enemy.type = this.normalizeEnemyType(enemy.type);
    if (this.canAssassinate(enemy)) {
      this.assassinateEnemy(enemyIndex);
      return;
    }
    const missChance = this.getEnemyMissChance(enemy.type);
    const attackMissed = this.attackMissed(missChance);

    enemies.splice(enemyIndex, 1);

    if (attackMissed) {
      this.showMissFeedback();
    } else {
      const damage = this.getEnemyDamage(enemy.type);
      const lives = this.gameState.damagePlayer(damage);
      const reduction = this.gameState.consumeLastDamageReduction();
      const revived = this.gameState.consumeRecentReviveFlag?.() || false;
      if (revived) {
        this.renderer.showCombatIndicator(getEnemyLocaleText('skills.necromancer.revive', ''), { duration: 900 });
      }
      if (reduction > 0) {
        const text =
          reduction >= damage
            ? getEnemyLocaleText('combat.block.full', '')
            : formatEnemyLocaleText('combat.block.partial', { value: reduction }, '');
        this.renderer.showCombatIndicator(text, { duration: 700 });
      }
      if (lives <= 0) {
        this.onPlayerDefeated();
        return;
      }
    }

    const experienceReward = this.getExperienceReward(enemy.type);
    const defeatResult = this.gameState.handleEnemyDefeated(experienceReward);
    if (defeatResult?.leveledUp && this.shouldStartLevelOverlay()) {
      this.gameState.startLevelUpSelectionIfNeeded?.();
    }

    this.tryTriggerDefeatVariable(enemy);
    this.renderer.flashScreen({ intensity: 0.8, duration: 160 });

    this.checkAllEnemiesCleared();
    this.renderer.draw();
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

  tryMoveEnemy(enemies: EnemyState[], index: number, game: GameData): EnemyMovementResult {
    const enemy = enemies[index];
    if (!enemy) return EnemyMovementResult.None;
    enemy.type = this.normalizeEnemyType(enemy.type);
    if (enemy.playerInVision) return EnemyMovementResult.None;

    const dir = this.pickRandomDirection();
    const target = this.getTargetPosition(enemy, dir);
    const roomIndex = enemy.roomIndex;

    if (!this.canEnterTile(roomIndex, target.x, target.y, game, enemies, index)) {
      return EnemyMovementResult.None;
    }

    enemy.lastX = enemy.x;
    enemy.x = target.x;
    enemy.y = target.y;

    return this.resolvePostMove(roomIndex, target.x, target.y, index)
      ? EnemyMovementResult.Collided
      : EnemyMovementResult.Moved;
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
      if (!this.canEnterTile(roomIndex, target.x, target.y, game, enemies, index)) {
        continue;
      }
      enemy.lastX = enemy.x;
      enemy.x = target.x;
      enemy.y = target.y;
      return this.resolvePostMove(roomIndex, target.x, target.y, index)
        ? EnemyMovementResult.Collided
        : EnemyMovementResult.Moved;
    }
    return EnemyMovementResult.None;
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
      if (result === EnemyMovementResult.Moved) {
        moved = true;
      } else if (result === EnemyMovementResult.Collided) {
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
    const room = game.rooms[roomIndex];
    if (!room) return false;
    if (room.walls?.[y]?.[x]) return false;
    if (this.isTileBlocked(roomIndex, x, y)) return false;
    if (this.hasBlockingObject(roomIndex, x, y)) return false;
    return !this.isOccupied(enemies, movingIndex, roomIndex, x, y);
  }

  isTileBlocked(roomIndex: number, x: number, y: number): boolean {
    const tileMap = this.tileManager.getTileMap(roomIndex);
    const groundId = tileMap?.ground?.[y]?.[x] ?? null;
    const overlayId = tileMap?.overlay?.[y]?.[x] ?? null;
    const candidateId = overlayId ?? groundId;
    if (candidateId === null || candidateId === undefined) return false;
    const tile = this.tileManager.getTile(candidateId);
    return Boolean(tile?.collision);
  }

  hasBlockingObject(roomIndex: number, x: number, y: number): boolean {
    const OT = ITEM_TYPES;
    const blockingObject = this.gameState.getObjectAt?.(roomIndex, x, y) ?? null;
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
      this.handleEnemyCollision(enemyIndex);
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
    if (!enemy) return true;
    const definition = this.getEnemyDefinition(enemy.type);
    if (!definition) return true;
    if (definition.hasEyes === false) return false;
    return true;
  }

  canAssassinate(enemy: EnemyState): boolean {
    const stealth = this.gameState.hasSkill?.('stealth');
    if (!stealth || !enemy) return false;
    const damage = this.getEnemyDamage(enemy.type);
    return damage <= 2;
  }

  tryStealthAssassination(enemyIndex: number): boolean {
    const enemies = this.gameState.getEnemies();
    const enemy = enemies?.[enemyIndex];
    if (!this.canAssassinate(enemy)) {
      return false;
    }
    const missed = Math.random() < GameConfig.enemy.stealthMissChance;
    if (missed) {
      this.showStealthMissFeedback();
      return false;
    }
    this.assassinateEnemy(enemyIndex);
    return true;
  }

  assassinateEnemy(enemyIndex: number): void {
    const enemies = this.gameState.getEnemies();
    const enemy = enemies?.[enemyIndex];
    if (!enemy) return;
    const type = this.normalizeEnemyType(enemy.type);
    enemies.splice(enemyIndex, 1);

    const experienceReward = this.getExperienceReward(type);
    const defeatResult = this.gameState.handleEnemyDefeated(experienceReward);
    if (defeatResult?.leveledUp && this.shouldStartLevelOverlay()) {
      this.gameState.startLevelUpSelectionIfNeeded?.();
    }
    this.tryTriggerDefeatVariable({ ...enemy, type });
    this.showStealthKillFeedback();
    this.renderer.flashScreen({ intensity: 0.4, duration: 120 });
    this.checkAllEnemiesCleared();
    this.renderer.draw();
  }

  showStealthKillFeedback(): void {
    const text = getEnemyLocaleText('combat.stealthKill', '');
    if (!text) return;
    this.renderer.showCombatIndicator?.(text, { duration: 800 });
  }

  showStealthMissFeedback(): void {
    const text = getEnemyLocaleText('combat.stealthMiss', '');
    if (!text) return;
    this.renderer.showCombatIndicator?.(text, { duration: 800 });
  }

  shouldStartLevelOverlay(): boolean {
    const pendingChoices = this.gameState.getPendingLevelUpChoices?.() ?? 0;
    return pendingChoices > 0;
  }

  getEnemyDamage(type: string): number {
    const definition = this.getEnemyDefinition(type);
    if (definition && typeof definition.damage === 'number' && Number.isFinite(definition.damage)) {
      return Math.max(1, definition.damage);
    }
    return 1;
  }

  getExperienceReward(type: string): number {
    return EnemyDefinitions.getExperienceReward(type);
  }

  getEnemyMissChance(type: string): number {
    const explicit = EnemyDefinitions.getMissChance(type);
    if (explicit !== null && explicit !== undefined) {
      return this.normalizeMissChance(explicit);
    }
    return this.fallbackMissChance;
  }

  checkAllEnemiesCleared(): void {
    const remaining = this.gameState.getEnemies()?.length ?? 0;
    if (remaining <= 0) {
      const text = getEnemyLocaleText('game.clearAllEnemies', '');
      if (text) {
        this.dialogManager?.showDialog?.(text);
      }
    }
  }

  normalizeMissChance(value: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0.25;
    }
    return Math.max(0, Math.min(1, numeric));
  }

  attackMissed(chance?: number): boolean {
    let normalized: number;
    if (chance === undefined) {
      normalized = this.normalizeMissChance(this.fallbackMissChance);
      this.fallbackMissChance = normalized;
    } else {
      normalized = this.normalizeMissChance(chance);
    }
    if (normalized <= 0) return false;
    if (normalized >= 1) return true;
    return Math.random() < normalized;
  }

  getDefeatVariableConfig(enemy: EnemyState): { variableId: string; persist: boolean; message: string | null } | null {
    if (!enemy) return null;
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
    this.renderer.showCombatIndicator('Miss', { duration: 500 });
  }

  getNow() {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
}

export { EnemyManager };
