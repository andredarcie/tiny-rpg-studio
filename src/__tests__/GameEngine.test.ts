import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  StubDialogManager,
  StubEnemyManager,
  StubGameState,
  StubInputManager,
  StubInteractionManager,
  StubMovementManager,
  StubNpcManager,
  StubRenderer,
  StubTileManager
} from './stubs/index'

class StubBackgroundMusicEngine {
  play = vi.fn()
  stop = vi.fn()
  destroy = vi.fn()
  syncFromGame = vi.fn()
  setVideoId = vi.fn()
}

vi.mock('../runtime/domain/GameState', () => ({ GameState: StubGameState }))
vi.mock('../runtime/services/TileManager', () => ({ TileManager: StubTileManager }))
vi.mock('../runtime/services/NPCManager', () => ({ NPCManager: StubNpcManager }))
vi.mock('../runtime/adapters/Renderer', () => ({ Renderer: StubRenderer }))
vi.mock('../runtime/services/engine/DialogManager', () => ({ DialogManager: StubDialogManager }))
vi.mock('../runtime/services/engine/InteractionManager', () => ({ InteractionManager: StubInteractionManager }))
vi.mock('../runtime/services/engine/EnemyManager', () => ({ EnemyManager: StubEnemyManager }))
vi.mock('../runtime/services/engine/MovementManager', () => ({ MovementManager: StubMovementManager }))
vi.mock('../runtime/adapters/InputManager', () => ({ InputManager: StubInputManager }))
vi.mock('../runtime/services/BackgroundMusicEngine', () => ({ BackgroundMusicEngine: StubBackgroundMusicEngine }))
vi.mock('../runtime/adapters/TextResources', () => ({
  TextResources: {
    format: (_key: string, params?: { name?: string }, fallback = '') => {
      return `pickup:${params?.name ?? fallback}`
    },
    get: (_key: string, fallback = '') => `localized:${fallback}`
  }
}))

let GameEngineCtor: GameEngineCtor

beforeAll(async () => {
  const mod = await import('../runtime/services/GameEngine')
  GameEngineCtor = mod.GameEngine as unknown as GameEngineCtor
})

const createEngine = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  return new GameEngineCtor(canvas)
}

type GameEngineApi = {
  tileManager: { ensureDefaultTiles: { mock: { calls: unknown[] } }; lastGetRoom?: number; lastSet?: unknown };
  npcManager: { ensureDefaultNPCs: { mock: { calls: unknown[] } } };
  renderer: {
    setIntroData: { mock: { calls: unknown[] } };
    draw: { mock: { calls: unknown[] } };
    overlayRects: Array<{ x: number; y: number; width: number; height: number }>;
    overlayRenderer: { getLevelUpCardLayout: () => { rects: Array<{ x: number; y: number; width: number; height: number }> } };
  };
  gameState: {
    pauseCalls: string[];
    resumeCalls: string[];
    setEditorMode: (active: boolean) => void;
    isEditorModeActive: () => boolean;
    state: {
      game: {
        title: string;
        backgroundMusicVideoId?: string;
        customTileEffects?: Array<{ id: `custom:${string}`; name: string; baseEffectIds: ['glow'] }>;
        tileset?: { tiles: Array<{ id: number; visualEffect?: string }> };
      };
    };
    playerRoomIndex?: number;
    objectsByRoom: Map<number, unknown[]>;
    enemyVariableResult: boolean;
    pickupOverlayActive: boolean;
    levelUpCelebrationActive: boolean;
    gameOver: boolean;
    canResetAfterGameOver: boolean;
    necromancerReady: boolean;
    reviveResult: boolean;
    levelUpOverlay: { active: boolean; cursor: number; choices: Array<{ id: string; nameKey?: string; resolvedName?: string }> };
    selectedLevelUpIndex: number | null;
    testSettings: { startLevel: number; skills: string[]; godMode: boolean };
  };
  introVisible: boolean;
  isIntroVisible: () => boolean;
  dismissIntroScreen: () => boolean;
  syncDocumentTitle: () => void;
  tryMove: (dx: number, dy: number) => void;
  checkInteractions: () => void;
  movementManager: { tryMove: { mock: { calls: unknown[] } } };
  interactionManager: { handlePlayerInteractions: { mock: { calls: unknown[] } } };
  getTileMap: (roomIndex?: number | null) => unknown;
  setMapTile: (x: number, y: number, tileId: string | number, roomIndex?: number | null) => void;
  getObjectsForRoom: (roomIndex?: number | null) => unknown;
  setObjectPosition: (type: string, roomIndex: number, x: number, y: number) => unknown;
  setVariableDefault: (variableId: string, value: boolean) => boolean;
  setEnemyVariable: (enemyId: string, variableId: string | null) => boolean;
  dismissPickupOverlay: () => void;
  dismissLevelUpCelebration: () => void;
  handlePlayerDefeat: () => void;
  handleGameCompletion: () => void;
  handleGameOverInteraction: () => void;
  resetGame: () => void;
  online: { onRespawned: (() => void) | null };
  awaitingRestart: boolean;
  enemyManager: { stop: { mock: { calls: unknown[] } }; start: { mock: { calls: unknown[] } } };
  inputManager: {
    cancelHeldMovement: { mock: { calls: unknown[] } };
    destroy: { mock: { calls: unknown[] } };
  };
  dialogManager: { lastMessage?: string };
  chooseLevelUpSkill: (index: number | null) => void;
  moveLevelUpCursor: (delta: number) => void;
  confirmLevelUpSelection: () => void;
  pickLevelUpChoiceFromPointer: (clientX: number, clientY: number) => number;
  canvas: HTMLCanvasElement;
  updateTestSettings: (settings: { startLevel?: number; skills?: string[]; godMode?: boolean }) => void;
  setPlayerEndText: (roomIndex: number, text: string) => string;
  setObjectVariable: (type: string, roomIndex: number, variableId: string | null) => unknown;
  getSprites: () => unknown[];
  importGameData: (data: unknown) => void;
  destroy: () => void;
  backgroundMusicEngine?: StubBackgroundMusicEngine;
  resumeBackgroundMusic: () => void;
  startEnemyLoop: () => void;
  deleteCustomTileEffect: (id: `custom:${string}`) => boolean;
};

