import { vi } from 'vitest'
import type { StubGameState } from './StubGameState'

export class StubNpcManager {
  ensureDefaultNPCs = vi.fn()
  resetNPCs = vi.fn()

  constructor(_state: StubGameState) {}

  addNPC(npc: unknown) {
    return npc
  }

  getNPCs() {
    return []
  }

  getNPC() {
    return null
  }
}
