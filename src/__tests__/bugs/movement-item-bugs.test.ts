import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MovementManager } from '../../runtime/services/engine/MovementManager';
import { InteractionManager } from '../../runtime/services/engine/InteractionManager';
import { GameState } from '../../runtime/domain/GameState';
import { TextResources } from '../../runtime/adapters/TextResources';

/**
 * Failing tests that prove two real bugs in the engine. They encode the
 * CORRECT behavior, so they fail today and will pass once the bugs are fixed.
 * Production source is intentionally NOT modified here.
 */
describe('movement / item bugs (regression)', () => {
  // ---------------------------------------------------------------------------
  // BUG A — A push-box can be pushed onto a tile occupied by an enemy/NPC.
  //
  // src/runtime/services/engine/MovementManager.ts
  //   - canPushBoxTo() (~line 506-524) validates bounds, walls, blocking
  //     objects (other boxes / locked / variable doors) and collision tiles,
  //     but never checks enemy or NPC occupancy at the box DESTINATION.
  //   - tryMove() (~line 347-394) mutates objectAtTarget.x/y to move the box
  //     BEFORE the NPC check (~361) and the enemy check (~388). Those two
  //     checks only inspect the PLAYER's target tile (where the box used to
  //     be), not the box destination, so the box ends up overlapping the
  //     enemy/NPC.
  //
  // Layout for the test (all on row y=0, room 0):
  //   player @ (0,0)  box @ (1,0)  enemy/NPC @ (2,0)
  // Player moves right (dx=1): would push the box from (1,0) onto (2,0),
  // which is occupied. Correct behavior: the push is blocked, the box stays
  // at (1,0).
  // ---------------------------------------------------------------------------
  describe('BUG A: push-box onto occupied tile', () => {
    const getSpy = vi.spyOn(TextResources, 'get');
    const formatSpy = vi.spyOn(TextResources, 'format');

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
    const tileManager = {
      getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
      getTile: vi.fn(() => null),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      getSpy.mockImplementation((...args: unknown[]) => (args[1] as string | undefined) || 'text');
      formatSpy.mockImplementation((...args: unknown[]) => (args[2] as string | undefined) || 'text');
    });

    type Npc = { placed: boolean; roomIndex: number; x: number; y: number; text?: string };

    // Shared mock game-state builder. The push-box lives at (1,0); getObjectAt
    // returns it by reference so tryMove() can read and (buggily) mutate it.
    const createPushBoxGameState = (box: { type: string; x: number; y: number }) => ({
      playing: true,
      game: { roomSize: 8 },
      isGameOver: () => false,
      isLevelUpCelebrationActive: () => false,
      isLevelUpOverlayActive: () => false,
      isPickupOverlayActive: () => false,
      isInCombat: () => false,
      getDialog: () => ({ active: false, page: 1, maxPages: 2 }),
      setDialogPage: vi.fn(),
      getPlayer: () => ({ roomIndex: 0, x: 0, y: 0, lastX: 0 }),
      getRoomCoords: () => ({ row: 0, col: 0 }),
      getRoomIndex: () => null,
      // rooms array must exist for the target room to be valid (no walls).
      getGame: () => ({ sprites: [] as Npc[], rooms: [{}] }),
      getObjectAt: (_room: number, x: number, y: number) =>
        x === box.x && y === box.y ? box : null,
      isVariableOn: () => false,
      hasSkill: vi.fn(() => false),
      consumeKey: () => false,
      getKeys: () => 0,
      setPlayerPosition: vi.fn(),
    });

    it('does NOT push a box onto a tile occupied by an enemy', () => {
      const box = { type: 'push-box', x: 1, y: 0 };
      const gameState = createPushBoxGameState(box);

      // Enemy occupies the box destination (2,0). collideAt reports the enemy
      // at (2,0) and nowhere else.
      const enemyManager = {
        collideAt: vi.fn((_room: number, x: number, y: number) => x === 2 && y === 0),
        checkCollisionAt: vi.fn(),
      };

      const manager = new MovementManager({
        gameState,
        tileManager,
        renderer,
        dialogManager,
        interactionManager,
        enemyManager,
      });

      // Player at (0,0) moves right: pushes box (1,0) -> (2,0), where the enemy is.
      manager.tryMove(1, 0);

      // CORRECT behavior: the push is blocked, so the box must NOT move onto the
      // enemy's tile. It stays at (1,0).
      // BUG TODAY: canPushBoxTo() ignores enemy occupancy, so tryMove() moves
      // the box to (2,0) -> these assertions fail.
      expect(box.x).toBe(1);
      expect(box.y).toBe(0);
    });

    it('does NOT push a box onto a tile occupied by an NPC', () => {
      const box = { type: 'push-box', x: 1, y: 0 };
      const gameState = createPushBoxGameState(box);
      // NPC occupies the box destination (2,0). findNpcAt() reads game.sprites.
      gameState.getGame = () => ({
        sprites: [{ placed: true, roomIndex: 0, x: 2, y: 0, text: 'Hi' }],
        rooms: [{}],
      });

      // No enemy anywhere.
      const enemyManager = {
        collideAt: vi.fn(() => false),
        checkCollisionAt: vi.fn(),
      };

      const manager = new MovementManager({
        gameState,
        tileManager,
        renderer,
        dialogManager,
        interactionManager,
        enemyManager,
      });

      // Player at (0,0) moves right: pushes box (1,0) -> (2,0), where the NPC is.
      manager.tryMove(1, 0);

      // CORRECT behavior: the push is blocked, the box stays at (1,0).
      // BUG TODAY: canPushBoxTo() ignores NPC occupancy, so the box overlaps the
      // NPC at (2,0) -> these assertions fail.
      expect(box.x).toBe(1);
      expect(box.y).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // BUG B — Item pickup mutates the persistent authored definition.
  //
  // src/runtime/services/engine/InteractionManager.ts
  //   - checkItems() (~line 157-163) sets `item.collected = true` directly on
  //     entries from game.items (the authored definition).
  // src/runtime/domain/state/StateItemManager.ts
  //   - has no runtime/definition split; resetItems() merely flips the flag
  //     back to false. There is no separate runtime collection layer.
  // src/runtime/domain/state/StateDataManager.ts
  //   - exportGameData() (~line 95) returns `items: this.game.items` BY
  //     REFERENCE.
  //
  // Concrete hazard (the framing we assert against, per the task): calling
  // exportGameData() mid-play returns collected:true for items the player has
  // already picked up. That dirties the authored/saved game — a data leak of
  // run-time progress into the saved definition. The authored definition must
  // stay un-collected after a play-time pickup.
  //
  // We drive the pickup through the public interaction path used by the engine
  // (handlePlayerInteractions -> checkItems), exactly how stepping onto an item
  // tile triggers a pickup at run time.
  // ---------------------------------------------------------------------------
  describe('BUG B: item pickup dirties the authored definition', () => {
    it('keeps exportGameData().items[].collected falsy after a play-time pickup', () => {
      const gameState = new GameState();

      // Author an item and place the player onto its tile so a single
      // handlePlayerInteractions() call collects it.
      const player = gameState.getPlayer();
      expect(player).not.toBeNull();
      const { roomIndex, x, y } = player as { roomIndex: number; x: number; y: number };

      const game = gameState.getGame() as { items: Array<Record<string, unknown>> };
      game.items.push({ id: 'item-1', type: 'note', roomIndex, x, y, collected: false });

      // Sanity: the authored definition starts un-collected.
      const before = gameState.exportGameData() as { items?: Array<{ collected?: boolean }> };
      expect(before.items?.[0]?.collected).toBeFalsy();

      const manager = new InteractionManager(
        gameState as unknown as ConstructorParameters<typeof InteractionManager>[0],
        { showDialog: vi.fn() }
      );

      // Public interaction path: same call the engine makes after a move lands
      // the player on the item tile.
      manager.handlePlayerInteractions();

      // The exported snapshot is what gets shared/saved. Calling it mid-play
      // must NOT carry run-time progress.
      const after = gameState.exportGameData() as { items?: Array<{ collected?: boolean }> };

      // CORRECT behavior: the AUTHORED definition stays un-collected; run-time
      // collection should live in a separate runtime layer.
      // BUG TODAY: checkItems() set game.items[0].collected = true in place, and
      // exportGameData() returns game.items by reference -> this assertion fails.
      expect(after.items?.[0]?.collected).toBeFalsy();
    });
  });
});
