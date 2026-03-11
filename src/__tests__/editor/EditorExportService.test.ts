import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  api: null as null | {
    exportGameData: () => Record<string, unknown> | null;
    importGameData: (data: unknown) => void;
    draw: () => void;
    renderAll: () => void;
  },
  shareEncode: vi.fn<(data: Record<string, unknown>) => string>(),
  shareDecode: vi.fn<(code: string) => Record<string, unknown> | null>(),
  shareBuildUrl: vi.fn<(data: unknown) => string | null>(),
  trGet: vi.fn<(key: string, fallback?: string) => string>(),
  trLocale: 'en-US',
  version: '1',
}));

vi.mock('../../runtime/infra/TinyRpgApi', () => ({
  getTinyRpgApi: vi.fn(() => mockState.api),
}));

vi.mock('../../runtime/infra/share/ShareUtils', () => ({
  ShareUtils: {
    encode: (...args: [Record<string, unknown>]) => mockState.shareEncode(...args),
    decode: (...args: [string]) => mockState.shareDecode(...args),
    buildShareUrl: (...args: [unknown]) => mockState.shareBuildUrl(...args),
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
};

function setupDom() {
  document.body.innerHTML = '';

  const exportBtn = document.createElement('button');
  exportBtn.id = 'btn-generate-html';
  document.body.appendChild(exportBtn);

  const importBtn = document.createElement('button');
  importBtn.id = 'btn-import-html';
  document.body.appendChild(importBtn);

  const shareInput = document.createElement('input');
  shareInput.id = 'project-share-url';
  document.body.appendChild(shareInput);

  const gameContainer = document.createElement('div');
  gameContainer.id = 'game-container';
  gameContainer.innerHTML = '<canvas></canvas>';
  document.body.appendChild(gameContainer);

  const resetBtn = document.createElement('button');
  resetBtn.id = 'btn-reset';
  resetBtn.textContent = 'Reset';
  document.body.appendChild(resetBtn);

  return { exportBtn, importBtn, shareInput, gameContainer, resetBtn };
}

function makeApi(overrides: Partial<NonNullable<typeof mockState.api>> = {}) {
  return {
    exportGameData: vi.fn(() => ({ title: 'My Game' })),
    importGameData: vi.fn(),
    draw: vi.fn(),
    renderAll: vi.fn(),
    ...overrides,
  };
}

function setStyleSheets(sheets: Array<{ href?: string | null; cssRules?: Array<{ cssText: string }> }>) {
  Object.defineProperty(document, 'styleSheets', {
    configurable: true,
    value: sheets,
  });
}

function fileLike(textResult: string | Error): File {
  return {
    text: typeof textResult === 'string'
      ? vi.fn(() => Promise.resolve(textResult))
      : vi.fn(() => Promise.reject(textResult)),
  } as unknown as File;
}

describe('EditorExportService', () => {
  let alertSpy: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let createdBlob: Blob | null;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setupDom();

    alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    createdBlob = null;

    mockState.api = makeApi();
    mockState.shareEncode.mockReset();
    mockState.shareDecode.mockReset();
    mockState.shareBuildUrl.mockReset();
    mockState.trGet.mockReset();
    mockState.shareEncode.mockReturnValue('ENCODED');
    mockState.shareDecode.mockReturnValue({ title: 'Imported' });
    mockState.shareBuildUrl.mockReturnValue('https://x.test/#abc');
    mockState.trGet.mockImplementation((_key, fallback = '') => fallback);
    mockState.trLocale = 'en-US';
    mockState.version = '9';

    setStyleSheets([]);

    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) createdBlob = obj;
      return 'blob:test';
    });
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('binds buttons in constructor and schedules export on click', async () => {
    vi.useFakeTimers();
    const svc = new EditorExportService();
    const exportSpy = vi.spyOn(svc, 'exportProjectAsHtml').mockResolvedValue();
    const importClickSpy = vi.spyOn(svc.importFileInput as HTMLInputElement, 'click').mockImplementation(() => {});

    (document.getElementById('btn-generate-html') as HTMLButtonElement).click();
    expect(exportSpy).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(exportSpy).toHaveBeenCalledTimes(1);

    (document.getElementById('btn-import-html') as HTMLButtonElement).click();
    expect(importClickSpy).toHaveBeenCalledTimes(1);
  });

  it('resets hidden import input value after file selection and imports file', async () => {
    const svc = new EditorExportService();
    const importSpy = vi.spyOn(svc, 'importFromHtml').mockResolvedValue();
    const hiddenInput = svc.importFileInput as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      configurable: true,
      value: [fileLike('<html></html>')],
    });

    hiddenInput.dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(hiddenInput.value).toBe('');
  });

  it('importFromHtml alerts when no embedded share code is found', async () => {
    const svc = new EditorExportService();
    await svc.importFromHtml(fileLike('<html><body>No code</body></html>'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('importFromHtml alerts when embedded value is invalid JSON', async () => {
    const svc = new EditorExportService();
    const html = '<script>__TINY_RPG_SHARED_CODE = not-json;</script>';
    await svc.importFromHtml(fileLike(html));
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('importFromHtml alerts when ShareUtils.decode fails', async () => {
    mockState.shareDecode.mockReturnValue(null);
    const svc = new EditorExportService();
    const html = '<script>__TINY_RPG_SHARED_CODE = "abc";</script>';
    await svc.importFromHtml(fileLike(html));
    expect(mockState.shareDecode).toHaveBeenCalledWith('abc');
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('importFromHtml alerts when engine API is unavailable', async () => {
    mockState.api = null;
    const svc = new EditorExportService();
    const html = '<script>__TINY_RPG_SHARED_CODE = "abc";</script>';
    await svc.importFromHtml(fileLike(html));
    expect(alertSpy).toHaveBeenCalledWith('Unable to import: engine API is not available.');
  });

  it('importFromHtml imports data, redraws, updates hash and share input on success', async () => {
    const api = makeApi();
    mockState.api = api;
    mockState.shareDecode.mockReturnValue({ title: 'Imported Game' });
    mockState.shareBuildUrl.mockReturnValue('https://example.test/#xyz123');
    const svc = new EditorExportService();
    const shareInput = document.getElementById('project-share-url') as HTMLInputElement;

    await svc.importFromHtml(fileLike('<script>__TINY_RPG_SHARED_CODE = "abc";</script>'));

    expect(api.importGameData).toHaveBeenCalledWith({ title: 'Imported Game' });
    expect(api.draw).toHaveBeenCalledTimes(1);
    expect(api.renderAll).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('#xyz123');
    expect(shareInput.value).toBe('https://example.test/#xyz123');
  });

  it('importFromHtml handles file read errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const svc = new EditorExportService();
    await svc.importFromHtml(fileLike(new Error('boom')));
    expect(errorSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('exportProjectAsHtml alerts when engine API is unavailable', async () => {
    mockState.api = null;
    const svc = new EditorExportService();
    await svc.exportProjectAsHtml();
    expect(alertSpy).toHaveBeenCalledWith('Unable to export: engine API is not available.');
  });

  it('exportProjectAsHtml alerts when exportGameData returns null', async () => {
    mockState.api = makeApi({ exportGameData: vi.fn(() => null) });
    const svc = new EditorExportService();
    await svc.exportProjectAsHtml();
    expect(alertSpy).toHaveBeenCalledWith('Unable to read current project data.');
  });

  it('exportProjectAsHtml alerts on local stylesheet download failure', async () => {
    setStyleSheets([{ href: '/app.css' }]);
    fetchSpy.mockResolvedValue({ ok: false, text: () => Promise.resolve('') } as FakeResponse);
    const svc = new EditorExportService();

    await svc.exportProjectAsHtml();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to download project assets'));
  });

  it('exportProjectAsHtml skips cross-origin stylesheet and succeeds with bundle source', async () => {
    const cssRules = [{ cssText: '.a{color:red;}' }];
    setStyleSheets([
      { href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P' },
      { href: null, cssRules },
    ]);
    mockState.trLocale = 'pt-BR';
    mockState.api = makeApi({ exportGameData: vi.fn(() => ({ title: 'Árvore Mágica' })) });
    fetchSpy.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('console.log("bundle ok");') } as FakeResponse);
    const svc = new EditorExportService();

    await svc.exportProjectAsHtml();

    expect(mockState.shareEncode).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringMatching(/^export\.bundle\.js\?v=/));
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:test');

    expect(createdBlob).toBeInstanceOf(Blob);
  });

  it('exportProjectAsHtml alerts when script endpoint returns HTML in fallback mode', async () => {
    setStyleSheets([]);
    fetchSpy
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse)
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<!doctype html><html></html>') } as FakeResponse);
    const svc = new EditorExportService();

    await svc.exportProjectAsHtml();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('expected a JavaScript asset but received HTML'));
  });

  it('exportProjectAsHtml alerts when game-container is missing', async () => {
    (document.getElementById('game-container') as HTMLElement).remove();
    fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve('console.log(1);') } as FakeResponse);
    const svc = new EditorExportService();

    await svc.exportProjectAsHtml();

    expect(alertSpy).toHaveBeenCalledWith('game-container not found');
  });

  it('exportProjectAsHtml alerts when fallback scripts are all skipped as modules', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body><script src="js/main.js"></script><script src="js/runtime/adapters/TextResources.js"></script></body></html>'),
      } as FakeResponse)
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('export const x = 1;') } as FakeResponse);

    const svc = new EditorExportService();
    await svc.exportProjectAsHtml();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('expected a JavaScript asset but received HTML'));
  });
});

