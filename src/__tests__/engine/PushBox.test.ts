import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MovementManager } from '../../runtime/services/engine/MovementManager';
import { InteractionManager } from '../../runtime/services/engine/InteractionManager';
import { StateObjectManager } from '../../runtime/domain/state/StateObjectManager';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { TextResources } from '../../runtime/adapters/TextResources';
import { createInteractionGameState } from '../helpers/createInteractionGameState';

// ─── MovementManager helpers ──────────────────────────────────────────────────

const createTileManager = () => ({
  getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
  getTile: vi.fn(() => null),
});

const renderer = {
  draw: vi.fn(),
  captureGameplayFrame: vi.fn(() => null),
  startRoomTransition: vi.fn(() => false),
  flashEdge: vi.fn(),
};

const dialogManager = { closeDialog: vi.fn(), showDialog: vi.fn() };
const interactionManager = { handlePlayerInteractions: vi.fn() };
const enemyManager = { collideAt: vi.fn(() => false), checkCollisionAt: vi.fn() };

const makeRoom = (walls: boolean[][] = []) => ({ walls });
const emptyWalls = (): boolean[][] => Array.from({ length: 8 }, () => Array<boolean>(8).fill(false));

const createMovementGameState = (overrides: Record<string, unknown> = {}) => ({
  playing: true,
  game: { roomSize: 8 },
  isGameOver: vi.fn(() => false),
  isLevelUpCelebrationActive: vi.fn(() => false),
  isLevelUpOverlayActive: vi.fn(() => false),
  isPickupOverlayActive: vi.fn(() => false),
  getDialog: vi.fn(() => ({ active: false, page: 1, maxPages: 1 })),
  setDialogPage: vi.fn(),
  getPlayer: vi.fn(() => ({ roomIndex: 0, x: 3, y: 3, lastX: 2 })),
  getRoomCoords: vi.fn(() => ({ row: 0, col: 0 })),
  getRoomIndex: vi.fn(() => null),
  getGame: vi.fn(() => ({ rooms: [makeRoom(emptyWalls())], sprites: [] })),
  getObjectAt: vi.fn(() => null),
  isVariableOn: vi.fn(() => false),
  hasSkill: vi.fn(() => false),
  consumeKey: vi.fn(() => false),
  getKeys: vi.fn(() => 0),
  setPlayerPosition: vi.fn(),
  resetPushBoxesForRoom: vi.fn(),
  ...overrides,
});

const makeMovementManager = (gameState: ReturnType<typeof createMovementGameState>) =>
  new MovementManager({
    gameState: gameState as never,
    tileManager: createTileManager(),
    renderer,
    dialogManager,
    interactionManager,
    enemyManager,
  });

// ─── StateObjectManager helpers ──────────────────────────────────────────────

const createWorldManager = () => ({
  clampRoomIndex: (v: number) => Math.max(0, Math.min(8, Math.floor(Number.isFinite(v) ? v : 0))),
  clampCoordinate: (v: number) => Math.max(0, Math.min(7, Math.floor(Number.isFinite(v) ? v : 0))),
});

const createVariableManager = () => ({
  getFirstVariableId: () => 'var-1',
  normalizeVariableId: (v: string | null | undefined) => (v === 'var-1' ? v : null),
});

