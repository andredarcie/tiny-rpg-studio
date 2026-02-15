/**
 * Type definitions for manager APIs and interfaces
 * Used by EnemyManager, CombatManager, and other service managers
 */

import type { EnemyDefinition } from './gameState';

// ========== Combat & Rendering APIs ==========

export type GameStateApi = {
  playing: boolean;
  isEditorModeActive: () => boolean;
  getEnemyDefinitions?: () => unknown;
  getEnemies: () => EnemyState[];
  addEnemy?: (enemy: EnemyState) => string | null;
  removeEnemy?: (id: string) => void;
  getGame?: () => GameData;
  getPlayer: () => PlayerState;
  isPlayerOnDamageCooldown: () => boolean;
  getLives: () => number;
  damagePlayer: (amount: number) => number;
  consumeLastDamageReduction: () => number;
  consumeRecentReviveFlag?: () => boolean;
  handleEnemyDefeated: (xp: number) => { leveledUp?: boolean } | null;
  getPendingLevelUpChoices: () => number;
  startLevelUpSelectionIfNeeded: () => void;
  prepareNecromancerRevive?: () => void;
  setLastKillerEnemy?: (enemyId: string | null) => void;
  pauseGame: (reason: string) => void;
  resumeGame: (reason: string) => void;
  isVariableOn?: (id: string) => boolean;
  normalizeVariableId?: (id: string | null) => string | null;
  setVariableValue?: (id: string, value: boolean, persist?: boolean) => Array<boolean | undefined>;
  getObjectAt?: (roomIndex: number, x: number, y: number) => GameObjectState | null;
  hasSkill: (skillId: string) => boolean;
};

export type RendererApi = {
  draw: () => void;
  flashScreen: (payload: Record<string, unknown>) => void;
  showCombatIndicator: (text: string, options?: Record<string, unknown>) => void;
  spawnEnemyLifeLoss: (enemyX: number, enemyY: number, lostLifeIndex: number) => void;
  applyGrayscaleFilter: () => void;
  removeGrayscaleFilter: () => void;
  combatAnimator?: CombatAnimatorApi;
  cameraShake?: CameraShakeApi;
  floatingText?: FloatingTextApi;
  particleSystem?: ParticleSystemApi;
  entityRenderer?: EntityRendererApi;
  attackTelegraph?: AttackTelegraphApi;
};

export type CombatAnimatorApi = {
  startLungeAttack: (attacker: 'player', target: { x: number; y: number }, onComplete?: () => void) => void;
  startKnockback: (entity: 'player' | string, direction: { x: number; y: number }, onComplete?: () => void) => void;
  freezeFrame: (duration: number) => void;
};

export type CameraShakeApi = {
  triggerFromDamage: (damage: number) => void;
};

export type FloatingTextApi = {
  spawnDamageNumber: (damage: number, tileX: number, tileY: number, options?: Record<string, unknown>) => void;
};

export type ParticleSystemApi = {
  spawnImpactAtTile: (tileX: number, tileY: number, options?: Record<string, unknown>) => void;
  spawnCriticalImpact: (x: number, y: number, options?: Record<string, unknown>) => void;
  spawnDeath: (x: number, y: number, options?: Record<string, unknown>) => void;
};

export type EntityRendererApi = {
  flashEntity: (entityId: string, color: string, duration?: number) => void;
};

export type AttackTelegraphApi = {
  activateTelegraph: (enemyId: string, direction: { x: number; y: number }) => void;
  deactivateTelegraph: (enemyId: string) => void;
  clearAll: () => void;
  isActive: (enemyId: string) => boolean;
  applyWindupOffset: (enemyId: string, baseX: number, baseY: number) => { x: number; y: number };
};

export type CombatStunManagerApi = {
  applyStun: () => void;
};

export type StatePlayerManagerApi = {
  isOnAttackCooldown: () => boolean;
  player: { lastAttackTime: number } | null;
};

// ========== State Types ==========

export type PlayerState = {
  roomIndex: number;
  x: number;
  y: number;
};

export type EnemyState = EnemyDefinition;

// ========== Manager Options ==========

export type CombatManagerOptions = {
  onPlayerDefeated?: () => void;
  fallbackMissChance?: number;
  combatStunManager?: CombatStunManagerApi | null;
  playerManager?: StatePlayerManagerApi | null;
  onEnemyDefeated?: (enemyId: string, enemy: EnemyState) => void;
  onCheckAllEnemiesCleared?: () => void;
  shouldStartLevelOverlay?: () => boolean;
};

export type EnemyManagerOptions = {
  onPlayerDefeated?: () => void;
  interval?: number;
  directions?: number[][];
  dialogManager?: { showDialog?: (text: string) => void } | null;
  missChance?: number;
  combatStunManager?: CombatStunManagerApi | null;
  playerManager?: StatePlayerManagerApi | null;
};

// ========== Tile & World APIs ==========

export type TileManagerApi = {
  getTileMap: (roomIndex: number) => TileMapState | null;
  getTile: (tileId: string | number) => TileDefinition | null;
};

// ========== Game Data Types ==========

export type RoomState = {
  walls?: boolean[][];
};

export type GameData = {
  rooms: RoomState[];
};

export type GameObjectState = {
  type: string;
  opened?: boolean;
  variableId?: string | null;
};

export type TileMapState = {
  ground?: (string | number | null)[][];
  overlay?: (string | number | null)[][];
};

export type TileDefinition = {
  collision?: boolean;
};

// ========== Enemy Types ==========

export type EnemyInput = {
  id?: string;
  type: string;
  roomIndex?: number;
  x: number;
  y: number;
  lastX?: number;
  lastY?: number;
  defeatVariableId?: string | null;
};

export type DefeatVariableConfig = {
  variableId?: string;
  persist?: boolean;
  message?: string;
  messageKey?: string;
};

export type EnemyDefinitionData = {
  hasEyes?: boolean;
  damage?: number;
  activateVariableOnDefeat?: DefeatVariableConfig | null;
  defeatActivationMessageKey?: string;
  defeatActivationMessage?: string;
};

// ========== Enemy Movement ==========

export const EnemyMovementResult = {
  None: 'none',
  Moved: 'moved',
  Collided: 'collided',
} as const;

export type EnemyMovementResult = typeof EnemyMovementResult[keyof typeof EnemyMovementResult];
