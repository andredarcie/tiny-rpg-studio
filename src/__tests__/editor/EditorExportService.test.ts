import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  api: null as null | {
    exportGameData: () => Record<string, unknown> | null;
    importGameData: (data: unknown) => void;
    draw: () => void;
    renderAll: () => void;
  },
  shareBuildUrl: vi.fn<(data: unknown) => string | null>(),
  shareDecode: vi.fn<(code: string) => Record<string, unknown> | null>(),
  shareEncode: vi.fn<(data: Record<string, unknown>) => string>(),
  trGet: vi.fn<(key: string, fallback?: string) => string>(),
  trLocale: 'en-US',
  version: '1',
}));

vi.mock('../../runtime/infra/TinyRpgApi', () => ({
  getTinyRpgApi: vi.fn(() => mockState.api),
}));

vi.mock('../../runtime/infra/share/ShareUtils', () => ({
  ShareUtils: {
    buildShareUrl: (...args: [unknown]) => mockState.shareBuildUrl(...args),
    decode: (...args: [string]) => mockState.shareDecode(...args),
    encode: (...args: [Record<string, unknown>]) => mockState.shareEncode(...args),
  },
}));

vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: {
    get: (...args: [string, string?]) => mockState.trGet(...args),
    getLocale: () => mockState.trLocale,
  },
}));

vi.mock('../../runtime/infra/share/ShareConstants', () => ({
  ShareConstants: {
    get VERSION() { return mockState.version; },
  },
}));

import { EditorExportService } from '../../editor/modules/EditorExportService';

type FakeResponse = {
  ok: boolean;
  text: () => Promise<string>;
  blob?: () => Promise<Blob>;
};

function setupDom(): void {
  document.body.innerHTML = `
    <button id="btn-generate-html"></button>
    <input id="export-editable-in-studio" type="checkbox" checked>
    <button id="btn-import-html"></button>
    <input id="project-share-url">
    <div id="game-container"><canvas></canvas></div>
  `;
}

function makeApi(overrides: Partial<NonNullable<typeof mockState.api>> = {}) {
  return {
    draw: vi.fn(),
    exportGameData: vi.fn(() => ({ title: 'My Game' })),
    importGameData: vi.fn(),
    renderAll: vi.fn(),
    ...overrides,
  };
}

function fileLike(result: string | Error): File {
  return {
    text: typeof result === 'string'
      ? vi.fn(() => Promise.resolve(result))
      : vi.fn(() => Promise.reject(result)),
  } as unknown as File;
}

