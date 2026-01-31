import { vi } from 'vitest';

/**
 * Complete GameStateApi mock for testing.
 * This interface represents all possible methods that various managers might need.
 * Not all managers need all methods - each manager defines its own subset.
 */
export interface MockGameState {
  // Core state
  playing: boolean;

  // Mode checks
  isEditorModeActive: () => boolean;
  isGameOver: () => boolean;
  isLevelUpCelebrationActive: () => boolean;
  isLevelUpOverlayActive: () => boolean;
  isPickupOverlayActive: () => boolean;

  // Enemy management
  getEnemyDefinitions: () => unknown;
  getEnemies: () => unknown[];
  addEnemy: (enemy: unknown) => string | null;
  removeEnemy: (id: string) => void;
  handleEnemyDefeated: (xp: number) => { leveledUp?: boolean } | null;

  // Player state
  getPlayer: () => { roomIndex: number; x: number; y: number; lastX?: number; currentLives?: number; lastRoomChangeTime?: number | null };
  setPlayerPosition: (x: number, y: number, roomIndex: number | null) => void;
  isPlayerOnDamageCooldown: () => boolean;
  damagePlayer: (amount: number) => number;
  consumeLastDamageReduction: () => number;
  consumeRecentReviveFlag: () => boolean;

  // Player resources
  getLives: () => number;
  getMaxLives: () => number;
  getKeys: () => number;
  addKeys: (count: number) => void;
  consumeKey: () => boolean;
  addLife: (count: number) => void;
  healPlayerToFull: () => void;
  addDamageShield: (count: number) => void;

  // Experience and leveling
  getExperienceToNext: () => number;
  addExperience: (amount: number) => void;
  getPendingLevelUpChoices: () => number;
  startLevelUpSelectionIfNeeded: () => void;

  // Equipment
  getSwordType: () => string | null;
  hasSkill: (skillId: string) => boolean;

  // Game world
  getGame: () => { rooms?: unknown[]; sprites?: unknown[]; items?: unknown[]; exits?: unknown[]; roomSize?: number; [key: string]: unknown };
  getRoomCoords: () => { row: number; col: number };
  getRoomIndex: (row: number, col: number) => number | null;

  // Objects and interactions
  getObjectAt: (roomIndex: number, x: number, y: number) => unknown | null;
  getObjectsForRoom: (roomIndex: number) => unknown[];
  getPlayerEndText: (roomIndex: number) => string;
  setActiveEndingText: (text: string) => void;

  // Variables
  isVariableOn: (id: string) => boolean;
  normalizeVariableId: (id: string | null) => string | null;
  setVariableValue: (id: string, value: boolean, persist?: boolean) => [boolean, boolean?];

  // Dialog
  getDialog: () => { active: boolean; page: number; maxPages: number };
  setDialogPage: (page: number) => void;

  // Pickup overlay
  showPickupOverlay: (options: unknown) => void;

  // Optional methods (used by some managers)
  prepareNecromancerRevive?: () => void;
  pauseGame?: (reason: string) => void;
  resumeGame?: (reason: string) => void;
  setDialog?: (active: boolean, text?: string, meta?: unknown) => void;
}

/**
 * Creates a complete mock GameState with all common methods.
 * All methods are vi.fn() mocks with sensible defaults.
 *
 * @param overrides Partial overrides for specific test needs
 * @returns Complete mock GameState object
 */
export const createMockGameState = (overrides: Partial<MockGameState> = {}): MockGameState => {
  const defaultPlayer = { roomIndex: 0, x: 0, y: 0, lastX: 0 };
  const defaultGame = { rooms: [], sprites: [], items: [], exits: [] };
  const defaultDialog = { active: false, page: 1, maxPages: 1 };

  return {
    // Core state
    playing: true,

    // Mode checks
    isEditorModeActive: vi.fn(() => false),
    isGameOver: vi.fn(() => false),
    isLevelUpCelebrationActive: vi.fn(() => false),
    isLevelUpOverlayActive: vi.fn(() => false),
    isPickupOverlayActive: vi.fn(() => false),

    // Enemy management
    getEnemyDefinitions: vi.fn(() => []),
    getEnemies: vi.fn(() => []),
    addEnemy: vi.fn(() => 'enemy-1'),
    removeEnemy: vi.fn(),
    handleEnemyDefeated: vi.fn(() => null),

    // Player state
    getPlayer: vi.fn(() => defaultPlayer),
    setPlayerPosition: vi.fn(),
    isPlayerOnDamageCooldown: vi.fn(() => false),
    damagePlayer: vi.fn(() => 1),
    consumeLastDamageReduction: vi.fn(() => 0),
    consumeRecentReviveFlag: vi.fn(() => false),

    // Player resources
    getLives: vi.fn(() => 3),
    getMaxLives: vi.fn(() => 3),
    getKeys: vi.fn(() => 0),
    addKeys: vi.fn(),
    consumeKey: vi.fn(() => false),
    addLife: vi.fn(),
    healPlayerToFull: vi.fn(),
    addDamageShield: vi.fn(),

    // Experience and leveling
    getExperienceToNext: vi.fn(() => 100),
    addExperience: vi.fn(),
    getPendingLevelUpChoices: vi.fn(() => 0),
    startLevelUpSelectionIfNeeded: vi.fn(),

    // Equipment
    getSwordType: vi.fn(() => null),
    hasSkill: vi.fn(() => false),

    // Game world
    getGame: vi.fn(() => defaultGame),
    getRoomCoords: vi.fn(() => ({ row: 0, col: 0 })),
    getRoomIndex: vi.fn(() => 0),

    // Objects and interactions
    getObjectAt: vi.fn(() => null),
    getObjectsForRoom: vi.fn(() => []),
    getPlayerEndText: vi.fn(() => 'The End'),
    setActiveEndingText: vi.fn(),

    // Variables
    isVariableOn: vi.fn(() => false),
    normalizeVariableId: vi.fn((id: string | null) => id),
    setVariableValue: vi.fn(() => [true, false] as [boolean, boolean?]),

    // Dialog
    getDialog: vi.fn(() => defaultDialog),
    setDialogPage: vi.fn(),

    // Pickup overlay
    showPickupOverlay: vi.fn(),

    // Apply overrides
    ...overrides,
  };
};
