/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorNpcRenderer } from '../../editor/modules/renderers/EditorNpcRenderer';

function makeService(managerOverrides: Record<string, unknown> = {}, domOverrides: Record<string, unknown> = {}) {
  const npcsList = document.createElement('ul');
  const npcEditor = document.createElement('div');
  const npcText = document.createElement('textarea') as HTMLTextAreaElement;
  const npcConditionalText = document.createElement('textarea') as HTMLTextAreaElement;
  const npcConditionalVariable = document.createElement('select') as HTMLSelectElement;
  const npcRewardVariable = document.createElement('select') as HTMLSelectElement;
  const npcConditionalRewardVariable = document.createElement('select') as HTMLSelectElement;
  const btnToggleNpcConditional = document.createElement('button') as HTMLButtonElement & { textContent: string };
  const npcConditionalSection = document.createElement('div');
  const btnNpcDelete = document.createElement('button') as HTMLButtonElement & { disabled: boolean };
  const humanBtn = document.createElement('button');
  humanBtn.dataset.npcVariantFilter = 'human';
  const beastBtn = document.createElement('button');
  beastBtn.dataset.npcVariantFilter = 'beast';
  const npcVariantButtons: HTMLButtonElement[] = [humanBtn, beastBtn];

  const manager = {
    selectedNpcType: null as string | null,
    selectedNpcId: null as string | null,
    state: { npcVariantFilter: 'human', activeRoomIndex: 0, conditionalDialogueExpanded: false },
    npcService: {
      populateVariableSelect: vi.fn(),
      clearSelection: vi.fn(),
    },
    ...managerOverrides,
  };

  const service = {
    manager,
    dom: {
      npcsList, npcEditor, npcText, npcConditionalText,
      npcConditionalVariable, npcRewardVariable, npcConditionalRewardVariable,
      btnToggleNpcConditional, npcConditionalSection, btnNpcDelete,
      npcVariantButtons,
      ...domOverrides,
    },
    state: manager.state,
    gameEngine: {
      npcManager: {
        ensureDefaultNPCs: vi.fn(),
        getDefinitions: vi.fn(() => [
          { type: 'hero', name: 'Hero', variant: 'human' },
          { type: 'mage', name: 'Mage', variant: 'human' },
          { type: 'beast', name: 'Beast', variant: 'beast' },
        ]),
      },
      getSprites: vi.fn((): any[] => []),
      renderer: {
        npcSprites: {
          default: [['#FF0000', '#FF0000']],
          hero: [['#0000FF', '#0000FF']],
        },
      },
    },
    t: vi.fn((key: string, fallback = '') => {
      const map: Record<string, string> = {
        'npc.status.available': 'Available',
        'npc.defaultName': 'NPC',
        'npc.toggle.hide': 'Hide',
        'npc.toggle.create': 'Create',
      };
      return map[key] ?? fallback;
    }),
    tf: vi.fn((_key: string, _params = {}, fallback = '') => fallback),
  };

  return service;
}