describe('EditorExportService', () => {
  let alertSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let createdBlob: Blob | null;
  let fetchSpy: ReturnType<typeof vi.fn<(url: string) => Promise<FakeResponse>>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setupDom();
    alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    fetchSpy = vi.fn((url: string) => {
      if (url.startsWith('export.bundle.js')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('globalThis.exportBundleLoaded=true;'),
        } as FakeResponse);
      }
      if (url.startsWith('tiny-rpg-studio-sdk.css')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('@font-face{src:url("pixel-operator.woff")}body{color:white}'),
        } as FakeResponse);
      }
      if (url === 'pixel-operator.woff') {
        return Promise.resolve({
          blob: () => Promise.resolve(new Blob(['woff'], { type: 'font/woff' })),
          ok: true,
          text: () => Promise.resolve('woff'),
        } as FakeResponse);
      }
      return Promise.resolve({ ok: false, text: () => Promise.resolve('') } as FakeResponse);
    });
    vi.stubGlobal('fetch', fetchSpy);
    createdBlob = null;

    mockState.api = makeApi();
    mockState.shareEncode.mockReset().mockReturnValue('ENCODED');
    mockState.shareDecode.mockReset().mockReturnValue({ title: 'Imported' });
    mockState.shareBuildUrl.mockReset().mockReturnValue('https://x.test/#abc');
    mockState.trGet.mockReset().mockImplementation((_key, fallback = '') => fallback);
    mockState.trLocale = 'en-US';
    mockState.version = '9';

    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockImplementation((object: Blob | MediaSource) => {
      if (object instanceof Blob) createdBlob = object;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function readExportHtml(): Promise<string> {
    expect(createdBlob).toBeInstanceOf(Blob);
    const blob = createdBlob;
    if (!blob) throw new Error('Expected export blob');
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read blob'));
      reader.readAsText(blob);
    });
  }

  it('binds export and import buttons', async () => {
    vi.useFakeTimers();
    const service = new EditorExportService();
    const exportSpy = vi.spyOn(service, 'exportProjectAsHtml').mockResolvedValue();
    const importClickSpy = vi.spyOn(
      service.importFileInput as HTMLInputElement,
      'click',
    ).mockImplementation(() => {});

    (document.getElementById('btn-generate-html') as HTMLButtonElement).click();
    await vi.runAllTimersAsync();
    expect(exportSpy).toHaveBeenCalledOnce();
    (document.getElementById('btn-import-html') as HTMLButtonElement).click();
    expect(importClickSpy).toHaveBeenCalledOnce();
  });

  it('resets the hidden import input after selection', async () => {
    const service = new EditorExportService();
    const importSpy = vi.spyOn(service, 'importFromHtml').mockResolvedValue();
    const input = service.importFileInput as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [fileLike('<html>')] });
    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    expect(importSpy).toHaveBeenCalledOnce();
    expect(input.value).toBe('');
  });

  it.each([
    ['missing code', '<html>No code</html>'],
    ['invalid JSON', '<script>__TINY_RPG_SHARED_CODE = invalid;</script>'],
  ])('rejects an import with %s', async (_name, html) => {
    await new EditorExportService().importFromHtml(fileLike(html));
    expect(alertSpy).toHaveBeenCalledOnce();
  });

  it('rejects undecodable imported data', async () => {
    mockState.shareDecode.mockReturnValue(null);
    await new EditorExportService().importFromHtml(
      fileLike('<script>__TINY_RPG_SHARED_CODE = "abc";</script>'),
    );
    expect(mockState.shareDecode).toHaveBeenCalledWith('abc');
    expect(alertSpy).toHaveBeenCalledOnce();
  });

  it('imports, redraws, and updates the share URL', async () => {
    const api = makeApi();
    mockState.api = api;
    mockState.shareDecode.mockReturnValue({ title: 'Imported Game' });
    mockState.shareBuildUrl.mockReturnValue('https://example.test/#xyz123');
    await new EditorExportService().importFromHtml(
      fileLike('<script>__TINY_RPG_SHARED_CODE = "abc";</script>'),
    );

    expect(api.importGameData).toHaveBeenCalledWith({ title: 'Imported Game' });
    expect(api.draw).toHaveBeenCalledOnce();
    expect(api.renderAll).toHaveBeenCalledOnce();
    expect(location.hash).toBe('#xyz123');
    expect((document.getElementById('project-share-url') as HTMLInputElement).value)
      .toBe('https://example.test/#xyz123');
  });

  it('handles import read errors and an unavailable API', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await new EditorExportService().importFromHtml(fileLike(new Error('boom')));
    expect(errorSpy).toHaveBeenCalled();
    mockState.api = null;
    await new EditorExportService().importFromHtml(
      fileLike('<script>__TINY_RPG_SHARED_CODE = "abc";</script>'),
    );
    expect(alertSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects export without API or game data', async () => {
    mockState.api = null;
    await new EditorExportService().exportProjectAsHtml();
    expect(alertSpy).toHaveBeenCalledWith('Unable to export: engine API is not available.');
    mockState.api = makeApi({ exportGameData: vi.fn(() => null) });
    await new EditorExportService().exportProjectAsHtml();
    expect(alertSpy).toHaveBeenCalledWith('Unable to read current project data.');
  });

  it('fetches only dedicated assets and exports minimal markup', async () => {
    const service = new EditorExportService();
    await service.exportProjectAsHtml();
    const html = await readExportHtml();
    const urls = (fetchSpy.mock.calls as [string][]).map(([url]) => url);

    expect(urls).toHaveLength(3);
    expect(urls.some((url) => url.startsWith('export.bundle.js?v='))).toBe(true);
    expect(urls.some((url) => url.startsWith('tiny-rpg-studio-sdk.css?v='))).toBe(true);
    expect(urls).toContain('pixel-operator.woff');
    expect(urls.some((url) => url.includes('legacy/'))).toBe(false);
    expect(html).toContain('id="btn-export-reset"');
    expect(html).toContain('>R</button>');
    expect(html).not.toContain('id="btn-reset"');
    expect(html).not.toContain('class="tabs"');
    expect(html).not.toContain('id="game-audio-controls"');
    expect(html).not.toContain('id="game-fullscreen-toggle"');
    expect(service.lastExportSections?.total).toBeGreaterThan(0);
    expect(anchorClickSpy).toHaveBeenCalledOnce();
  });

  it('does not depend on the live game container', async () => {
    document.getElementById('game-container')?.remove();
    await new EditorExportService().exportProjectAsHtml();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(createdBlob).toBeInstanceOf(Blob);
  });

  it('respects the editable-in-studio setting', async () => {
    const editable = document.getElementById('export-editable-in-studio') as HTMLInputElement;
    editable.checked = false;
    await new EditorExportService().exportProjectAsHtml();
    expect(await readExportHtml()).toContain('id="btn-open-studio" type="button" hidden');

    createdBlob = null;
    editable.checked = true;
    await new EditorExportService().exportProjectAsHtml();
    expect(await readExportHtml()).toContain('id="btn-open-studio" type="button">');
  });

  it('embeds the font once and keeps the payload import-compatible', async () => {
    await new EditorExportService().exportProjectAsHtml();
    const html = await readExportHtml();
    expect(html.match(/data:font\/woff;base64,/g)).toHaveLength(1);
    const match = html.match(/__TINY_RPG_SHARED_CODE\s*=\s*([^;]+);/);
    expect(JSON.parse(match?.[1] ?? '""')).toBe('ENCODED');
  });

  it('reports dedicated asset failures without attempting a fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy.mockImplementation((url: string) => Promise.resolve({
      blob: () => Promise.resolve(new Blob(['woff'])),
      ok: !url.startsWith('tiny-rpg-studio-sdk.css'),
      text: () => Promise.resolve('globalThis.ok=true;'),
    } as FakeResponse));
    await new EditorExportService().exportProjectAsHtml();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to download project assets'));
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('rejects an HTML response in place of the runtime bundle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy.mockImplementation((url: string) => Promise.resolve({
      blob: () => Promise.resolve(new Blob(['woff'])),
      ok: true,
      text: () => Promise.resolve(
        url.startsWith('export.bundle.js')
          ? '<!doctype html><html></html>'
          : '@font-face{src:url("pixel-operator.woff")}',
      ),
    } as FakeResponse));
    await new EditorExportService().exportProjectAsHtml();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('runtime bundle is missing or stale'));
  });
});
