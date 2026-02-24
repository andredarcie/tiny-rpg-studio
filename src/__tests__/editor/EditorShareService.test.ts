import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../runtime/infra/share/FirebaseShareTracker', () => ({
  FirebaseShareTracker: class {
    trackShareUrl = vi.fn(() => Promise.resolve(true));
  }
}));

vi.mock('../../runtime/infra/share/ShareUtils', () => ({
  ShareUtils: {
    buildShareUrl: vi.fn(() => 'https://example.com#abc123'),
    encode: vi.fn(() => 'encoded-code'),
    decode: vi.fn(() => ({ title: 'Test' })),
  }
}));

vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: {
    get: vi.fn<(key: string, fallback?: string) => string>((key: string, fallback = ''): string => fallback || key),
  }
}));

import { EditorShareService } from '../../editor/modules/EditorShareService';
import { TextResources } from '../../runtime/adapters/TextResources';

type ShareServiceManager = ConstructorParameters<typeof EditorShareService>[0];
type ShareServiceManagerFixture = ReturnType<typeof makeManager>;
type TinyRPGGlobals = typeof globalThis & {
  TinyRPGFirebaseConfig?: Record<string, unknown>;
  TinyRPGFirebaseCollection?: string;
};

function asShareServiceManager(mgr: ShareServiceManagerFixture): ShareServiceManager {
  return mgr as unknown as ShareServiceManager;
}

function makeManager(domOverrides: Record<string, unknown> = {}) {
  const shareUrlInput = document.createElement('input') as HTMLInputElement;
  shareUrlInput.value = '';

  return {
    gameEngine: {
      exportGameData: vi.fn(() => ({ title: 'My Game' })),
    },
    dom: { shareUrlInput, ...domOverrides },
    history: { pushCurrentState: vi.fn() },
    restore: vi.fn(),
  };
}

