import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RendererEffectsManager } from '../../runtime/adapters/renderer/RendererEffectsManager';

const createElementStub = () => ({
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
  setAttribute: vi.fn(),
  textContent: '',
  style: {
    setProperty: vi.fn(),
  },
  offsetWidth: 0,
});

describe('RendererEffectsManager', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.document = originalDocument as Document;
  });

  it('toggles combat indicator visibility and clears it after timeout', () => {
    const combatElement = createElementStub();
    const screenElement = createElementStub();
    globalThis.document = {
      getElementById: vi.fn((id: string) => {
        if (id === 'combat-indicator') return combatElement;
        if (id === 'screen-flash') return screenElement;
        return null;
      }),
    } as unknown as Document;

    const renderer = {
      canvas: { closest: () => null } as unknown as HTMLCanvasElement,
      ctx: null,
      gameState: {
        getPlayer: () => ({ x: 1, y: 1 }),
      },
      tileManager: {},
      paletteManager: {},
      spriteFactory: {},
      canvasHelper: {
        getTilePixelSize: () => 8,
      },
      entityRenderer: {},
    };

    const manager = new RendererEffectsManager(renderer);

    manager.showCombatIndicator('Hit', { duration: 100 });

    expect(combatElement.textContent).toBe('Hit');
    expect(combatElement.setAttribute).toHaveBeenCalledWith('data-visible', 'true');

    vi.advanceTimersByTime(100);

    expect(combatElement.textContent).toBe('');
    expect(combatElement.setAttribute).toHaveBeenCalledWith('data-visible', 'false');
  });

  it('clamps flash edge tile indexes', () => {
    globalThis.document = {
      getElementById: vi.fn(() => null),
    } as unknown as Document;

    const renderer = {
      canvas: { closest: () => null } as unknown as HTMLCanvasElement,
      ctx: null,
      gameState: {
        getPlayer: () => ({ x: 4, y: 5 }),
      },
      tileManager: {},
      paletteManager: {},
      spriteFactory: {},
      canvasHelper: {
        getTilePixelSize: () => 8,
      },
      entityRenderer: {},
    };

    const manager = new RendererEffectsManager(renderer);
    manager.flashEdge('left', { tileX: 99, tileY: -5, duration: 50 });

    expect(manager.edgeFlash.tileX).toBe(7);
    expect(manager.edgeFlash.tileY).toBe(0);
  });
});
