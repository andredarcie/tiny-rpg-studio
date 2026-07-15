import {
  AppUpdateManager,
  isDynamicImportFailure,
  type AppUpdateCheckResult,
  type DirtyStateGuard,
} from './AppUpdateManager';
import { CURRENT_APP_VERSION } from './AppVersion';

export interface InstallPwaUpdateChecksOptions {
  dirtyState?: DirtyStateGuard;
}

let installed = false;
let manager: AppUpdateManager | null = null;

type NavigatorWithOptionalServiceWorker = Navigator & {
  serviceWorker?: ServiceWorkerContainer;
};

export function installPwaUpdateChecks(options: InstallPwaUpdateChecksOptions = {}): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  manager = new AppUpdateManager({
    appBaseUrl: new URL(getBaseUrl(), window.location.href),
    currentVersion: CURRENT_APP_VERSION,
    getServiceWorkerRegistration: async () => getServiceWorkerContainer()?.ready,
    dirtyState: options.dirtyState,
  });

  manager.start();
  installStaleChunkRecovery(manager);
}

/**
 * Called when a dynamic `import()` fails because a hashed chunk is missing
 * after a deploy. Returns true when recovery was started (or recognized as a
 * stale-chunk error). Safe to call before install (no-ops without a manager).
 */
export function recoverFromDynamicImportFailure(error: unknown): boolean {
  if (!isDynamicImportFailure(error)) return false;
  if (!manager) {
    console.warn(
      '[TinyRPG] Stale chunk load detected but PWA recovery is not installed yet.',
      error,
    );
    return false;
  }
  void manager.recoverFromStaleChunkFailure(error).then((result: AppUpdateCheckResult) => {
    if (result.status === 'hard-reload') {
      console.info('[TinyRPG] Reloading to pick up a fresh app build after a missing chunk.');
    } else if (result.status === 'reload-loop-blocked') {
      console.error(
        '[TinyRPG] Stale chunk recovery already attempted this session; not reloading again.',
        error,
      );
    } else if (result.status === 'dirty-work-blocked') {
      console.warn(
        '[TinyRPG] Could not auto-reload for a stale chunk because unsaved work could not be saved.',
        error,
      );
    }
  });
  return true;
}

function installStaleChunkRecovery(updateManager: AppUpdateManager): void {
  // Vite emits this when a preload / dynamic import of a production chunk fails.
  // Prefer a hard cache-clearing reload over a plain refresh so the service
  // worker cannot keep serving the obsolete index + asset map.
  window.addEventListener('vite:preloadError', (event: Event) => {
    event.preventDefault();
    const detail = 'payload' in event
      ? (event as Event & { payload?: unknown }).payload
      : undefined;
    void updateManager.recoverFromStaleChunkFailure(
      detail instanceof Error ? detail : new TypeError('Failed to fetch dynamically imported module'),
    );
  });
}

function getBaseUrl(): string {
  return (import.meta.env as ImportMetaEnv).BASE_URL;
}

function getServiceWorkerContainer(): ServiceWorkerContainer | undefined {
  return (navigator as NavigatorWithOptionalServiceWorker).serviceWorker;
}
