import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MovementManager } from '../../runtime/services/engine/MovementManager';
import { TextResources } from '../../runtime/adapters/TextResources';

describe('MovementManager', () => {
  const getSpy = vi.spyOn(TextResources, 'get');
  const formatSpy = vi.spyOn(TextResources, 'format');
  const createGameState = (dialogActive = false) => ({
    playing: true,
    game: { roomSize: 8 },
    isGameOver: () => false,
    isLevelUpCelebrationActive: () => false,
    isLevelUpOverlayActive: () => false,
    isPickupOverlayActive: () => false,
    getDialog: () => ({ active: dialogActive, page: 1, maxPages: 2 }),
    setDialogPage: vi.fn(),
    getPlayer: () => ({ roomIndex: 0, x: 0, y: 0, lastX: 0 }),
    getRoomCoords: () => ({ row: 0, col: 0 }),
    getRoomIndex: () => null,
    getGame: () => ({ sprites: [] }),
    getObjectAt: () => null,
    isVariableOn: () => false,
    hasSkill: vi.fn((_skill: string) => false),
    consumeKey: () => false,
    getKeys: () => 0,
    setPlayerPosition: vi.fn(),
  });

  const renderer = {
    draw: vi.fn(),
    captureGameplayFrame: vi.fn(),
    startRoomTransition: vi.fn(() => false),
    flashEdge: vi.fn(),
  };

  const dialogManager = {
    closeDialog: vi.fn(),
    showDialog: vi.fn(),
  };

  const interactionManager = {
    handlePlayerInteractions: vi.fn(),
    getNpcDialogText: vi.fn(),
    getNpcDialogMeta: vi.fn(),
  };

  const enemyManager = {
    collideAt: vi.fn(() => false),
    checkCollisionAt: vi.fn(),
  };

  const tileManager = {
    getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
    getTile: vi.fn(() => null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getSpy.mockImplementation((...args: unknown[]) => {
      const fallback = args[1] as string | undefined;
      return fallback || 'text';
    });
    formatSpy.mockImplementation((...args: unknown[]) => {
      const fallback = args[2] as string | undefined;
      return fallback || 'text';
    });
  });

  it('advances dialog pages when a dialog is active', () => {
    const gameState = createGameState(true);
    const manager = new MovementManager({
      gameState,
      tileManager,
      renderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    manager.tryMove(1, 0);

    expect(gameState.setDialogPage).toHaveBeenCalledWith(2);
    expect(renderer.draw).toHaveBeenCalled();
  });

  it('closes dialog when the last page is reached', () => {
    const gameState = createGameState(true);
    gameState.getDialog = () => ({ active: true, page: 2, maxPages: 2 });
    const manager = new MovementManager({
      gameState,
      tileManager,
      renderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    manager.tryMove(1, 0);

    expect(dialogManager.closeDialog).toHaveBeenCalled();
  });

  it('honors collision traversal skills', () => {
    const gameState = createGameState(false);
    gameState.hasSkill.mockImplementation((skill: string) => skill === 'water-walker');
    const manager = new MovementManager({
      gameState,
      tileManager,
      renderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    expect(manager.canTraverseCollisionTile({ collision: true, category: 'agua' })).toBe(true);
    expect(manager.canTraverseCollisionTile({ collision: true, category: 'perigo' })).toBe(false);
  });

  it('sets a damage cooldown timestamp when entering a new room', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const player = { roomIndex: 0, x: 0, y: 0, lastX: 0, lastRoomChangeTime: null as number | null };
    const gameState = {
      ...createGameState(false),
      getPlayer: () => player,
      getRoomCoords: () => ({ row: 0, col: 0 }),
      getRoomIndex: (_row: number, col: number) => (col === -1 ? 1 : null),
      getGame: () => ({ sprites: [], rooms: [{}, {}] }),
      setPlayerPosition: (x: number, y: number, roomIndex: number | null) => {
        player.x = x;
        player.y = y;
        if (roomIndex !== null) {
          player.roomIndex = roomIndex;
        }
      },
    };
    const manager = new MovementManager({
      gameState,
      tileManager,
      renderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    manager.tryMove(-1, 0);

    expect(player.roomIndex).toBe(1);
    expect(player.lastRoomChangeTime).toBe(1000);

    vi.useRealTimers();
  });

  it('does not show NPC dialog when player walks into NPC tile during combat', () => {
    const npc = { placed: true, roomIndex: 0, x: 1, y: 0, text: 'Hello!' };
    const gameState = {
      ...createGameState(false),
      isInCombat: () => true,
      getGame: () => ({ sprites: [npc], rooms: [{}] }),
    };
    interactionManager.getNpcDialogText.mockReturnValue('Hello!');

    const manager = new MovementManager({
      gameState,
      tileManager,
      renderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    // Player at (0,0) tries to move right into NPC at (1,0)
    manager.tryMove(1, 0);

    expect(dialogManager.showDialog).not.toHaveBeenCalled();
  });

  it('shows NPC dialog when player walks into NPC tile and NOT in combat', () => {
    const npc = { placed: true, roomIndex: 0, x: 1, y: 0, text: 'Hello!' };
    const gameState = {
      ...createGameState(false),
      isInCombat: () => false,
      getGame: () => ({ sprites: [npc], rooms: [{}] }),
    };
    interactionManager.getNpcDialogText.mockReturnValue('Hello!');

    const manager = new MovementManager({
      gameState,
      tileManager,
      renderer,
      dialogManager,
      interactionManager,
      enemyManager,
    });

    manager.tryMove(1, 0);

    expect(dialogManager.showDialog).toHaveBeenCalledWith('Hello!', undefined);
  });
});
