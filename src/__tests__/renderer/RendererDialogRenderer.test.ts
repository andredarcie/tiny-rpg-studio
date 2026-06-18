import { describe, expect, it, vi } from 'vitest';
import { RendererDialogRenderer } from '../../runtime/adapters/renderer/RendererDialogRenderer';
import { soundEngine } from '../../runtime/services/SoundEngine';

const makeDialogCtx = () =>
  ({
    fillStyle: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 6 }),
  }) as unknown as CanvasRenderingContext2D;

describe('RendererDialogRenderer', () => {
  it('splits dialog into pages and normalizes the page index', () => {
    const dialog = {
      active: true,
      text: 'Hello world this is a dialog message that should wrap across lines.',
      page: 0,
      maxPages: 1,
    };
    const gameState = {
      getDialog: () => dialog,
    };
    const paletteManager = {
      getColor: () => '#fff',
    };

    const renderer = new RendererDialogRenderer(gameState, paletteManager);
    const lines: string[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      font: '',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn((text: string) => lines.push(text)),
      measureText: (text: string) => ({ width: text.length * 6 }),
    } as unknown as CanvasRenderingContext2D;

    renderer.drawDialog(ctx, { width: 96, height: 72 });

    expect(dialog.page).toBe(1);
    expect(dialog.maxPages).toBeGreaterThan(0);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('anchors text to the top so it keeps a margin from the box border', () => {
    const dialog = { active: true, text: 'Hello there', page: 1, maxPages: 1 };
    const renderer = new RendererDialogRenderer({ getDialog: () => dialog }, { getColor: () => '#fff' });
    const ctx = makeDialogCtx();
    ctx.textBaseline = 'alphabetic'; // default that previously pushed text to the edge
    renderer.drawDialog(ctx, { width: 96, height: 72 });
    expect(ctx.textBaseline).toBe('top');
  });

  it('reveals the full page immediately when no typewriter callback is provided', () => {
    const dialog = { active: true, text: 'Hello world', page: 1, maxPages: 1 };
    const renderer = new RendererDialogRenderer({ getDialog: () => dialog }, { getColor: () => '#fff' });
    renderer.drawDialog(makeDialogCtx(), { width: 96, height: 72 });
    expect(renderer.isRevealComplete()).toBe(true);
  });

  it('types out the page over time and ticks a sound per letter', () => {
    const playSpy = vi.spyOn(soundEngine, 'play').mockImplementation(() => {});
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    let now = 1000;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);

    const dialog = { active: true, text: 'Hello world', page: 1, maxPages: 1 };
    const redraw = vi.fn();
    const renderer = new RendererDialogRenderer({ getDialog: () => dialog }, { getColor: () => '#fff' }, redraw);
    const ctx = makeDialogCtx();

    // First frame: nothing revealed yet, and it schedules the reveal loop.
    renderer.drawDialog(ctx, { width: 96, height: 72 });
    expect(renderer.isRevealComplete()).toBe(false);
    expect(requestAnimationFrame).toHaveBeenCalled();

    // After plenty of time the whole page is revealed and a tick has played.
    now = 1000 + 100000;
    renderer.drawDialog(ctx, { width: 96, height: 72 });
    expect(renderer.isRevealComplete()).toBe(true);
    expect(playSpy).toHaveBeenCalledWith('typewriter');

    nowSpy.mockRestore();
    vi.unstubAllGlobals();
    playSpy.mockRestore();
  });

  it('skipReveal instantly completes the current page', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(5000);
    const dialog = { active: true, text: 'Hello world this is long', page: 1, maxPages: 1 };
    const renderer = new RendererDialogRenderer({ getDialog: () => dialog }, { getColor: () => '#fff' }, vi.fn());
    const ctx = makeDialogCtx();

    renderer.drawDialog(ctx, { width: 96, height: 72 });
    expect(renderer.isRevealComplete()).toBe(false);

    renderer.skipReveal();
    renderer.drawDialog(ctx, { width: 96, height: 72 });
    expect(renderer.isRevealComplete()).toBe(true);

    nowSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