describe('PushBox — MovementManager', () => {
  const getSpy = vi.spyOn(TextResources, 'get');
  const formatSpy = vi.spyOn(TextResources, 'format');

  beforeEach(() => {
    vi.clearAllMocks();
    getSpy.mockImplementation((...args: unknown[]) => (args[1] as string) || 'text');
    formatSpy.mockImplementation((...args: unknown[]) => (args[2] as string) || 'text');
  });

  it('pushes box even when a pressure plate is underneath it', () => {
    const box = { type: 'push-box', roomIndex: 0, x: 4, y: 3 };
    // getObjectAt must return the push-box (not the plate) — simulates StateObjectManager priority
    const gameState = createMovementGameState({
      getObjectAt: vi.fn((_, x, y) => {
        if (x === 4 && y === 3) return box; // push-box wins over plate
        return null;
      }),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(box.x).toBe(5);
    expect(box.y).toBe(3);
    expect(gameState.setPlayerPosition).toHaveBeenCalledWith(4, 3, null);
  });

  it('pushes box into empty space and moves player into its old position', () => {
    const box = { type: 'push-box', roomIndex: 0, x: 4, y: 3 };
    const gameState = createMovementGameState({
      getObjectAt: vi.fn((_, x, y) => (x === 4 && y === 3 ? box : null)),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(box.x).toBe(5);
    expect(box.y).toBe(3);
    expect(gameState.setPlayerPosition).toHaveBeenCalledWith(4, 3, null);
  });

  it('blocks player when wall is behind the box', () => {
    const walls = emptyWalls();
    walls[3][5] = true;
    const box = { type: 'push-box', roomIndex: 0, x: 4, y: 3 };
    const gameState = createMovementGameState({
      getGame: vi.fn(() => ({ rooms: [makeRoom(walls)], sprites: [] })),
      getObjectAt: vi.fn((_, x, y) => (x === 4 && y === 3 ? box : null)),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(box.x).toBe(4);
    expect(gameState.setPlayerPosition).not.toHaveBeenCalled();
  });

  it('blocks player when another push-box is behind the box', () => {
    const box = { type: 'push-box', roomIndex: 0, x: 4, y: 3 };
    const box2 = { type: 'push-box', roomIndex: 0, x: 5, y: 3 };
    const gameState = createMovementGameState({
      getObjectAt: vi.fn((_, x, y) => {
        if (x === 4 && y === 3) return box;
        if (x === 5 && y === 3) return box2;
        return null;
      }),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(box.x).toBe(4);
    expect(gameState.setPlayerPosition).not.toHaveBeenCalled();
  });

  it('blocks player when a locked door is behind the box', () => {
    const box = { type: 'push-box', roomIndex: 0, x: 4, y: 3 };
    const door = { type: 'door', roomIndex: 0, x: 5, y: 3, isLockedDoor: true, opened: false };
    const gameState = createMovementGameState({
      getObjectAt: vi.fn((_, x, y) => {
        if (x === 4 && y === 3) return box;
        if (x === 5 && y === 3) return door;
        return null;
      }),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(box.x).toBe(4);
    expect(gameState.setPlayerPosition).not.toHaveBeenCalled();
  });

  it('blocks player when box is at the room boundary', () => {
    const box = { type: 'push-box', roomIndex: 0, x: 7, y: 3 };
    const gameState = createMovementGameState({
      getPlayer: vi.fn(() => ({ roomIndex: 0, x: 6, y: 3, lastX: 5 })),
      getObjectAt: vi.fn((_, x, y) => (x === 7 && y === 3 ? box : null)),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(box.x).toBe(7);
    expect(gameState.setPlayerPosition).not.toHaveBeenCalled();
  });

  it('can push box upward', () => {
    const box = { type: 'push-box', roomIndex: 0, x: 3, y: 2 };
    const gameState = createMovementGameState({
      getPlayer: vi.fn(() => ({ roomIndex: 0, x: 3, y: 3, lastX: 3 })),
      getObjectAt: vi.fn((_, x, y) => (x === 3 && y === 2 ? box : null)),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(0, -1);

    expect(box.x).toBe(3);
    expect(box.y).toBe(1);
    expect(gameState.setPlayerPosition).toHaveBeenCalledWith(3, 2, null);
  });

  it('resets push boxes in current room when entering a new room', () => {
    // Player is at the right edge (x=7); moving right crosses into room 1
    const gameState = createMovementGameState({
      getPlayer: vi.fn(() => ({ roomIndex: 0, x: 7, y: 3, lastX: 6 })),
      getRoomIndex: vi.fn(() => 1),
      getGame: vi.fn(() => ({
        rooms: [makeRoom(emptyWalls()), makeRoom(emptyWalls())],
        sprites: [],
      })),
      getObjectAt: vi.fn(() => null),
    });
    const manager = makeMovementManager(gameState);

    manager.tryMove(1, 0);

    expect(gameState.resetPushBoxesForRoom).toHaveBeenCalledWith(0);
  });
});

describe('PushBox — InteractionManager pressure plate integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('activates pressure plate when a push-box is on it', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: false, roomIndex: 0, x: 2, y: 3 };
    const box = { type: 'push-box', roomIndex: 0, x: 2, y: 3 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate, box]);
    const manager = new InteractionManager(gameState, { showDialog: vi.fn() });
    const player = { roomIndex: 0, x: 5, y: 5 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(true);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', true);
  });

  it('deactivates pressure plate when push-box moves off', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: true, roomIndex: 0, x: 2, y: 3 };
    const box = { type: 'push-box', roomIndex: 0, x: 4, y: 4 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate, box]);
    const manager = new InteractionManager(gameState, { showDialog: vi.fn() });
    const player = { roomIndex: 0, x: 5, y: 5 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(false);
    expect(gameState.setVariableValue).toHaveBeenCalledWith('var-1', false);
  });

  it('keeps plate active when player steps on it without box', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: false, roomIndex: 0, x: 2, y: 3 };
    const box = { type: 'push-box', roomIndex: 0, x: 5, y: 5 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate, box]);
    const manager = new InteractionManager(gameState, { showDialog: vi.fn() });
    const player = { roomIndex: 0, x: 2, y: 3 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(true);
  });

  it('does not activate plate when box is in a different room', () => {
    const gameState = createInteractionGameState();
    (gameState.normalizeVariableId as ReturnType<typeof vi.fn>).mockReturnValue('var-1');
    const plate = { type: 'pressure-plate', variableId: 'var-1', activated: false, roomIndex: 0, x: 2, y: 3 };
    const box = { type: 'push-box', roomIndex: 1, x: 2, y: 3 };
    (gameState.getAllObjects as ReturnType<typeof vi.fn>).mockReturnValue([plate, box]);
    const manager = new InteractionManager(gameState, { showDialog: vi.fn() });
    const player = { roomIndex: 0, x: 5, y: 5 };

    manager.checkPressurePlates(player);

    expect(plate.activated).toBe(false);
    expect(gameState.setVariableValue).not.toHaveBeenCalled();
  });
});

describe('PushBox — StateObjectManager reset', () => {
  it('normalizeObjects captures originalX and originalY for push-box', () => {
    const game = { start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] };
    const manager = new StateObjectManager(game, createWorldManager(), createVariableManager());

    const result = manager.normalizeObjects([
      { type: ITEM_TYPES.PUSH_BOX, roomIndex: 0, x: 3, y: 4 },
    ]);

    expect(result[0].originalX).toBe(3);
    expect(result[0].originalY).toBe(4);
  });

  it('resetPushBoxesForRoom restores box to its original position', () => {
    const game = { start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] };
    const manager = new StateObjectManager(game, createWorldManager(), createVariableManager());
    const box = manager.normalizeObjects([{ type: ITEM_TYPES.PUSH_BOX, roomIndex: 0, x: 3, y: 4 }])[0];
    game.objects = [game.objects[0], box] as never;

    box.x = 6;
    box.y = 2;
    manager.resetPushBoxesForRoom(0);

    expect(box.x).toBe(3);
    expect(box.y).toBe(4);
  });

  it('resetPushBoxesForRoom only affects boxes in the specified room', () => {
    const game = { start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] };
    const manager = new StateObjectManager(game, createWorldManager(), createVariableManager());
    const [boxRoom0, boxRoom1] = manager.normalizeObjects([
      { type: ITEM_TYPES.PUSH_BOX, roomIndex: 0, x: 1, y: 1 },
      { type: ITEM_TYPES.PUSH_BOX, roomIndex: 1, x: 2, y: 2 },
    ]);
    game.objects = [game.objects[0], boxRoom0, boxRoom1] as never;

    boxRoom0.x = 5;
    boxRoom1.x = 5;
    manager.resetPushBoxesForRoom(0);

    expect(boxRoom0.x).toBe(1);
    expect(boxRoom1.x).toBe(5);
  });

  it('resetRuntime restores all push boxes across all rooms', () => {
    const game = { start: { x: 1, y: 1, roomIndex: 0 }, objects: [], variables: [] };
    const manager = new StateObjectManager(game, createWorldManager(), createVariableManager());
    const [boxA, boxB] = manager.normalizeObjects([
      { type: ITEM_TYPES.PUSH_BOX, roomIndex: 0, x: 1, y: 1 },
      { type: ITEM_TYPES.PUSH_BOX, roomIndex: 2, x: 3, y: 3 },
    ]);
    game.objects = [game.objects[0], boxA, boxB] as never;

    boxA.x = 6;
    boxB.y = 6;
    manager.resetRuntime();

    expect(boxA.x).toBe(1);
    expect(boxA.y).toBe(1);
    expect(boxB.x).toBe(3);
    expect(boxB.y).toBe(3);
  });
});
