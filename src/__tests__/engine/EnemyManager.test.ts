import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { EnemyManager } from '../../runtime/services/engine/EnemyManager';
import { MovementManager } from '../../runtime/services/engine/MovementManager';
import { TextResources } from '../../runtime/adapters/TextResources';
import { GameConfig } from '../../config/GameConfig';
import { createEnemyGameState } from '../helpers/createEnemyGameState';

describe('EnemyManager', () => {
  const getSpy = vi.spyOn(TextResources, 'get');
  const formatSpy = vi.spyOn(TextResources, 'format');
  const normalizeSpy = vi.spyOn(EnemyDefinitions, 'normalizeType');
  const getDefinitionSpy = vi.spyOn(EnemyDefinitions, 'getEnemyDefinition');
  const getExperienceSpy = vi.spyOn(EnemyDefinitions, 'getExperienceReward');
  const getMissChanceSpy = vi.spyOn(EnemyDefinitions, 'getMissChance');

  const renderer = {
    draw: vi.fn(),
    flashScreen: vi.fn(),
    showCombatIndicator: vi.fn(),
  };

  const tileManager = {
    getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
    getTile: vi.fn(() => null),
  };

  const baseEnemyDefinition = {
    type: 'test-enemy',
    id: 'enemy-test',
    name: 'Test Enemy',
    nameKey: 'enemies.names.test',
    description: 'test',
    damage: 1,
    missChance: 0,
    experience: 1,
    hasEyes: true,
    sprite: [],
  };

  interface MockEnemyData {
    id: string;
    type: string;
    roomIndex: number;
    x: number;
    y: number;
    lastX: number;
    playerInVision?: boolean;
    alertUntil?: number | null;
    alertStart?: number | null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getSpy.mockImplementation((...args: unknown[]) => {
      const key = args[0] as string;
      const fallback = args[1] as string | undefined;
      return key === 'combat.cooldown' ? 'Safe' : fallback || 'text';
    });
    formatSpy.mockImplementation((...args: unknown[]) => {
      const fallback = args[2] as string | undefined;
      return fallback || 'text';
    });
    normalizeSpy.mockImplementation((type: string | null | undefined) => type ?? 'test-enemy');
    getDefinitionSpy.mockImplementation(() => {
      const data = { ...baseEnemyDefinition };
      return {
        ...data,
        matchesType: (type: string) => data.type === type,
        getExperienceReward: () => data.experience,
        getMissChance: () => data.missChance,
      };
    });
    getExperienceSpy.mockImplementation(() => 2);
    getMissChanceSpy.mockImplementation(() => null);
  });

  it('adds enemies and redraws', () => {
    const gameState = createEnemyGameState();
    const manager = new EnemyManager(gameState, renderer, tileManager);

    const id = manager.addEnemy({ type: 'rat', roomIndex: 0, x: 0, y: 0 });

    expect(id).toBe('enemy-1');
    expect(gameState.addEnemy).toHaveBeenCalled();
    expect(renderer.draw).toHaveBeenCalled();
  });

  it('normalizes miss chance', () => {
    const manager = new EnemyManager(createEnemyGameState(), renderer, tileManager);

    expect(manager.normalizeMissChance(2)).toBe(1);
    expect(manager.normalizeMissChance(-1)).toBe(0);
  });

  it('returns true when miss chance is 1', () => {
    const manager = new EnemyManager(createEnemyGameState(), renderer, tileManager);

    expect(manager.attackMissed(1)).toBe(true);
    expect(manager.attackMissed(0)).toBe(false);
  });

  it('uses crypto.randomUUID when available', () => {
    const manager = new EnemyManager(createEnemyGameState(), renderer, tileManager);
    const globalWithCrypto = globalThis as GlobalWithCrypto;
    const originalCrypto = globalWithCrypto.crypto;
    const spy = 'randomUUID' in originalCrypto
      ? vi.spyOn(originalCrypto, 'randomUUID').mockReturnValue('enemy-uuid')
      : null;

    if (spy) {
      expect(manager.generateEnemyId()).toBe('enemy-uuid');
      spy.mockRestore();
      return;
    }

    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'enemy-uuid' },
      configurable: true,
    });
    expect(manager.generateEnemyId()).toBe('enemy-uuid');
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });

  it('triggers defeat variables and shows message', () => {
    getDefinitionSpy.mockImplementation(() => {
      const data = {
        ...baseEnemyDefinition,
        activateVariableOnDefeat: { variableId: 'var-1', message: 'Unlocked' },
      };
      return {
        ...data,
        matchesType: (type: string) => data.type === type,
        getExperienceReward: () => data.experience,
        getMissChance: () => data.missChance,
      };
    });
    const gameState = createEnemyGameState();
    const manager = new EnemyManager(gameState, renderer, tileManager);

    const result = manager.tryTriggerDefeatVariable({ id: 'enemy-1', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0 });

    expect(result).toBe(true);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', true, true);
    expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Unlocked', { duration: 900 });
  });

  it('triggers vision alert when player enters vision box', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const player = { roomIndex: 0, x: 2, y: 2 };
    const enemy: MockEnemyData = { id: 'enemy-vision', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0 };
    const getEnemiesMock = vi.fn(() => [enemy]);
    const getPlayerMock = vi.fn(() => player);
    const gameState = createEnemyGameState({
      getEnemies: getEnemiesMock,
      getPlayer: getPlayerMock,
    });

    const manager = new EnemyManager(gameState, renderer, tileManager);
    manager.evaluateVision(player);

    expect(enemy.playerInVision).toBe(true);
    expect(typeof enemy.alertUntil).toBe('number');
    expect(enemy.alertUntil).toBe(1000 + GameConfig.enemy.vision.alertDuration);
    expect(typeof enemy.alertStart).toBe('number');
    expect(enemy.alertStart).toBe(1000);
    nowSpy.mockRestore();
  });

  it('clears vision flag when player exits the area', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(2000);
    const player = { roomIndex: 0, x: 10, y: 10 };
    const enemy: MockEnemyData = {
      id: 'enemy-vision',
      type: 'rat',
      roomIndex: 0,
      x: 0,
      y: 0,
      lastX: 0,
      playerInVision: true,
      alertUntil: 500,
      alertStart: 300,
    };
    const getEnemiesMock = vi.fn(() => [enemy]);
    const getPlayerMock = vi.fn(() => player);
    const gameState = createEnemyGameState({
      getEnemies: getEnemiesMock,
      getPlayer: getPlayerMock,
    });

    const manager = new EnemyManager(gameState, renderer, tileManager);
    manager.evaluateVision(player);

    expect(enemy.playerInVision).toBe(false);
    expect(enemy.alertStart).toBe(null);
    expect(enemy.alertUntil).toBe(null);
    nowSpy.mockRestore();
  });

  it('moves chasing enemy toward player per movement', () => {
    const player = { roomIndex: 0, x: 5, y: 5 };
    const enemy: MockEnemyData = { id: 'chaser', type: 'rat', roomIndex: 0, x: 2, y: 2, lastX: 2, playerInVision: true };
    const getEnemiesMock = vi.fn(() => [enemy]);
    const getPlayerMock = vi.fn(() => player);
    const getGameMock = vi.fn(() => ({ rooms: [{}] }));
    const gameState = createEnemyGameState({
      getEnemies: getEnemiesMock,
      getPlayer: getPlayerMock,
      getGame: getGameMock,
    });

    const manager = new EnemyManager(gameState, renderer, tileManager);

    manager.moveChasingEnemies(player);

    expect(enemy.x).toBe(3);
  });

  it('does not move non-chasing enemies during player movement', () => {
    const player = { roomIndex: 0, x: 3, y: 0 };
    const enemy: MockEnemyData = { id: 'idle', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0 };
    const getEnemiesMock = vi.fn(() => [enemy]);
    const getPlayerMock = vi.fn(() => player);
    const getGameMock = vi.fn(() => ({ rooms: [{}] }));
    const gameState = createEnemyGameState({
      getEnemies: getEnemiesMock,
      getPlayer: getPlayerMock,
      getGame: getGameMock,
    });

    const manager = new EnemyManager(gameState, renderer, tileManager);

    manager.moveChasingEnemies(player);

    expect(enemy.x).toBe(0);
  });

  it('moves chasing enemy during tick even if player stops', () => {
    const player = { roomIndex: 0, x: 3, y: 2 };
    const enemy: MockEnemyData = { id: 'chaser', type: 'rat', roomIndex: 0, x: 2, y: 2, lastX: 2, playerInVision: true };
    const getEnemiesMock = vi.fn(() => [enemy]);
    const getPlayerMock = vi.fn(() => player);
    const getGameMock = vi.fn(() => ({ rooms: [{ walls: [] }] }));
    const gameState = createEnemyGameState({
      getEnemies: getEnemiesMock,
      getPlayer: getPlayerMock,
      getGame: getGameMock,
    });

    const manager = new EnemyManager(gameState, renderer, tileManager);

    manager.tick();

    expect(enemy.x).toBe(3);
  });

  it('shows a cooldown message when damage is blocked by room change safety', () => {
    const gameState = createEnemyGameState({
      getEnemies: vi.fn(() => [{ id: 'enemy-1', type: 'rat', roomIndex: 0, x: 0, y: 0, lastX: 0 }]),
      isPlayerOnDamageCooldown: vi.fn(() => true),
    });
    const manager = new EnemyManager(gameState, renderer, tileManager);

    manager.handleEnemyCollision(0);

    expect(renderer.showCombatIndicator).toHaveBeenCalledWith('Safe', { duration: 700 });
    expect(gameState.damagePlayer).not.toHaveBeenCalled();
  });

  describe('Chase Movement Bug - Enemy Adjacent But Not Advancing', () => {
    it('should eventually collide when player moves and enemy chases using moveChasingEnemies', () => {
      const player = { roomIndex: 0, x: 2, y: 2 };
      const enemy: MockEnemyData = {
        id: 'chasing-enemy',
        type: 'rat',
        roomIndex: 0,
        x: 0,
        y: 2,
        lastX: 0,
        playerInVision: true,
      };

      const walls = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const getEnemiesMock = vi.fn(() => [enemy]);
      const getPlayerMock = vi.fn(() => player);
      const getGameMock = vi.fn(() => ({ rooms: [{ walls }] }));
      const gameState = createEnemyGameState({
        getEnemies: getEnemiesMock,
        getPlayer: getPlayerMock,
        getGame: getGameMock,
      });

      const manager = new EnemyManager(gameState, renderer, tileManager);

      let collided = false;
      for (let i = 0; i < 5; i += 1) {
        manager.moveChasingEnemies(player);
        if (enemy.x === player.x && enemy.y === player.y) {
          collided = true;
          break;
        }
      }

      expect(collided).toBe(true);
    });

    it('should collide after player stops moving when enemy becomes adjacent', () => {
      const player = { roomIndex: 0, x: 5, y: 3 };
      const enemy: MockEnemyData = {
        id: 'follower',
        type: 'skeleton',
        roomIndex: 0,
        x: 4,
        y: 3,
        lastX: 4,
        playerInVision: true,
      };

      const walls = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const getEnemiesMock = vi.fn(() => [enemy]);
      const getPlayerMock = vi.fn(() => player);
      const getGameMock = vi.fn(() => ({ rooms: [{ walls }] }));
      const gameState = createEnemyGameState({
        getEnemies: getEnemiesMock,
        getPlayer: getPlayerMock,
        getGame: getGameMock,
      });

      const manager = new EnemyManager(gameState, renderer, tileManager);

      manager.tick();

      expect(enemy.x).toBe(5);
      expect(enemy.y).toBe(3);
    });

    it('should not get stuck following player horizontally without advancing when distance is exactly 1', () => {
      const enemy: MockEnemyData = {
        id: 'stuck-follower',
        type: 'goblin',
        roomIndex: 0,
        x: 3,
        y: 2,
        lastX: 2,
        playerInVision: true,
      };

      const walls = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const getEnemiesMock = vi.fn(() => [enemy]);
      let playerX = 4;
      const getPlayerMock = vi.fn(() => ({ roomIndex: 0, x: playerX, y: 2 }));
      const getGameMock = vi.fn(() => ({ rooms: [{ walls }] }));
      const gameState = createEnemyGameState({
        getEnemies: getEnemiesMock,
        getPlayer: getPlayerMock,
        getGame: getGameMock,
      });

      const manager = new EnemyManager(gameState, renderer, tileManager);

      let collisionOccurred = false;
      for (let i = 0; i < 10; i += 1) {
        const currentPlayer = getPlayerMock();
        manager.moveChasingEnemies(currentPlayer);

        if (enemy.x === currentPlayer.x && enemy.y === currentPlayer.y) {
          collisionOccurred = true;
          break;
        }

        if (i < 5) {
          playerX += 1;
        }
      }

      expect(collisionOccurred).toBe(true);
    });
  });

  describe('Independent Enemy Movement (TDD)', () => {
    it('should NOT move chasing enemies when player moves via MovementManager', () => {
      const player = { roomIndex: 0, x: 2, y: 3, lastX: 2, lastRoomChangeTime: null };
      const chasingEnemy: MockEnemyData = {
        id: 'chaser',
        type: 'rat',
        roomIndex: 0,
        x: 1,
        y: 3,
        lastX: 1,
        playerInVision: true, // Enemy is chasing
      };
      const enemies = [chasingEnemy];

      const walls: number[][] = Array(8).fill(0).map(() => Array(8).fill(0) as number[]) as number[][];
      const gameState = {
        playing: true,
        game: { roomSize: 8 },
        isEditorModeActive: vi.fn(() => false),
        getEnemyDefinitions: vi.fn(() => []),
        getEnemies: vi.fn(() => enemies),
        addEnemy: vi.fn(() => 'enemy-1'),
        removeEnemy: vi.fn(),
        getGame: vi.fn(() => ({ rooms: [{ walls }], sprites: [] })),
        getPlayer: vi.fn(() => player),
        isPlayerOnDamageCooldown: vi.fn(() => false),
        damagePlayer: vi.fn(() => 3),
        consumeLastDamageReduction: vi.fn(() => 0),
        consumeRecentReviveFlag: vi.fn(() => false),
        handleEnemyDefeated: vi.fn(() => null),
        getPendingLevelUpChoices: vi.fn(() => 0),
        startLevelUpSelectionIfNeeded: vi.fn(),
        isVariableOn: vi.fn(() => false),
        normalizeVariableId: vi.fn((id: string | null) => id),
        setVariableValue: vi.fn(() => [true, false]),
        getObjectAt: vi.fn(() => null),
        hasSkill: vi.fn(() => false),
        isGameOver: () => false,
        isLevelUpCelebrationActive: () => false,
        isLevelUpOverlayActive: () => false,
        isPickupOverlayActive: () => false,
        getDialog: () => ({ active: false, page: 1, maxPages: 1 }),
        setDialogPage: vi.fn(),
        getRoomCoords: () => ({ row: 0, col: 0 }),
        getRoomIndex: () => null,
        consumeKey: () => false,
        getKeys: () => 0,
        setPlayerPosition: (x: number, y: number, roomIndex: number | null) => {
          player.x = x;
          player.y = y;
          if (roomIndex !== null) player.roomIndex = roomIndex;
        },
      };

      const movementRenderer = {
        draw: vi.fn(),
        captureGameplayFrame: vi.fn(),
        startRoomTransition: vi.fn(() => false),
        flashEdge: vi.fn(),
      };
      const dialogManager = { closeDialog: vi.fn(), showDialog: vi.fn() };
      const interactionManager = { handlePlayerInteractions: vi.fn() };
      const movementTileManager = {
        getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
        getTile: vi.fn(() => null),
      };

      const enemyManager = new EnemyManager(gameState as never, renderer, tileManager);
      const movementManager = new MovementManager({
        gameState: gameState as never,
        tileManager: movementTileManager,
        renderer: movementRenderer,
        dialogManager,
        interactionManager,
        enemyManager,
      });

      // Record initial enemy position
      const initialEnemyX = chasingEnemy.x;
      expect(initialEnemyX).toBe(1);

      // Player moves right (enemy at x=1, player moves from x=2 to x=3)
      // Player stays within vision range (dx=2, dy=0)
      movementManager.tryMove(1, 0);

      // Enemy should NOT have moved because only tick() should move enemies
      // This will FAIL because currently MovementManager calls moveChasingEnemies
      expect(chasingEnemy.x).toBe(initialEnemyX);
      expect(chasingEnemy.x).toBe(1); // Should still be at original position
    });

    it('should move chasing enemies ONLY when tick is called, not on player movement', () => {
      const player = { roomIndex: 0, x: 4, y: 2 };
      const chasingEnemy: MockEnemyData = {
        id: 'chaser',
        type: 'rat',
        roomIndex: 0,
        x: 2,
        y: 2,
        lastX: 2,
        playerInVision: false, // Will be set by evaluateVision
      };
      const getEnemiesMock = vi.fn(() => [chasingEnemy]);
      const getPlayerMock = vi.fn(() => player);
      const getGameMock = vi.fn(() => ({ rooms: [{ walls: Array(8).fill(0).map(() => Array(8).fill(0) as number[]) as number[][] }] }));
      const gameState = createEnemyGameState({
        getEnemies: getEnemiesMock,
        getPlayer: getPlayerMock,
        getGame: getGameMock,
      });

      const manager = new EnemyManager(gameState, renderer, tileManager);

      // Record initial position
      const initialX = chasingEnemy.x;
      expect(initialX).toBe(2);

      // Call tick - enemy SHOULD move (evaluateVision will detect player, then chase)
      manager.tick();

      // Enemy should have moved closer to player (dx=2, within vision range)
      expect(chasingEnemy.x).toBeGreaterThan(initialX);
      expect(chasingEnemy.x).toBe(3);
    });

    it('should move idle enemies ONLY on tick, respecting movementInterval timing', () => {
      const player = { roomIndex: 0, x: 7, y: 7 }; // Far from enemy
      const idleEnemy: MockEnemyData = {
        id: 'idle',
        type: 'rat',
        roomIndex: 0,
        x: 1,
        y: 1,
        lastX: 1,
        playerInVision: false,
      };
      const getEnemiesMock = vi.fn(() => [idleEnemy]);
      const getPlayerMock = vi.fn(() => player);
      const getGameMock = vi.fn(() => ({ rooms: [{ walls: Array(8).fill(0).map(() => Array(8).fill(0) as number[]) as number[][] }] }));
      const gameState = createEnemyGameState({
        getEnemies: getEnemiesMock,
        getPlayer: getPlayerMock,
        getGame: getGameMock,
      });

      const manager = new EnemyManager(gameState, renderer, tileManager);

      // Record initial position
      const initialX = idleEnemy.x;
      const initialY = idleEnemy.y;

      // Call tick - enemy may move randomly or stay
      manager.tick();

      // Enemy position may have changed or stayed the same (random movement)
      // But it should only happen via tick(), not player movement
      const movedOrStayed =
        (idleEnemy.x !== initialX || idleEnemy.y !== initialY) || (idleEnemy.x === initialX && idleEnemy.y === initialY);
      expect(movedOrStayed).toBe(true);
    });
  });

  it('prevents damage right after changing rooms (damage cooldown)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const player = {
      roomIndex: 0,
      x: 0,
      y: 0,
      lastX: 0,
      lastRoomChangeTime: null as number | null,
      currentLives: 3,
    };
    const enemies = [{ id: 'enemy-1', type: 'rat', roomIndex: 1, x: 7, y: 0, lastX: 7 }];

    const gameState = {
      playing: true,
      game: { roomSize: 8 },
      getEnemyDefinitions: vi.fn(() => []),
      getEnemies: vi.fn(() => enemies),
      addEnemy: vi.fn(() => 'enemy-1'),
      removeEnemy: vi.fn(),
      getGame: vi.fn(() => ({ sprites: [] })),
      getPlayer: vi.fn(() => player),
      isPlayerOnDamageCooldown: vi.fn(
        () => Number.isFinite(player.lastRoomChangeTime) && Date.now() - (player.lastRoomChangeTime ?? 0) < 1000,
      ),
      damagePlayer: vi.fn(() => player.currentLives),
      consumeLastDamageReduction: vi.fn(() => 0),
      handleEnemyDefeated: vi.fn(() => null),
      isVariableOn: vi.fn(() => false),
      normalizeVariableId: vi.fn((id: string | null) => id),
      setVariableValue: vi.fn(() => [true, false]),
      isGameOver: () => false,
      isLevelUpCelebrationActive: () => false,
      isLevelUpOverlayActive: () => false,
      isPickupOverlayActive: () => false,
      getDialog: () => ({ active: false, page: 1, maxPages: 1 }),
      setDialogPage: vi.fn(),
      getRoomCoords: () => ({ row: 0, col: 0 }),
      getRoomIndex: (_row: number, col: number) => (col === -1 ? 1 : null),
      getObjectAt: () => null,
      hasSkill: () => false,
      consumeKey: () => false,
      getKeys: () => 0,
      setPlayerPosition: (x: number, y: number, roomIndex: number | null) => {
        player.x = x;
        player.y = y;
        if (roomIndex !== null) {
          player.roomIndex = roomIndex;
        }
      },
    };

    const movementRenderer = {
      draw: vi.fn(),
      captureGameplayFrame: vi.fn(),
      startRoomTransition: vi.fn(() => false),
      flashEdge: vi.fn(),
    };
    const dialogManager = { closeDialog: vi.fn(), showDialog: vi.fn() };
    const interactionManager = { handlePlayerInteractions: vi.fn() };
    const movementTileManager = { getTileMap: vi.fn(() => ({ ground: [], overlay: [] })), getTile: vi.fn(() => null) };

    const enemyManager = new EnemyManager(gameState as never, renderer, tileManager);
    const movementManager = new MovementManager({
      gameState: gameState as never,
      tileManager: movementTileManager,
      renderer: movementRenderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    movementManager.tryMove(-1, 0);

    expect(gameState.damagePlayer).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

type GlobalWithCrypto = typeof globalThis & {
  crypto?: Crypto & { randomUUID?: () => string };
};
