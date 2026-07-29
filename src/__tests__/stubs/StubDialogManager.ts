import { vi } from 'vitest'
import type { StubGameState } from './StubGameState'
import type { StubRenderer } from './StubRenderer'

export class StubDialogManager {
  lastMessage: string | null = null
  onEndGame: (() => void) | null = null
  reset = vi.fn()

  constructor(_state: StubGameState, _renderer: StubRenderer) {}

  showDialog = vi.fn((message: string) => {
    this.lastMessage = message
  })
  closeDialog() {}
  completeDialog() {}
}