describe('EditorNpcRenderer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── renderNpcs ──────────────────────────────────────────────────────────

  it('returns early when npcsList is null', () => {
    const svc = makeService({}, { npcsList: null });
    const renderer = new EditorNpcRenderer(svc as any);
    expect(() => renderer.renderNpcs()).not.toThrow();
    expect(svc.gameEngine.npcManager.ensureDefaultNPCs).not.toHaveBeenCalled();
  });

  it('calls ensureDefaultNPCs on render', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    expect(svc.gameEngine.npcManager.ensureDefaultNPCs).toHaveBeenCalled();
  });

  it('renders only npcs matching current variant filter', () => {
    const svc = makeService();
    svc.state.npcVariantFilter = 'human';
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const cards = svc.dom.npcsList.querySelectorAll('.npc-card');
    // Should render hero and mage (human), not beast
    expect(cards.length).toBe(2);
  });

  it('renders beast variant when filter is "beast"', () => {
    const svc = makeService();
    svc.state.npcVariantFilter = 'beast';
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const cards = svc.dom.npcsList.querySelectorAll('.npc-card');
    expect(cards.length).toBe(1);
    expect((cards[0] as HTMLElement).dataset.type).toBe('beast');
  });

  it('marks placed npc with npc-card-placed class', () => {
    const svc = makeService();
    svc.gameEngine.getSprites.mockReturnValue([
      { type: 'hero', roomIndex: 0, x: 2, y: 3, placed: true },
    ]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const card = svc.dom.npcsList.querySelector('.npc-card-placed');
    expect(card).toBeTruthy();
  });

  it('marks created-but-unplaced npc with npc-card-created class', () => {
    const svc = makeService();
    svc.gameEngine.getSprites.mockReturnValue([
      { type: 'hero', roomIndex: 0, x: 0, y: 0, placed: false },
    ]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const card = svc.dom.npcsList.querySelector('.npc-card-created');
    expect(card).toBeTruthy();
  });

  it('marks unavailable npc with npc-card-available class', () => {
    const svc = makeService();
    svc.gameEngine.getSprites.mockReturnValue([]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const card = svc.dom.npcsList.querySelector('.npc-card-available');
    expect(card).toBeTruthy();
  });

  it('marks selected npc type with "selected" class', () => {
    const svc = makeService();
    svc.manager.selectedNpcType = 'hero';
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const selected = svc.dom.npcsList.querySelector('.npc-card.selected');
    expect(selected).toBeTruthy();
    expect((selected as HTMLElement).dataset.type).toBe('hero');
  });

  it('shows position text when npc is placed', () => {
    const svc = makeService();
    svc.gameEngine.getSprites.mockReturnValue([
      { type: 'hero', roomIndex: 0, x: 3, y: 5, placed: true },
    ]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const posEl = svc.dom.npcsList.querySelector('.npc-position');
    expect(posEl?.textContent).toBe('(3, 5)');
  });

  it('shows "Available" text when npc is not placed', () => {
    const svc = makeService();
    svc.gameEngine.getSprites.mockReturnValue([]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.renderNpcs();
    const posEl = svc.dom.npcsList.querySelector('.npc-position');
    expect(posEl?.textContent).toBe('Available');
  });

  // ─── getNpcName ──────────────────────────────────────────────────────────

  it('getNpcName returns translated name from nameKey', () => {
    const svc = makeService();
    svc.t.mockImplementation((key: string, fallback: string) => {
      if (key === 'npc.hero.name') return 'The Hero';
      return fallback;
    });
    const renderer = new EditorNpcRenderer(svc as any);
    const name = renderer.getNpcName({ type: 'hero', nameKey: 'npc.hero.name', name: 'Hero' });
    expect(name).toBe('The Hero');
  });

  it('getNpcName falls back to definition.name when no nameKey', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    const name = renderer.getNpcName({ type: 'hero', name: 'Hero' });
    expect(name).toBe('Hero');
  });

  it('getNpcName returns default when definition is null', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    const name = renderer.getNpcName(null);
    expect(name).toBe('NPC');
  });

  // ─── getNpcDialogueText ─────────────────────────────────────────────────

  it('getNpcDialogueText returns empty string when npc is null', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    expect(renderer.getNpcDialogueText(null)).toBe('');
  });

  it('getNpcDialogueText returns npc.text when no textKey', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    const text = renderer.getNpcDialogueText({
      type: 'hero', roomIndex: 0, x: 0, y: 0, text: 'Hello!'
    });
    expect(text).toBe('Hello!');
  });

  it('getNpcDialogueText uses textKey translation when available', () => {
    const svc = makeService();
    svc.t.mockImplementation((key: string, fallback: string) => {
      if (key === 'npc.hero.text') return 'Greetings traveler!';
      return fallback;
    });
    const renderer = new EditorNpcRenderer(svc as any);
    const text = renderer.getNpcDialogueText({
      type: 'hero', roomIndex: 0, x: 0, y: 0, textKey: 'npc.hero.text', text: 'fallback'
    });
    expect(text).toBe('Greetings traveler!');
  });

  // ─── updateVariantButtons ───────────────────────────────────────────────

  it('updateVariantButtons activates matching button', () => {
    const svc = makeService();
    svc.state.npcVariantFilter = 'beast';
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateVariantButtons();
    const [humanBtn, beastBtn] = svc.dom.npcVariantButtons as HTMLButtonElement[];
    expect(humanBtn.classList.contains('active')).toBe(false);
    expect(beastBtn.classList.contains('active')).toBe(true);
    expect(beastBtn.getAttribute('aria-pressed')).toBe('true');
    expect(humanBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('updateVariantButtons does nothing when no buttons present', () => {
    const svc = makeService({}, { npcVariantButtons: [] });
    const renderer = new EditorNpcRenderer(svc as any);
    expect(() => renderer.updateVariantButtons()).not.toThrow();
  });

  // ─── updateNpcForm ───────────────────────────────────────────────────────

  it('hides npcEditor when no npc selected', () => {
    const svc = makeService();
    svc.manager.selectedNpcId = null;
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateNpcForm();
    expect(svc.dom.npcEditor.hidden).toBe(true);
  });

  it('shows npcEditor when npc is selected', () => {
    const svc = makeService();
    svc.manager.selectedNpcId = 'npc-1';
    svc.gameEngine.getSprites.mockReturnValue([{ id: 'npc-1', type: 'hero', roomIndex: 0, x: 0, y: 0 }]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateNpcForm();
    expect(svc.dom.npcEditor.hidden).toBe(false);
  });

  it('disables npcText when npc not found', () => {
    const svc = makeService();
    svc.manager.selectedNpcId = 'nonexistent';
    svc.gameEngine.getSprites.mockReturnValue([]);
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateNpcForm();
    expect(svc.dom.npcText.disabled).toBe(true);
  });

  it('sets btnToggleNpcConditional text based on expansion state', () => {
    const svc = makeService();
    svc.state.conditionalDialogueExpanded = true;
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateNpcForm();
    expect(svc.dom.btnToggleNpcConditional.textContent).toBe('Hide');
  });

  it('shows/hides npcConditionalSection based on expansion state', () => {
    const svc = makeService();
    svc.state.conditionalDialogueExpanded = false;
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateNpcForm();
    expect(svc.dom.npcConditionalSection.hidden).toBe(true);

    svc.state.conditionalDialogueExpanded = true;
    renderer.updateNpcForm();
    expect(svc.dom.npcConditionalSection.hidden).toBe(false);
  });

  it('calls populateVariableSelect three times per updateNpcForm', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    renderer.updateNpcForm();
    expect(svc.manager.npcService.populateVariableSelect).toHaveBeenCalledTimes(3);
  });

  // ─── drawNpcPreview ──────────────────────────────────────────────────────

  it('drawNpcPreview returns early when canvas is not HTMLCanvasElement', () => {
    const svc = makeService();
    const renderer = new EditorNpcRenderer(svc as any);
    expect(() => renderer.drawNpcPreview({} as any, { type: 'hero' })).not.toThrow();
  });

  it('drawNpcPreview draws sprite pixels on canvas', () => {
    const svc = makeService();
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const renderer = new EditorNpcRenderer(svc as any);
    // Should not throw; uses npcSprites
    expect(() => renderer.drawNpcPreview(canvas, { type: 'hero' })).not.toThrow();
  });

  it('drawNpcPreview falls back to default sprite when type not found', () => {
    const svc = makeService();
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const renderer = new EditorNpcRenderer(svc as any);
    expect(() => renderer.drawNpcPreview(canvas, { type: 'unknown-npc' })).not.toThrow();
  });
});


