import { describe, expect, it } from 'vitest';
import { RendererMinimapRenderer } from '../../runtime/adapters/renderer/RendererMinimapRenderer';

function makeGameState(overrides: {
  rows?: number;
  cols?: number;
  roomIndex?: number | null;
} = {}) {
  const { rows = 2, cols = 3, roomIndex = 0 } = overrides;
  return {
    getGame: () => ({ world: { rows, cols } }),
    getPlayer: () => ({ roomIndex }),
  };
}

describe('RendererMinimapRenderer', () => {
  it('returns early when minimap element is missing', () => {
    document.body.innerHTML = '';
    const renderer = new RendererMinimapRenderer(makeGameState());
    expect(renderer.minimapElement).toBeNull();
    expect(() => renderer.drawMinimap()).not.toThrow();
  });

  it('creates minimap cells and marks active room', () => {
    document.body.innerHTML = '<div id="game-minimap"></div>';
    const renderer = new RendererMinimapRenderer(makeGameState({ rows: 2, cols: 2, roomIndex: 2 }));

    renderer.drawMinimap();

    const minimap = document.getElementById('game-minimap') as HTMLElement;
    const cells = minimap.querySelectorAll('.game-minimap-cell');
    expect(cells.length).toBe(4);
    expect(minimap.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(cells[2].classList.contains('active')).toBe(true);
    expect(cells[0].classList.contains('active')).toBe(false);
  });

  it('reuses existing cells when total size is unchanged', () => {
    document.body.innerHTML = '<div id="game-minimap"></div>';
    const state = makeGameState({ rows: 1, cols: 3, roomIndex: 1 });
    const renderer = new RendererMinimapRenderer(state);

    renderer.drawMinimap();
    const minimap = document.getElementById('game-minimap') as HTMLElement;
    const firstCells = renderer.minimapCells;
    minimap.innerHTML = minimap.innerHTML + '<span data-extra="1"></span>';

    renderer.drawMinimap();

    expect(renderer.minimapCells).toBe(firstCells);
    expect(minimap.querySelector('[data-extra="1"]')).toBeTruthy();
  });

  it('rebuilds cells when grid size changes', () => {
    document.body.innerHTML = '<div id="game-minimap"></div>';
    let rows = 1;
    let cols = 2;
    const state = {
      getGame: () => ({ world: { rows, cols } }),
      getPlayer: () => ({ roomIndex: 0 }),
    };
    const renderer = new RendererMinimapRenderer(state);

    renderer.drawMinimap();
    const firstCellsRef = renderer.minimapCells;
    rows = 2;
    cols = 2;

    renderer.drawMinimap();

    expect(renderer.minimapCells).not.toBe(firstCellsRef);
    expect(renderer.minimapCells).toHaveLength(4);
  });

  it('clamps player room index to valid range (negative and too large)', () => {
    document.body.innerHTML = '<div id="game-minimap"></div>';
    const rendererNegative = new RendererMinimapRenderer(makeGameState({ rows: 1, cols: 3, roomIndex: -10 }));
    rendererNegative.drawMinimap();
    expect(rendererNegative.minimapCells?.[0].classList.contains('active')).toBe(true);

    const rendererHigh = new RendererMinimapRenderer(makeGameState({ rows: 1, cols: 3, roomIndex: 999 }));
    rendererHigh.drawMinimap();
    expect(rendererHigh.minimapCells?.[2].classList.contains('active')).toBe(true);
  });

  it('defaults to 1x1 minimap and room 0 when world/player data is missing', () => {
    document.body.innerHTML = '<div id="game-minimap"></div>';
    const renderer = new RendererMinimapRenderer({
      getGame: () => ({}),
      getPlayer: () => ({ roomIndex: null }),
    });

    renderer.drawMinimap();

    expect(renderer.minimapCells).toHaveLength(1);
    expect(renderer.minimapCells?.[0].classList.contains('active')).toBe(true);
  });
});
