import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppUpdateManager,
  CHUNK_LOAD_FAILURE_TOKEN,
  isDynamicImportFailure,
} from '../../pwa/AppUpdateManager';

type UpdateManagerOptions = ConstructorParameters<typeof AppUpdateManager>[0];

const jsonResponse = (version: string): Response =>
  new Response(JSON.stringify({ version }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const createManager = (overrides: Partial<UpdateManagerOptions> = {}) => {
  const fetchVersion = vi.fn<NonNullable<UpdateManagerOptions['fetchVersion']>>(
    () => Promise.resolve(jsonResponse('1.0.0')),
  );
  const reload = vi.fn();
  const updateRegistration = vi.fn(() => Promise.resolve());
  const unregister = vi.fn(() => Promise.resolve(true));
  const registration = {
    scope: 'https://example.com/tiny-rpg-studio/',
    update: updateRegistration,
    unregister,
  } as unknown as ServiceWorkerRegistration;
  const getRegistrations = vi.fn(() => Promise.resolve([registration]));
  const deleteCache = vi.fn(() => Promise.resolve(true));
  const keys = vi.fn(() => Promise.resolve(['workbox-precache-v2-https://example.com/tiny-rpg-studio/']));
  const sessionStorage = new Map<string, string>();

  const manager = new AppUpdateManager({
    appBaseUrl: new URL('https://example.com/tiny-rpg-studio/'),
    currentVersion: '1.0.0',
    fetchVersion,
    getServiceWorkerRegistration: () => Promise.resolve(registration),
    getServiceWorkerRegistrations: getRegistrations,
    cacheStorage: { keys, delete: deleteCache } as unknown as CacheStorage,
    reload,
    online: () => true,
    now: () => 1_800_000,
    sessionStorage: {
      getItem: (key: string) => sessionStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionStorage.set(key, value);
      },
      removeItem: (key: string) => {
        sessionStorage.delete(key);
      },
    },
    normalUpdateTimeoutMs: 100,
    throttleMs: 0,
    ...overrides,
  });

  return {
    manager,
    fetchVersion,
    reload,
    updateRegistration,
    unregister,
    getRegistrations,
    deleteCache,
    keys,
    sessionStorage,
  };
};

describe('AppUpdateManager.checkNow', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when deployed version matches bundled version', async () => {
    const { manager, fetchVersion, updateRegistration, reload } = createManager();

    await manager.checkNow();

    expect(fetchVersion).toHaveBeenCalledWith(
      new URL('https://example.com/tiny-rpg-studio/version.json'),
      { cache: 'no-store' },
    );
    expect(updateRegistration).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('asks the service worker to update when the deployed version differs', async () => {
    const { manager, fetchVersion, updateRegistration } = createManager();
    fetchVersion.mockResolvedValueOnce(jsonResponse('1.0.1'));

    await manager.checkNow();

    expect(updateRegistration).toHaveBeenCalledTimes(1);
  });

  it('fails quietly when version.json cannot be fetched', async () => {
    const { manager, fetchVersion, updateRegistration, reload } = createManager();
    fetchVersion.mockRejectedValueOnce(new TypeError('offline'));

    await expect(manager.checkNow()).resolves.toEqual({ status: 'version-fetch-failed' });
    expect(updateRegistration).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('skips the check while the browser is offline', async () => {
    const { manager, fetchVersion, reload } = createManager({ online: () => false });

    await expect(manager.checkNow()).resolves.toEqual({ status: 'offline' });
    expect(fetchVersion).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('prevents reload loops for a version already forced in this session', async () => {
    const { manager, fetchVersion, reload, sessionStorage } = createManager();
    fetchVersion.mockResolvedValueOnce(jsonResponse('1.0.2'));
    sessionStorage.set('tiny-rpg:pwa-update:forced-version', '1.0.2');

    await expect(manager.checkNow()).resolves.toEqual({ status: 'reload-loop-blocked' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('blocks forced reload when editor work is dirty and saving fails', async () => {
    vi.useFakeTimers();
    const dirtyState = {
      hasUnsavedChanges: vi.fn(() => true),
      saveBeforeUpdate: vi.fn(() => Promise.resolve(false)),
    };
    const { manager, fetchVersion, reload, unregister } = createManager({ dirtyState });
    fetchVersion.mockResolvedValueOnce(jsonResponse('1.0.3'));

    const resultPromise = manager.checkNow();
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ status: 'dirty-work-blocked' });
    expect(dirtyState.saveBeforeUpdate).toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('uses a scoped hard fallback when normal service worker update does not complete', async () => {
    vi.useFakeTimers();
    const { manager, fetchVersion, unregister, deleteCache, reload } = createManager();
    fetchVersion.mockResolvedValueOnce(jsonResponse('1.0.4'));

    const resultPromise = manager.checkNow();
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ status: 'hard-reload' });
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('workbox-precache-v2-https://example.com/tiny-rpg-studio/');
    expect(reload).toHaveBeenCalledWith(
      new URL('https://example.com/tiny-rpg-studio/?pwa-update=1.0.4'),
    );
  });
});

describe('AppUpdateManager.start', () => {
  it('checks once on startup and again when the app becomes visible or returns online', async () => {
    const { manager } = createManager();
    const checkSpy = vi.spyOn(manager, 'checkNow').mockResolvedValue({ status: 'current' });

    manager.start();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(checkSpy).toHaveBeenCalledTimes(3));
  });
});

describe('isDynamicImportFailure', () => {
  it('recognizes common stale-chunk browser and Vite error messages', () => {
    expect(
      isDynamicImportFailure(
        new TypeError(
          'Failed to fetch dynamically imported module: https://example.com/assets/EditorManager-DYInJlt7.js',
        ),
      ),
    ).toBe(true);
    expect(isDynamicImportFailure(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isDynamicImportFailure(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isDynamicImportFailure(new Error('Unable to preload CSS for /assets/style.css'))).toBe(true);
    expect(isDynamicImportFailure(new Error('NetworkError when attempting to fetch resource.'))).toBe(false);
    expect(isDynamicImportFailure('Failed to fetch dynamically imported module')).toBe(true);
  });
});

describe('AppUpdateManager.recoverFromStaleChunkFailure', () => {
  it('ignores errors that are not dynamic import failures', async () => {
    const { manager, reload, unregister } = createManager();

    await expect(
      manager.recoverFromStaleChunkFailure(new Error('something else')),
    ).resolves.toEqual({ status: 'current' });
    expect(unregister).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears scoped caches and hard-reloads when a hashed chunk is missing', async () => {
    const { manager, unregister, deleteCache, reload, sessionStorage } = createManager();
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://example.com/assets/EditorManager-DYInJlt7.js',
    );

    await expect(manager.recoverFromStaleChunkFailure(error)).resolves.toEqual({
      status: 'hard-reload',
    });
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith(
      'workbox-precache-v2-https://example.com/tiny-rpg-studio/',
    );
    expect(reload).toHaveBeenCalledWith(
      new URL(`https://example.com/tiny-rpg-studio/?pwa-update=${CHUNK_LOAD_FAILURE_TOKEN}`),
    );
    expect(sessionStorage.get('tiny-rpg:pwa-update:forced-version')).toBe(CHUNK_LOAD_FAILURE_TOKEN);
  });

  it('prevents a reload loop after chunk recovery already ran this session', async () => {
    const { manager, reload, sessionStorage } = createManager();
    sessionStorage.set('tiny-rpg:pwa-update:forced-version', CHUNK_LOAD_FAILURE_TOKEN);
    const error = new TypeError('Failed to fetch dynamically imported module: x.js');

    await expect(manager.recoverFromStaleChunkFailure(error)).resolves.toEqual({
      status: 'reload-loop-blocked',
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('skips recovery while offline', async () => {
    const { manager, reload } = createManager({ online: () => false });
    const error = new TypeError('Failed to fetch dynamically imported module: x.js');

    await expect(manager.recoverFromStaleChunkFailure(error)).resolves.toEqual({
      status: 'offline',
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('blocks recovery when dirty editor work cannot be saved', async () => {
    const dirtyState = {
      hasUnsavedChanges: vi.fn(() => true),
      saveBeforeUpdate: vi.fn(() => Promise.resolve(false)),
    };
    const { manager, reload, unregister } = createManager({ dirtyState });
    const error = new TypeError('Failed to fetch dynamically imported module: x.js');

    await expect(manager.recoverFromStaleChunkFailure(error)).resolves.toEqual({
      status: 'dirty-work-blocked',
    });
    expect(dirtyState.saveBeforeUpdate).toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
