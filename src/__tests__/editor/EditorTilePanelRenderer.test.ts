import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorTilePanelRenderer } from '../../editor/modules/renderers/EditorTilePanelRenderer';

type TilePanelService = ConstructorParameters<typeof EditorTilePanelRenderer>[0];
function asTilePanelService(service: unknown): TilePanelService {
  return service as unknown as TilePanelService;
}

function makeService(domOverrides: Record<string, unknown> = {}, managerOverrides: Record<string, unknown> = {}) {
  const tileList = document.createElement('div');
  const selectedTilePreview = document.createElement('canvas') as HTMLCanvasElement & { width: number; height: number };
  selectedTilePreview.width = 64;
  selectedTilePreview.height = 64;
  const tileSummary = document.createElement('span');

  const tiles = [
    { id: 1, name: 'Grass', category: 'Terreno' },
    { id: 2, name: 'Water', category: 'Agua' },
    { id: 3, name: 'Tree', category: 'Natureza' },
    { id: 4, name: 'Stone', category: 'Construcoes' },
  ];

  const manager = {
    selectedTileId: 1,
    state: {},
    ...managerOverrides,
  };

  const service = {
    manager,
    dom: { tileList, selectedTilePreview, tileSummary, ...domOverrides },
    state: manager.state,
    gameEngine: {
      getTiles: vi.fn(() => tiles),
      renderer: {
        drawTileOnCanvas: vi.fn(),
      },
    },
    t: vi.fn<(_key: string, fallback?: string) => string>((_key: string, fallback = ''): string => fallback),
    tf: vi.fn<(_key: string, params?: Record<string, unknown>, fallback?: string) => string>(
      (_key: string, params: Record<string, unknown> = {}, fallback = ''): string => fallback || String(params.id ?? '')
    ),
  };

  return service;
}

describe('EditorTilePanelRenderer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── renderTileList ──────────────────────────────────────────────────────

  it('returns early when tileList element is null', () => {
    const svc = makeService({ tileList: null });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    expect(() => renderer.renderTileList()).not.toThrow();
  });

  it('renders a tile-grid inside tileList', () => {
    const svc = makeService();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const grid = (svc.dom.tileList as HTMLElement).querySelector('.tile-grid');
    expect(grid).toBeTruthy();
  });

  it('creates one button per tile', () => {
    const svc = makeService();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const buttons = (svc.dom.tileList as HTMLElement).querySelectorAll('.tile-card');
    expect(buttons.length).toBe(4);
  });

  it('marks selected tile with "selected" class', () => {
    const svc = makeService({}, { selectedTileId: 2 });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const selectedCard = (svc.dom.tileList as HTMLElement).querySelector('.tile-card.selected');
    expect(selectedCard).toBeTruthy();
    expect((selectedCard as HTMLElement).dataset.tileId).toBe('2');
  });

  it('does not mark any card as selected when selectedTileId is null', () => {
    const svc = makeService({}, { selectedTileId: null });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const selectedCards = (svc.dom.tileList as HTMLElement).querySelectorAll('.tile-card.selected');
    expect(selectedCards.length).toBe(0);
  });

  it('calls drawTileOnCanvas for each tile', () => {
    const svc = makeService();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    expect(svc.gameEngine.renderer.drawTileOnCanvas).toHaveBeenCalledTimes(4);
  });

  it('orders tiles by categoryOrder (Terreno before Agua)', () => {
    const svc = makeService();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const cards = Array.from((svc.dom.tileList as HTMLElement).querySelectorAll('.tile-card'));
    const tileIds = cards.map((c) => Number((c as HTMLElement).dataset.tileId));
    // Terreno (id 1) should appear before Agua (id 2)
    expect(tileIds.indexOf(1)).toBeLessThan(tileIds.indexOf(2));
  });

  it('assigns data-tile-id to each card', () => {
    const svc = makeService();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const cards = (svc.dom.tileList as HTMLElement).querySelectorAll('[data-tile-id]');
    expect(cards.length).toBe(4);
  });

  it('handles empty tile list gracefully', () => {
    const svc = makeService();
    svc.gameEngine.getTiles.mockReturnValue([]);
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const buttons = (svc.dom.tileList as HTMLElement).querySelectorAll('.tile-card');
    expect(buttons.length).toBe(0);
  });

  // ─── updateSelectedTilePreview ────────────────────────────────────────────

  it('returns early when preview element is null', () => {
    const svc = makeService({ selectedTilePreview: null });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    expect(() => renderer.updateSelectedTilePreview()).not.toThrow();
    expect(svc.gameEngine.renderer.drawTileOnCanvas).not.toHaveBeenCalled();
  });

  it('returns early when no tile matches selectedTileId', () => {
    const svc = makeService({}, { selectedTileId: 999 });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.updateSelectedTilePreview();
    expect(svc.gameEngine.renderer.drawTileOnCanvas).not.toHaveBeenCalled();
  });

  it('calls drawTileOnCanvas with selected tile', () => {
    const svc = makeService({}, { selectedTileId: 1 });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.updateSelectedTilePreview();
    expect(svc.gameEngine.renderer.drawTileOnCanvas).toHaveBeenCalledWith(
      svc.dom.selectedTilePreview,
      expect.objectContaining({ id: 1 })
    );
  });

  it('sets tileSummary textContent to tile name', () => {
    const svc = makeService({}, { selectedTileId: 1 });
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.updateSelectedTilePreview();
    expect((svc.dom.tileSummary as HTMLElement).textContent).toBe('Grass');
  });

  it('calls tf as fallback when tile has no name', () => {
    const svc = makeService({}, { selectedTileId: 5 });
    // Add a nameless tile
    vi.mocked(svc.gameEngine.getTiles).mockReturnValue([{ id: 5, name: '', category: '' }]);
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.updateSelectedTilePreview();
    expect(svc.tf).toHaveBeenCalledWith('tiles.summaryFallback', { id: 5 }, '');
  });
});

