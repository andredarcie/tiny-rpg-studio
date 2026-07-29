import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorExportService } from '../../editor/modules/EditorExportService';
import { setTinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';

const readBlob = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
  reader.readAsText(blob);
});

describe('EditorExportService chest variable persistence', () => {
  let exportedBlob: Blob | null;
  const importGameData = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-generate-html"></button>
      <button id="btn-import-html"></button>
      <input id="export-editable-in-studio" type="checkbox" checked>
      <input id="project-share-url">
      <div id="game-container"><canvas></canvas></div>
    `;
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [],
    });
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('console.log("export bundle");'),
      blob: () => Promise.resolve(new Blob(['font'])),
    })));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    exportedBlob = null;
    importGameData.mockClear();
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value: Blob | MediaSource) => {
      if (value instanceof Blob) exportedBlob = value;
      return 'blob:chest-variable-export';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    setTinyRpgApi({
      exportGameData: () => ({
        title: 'Conditional Chest',
        start: { x: 1, y: 1, roomIndex: 0 },
        sprites: [],
        enemies: [],
        variables: [{ id: 'var-16', value: false }],
        objects: [{
          type: 'chest',
          x: 2,
          y: 3,
          roomIndex: 0,
          variableId: 'var-16',
          containsItemType: 'key',
          randomItem: false,
        }],
        tileset: { tiles: [], maps: [] },
      }),
      importGameData,
      getState: vi.fn(),
      draw: vi.fn(),
      resetGame: vi.fn(),
      updateTile: vi.fn(),
      setMapTile: vi.fn(),
      getTiles: vi.fn(),
      getTileMap: vi.fn(),
      getTilePresetNames: vi.fn(() => []),
      getVariables: vi.fn(),
      setVariableDefault: vi.fn(),
      addSprite: vi.fn(),
      getSprites: vi.fn(),
      resetNPCs: vi.fn(),
      renderAll: vi.fn(),
    });
  });

  afterEach(() => {
    setTinyRpgApi(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves the linked variable through export and HTML re-import', async () => {
    const service = new EditorExportService();

    await service.exportProjectAsHtml();

    expect(exportedBlob).toBeInstanceOf(Blob);
    if (!exportedBlob) throw new Error('export blob missing');
    const html = await readBlob(exportedBlob);
    const match = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*([^;]+);/);
    expect(match).not.toBeNull();
    const code = JSON.parse(match?.[1] ?? '""') as string;
    const decoded = ShareUtils.decode(code) as {
      objects?: Array<{ type?: string; variableId?: string | null }>;
    } | null;

    expect(decoded?.objects?.find((object) => object.type === 'chest')?.variableId).toBe('var-16');

    await service.importFromHtml({ text: () => Promise.resolve(html) } as File);

    const imported = importGameData.mock.calls[0]?.[0] as {
      objects?: Array<{ type?: string; variableId?: string | null }>;
    };
    expect(imported.objects?.find((object) => object.type === 'chest')?.variableId).toBe('var-16');
  });
});