describe('EditorExportService - novos arquivos de custom sprites', () => {
  let alertSpy: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setupDom();

    alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    mockState.api = makeApi();
    mockState.shareEncode.mockReset();
    mockState.shareDecode.mockReset();
    mockState.shareBuildUrl.mockReset();
    mockState.trGet.mockReset();
    mockState.shareEncode.mockReturnValue('ENCODED');
    mockState.shareDecode.mockReturnValue({ title: 'Imported' });
    mockState.shareBuildUrl.mockReturnValue('https://x.test/#abc');
    mockState.trGet.mockImplementation((_key, fallback = '') => fallback);
    mockState.trLocale = 'en-US';
    mockState.version = '9';

    setStyleSheets([]);

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes CustomSpriteLookup.js in the script list', async () => {
    // The bundle fails, legacyIndex fails, and fallbackScriptSrcs is used.
    fetchSpy
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse) // bundle fail
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse) // legacyIndex fail
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('console.log(1);') } as FakeResponse);

    const svc = new EditorExportService();
    await svc.exportProjectAsHtml();

    const calledUrls = (fetchSpy.mock.calls as [string][]).map(([url]) => url);
    expect(calledUrls.some(url => url.includes('CustomSpriteLookup.js'))).toBe(true);
  });

  it('includes PixelArtEditorController.js in the script list', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse)
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('') } as FakeResponse)
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('console.log(1);') } as FakeResponse);

    const svc = new EditorExportService();
    await svc.exportProjectAsHtml();

    const calledUrls = (fetchSpy.mock.calls as [string][]).map(([url]) => url);
    expect(calledUrls.some(url => url.includes('PixelArtEditorController.js'))).toBe(true);
  });
});
