import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RendererOverlayRenderer } from '../../runtime/adapters/renderer/RendererOverlayRenderer';

describe('RendererOverlayRenderer', () => {
  const makeRenderer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const gradient = { addColorStop: vi.fn() };
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      set lineWidth(_v: number) {},
      set fillStyle(_v: string) {},
      set strokeStyle(_v: string) {},
      set shadowColor(_v: string) {},
      set shadowBlur(_v: number) {},
      set shadowOffsetY(_v: number) {},
      set globalAlpha(_v: number) {},
      set textAlign(_v: CanvasTextAlign) {},
      set textBaseline(_v: CanvasTextBaseline) {},
      set font(_v: string) {},
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext'];

    const renderer = {
      canvas,
      ctx,
      gameState: {
        getPickupOverlay: () => ({
          active: true,
          name: 'Key',
          spriteGroup: 'object',
          spriteType: 'key',
        }),
        isPickupOverlayActive: () => true,
      },
      tileManager: {},
      paletteManager: { getColor: vi.fn(() => '#fff') },
      spriteFactory: { getObjectSprites: () => ({ key: [[1]] }) },
      canvasHelper: { drawSprite: vi.fn() },
      entityRenderer: { cleanupEnemyLabels: vi.fn() },
      draw: vi.fn(),
    };

    return { renderer, ctx };
  };

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 123));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restarts the pickup animation loop when handle is stuck', () => {
    const { renderer, ctx } = makeRenderer();
    const overlayRenderer = new RendererOverlayRenderer(renderer as never);

    // Simulate a stuck handle (loop no longer running, but handle still set).
    overlayRenderer.pickupAnimationHandle = 999;

    overlayRenderer.drawPickupOverlay(ctx, { width: 128, height: 128 });

    expect(requestAnimationFrame).toHaveBeenCalled();
  });
});