// sprite-edit-btn

describe('EditorTilePanelRenderer - sprite-edit-btn', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makeServiceWithCustomSprites(customSprites: unknown[] = []) {
    const tileList = document.createElement('div');
    const tiles = [{ id: 1, name: 'Grass', category: 'Terreno' }];
    const manager = {
      selectedTileId: 1,
      state: {},
    };
    const service = {
      manager,
      dom: { tileList },
      state: manager.state,
      gameEngine: {
        getTiles: vi.fn(() => tiles),
        getGame: vi.fn(() => ({ customSprites })),
        renderer: { drawTileOnCanvas: vi.fn() },
      },
      t: vi.fn<(_key: string, fallback?: string) => string>((_key: string, fallback = ''): string => fallback),
      tf: vi.fn<(_key: string, _params?: Record<string, unknown>, fallback?: string) => string>(
        (_key: string, _params: Record<string, unknown> = {}, fallback = ''): string => fallback
      ),
    };
    return service;
  }

  it('tile cards use a div wrapper instead of a button', () => {
    const svc = makeServiceWithCustomSprites();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const cards = (svc.dom.tileList as HTMLElement).querySelectorAll('.tile-card');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card.tagName.toLowerCase()).toBe('div');
    });
  });

  it('tile cards render .sprite-edit-btn with data-edit-group="tile"', () => {
    const svc = makeServiceWithCustomSprites();
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const editBtn = (svc.dom.tileList as HTMLElement).querySelector('.sprite-edit-btn');
    expect(editBtn).toBeTruthy();
    expect((editBtn as HTMLElement).dataset.editGroup).toBe('tile');
    expect((editBtn as HTMLElement).dataset.editKey).toBe('1');
  });

  it('.sprite-edit-btn adds the is-custom class when the tile has a customSprites entry', () => {
    const svc = makeServiceWithCustomSprites([
      { group: 'tile', key: '1', variant: 'base', frames: [[[0]]] },
    ]);
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const editBtn = (svc.dom.tileList as HTMLElement).querySelector('.sprite-edit-btn');
    expect(editBtn).toBeTruthy();
    expect((editBtn as HTMLElement).classList.contains('is-custom')).toBe(true);
  });

  it('.sprite-edit-btn does not add the is-custom class when the tile has no custom entry', () => {
    const svc = makeServiceWithCustomSprites([]);
    const renderer = new EditorTilePanelRenderer(asTilePanelService(svc));
    renderer.renderTileList();
    const editBtn = (svc.dom.tileList as HTMLElement).querySelector('.sprite-edit-btn');
    expect(editBtn).toBeTruthy();
    expect((editBtn as HTMLElement).classList.contains('is-custom')).toBe(false);
  });
});


