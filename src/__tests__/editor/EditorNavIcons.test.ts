/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorNavIcons } from '../../editor/modules/EditorNavIcons';

function makeSprite(size = 8): (string | null)[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => '#FF0000'));
}

function makeGameEngine(overrides: Record<string, unknown> = {}) {
  const sprite = makeSprite(8);
  return {
    getTiles: vi.fn(() => [
      { id: 5, name: 'water', category: 'Agua' },
      { id: 8, name: 'tree', category: 'Natureza' },
    ]),
    renderer: {
      drawTileOnCanvas: vi.fn(),
      spriteFactory: {
        getObjectSprites: vi.fn(() => ({
          sword: sprite,
          'xp-scroll': sprite,
        })),
        getNpcSprites: vi.fn(() => ({
          'old-mage': sprite,
        })),
        getEnemySprites: vi.fn(() => ({
          'giant-rat': sprite,
        })),
      },
    },
    ...overrides,
  };
}

function makeCanvas(iconType: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'nav-icon';
  canvas.dataset.navIcon = iconType;
  canvas.width = 16;
  canvas.height = 16;
  return canvas;
}

describe('EditorNavIcons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any leftover canvases from body
    document.querySelectorAll('.nav-icon').forEach(el => el.remove());
  });

  it('instantiates without throwing', () => {
    const engine = makeGameEngine();
    expect(() => new EditorNavIcons(engine as any)).not.toThrow();
  });

  it('renderAll does nothing when no nav-icon canvases found', () => {
    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    expect(() => icons.renderAll()).not.toThrow();
    expect(engine.getTiles).not.toHaveBeenCalled();
  });

  it('renderAll skips canvas without data-nav-icon', () => {
    const canvas = document.createElement('canvas');
    canvas.className = 'nav-icon';
    // no data-nav-icon set
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.getTiles).not.toHaveBeenCalled();
    canvas.remove();
  });

  it('renders tree icon by calling drawTileOnCanvas for tile id 8', () => {
    const canvas = makeCanvas('tree');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.drawTileOnCanvas).toHaveBeenCalled();
    canvas.remove();
  });

  it('renders water icon by calling drawTileOnCanvas for tile id 5', () => {
    const canvas = makeCanvas('water');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.drawTileOnCanvas).toHaveBeenCalled();
    canvas.remove();
  });

  it('renders sword icon via getObjectSprites', () => {
    const canvas = makeCanvas('sword');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.spriteFactory.getObjectSprites).toHaveBeenCalled();
    canvas.remove();
  });

  it('renders oldMage icon via getNpcSprites', () => {
    const canvas = makeCanvas('oldMage');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.spriteFactory.getNpcSprites).toHaveBeenCalled();
    canvas.remove();
  });

  it('renders rat icon via getEnemySprites', () => {
    const canvas = makeCanvas('rat');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.spriteFactory.getEnemySprites).toHaveBeenCalled();
    canvas.remove();
  });

  it('renders scroll icon via getObjectSprites', () => {
    const canvas = makeCanvas('scroll');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.spriteFactory.getObjectSprites).toHaveBeenCalled();
    canvas.remove();
  });

  it('handles unknown icon type without throwing', () => {
    const canvas = makeCanvas('unknown-type');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    const icons = new EditorNavIcons(engine as any);
    expect(() => icons.renderAll()).not.toThrow();
    canvas.remove();
  });

  it('skips tree render when tile id 8 not found', () => {
    const canvas = makeCanvas('tree');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    engine.getTiles.mockReturnValue([{ id: 5, name: 'water', category: 'Agua' }]); // no tile id 8
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    expect(engine.renderer.drawTileOnCanvas).not.toHaveBeenCalled();
    canvas.remove();
  });

  it('skips sword render when sprite not found', () => {
    const canvas = makeCanvas('sword');
    document.body.appendChild(canvas);

    const engine = makeGameEngine();
    engine.renderer.spriteFactory.getObjectSprites.mockReturnValue({} as any); // no sword
    const icons = new EditorNavIcons(engine as any);
    icons.renderAll();
    // No error, but drawTileOnCanvas not called (it's for tiles only)
    expect(engine.renderer.drawTileOnCanvas).not.toHaveBeenCalled();
    canvas.remove();
  });
});


