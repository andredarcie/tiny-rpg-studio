import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const recoverFromStaleChunkFailure = vi.fn(() => Promise.resolve({ status: 'hard-reload' as const }));
  const AppUpdateManager = vi.fn(function MockAppUpdateManager(this: {
    start: ReturnType<typeof vi.fn>;
    recoverFromStaleChunkFailure: typeof recoverFromStaleChunkFailure;
  }) {
    this.start = vi.fn();
    this.recoverFromStaleChunkFailure = recoverFromStaleChunkFailure;
  });
  return { AppUpdateManager, recoverFromStaleChunkFailure };
});

vi.mock('../../pwa/AppUpdateManager', async () => {
  const actual = await vi.importActual('../../pwa/AppUpdateManager') as Record<string, unknown>;
  return {
    ...actual,
    AppUpdateManager: mocks.AppUpdateManager,
  };
});

vi.mock('../../pwa/AppVersion', () => ({
  CURRENT_APP_VERSION: '1.0.0-test',
}));

describe('stale chunk recovery install wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listens for vite:preloadError and recovers without rethrowing', async () => {
    const { installPwaUpdateChecks } = await import('../../pwa/installPwaUpdateChecks');
    const addEventListener = vi.spyOn(window, 'addEventListener');

    installPwaUpdateChecks();

    const preloadHandler = addEventListener.mock.calls.find(
      ([type]) => type === 'vite:preloadError',
    )?.[1] as EventListener | undefined;
    expect(preloadHandler).toBeTypeOf('function');

    const event = new Event('vite:preloadError', { cancelable: true });
    Object.assign(event, {
      payload: new TypeError('Failed to fetch dynamically imported module: chunk.js'),
    });
    preloadHandler?.(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mocks.recoverFromStaleChunkFailure).toHaveBeenCalledTimes(1);
  });

  it('recoverFromDynamicImportFailure starts recovery for stale chunks only', async () => {
    const {
      installPwaUpdateChecks,
      recoverFromDynamicImportFailure,
    } = await import('../../pwa/installPwaUpdateChecks');

    installPwaUpdateChecks();
    mocks.recoverFromStaleChunkFailure.mockClear();

    expect(recoverFromDynamicImportFailure(new Error('unrelated'))).toBe(false);
    expect(mocks.recoverFromStaleChunkFailure).not.toHaveBeenCalled();

    expect(
      recoverFromDynamicImportFailure(
        new TypeError('Failed to fetch dynamically imported module: EditorManager.js'),
      ),
    ).toBe(true);
    expect(mocks.recoverFromStaleChunkFailure).toHaveBeenCalledTimes(1);
  });
});
