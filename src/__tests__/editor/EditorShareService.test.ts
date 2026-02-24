/* eslint-disable */
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
    get: vi.fn((key: string, fallback = '') => fallback || key),
  }
}));

import { EditorShareService } from '../../editor/modules/EditorShareService';
import { TextResources } from '../../runtime/adapters/TextResources';

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
    delete (globalThis as any).TinyRPGFirebaseConfig;
    delete (globalThis as any).TinyRPGFirebaseCollection;
  });

  // ─── constructor / createShareTracker ────────────────────────────────────

  it('instantiates without throwing', () => {
    const mgr = makeManager();
    expect(() => new EditorShareService(mgr as any)).not.toThrow();
  });

  it('shareTracker is null when no firebase config present', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    expect(svc.shareTracker).toBeNull();
  });

  it('creates shareTracker when TinyRPGFirebaseConfig is set', async () => {
    (globalThis as any).TinyRPGFirebaseConfig = { apiKey: 'test' };
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    expect(svc.shareTracker).not.toBeNull();
  });

  // ─── t() ─────────────────────────────────────────────────────────────────

  it('t returns fallback string', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    (TextResources.get as any).mockReturnValue('');
    expect(svc.t('some.key', 'my fallback')).toBe('my fallback');
  });

  it('t returns key when no value and no fallback', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    (TextResources.get as any).mockReturnValue('');
    expect(svc.t('some.key')).toBe('some.key');
  });

  // ─── buildShareUrl ────────────────────────────────────────────────────────

  it('calls exportGameData and buildShareUrl', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    const url = svc.buildShareUrl();
    expect(mgr.gameEngine.exportGameData).toHaveBeenCalled();
    expect(url).toBe('https://example.com#abc123');
  });

  it('buildShareUrl does not throw when history.replaceState fails', async () => {
    const mgr = makeManager();
    const origReplace = globalThis.history?.replaceState;
    try {
      Object.defineProperty(globalThis, 'history', {
        value: { replaceState: () => { throw new Error('blocked'); } },
        configurable: true,
      });
    } catch {
      // jsdom may not allow this — just skip gracefully
    }
    const svc = new EditorShareService(mgr as any);
    expect(() => svc.buildShareUrl()).not.toThrow();
    if (origReplace) {
      try {
        Object.defineProperty(globalThis, 'history', { value: { replaceState: origReplace }, configurable: true });
      } catch {}
    }
  });

  // ─── updateShareUrlField ──────────────────────────────────────────────────

  it('sets shareUrlInput.value to the provided url', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    svc.updateShareUrlField('https://example.com#abc');
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('https://example.com#abc');
  });

  it('sets shareUrlInput.value to empty when url is null', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    svc.updateShareUrlField(null);
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('');
  });

  it('returns early when shareUrlInput is null', () => {
    const mgr = makeManager({ shareUrlInput: null });
    const svc = new EditorShareService(mgr as any);
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
    const svc = new EditorShareService(mgr as any);
    await svc.generateShareableUrl();
    expect((mgr.dom.shareUrlInput as HTMLInputElement).value).toBe('https://example.com#abc123');
  });

  it('generateShareableUrl uses prompt when clipboard unavailable', async () => {
    const mgr = makeManager();
    // Remove clipboard
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const svc = new EditorShareService(mgr as any);
    await svc.generateShareableUrl();
    expect(promptSpy).toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  // ─── trackShareUrl ────────────────────────────────────────────────────────

  it('trackShareUrl does nothing when shareTracker is null', async () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
    expect(svc.shareTracker).toBeNull();
    await expect(svc.trackShareUrl('https://example.com')).resolves.toBeUndefined();
  });

  // ─── saveGame ─────────────────────────────────────────────────────────────

  it('saveGame calls exportGameData and triggers download', () => {
    const mgr = makeManager();
    const svc = new EditorShareService(mgr as any);
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
    const svc = new EditorShareService(mgr as any);
    const input = document.createElement('input');
    const ev = { target: input } as unknown as Event;
    svc.loadGameFile(ev);
    expect(mgr.restore).not.toHaveBeenCalled();
  });
});


