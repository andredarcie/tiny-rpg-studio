import { vi } from 'vitest'

export class StubInputManager {
  constructor(_engine: unknown) {}

  cancelHeldMovement = vi.fn()
  destroy = vi.fn()
}
