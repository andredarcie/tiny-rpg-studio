import { vi } from 'vitest'

export class StubInputManager {
  constructor(_engine: unknown) {}

  isMovementHeld = vi.fn(() => false)
  cancelHeldMovement = vi.fn()
  destroy = vi.fn()
}
