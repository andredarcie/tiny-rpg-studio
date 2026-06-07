import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { EnemyManager } from '../../runtime/services/engine/EnemyManager';
import type { GameStateApi, RendererApi, TileManagerApi } from '../../types/managerTypes';

/**
 * Regression test for the reported "magic door" / gate variable bug.
 *
 * User report:
 *   "After putting 2 gates in 2 different rooms and an end-boss with a variable
 *    to open gate #2, once I beat the boss the variable has Current State: ON and
 *    STAYS set at that — that variable can never be used again, it is PERMANENTLY ON."
 *
 * Root cause:
 *   Defeating an enemy goes through EnemyManager.tryTriggerDefeatVariable, and
 *   getDefeatVariableConfig used to default `persist` to TRUE. With persist=true,
 *   StateVariableManager.setVariableValue writes the value not only into the
 *   RUNTIME state but also into the GAME DEFINITION (`game.variables`). The
 *   definition is the editor's authoring source of truth and the baseline that
 *   `resetGame()` clones, so beating the boss mutated the authored variable to ON
 *   forever: the editor showed it stuck ON and every replay started with the gate
 *   already open (even though resetGame had revived the boss).
 *
 * Fix:
 *   Boss defeat is gameplay, so it now defaults to persist=false (runtime only).
 *   The `persist` write-back itself is still valid for AUTHORING APIs such as the
 *   SDK's setVariableDefault — that behaviour is locked in by the last test below.
 */