type GameEngineCtor = new (canvas: HTMLCanvasElement) => GameEngineApi;

describe('GameEngine business rules (legacy)', () => {
  it('deletes custom effects and clears every tile assignment that used them', () => {
    const engine = createEngine();
    const game = engine.gameState.state.game;
    game.customTileEffects = [{ id: 'custom:0', name: 'Mistake', baseEffectIds: ['glow'] }];
    game.tileset = {
      tiles: [
        { id: 0, visualEffect: 'custom:0' },
        { id: 1, visualEffect: 'water' },
      ],
    };

    expect(engine.deleteCustomTileEffect('custom:0')).toBe(true);
    expect(game.customTileEffects).toBeUndefined();
    expect(game.tileset.tiles.map((tile) => tile.visualEffect)).toEqual(['none', 'water']);
    expect(engine.deleteCustomTileEffect('custom:missing')).toBe(false);
  });
  it('bootstraps subsystems and initializes intro state', () => {
    const engine = createEngine()

    expect(engine.tileManager.ensureDefaultTiles.mock.calls.length).toBeGreaterThan(0)
    expect(engine.npcManager.ensureDefaultNPCs.mock.calls.length).toBeGreaterThan(0)
    expect(engine.renderer.setIntroData.mock.calls.length).toBeGreaterThan(0)
    expect(engine.gameState.pauseCalls).toContain('intro-screen')
    expect(engine.isIntroVisible()).toBe(true)
  })

  it('dismisses intro screen only when visible', () => {
    const engine = createEngine()

    const dismissed = engine.dismissIntroScreen()
    expect(dismissed).toBe(true)
    expect(engine.gameState.resumeCalls).toContain('intro-screen')

    engine.introVisible = false
    expect(engine.dismissIntroScreen()).toBe(false)
  })

  it('updates document title from game state', () => {
    const engine = createEngine()
    engine.gameState.state.game.title = 'New Title'
    engine.syncDocumentTitle()

    expect(document.title).toBe('New Title')
  })

  it('routes movement and interaction calls to managers', () => {
    const engine = createEngine()

    engine.tryMove(1, -1)
    engine.checkInteractions()

    expect(engine.movementManager.tryMove.mock.calls).toEqual([[1, -1]])
    expect(engine.interactionManager.handlePlayerInteractions.mock.calls.length).toBe(1)
  })

  it('routes map reads to the current player room by default', () => {
    const engine = createEngine()
    engine.gameState.playerRoomIndex = 7

    engine.getTileMap()
    expect(engine.tileManager.lastGetRoom).toBe(7)
  })

  it('routes map writes to the current player room when roomIndex is omitted', () => {
    const engine = createEngine()
    engine.gameState.playerRoomIndex = 3

    engine.setMapTile(1, 2, 'tile-1')

    expect(engine.tileManager.lastSet).toEqual({
      x: 1,
      y: 2,
      tileId: 'tile-1',
      roomIndex: 3
    })
  })

  it('returns objects for the player room when roomIndex is omitted', () => {
    const engine = createEngine()
    engine.gameState.playerRoomIndex = 4
    engine.gameState.objectsByRoom.set(4, ['obj'])

    expect(engine.getObjectsForRoom()).toEqual(['obj'])
  })

  it('sets object positions and redraws', () => {
    const engine = createEngine()
    const drawsBefore = engine.renderer.draw.mock.calls.length

    const entry = engine.setObjectPosition('door', 1, 2, 3)

    expect(entry).toEqual({ type: 'door', roomIndex: 1, x: 2, y: 3 })
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('updates variable defaults and redraws only on change', () => {
    const engine = createEngine()
    const drawsBefore = engine.renderer.draw.mock.calls.length

    const changed = engine.setVariableDefault('var-1', false)
    expect(changed).toBe(false)
    expect(engine.renderer.draw.mock.calls.length).toBe(drawsBefore)

    const changedAgain = engine.setVariableDefault('var-1', true)
    expect(changedAgain).toBe(true)
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('updates enemy variables and redraws only on change', () => {
    const engine = createEngine()
    engine.gameState.enemyVariableResult = false
    const drawsBefore = engine.renderer.draw.mock.calls.length

    const noChange = engine.setEnemyVariable('enemy-1', 'var-1')
    expect(noChange).toBe(false)
    expect(engine.renderer.draw.mock.calls.length).toBe(drawsBefore)

    engine.gameState.enemyVariableResult = true
    const changed = engine.setEnemyVariable('enemy-1', 'var-1')
    expect(changed).toBe(true)
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('toggles pickup and celebration overlays with redraws', () => {
    const engine = createEngine()
    engine.gameState.pickupOverlayActive = true
    engine.gameState.levelUpCelebrationActive = true
    const drawsBefore = engine.renderer.draw.mock.calls.length

    engine.dismissPickupOverlay()
    engine.dismissLevelUpCelebration()

    expect(engine.gameState.pickupOverlayActive).toBe(false)
    expect(engine.gameState.levelUpCelebrationActive).toBe(false)
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('handles player defeat by stopping enemies and marking game over', () => {
    const engine = createEngine()
    const drawsBefore = engine.renderer.draw.mock.calls.length

    engine.handlePlayerDefeat()

    expect(engine.enemyManager.stop.mock.calls.length).toBeGreaterThan(0)
    expect((engine.gameState as StubGameState).setGameOverCalls).toEqual([{ value: true, reason: 'defeat' }])
    expect(engine.awaitingRestart).toBe(true)
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('handles game completion only when not already over', () => {
    const engine = createEngine()
    engine.gameState.gameOver = true

    engine.handleGameCompletion()
    expect(engine.enemyManager.stop.mock.calls.length).toBe(0)

    engine.gameState.gameOver = false
    engine.handleGameCompletion()
    expect(engine.enemyManager.stop.mock.calls.length).toBeGreaterThan(0)
    expect((engine.gameState as StubGameState).setGameOverCalls).toEqual([{ value: true, reason: 'victory' }])
    expect(engine.awaitingRestart).toBe(true)
  })

  it('handles game over interaction with necromancer revive', () => {
    const engine = createEngine()
    engine.gameState.gameOver = true
    engine.gameState.canResetAfterGameOver = true
    engine.gameState.necromancerReady = true
    engine.gameState.reviveResult = true

    let resetCalled = false
    engine.resetGame = () => {
      resetCalled = true
    }

    const drawsBefore = engine.renderer.draw.mock.calls.length
    engine.handleGameOverInteraction()

    expect(resetCalled).toBe(false)
    expect(engine.awaitingRestart).toBe(false)
    expect(engine.enemyManager.start.mock.calls.length).toBeGreaterThan(0)
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('falls back to resetGame when no revive is available', () => {
    const engine = createEngine()
    engine.gameState.gameOver = true
    engine.gameState.canResetAfterGameOver = true
    engine.gameState.necromancerReady = false

    let resetCalled = false
    engine.resetGame = () => {
      resetCalled = true
    }

    engine.handleGameOverInteraction()

    expect(resetCalled).toBe(true)
  })

  it('notifies online respawn after a game-over restart (so the other player stops seeing a ghost)', () => {
    const engine = createEngine()
    engine.gameState.gameOver = true
    engine.gameState.canResetAfterGameOver = true
    engine.gameState.necromancerReady = false
    engine.resetGame = () => {}

    const onRespawned = vi.fn()
    engine.online.onRespawned = onRespawned

    engine.handleGameOverInteraction()

    expect(onRespawned).toHaveBeenCalledTimes(1)
  })

  it('notifies online respawn after a necromancer revive', () => {
    const engine = createEngine()
    engine.gameState.gameOver = true
    engine.gameState.canResetAfterGameOver = true
    engine.gameState.necromancerReady = true
    engine.gameState.reviveResult = true

    const onRespawned = vi.fn()
    engine.online.onRespawned = onRespawned

    engine.handleGameOverInteraction()

    expect(onRespawned).toHaveBeenCalledTimes(1)
  })

  it('shows dialog on level up choice and redraws', () => {
    const engine = createEngine()
    engine.gameState.levelUpOverlay.active = true
    engine.gameState.levelUpOverlay.choices = [{ id: 'skill-1', nameKey: 'skills.skill1' }]

    const drawsBefore = engine.renderer.draw.mock.calls.length
    engine.chooseLevelUpSkill(0)

    expect(engine.dialogManager.lastMessage).toContain('pickup:')
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('uses resolved skill name in level up pickup dialog', () => {
    const engine = createEngine()
    engine.gameState.levelUpOverlay.active = true
    engine.gameState.levelUpOverlay.choices = [{ id: 'skill-1', nameKey: 'skills.skill1', resolvedName: 'Custom Skill' }]

    engine.chooseLevelUpSkill(0)

    expect(engine.dialogManager.lastMessage).toContain('Custom Skill')
  })

  it('moves and confirms level-up selections when overlay is active', () => {
    const engine = createEngine()
    engine.gameState.levelUpOverlay.active = true
    engine.gameState.levelUpOverlay.choices = [{ id: 'skill-1' }, { id: 'skill-2' }]

    engine.moveLevelUpCursor(1)
    engine.confirmLevelUpSelection()

    expect(engine.gameState.levelUpOverlay.cursor).toBe(1)
    expect(engine.gameState.selectedLevelUpIndex).toBe(1)
  })

  it('picks level-up choice based on pointer hit or nearest', () => {
    const engine = createEngine()
    engine.gameState.levelUpOverlay.active = true
    engine.gameState.levelUpOverlay.choices = [{ id: 'a' }, { id: 'b' }]
    engine.renderer.overlayRects = [
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 40, y: 0, width: 20, height: 20 }
    ]

    engine.canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 128,
      height: 128,
      right: 128,
      bottom: 128,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    const hitIndex = engine.pickLevelUpChoiceFromPointer(10, 10)
    expect(hitIndex).toBe(0)

    const nearestIndex = engine.pickLevelUpChoiceFromPointer(100, 10)
    expect(nearestIndex).toBe(1)
  })

  it('updates test settings and triggers reset', () => {
    const engine = createEngine()
    let resetCalled = false
    engine.resetGame = () => {
      resetCalled = true
    }

    engine.updateTestSettings({ startLevel: 2, godMode: true })

    expect(engine.gameState.testSettings.startLevel).toBe(2)
    expect(engine.gameState.testSettings.godMode).toBe(true)
    expect(resetCalled).toBe(true)
  })

  it('returns trimmed end text and redraws on update', () => {
    const engine = createEngine()
    const drawsBefore = engine.renderer.draw.mock.calls.length

    const normalized = engine.setPlayerEndText(0, '  hello  ')

    expect(normalized).toBe('hello')
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('updates object variables and redraws', () => {
    const engine = createEngine()
    const drawsBefore = engine.renderer.draw.mock.calls.length

    const result = engine.setObjectVariable('door', 1, 'var-1')

    expect(result).toEqual({ type: 'door', roomIndex: 1, variableId: 'var-1' })
    expect(engine.renderer.draw.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('ensures sprites are available by bootstrapping NPC defaults', () => {
    const engine = createEngine()
    const callsBefore = engine.npcManager.ensureDefaultNPCs.mock.calls.length

    engine.getSprites()

    expect(engine.npcManager.ensureDefaultNPCs.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('syncs background music from imported game data', () => {
    const engine = createEngine()
    engine.gameState.state.game.backgroundMusicVideoId = 't0ihNLLZNi0'

    engine.importGameData({ title: 'Music Test' })

    expect(engine.backgroundMusicEngine?.syncFromGame).toHaveBeenCalledWith(engine.gameState.state.game)
    expect(engine.inputManager.cancelHeldMovement.mock.calls).toHaveLength(1)
  })

  it('stops background music when the intro screen is shown again', () => {
    const engine = createEngine()

    engine.resetGame()

    expect(engine.backgroundMusicEngine?.stop).toHaveBeenCalled()
    expect(engine.inputManager.cancelHeldMovement.mock.calls).toHaveLength(1)
  })

  it('starts background music after the intro screen is dismissed', () => {
    const engine = createEngine()

    engine.dismissIntroScreen()

    expect(engine.backgroundMusicEngine?.play).toHaveBeenCalled()
  })

  it('destroys the background music engine during teardown', () => {
    const engine = createEngine()

    engine.destroy()

    expect(engine.backgroundMusicEngine?.destroy).toHaveBeenCalled()
    expect(engine.inputManager.destroy.mock.calls).toHaveLength(1)
  })

  it('does not start background music when the intro is dismissed in editor mode', () => {
    const engine = createEngine()
    engine.gameState.setEditorMode(true)

    const dismissed = engine.dismissIntroScreen()

    expect(dismissed).toBe(false)
    expect(engine.backgroundMusicEngine?.play).not.toHaveBeenCalled()
  })

  it('refuses to play background music while editing even if asked directly', () => {
    const engine = createEngine()
    engine.gameState.setEditorMode(true)

    engine.resumeBackgroundMusic()

    expect(engine.backgroundMusicEngine?.play).not.toHaveBeenCalled()
  })

  it('keeps the intro visible when a dismissal is attempted in editor mode', () => {
    const engine = createEngine()
    engine.gameState.setEditorMode(true)

    const dismissed = engine.dismissIntroScreen()

    expect(dismissed).toBe(false)
    expect(engine.introVisible).toBe(true)
    expect(engine.isIntroVisible()).toBe(true)
  })

  it('lets the music play again once the editor is left for the game', () => {
    const engine = createEngine()

    engine.gameState.setEditorMode(true)
    expect(engine.dismissIntroScreen()).toBe(false)
    expect(engine.backgroundMusicEngine?.play).not.toHaveBeenCalled()

    engine.gameState.setEditorMode(false)
    expect(engine.dismissIntroScreen()).toBe(true)
    expect(engine.backgroundMusicEngine?.play).toHaveBeenCalled()
  })

  it('halts the enemy loop instead of starting it in editor mode', () => {
    const engine = createEngine()
    engine.gameState.setEditorMode(true)
    engine.enemyManager.start.mock.calls.length = 0
    engine.enemyManager.stop.mock.calls.length = 0

    engine.startEnemyLoop()

    expect(engine.enemyManager.start.mock.calls.length).toBe(0)
    expect(engine.enemyManager.stop.mock.calls.length).toBeGreaterThan(0)
  })

  it('in guest mode: handlePlayerInteractions runs (items/NPCs/exits work locally), guestMode flag set, interact signal fires', () => {
    const engine = createEngine()
    const engineAny = engine as unknown as { online: { setMode: (m: string) => void; onInteract: (() => void) | null } }
    engineAny.online.setMode('online-guest')

    const interactSignalFired: boolean[] = []
    engineAny.online.onInteract = () => { interactSignalFired.push(true) }

    engine.checkInteractions()

    // handlePlayerInteractions runs for guests so items, NPCs, exits, traps work locally
    expect(engine.interactionManager.handlePlayerInteractions.mock.calls.length).toBe(1)
    // guestMode flag is set so handleSwitch inside skips state mutation
    expect((engine.interactionManager as unknown as { guestMode: boolean }).guestMode).toBe(true)
    // Outbound signal to host is always sent
    expect(interactSignalFired.length).toBe(1)
  })
})
