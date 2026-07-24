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

describe('EditorExportService solid trap persistence', () => {
  let exportedBlob: Blob | null;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-generate-html"></button>
      <button id="btn-import-html"></button>
      <input id="export-editable-in-studio" type="checkbox" checked>
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
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value: Blob | MediaSource) => {
      if (value instanceof Blob) exportedBlob = value;
      return 'blob:solid-trap-export';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    setTinyRpgApi({
      exportGameData: () => ({
        title: 'Solid Trap',
        start: { x: 1, y: 1, roomIndex: 0 },
        sprites: [],
        enemies: [],
        variables: [{ id: 'var-1', value: false }],
        objects: [{
          type: 'trap',
          x: 2,
          y: 3,
          roomIndex: 0,
          variableId: 'var-1',
          solid: true,
        }],
        tileset: { tiles: [], maps: [] },
      }),
      importGameData: vi.fn(),
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

  it('embeds a real share code that retains solid traps', async () => {
    const service = new EditorExportService();

    await service.exportProjectAsHtml();

    expect(exportedBlob).toBeInstanceOf(Blob);
    if (!exportedBlob) throw new Error('export blob missing');
    const html = await readBlob(exportedBlob);
    const match = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*([^;]+);/);
    expect(match).not.toBeNull();
    const code = JSON.parse(match?.[1] ?? '""') as string;
    const decoded = ShareUtils.decode(code) as {
      objects?: Array<{ type?: string; solid?: boolean }>;
    } | null;

    expect(decoded?.objects?.find((object) => object.type === 'trap')?.solid).toBe(true);
  });
});