describe('EditorShareService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Remove global firebase config if set
    delete (globalThis as TinyRPGGlobals).TinyRPGFirebaseConfig;
    delete (globalThis as TinyRPGGlobals).TinyRPGFirebaseCollection;
  });

  // ─── constructor / createShareTracker ────────────────────────────────────

  it('instantiates without throwing', () => {
    const mgr = makeManager();
    expect(() => new EditorShareService(asShareServiceManager(mgr))).not.toThrow();
  });

  it('shareTracker is null when no firebase config present', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    expect(svc.shareTracker).toBeNull();
  });

  it('creates shareTracker when TinyRPGFirebaseConfig is set', () => {
    (globalThis as TinyRPGGlobals).TinyRPGFirebaseConfig = { apiKey: 'test' };
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    expect(svc.shareTracker).not.toBeNull();
  });

  // ─── t() ─────────────────────────────────────────────────────────────────

  it('t returns fallback string', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    vi.mocked(TextResources.get).mockReturnValue('');
    expect(svc.t('some.key', 'my fallback')).toBe('my fallback');
  });

  it('t returns key when no value and no fallback', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    vi.mocked(TextResources.get).mockReturnValue('');
    expect(svc.t('some.key')).toBe('some.key');
  });

  it('t returns translated value when available', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    vi.mocked(TextResources.get).mockReturnValue('Traduzido');
    expect(svc.t('some.key', 'fallback')).toBe('Traduzido');
  });

  // ─── buildShareUrl ────────────────────────────────────────────────────────

  it('calls exportGameData and buildShareUrl', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    const url = svc.buildShareUrl();
    expect(mgr.gameEngine.exportGameData).toHaveBeenCalled();
    expect(url).toBe('https://example.com#abc123');
  });

  it('buildShareUrl does not throw when history.replaceState fails', () => {
    const mgr = makeManager();
    const origReplace = globalThis.history.replaceState;
    try {
      Object.defineProperty(globalThis, 'history', {
        value: { replaceState: () => { throw new Error('blocked'); } },
        configurable: true,
      });
    } catch {
      // jsdom may not allow this — just skip gracefully
    }
    const svc = new EditorShareService(asShareServiceManager(mgr));
    expect(() => svc.buildShareUrl()).not.toThrow();
    try {
      Object.defineProperty(globalThis, 'history', { value: { replaceState: origReplace }, configurable: true });
    } catch {}
  });

  // ─── updateShareUrlField ──────────────────────────────────────────────────

  it('sets shareUrlInput.value to the provided url', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    svc.updateShareUrlField('https://example.com#abc');
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('https://example.com#abc');
  });

  it('sets shareUrlInput.value to empty when url is null', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    svc.updateShareUrlField(null);
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('');
  });

  it('returns early when shareUrlInput is null', () => {
    const mgr = makeManager({ shareUrlInput: null });
    const svc = new EditorShareService(asShareServiceManager(mgr));
    expect(() => svc.updateShareUrlField('https://example.com')).not.toThrow();
  });

  // ─── generateShareableUrl ─────────────────────────────────────────────────

  it('generateShareableUrl calls updateShareUrlField with url', async () => {
    const mgr = makeManager();
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    const svc = new EditorShareService(asShareServiceManager(mgr));
    await svc.generateShareableUrl();
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('https://example.com#abc123');
  });

  it('generateShareableUrl uses prompt when clipboard unavailable', async () => {
    const mgr = makeManager();
    // Remove clipboard
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const svc = new EditorShareService(asShareServiceManager(mgr));
    await svc.generateShareableUrl();
    expect(promptSpy).toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('generateShareableUrl returns early when buildShareUrl yields empty value', async () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    vi.spyOn(svc, 'buildShareUrl').mockReturnValueOnce('' as unknown as ReturnType<typeof svc.buildShareUrl>);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    await svc.generateShareableUrl();
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('');
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('generateShareableUrl alerts on clipboard/write failure', async () => {
    const mgr = makeManager();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) },
      configurable: true,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(TextResources.get).mockImplementation((key: string, fallback = '') => {
      if (key === 'alerts.share.generateError') return 'Generate failed';
      return fallback || key;
    });
    const svc = new EditorShareService(asShareServiceManager(mgr));
    await svc.generateShareableUrl();
    expect(errorSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Generate failed');
  });

  // ─── trackShareUrl ────────────────────────────────────────────────────────

  it('trackShareUrl does nothing when shareTracker is null', async () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    expect(svc.shareTracker).toBeNull();
    await expect(svc.trackShareUrl('https://example.com')).resolves.toBeUndefined();
  });

  it('trackShareUrl logs and tracks when shareTracker exists', async () => {
    (globalThis as TinyRPGGlobals).TinyRPGFirebaseConfig = { apiKey: 'test' };
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    expect(svc.shareTracker).not.toBeNull();

    await svc.trackShareUrl('https://example.com/game');

    expect(infoSpy).toHaveBeenCalledWith('[TinyRPG] Tracking share URL...', { url: 'https://example.com/game' });
    expect(infoSpy).toHaveBeenCalledWith('[TinyRPG] Share URL tracking result:', 'ok');
  });

  // ─── saveGame ─────────────────────────────────────────────────────────────

  it('saveGame calls exportGameData and triggers download', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    // Mock URL.createObjectURL
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, 'appendChild');
    svc.saveGame();
    expect(mgr.gameEngine.exportGameData).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    URL.createObjectURL = origCreate;
  });

  // ─── loadGameFile ─────────────────────────────────────────────────────────

  it('loadGameFile returns early when no file selected', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    const input = document.createElement('input');
    const ev = { target: input } as unknown as Event;
    svc.loadGameFile(ev);
    expect(mgr.restore).not.toHaveBeenCalled();
  });

  it('loadGameFile restores game, pushes history and clears input on valid JSON', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'save.json' }],
    });
    const readAsTextSpy = vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { configurable: true, value: '{"title":"Loaded"}' });
      this.onload?.(new ProgressEvent('load'));
    });
    input.value = 'x';

    svc.loadGameFile({ target: input } as unknown as Event);

    expect(readAsTextSpy).toHaveBeenCalled();
    expect(mgr.restore).toHaveBeenCalledWith({ title: 'Loaded' }, { skipHistory: true });
    expect(mgr.history.pushCurrentState).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
  });

  it('loadGameFile alerts on invalid JSON', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(asShareServiceManager(mgr));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(TextResources.get).mockImplementation((key: string, fallback = '') => {
      if (key === 'alerts.share.loadError') return 'Load failed';
      return fallback || key;
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'broken.json' }],
    });
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { configurable: true, value: '{invalid json' });
      this.onload?.(new ProgressEvent('load'));
    });

    svc.loadGameFile({ target: input } as unknown as Event);

    expect(mgr.restore).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Load failed');
  });
});


