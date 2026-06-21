import { vi } from 'vitest'
import type { StubGameState } from './StubGameState'
import type { StubTileManager } from './StubTileManager'
import type { StubNpcManager } from './StubNpcManager'

export class StubRenderer {
  introData: unknown = null
  overlayRects: Array<{ x: number; y: number; width: number; height: number }> = []
  draw = vi.fn()
  spriteFactory = {
    invalidate: vi.fn()
  }
  paletteManager = {}
  tileAnimationTimer: ReturnType<typeof setInterval> | null = null

  overlayRenderer = {
    getLevelUpCardLayout: () => ({ rects: this.overlayRects })
  }

  dialogRenderer = {
    setChoiceHandler: vi.fn(),
    setViewportOffset: vi.fn(),
    isRevealComplete: vi.fn(() => true),
    skipReveal: vi.fn(),
    pickChoiceFromPointer: vi.fn(() => null)
  }

  constructor(
    _canvas: HTMLCanvasElement,
    _state: StubGameState,
    _tileManager: StubTileManager,
    _npcManager: StubNpcManager,
    _engine: unknown
  ) {}

  setIntroData = vi.fn((data: unknown) => {
    this.introData = data
  })

  destroy = vi.fn()
}
