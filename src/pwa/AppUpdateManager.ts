import { resolveVersionJsonUrl } from './AppVersion';

export type AppUpdateCheckStatus =
  | 'current'
  | 'updated'
  | 'version-fetch-failed'
  | 'offline'
  | 'reload-loop-blocked'
  | 'dirty-work-blocked'
  | 'hard-reload';

export interface DirtyStateGuard {
  hasUnsavedChanges(): boolean;
  saveBeforeUpdate(): Promise<boolean> | boolean;
}

export interface AppUpdateCheckResult {
  status: AppUpdateCheckStatus;
}

export interface AppUpdateManagerOptions {
  appBaseUrl: URL;
  currentVersion: string;
  fetchVersion?: (url: URL, init: RequestInit) => Promise<Response>;
  getServiceWorkerRegistration?: () => Promise<ServiceWorkerRegistration | undefined>;
  getServiceWorkerRegistrations?: () => Promise<readonly ServiceWorkerRegistration[]>;
  cacheStorage?: CacheStorage;
  reload?: (url: URL) => void;
  online?: () => boolean;
  now?: () => number;
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  normalUpdateTimeoutMs?: number;
  throttleMs?: number;
  dirtyState?: DirtyStateGuard;
}

const FORCED_VERSION_KEY = 'tiny-rpg:pwa-update:forced-version';
const LAST_CHECK_KEY = 'tiny-rpg:pwa-update:last-check';
/** Session token used when a hashed chunk is missing after a deploy. */
export const CHUNK_LOAD_FAILURE_TOKEN = 'chunk-load-failure';
const DEFAULT_NORMAL_UPDATE_TIMEOUT_MS = 4_000;
const DEFAULT_THROTTLE_MS = 5 * 60_000;

/**
 * Detects the browser / Vite errors that mean a code-split asset is gone
 * (typical after a deploy while an older bundle is still running from cache).
 */
export function isDynamicImportFailure(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';
  return (
    /Failed to fetch dynamically imported module/i.test(message)
    || /error loading dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message)
    || /Unable to preload CSS/i.test(message)
  );
}

type NavigatorWithOptionalServiceWorker = Navigator & {
  serviceWorker?: ServiceWorkerContainer;
};

export class AppUpdateManager {
  private readonly appBaseUrl: URL;
  private readonly currentVersion: string;
  private readonly fetchVersion: (url: URL, init: RequestInit) => Promise<Response>;
  private readonly getServiceWorkerRegistration: () => Promise<ServiceWorkerRegistration | undefined>;
  private readonly getServiceWorkerRegistrations: () => Promise<readonly ServiceWorkerRegistration[]>;
  private readonly cacheStorage?: CacheStorage;
  private readonly reload: (url: URL) => void;
  private readonly online: () => boolean;
  private readonly now: () => number;
  private readonly sessionStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  private readonly normalUpdateTimeoutMs: number;
  private readonly throttleMs: number;
  private readonly dirtyState?: DirtyStateGuard;
  private started = false;
  private inFlight: Promise<AppUpdateCheckResult> | null = null;
  private chunkRecoveryInFlight: Promise<AppUpdateCheckResult> | null = null;

  constructor(options: AppUpdateManagerOptions) {
    this.appBaseUrl = options.appBaseUrl;
    this.currentVersion = options.currentVersion;
    this.fetchVersion = options.fetchVersion ?? ((url, init) => fetch(url, init));
    this.getServiceWorkerRegistration = options.getServiceWorkerRegistration ?? getReadyServiceWorkerRegistration;
    this.getServiceWorkerRegistrations = options.getServiceWorkerRegistrations ?? getServiceWorkerRegistrations;
    this.cacheStorage = options.cacheStorage ?? globalThis.caches;
    this.reload = options.reload ?? ((url) => globalThis.location.assign(url.href));
    this.online = options.online ?? (() => navigator.onLine !== false);
    this.now = options.now ?? (() => Date.now());
    this.sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
    this.normalUpdateTimeoutMs = options.normalUpdateTimeoutMs ?? DEFAULT_NORMAL_UPDATE_TIMEOUT_MS;
    this.throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
    this.dirtyState = options.dirtyState;
  }

  async checkNow(): Promise<AppUpdateCheckResult> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.runCheck();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    const scheduleCheck = () => {
      void this.checkNow();
    };