describe('Gate variable stuck ON after boss defeat (regression)', () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = {
      addEventListener: vi.fn(),
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  const authorGameWithGate2 = (state: GameState): void => {
    // The author wires gate #2 (a magic door) to var-2, authored OFF.
    state.game.objects = [
      {
        id: 'gate-2',
        type: 'door-variable',
        x: 4,
        y: 4,
        roomIndex: 1,
        variableId: 'var-2',
      },
    ];
    state.game.variables = [{ id: 'var-2', value: false }];
    // Re-seed the runtime from the freshly authored definition.
    state.resetGame();
  };

  const makeEnemyManager = (state: GameState): EnemyManager => {
    const renderer = {
      draw: vi.fn(),
      showCombatIndicator: vi.fn(),
    } as unknown as RendererApi;
    const tileManager = {
      getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
      getTile: vi.fn(() => null),
    } as unknown as TileManagerApi;
    return new EnemyManager(state as unknown as GameStateApi, renderer, tileManager);
  };

  it('opens the gate for the current playthrough but does NOT mutate the authored definition', () => {
    const state = new GameState();
    authorGameWithGate2(state);
    const manager = makeEnemyManager(state);

    // Sanity: authored OFF, runtime OFF before the boss is fought.
    expect((state.game.variables as Array<{ value: boolean }>)[0].value).toBe(false);
    expect(state.isVariableOn('var-2')).toBe(false);

    // The end-boss configured in the editor with a defeat variable for gate #2.
    const boss = { id: 'boss-1', type: 'boss', roomIndex: 1, x: 3, y: 3, lastX: 3, defeatVariableId: 'var-2' };
    expect(manager.tryTriggerDefeatVariable(boss as never)).toBe(true);

    // During the run the gate must open — runtime variable ON.
    expect(state.isVariableOn('var-2')).toBe(true);

    // ...but the authored game DEFINITION must stay OFF. Gameplay must never
    // rewrite the editor's source of truth.
    expect((state.game.variables as Array<{ value: boolean }>)[0].value).toBe(false);
  });

  it('defaults the boss-defeat variable to NON-persistent', () => {
    const state = new GameState();
    authorGameWithGate2(state);
    const manager = makeEnemyManager(state);

    const boss = { id: 'boss-1', type: 'boss', roomIndex: 1, x: 3, y: 3, lastX: 3, defeatVariableId: 'var-2' };
    expect(manager.getDefeatVariableConfig(boss as never)?.persist).toBe(false);
  });

  it('resets the gate variable to OFF on replay (it is NOT stuck ON forever)', () => {
    const state = new GameState();
    authorGameWithGate2(state);
    const manager = makeEnemyManager(state);

    // Playthrough #1: beat the boss -> variable turns ON, gate #2 opens.
    const boss = { id: 'boss-1', type: 'boss', roomIndex: 1, x: 3, y: 3, lastX: 3, defeatVariableId: 'var-2' };
    manager.tryTriggerDefeatVariable(boss as never);
    expect(state.isVariableOn('var-2')).toBe(true);

    // Player restarts the game (resetGame re-seeds runtime from the definition).
    state.resetGame();

    // The variable must be OFF again at the start of a fresh playthrough so the
    // gate is closed until the boss is beaten again.
    expect(state.isVariableOn('var-2')).toBe(false);
  });

  it("reproduces the user's exact 2-gates setup: only gate #2 opens, the editor stays clean, and both reset", () => {
    const state = new GameState();
    // Gate #1 in room 0 (var-1) and gate #2 in room 1 (var-2), both authored OFF.
    state.game.objects = [
      { id: 'gate-1', type: 'door-variable', x: 4, y: 4, roomIndex: 0, variableId: 'var-1' },
      { id: 'gate-2', type: 'door-variable', x: 4, y: 4, roomIndex: 1, variableId: 'var-2' },
    ];
    state.game.variables = [
      { id: 'var-1', value: false },
      { id: 'var-2', value: false },
    ];
    state.resetGame();

    const manager = makeEnemyManager(state);

    // Beat the end-boss wired to gate #2.
    const boss = { id: 'boss-1', type: 'boss', roomIndex: 1, x: 3, y: 3, lastX: 3, defeatVariableId: 'var-2' };
    expect(manager.tryTriggerDefeatVariable(boss as never)).toBe(true);

    // Gate #2 opens for this run; gate #1 is completely untouched.
    expect(state.isVariableOn('var-2')).toBe(true);
    expect(state.isVariableOn('var-1')).toBe(false);

    // The editor reads the DEFINITION (getVariableDefinitions). Neither variable
    // is "Current State: ON" there — the authoring data stays pristine.
    const defs = state.getVariableDefinitions() as Array<{ id: string; value: boolean }>;
    expect(defs.find((v) => v.id === 'var-1')?.value).toBe(false);
    expect(defs.find((v) => v.id === 'var-2')?.value).toBe(false);

    // Replaying the game closes both gates again — var-2 is reusable, not stuck ON.
    state.resetGame();
    expect(state.isVariableOn('var-1')).toBe(false);
    expect(state.isVariableOn('var-2')).toBe(false);
  });

  it('still lets the authoring API persist a new default that survives resetGame', () => {
    // Guard against over-fixing: persisting into the definition is still valid for
    // authoring (the SDK's setVariableDefault). Only gameplay must avoid it.
    const state = new GameState();
    authorGameWithGate2(state);

    // setVariableDefault persists into the authored definition (persist=true).
    state.setVariableValue('var-2', true, true);
    expect((state.game.variables as Array<{ value: boolean }>)[0].value).toBe(true);

    // Because it is now the authored default, it survives a reset.
    state.resetGame();
    expect(state.isVariableOn('var-2')).toBe(true);
  });

  /**
   * Full end-to-end: drives the REAL combat entry point (handleEnemyCollision) on a
   * complete GameState + EnemyManager + CombatManager, with no combat-system stubs
   * so it runs the production legacy combat path. The player kills the boss in a real
   * collision, which fires the actual defeat-variable pipeline
   * (handleEnemyDefeated -> tryTriggerDefeatVariable -> setVariableValue).
   */
  it('end-to-end: killing the boss in a real collision opens gate #2 without corrupting it', () => {
    const state = new GameState();

    // Author: gate #2 (magic door) wired to var-2, authored OFF, plus a boss in
    // room 0 carrying that defeat variable, standing next to the player.
    state.game.start = { x: 2, y: 2, roomIndex: 0 };
    state.game.objects = [
      { id: 'gate-2', type: 'door-variable', x: 5, y: 5, roomIndex: 1, variableId: 'var-2' },
    ];
    state.game.variables = [{ id: 'var-2', value: false }];
    state.game.enemies = [
      { id: 'boss-1', type: 'giant-rat', roomIndex: 0, x: 3, y: 2, lives: 1, defeatVariableId: 'var-2' },
    ] as never;
    state.resetGame();

    // Legacy combat path: NO combatAnimator/cameraShake/etc., so enemy defeat
    // resolves synchronously through real production code.
    const renderer = {
      draw: vi.fn(),
      flashScreen: vi.fn(),
      showCombatIndicator: vi.fn(),
      spawnEnemyLifeLoss: vi.fn(),
      applyGrayscaleFilter: vi.fn(),
      removeGrayscaleFilter: vi.fn(),
    } as unknown as RendererApi;
    const tileManager = {
      getTileMap: vi.fn(() => ({ ground: [], overlay: [] })),
      getTile: vi.fn(() => null),
    } as unknown as TileManagerApi;
    const manager = new EnemyManager(state as unknown as GameStateApi, renderer, tileManager);

    // Before the fight: gate closed, boss present.
    expect(state.isVariableOn('var-2')).toBe(false);
    expect(state.getEnemies().length).toBe(1);

    // Real collision -> player defeats the boss.
    manager.handleEnemyCollision(0);

    // Boss is gone, gate #2 is open for this playthrough...
    expect(state.getEnemies().length).toBe(0);
    expect(state.isVariableOn('var-2')).toBe(true);

    // ...but the authored definition was NOT corrupted (the editor stays clean).
    const defs = state.getVariableDefinitions() as Array<{ id: string; value: boolean }>;
    expect(defs.find((v) => v.id === 'var-2')?.value).toBe(false);

    // Replaying revives the boss AND closes the gate again — consistent, reusable.
    state.resetGame();
    expect(state.getEnemies().length).toBe(1);
    expect(state.isVariableOn('var-2')).toBe(false);
  });
});