    scheduleCheck();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', scheduleCheck);
    }
    addEventListener('online', scheduleCheck);
  }

  /**
   * Hard-recovers when a code-split chunk fails to load (stale PWA/cache after
   * deploy). Unregisters scoped service workers, deletes app caches, and
   * reloads with a cache-bypass query. Guarded against infinite reload loops.
   */
  async recoverFromStaleChunkFailure(error?: unknown): Promise<AppUpdateCheckResult> {
    if (error !== undefined && !isDynamicImportFailure(error)) {
      return { status: 'current' };
    }
    if (this.chunkRecoveryInFlight) return this.chunkRecoveryInFlight;
    this.chunkRecoveryInFlight = this.runChunkRecovery();
    try {
      return await this.chunkRecoveryInFlight;
    } finally {
      this.chunkRecoveryInFlight = null;
    }
  }

  private async runChunkRecovery(): Promise<AppUpdateCheckResult> {
    if (!this.online()) return { status: 'offline' };

    if (this.wasVersionAlreadyForced(CHUNK_LOAD_FAILURE_TOKEN)) {
      return { status: 'reload-loop-blocked' };
    }

    const dirtyStateSaved = await this.saveDirtyWorkIfNeeded();
    if (!dirtyStateSaved) return { status: 'dirty-work-blocked' };

    await this.forceScopedReload(CHUNK_LOAD_FAILURE_TOKEN);
    return { status: 'hard-reload' };
  }

  private async runCheck(): Promise<AppUpdateCheckResult> {
    if (!this.online()) return { status: 'offline' };
    if (this.isThrottled()) return { status: 'current' };

    const deployedVersion = await this.fetchDeployedVersion();
    if (!deployedVersion) return { status: 'version-fetch-failed' };
    this.rememberCheckTime();

    if (deployedVersion === this.currentVersion) {
      this.clearForcedVersion();
      return { status: 'current' };
    }

    if (this.wasVersionAlreadyForced(deployedVersion)) {
      return { status: 'reload-loop-blocked' };
    }

    await this.requestServiceWorkerUpdate();
    const updatedNormally = await this.waitForNormalUpdate();
    if (updatedNormally) {
      return { status: 'updated' };
    }

    const dirtyStateSaved = await this.saveDirtyWorkIfNeeded();
    if (!dirtyStateSaved) return { status: 'dirty-work-blocked' };

    await this.forceScopedReload(deployedVersion);
    return { status: 'hard-reload' };
  }

  private async fetchDeployedVersion(): Promise<string | null> {
    try {
      const response = await this.fetchVersion(
        resolveVersionJsonUrl('./', this.appBaseUrl.href),
        { cache: 'no-store' },
      );
      if (!response.ok) return null;
      const payload = await response.json() as { version?: unknown };
      return typeof payload.version === 'string' && payload.version.trim()
        ? payload.version.trim()
        : null;
    } catch {
      return null;
    }
  }

  private async requestServiceWorkerUpdate(): Promise<void> {
    const registration = await this.getServiceWorkerRegistration();
    await registration?.update();
  }

  private waitForNormalUpdate(): Promise<boolean> {
    const serviceWorker = getServiceWorkerContainer();
    if (!serviceWorker) {
      return delay(this.normalUpdateTimeoutMs).then(() => false);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (updated: boolean) => {
        if (settled) return;
        settled = true;
        serviceWorker.removeEventListener('controllerchange', onControllerChange);
        resolve(updated);
      };
      const onControllerChange = () => finish(true);
      serviceWorker.addEventListener('controllerchange', onControllerChange);
      setTimeout(() => finish(false), this.normalUpdateTimeoutMs);
    });
  }

  private async saveDirtyWorkIfNeeded(): Promise<boolean> {
    if (!this.dirtyState?.hasUnsavedChanges()) return true;
    try {
      return await this.dirtyState.saveBeforeUpdate();
    } catch {
      return false;
    }
  }

  private async forceScopedReload(deployedVersion: string): Promise<void> {
    this.sessionStorage?.setItem(FORCED_VERSION_KEY, deployedVersion);
    await this.unregisterScopedServiceWorkers();
    await this.deleteScopedCaches();
    this.reload(this.createCacheBypassUrl(deployedVersion));
  }

  private async unregisterScopedServiceWorkers(): Promise<void> {
    const registrations = await this.getServiceWorkerRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => this.isInAppScope(registration.scope))
        .map((registration) => registration.unregister()),
    );
  }

  private async deleteScopedCaches(): Promise<void> {
    const cacheStorage = this.cacheStorage;
    if (!cacheStorage) return;
    const keys = await cacheStorage.keys();
    await Promise.all(
      keys
        .filter((key) => this.isAppCacheName(key))
        .map((key) => cacheStorage.delete(key)),
    );
  }

  private isInAppScope(scope: string): boolean {
    try {
      const scopeUrl = new URL(scope);
      return scopeUrl.href.startsWith(this.appBaseUrl.href);
    } catch {
      return false;
    }
  }

  private isAppCacheName(cacheName: string): boolean {
    return cacheName.includes(this.appBaseUrl.href) || cacheName.includes(this.appBaseUrl.pathname);
  }

  private createCacheBypassUrl(deployedVersion: string): URL {
    const currentUrl = this.getCurrentAppUrl();
    currentUrl.searchParams.set('pwa-update', deployedVersion);
    return currentUrl;
  }

  private getCurrentAppUrl(): URL {
    if (typeof globalThis.location === 'undefined') return new URL(this.appBaseUrl.href);
    const currentUrl = new URL(globalThis.location.href);
    return currentUrl.href.startsWith(this.appBaseUrl.href) ? currentUrl : new URL(this.appBaseUrl.href);
  }

  private wasVersionAlreadyForced(deployedVersion: string): boolean {
    return this.sessionStorage?.getItem(FORCED_VERSION_KEY) === deployedVersion;
  }

  private clearForcedVersion(): void {
    this.sessionStorage?.removeItem(FORCED_VERSION_KEY);
  }

  private isThrottled(): boolean {
    if (this.throttleMs <= 0) return false;
    const lastCheck = Number(this.sessionStorage?.getItem(LAST_CHECK_KEY) ?? 0);
    return Number.isFinite(lastCheck) && lastCheck > 0 && this.now() - lastCheck < this.throttleMs;
  }

  private rememberCheckTime(): void {
    this.sessionStorage?.setItem(LAST_CHECK_KEY, String(this.now()));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  return getServiceWorkerContainer()?.ready;
}

async function getServiceWorkerRegistrations(): Promise<readonly ServiceWorkerRegistration[]> {
  return getServiceWorkerContainer()?.getRegistrations() ?? [];
}

function getServiceWorkerContainer(): ServiceWorkerContainer | undefined {
  return (navigator as NavigatorWithOptionalServiceWorker).serviceWorker;
}
