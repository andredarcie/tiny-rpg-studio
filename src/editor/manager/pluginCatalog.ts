import { parsePluginHtml, type InstalledPlugin, type PluginMetadata } from './PluginManager';

export interface CatalogEntry extends PluginMetadata { version: string; file: string }
type Fetch = typeof fetch;

function packageUrl(file: string, directory: URL): URL {
  if (typeof file !== 'string' || !file || file !== file.trim() || /[\\%?#:\s]/.test(file) || file.startsWith('/') || file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Error('Invalid plugin package path');
  }
  const url = new URL(file, directory);
  checkBoundary(url, directory);
  return url;
}
function checkBoundary(url: URL, directory: URL): void {
  if (url.origin !== directory.origin || !url.pathname.startsWith(directory.pathname) || url.search || url.hash || url.username || url.password) throw Error('Plugin URL outside catalog directory');
}
function validateCatalog(value: unknown, directory: URL): CatalogEntry[] {
  const document = value as { schemaVersion?: unknown; plugins?: unknown } | null;
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.plugins)) throw Error('Invalid or unsupported plugin catalog');
  const ids = new Set<string>();
  const keys = ['id', 'title', 'shortDescription', 'fullDescription', 'version', 'file'] as const;
  return document.plugins.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw Error('Invalid catalog entry');
    const raw = value as Record<string, unknown>;
    if (!keys.every(key => typeof raw[key] === 'string' && raw[key].trim())) throw Error('Invalid catalog metadata');
    const entry = Object.fromEntries(keys.map(key => [key, raw[key]])) as unknown as CatalogEntry;
    if (raw.capabilities !== undefined) {
      const capabilities = raw.capabilities;
      if (!Array.isArray(capabilities) || !capabilities.length || capabilities.some(value => value !== 'editor' && value !== 'gameplay') || new Set(capabilities).size !== capabilities.length) throw Error('Invalid catalog capabilities');
      entry.capabilities = capabilities as PluginMetadata['capabilities'];
    }
    if (ids.has(entry.id)) throw Error('Duplicate plugin ID');
    ids.add(entry.id);
    packageUrl(entry.file, directory);
    return entry;
  });
}

export function createPluginCatalog(base: string, fetcher: Fetch = (...args) => fetch(...args)) {
  const catalogUrl = new URL('plugins/catalog.json', base);
  const directory = new URL('.', catalogUrl);
  let pending: Promise<CatalogEntry[]> | undefined;
  async function request(url: URL, options: RequestInit): Promise<Response> {
    const response = await fetcher(url.href, { ...options, redirect: 'error' });
    if (!response.ok) throw Error('Plugin request failed');
    if (response.url) checkBoundary(new URL(response.url), directory);
    return response;
  }
  async function all(): Promise<CatalogEntry[]> {
    pending ??= request(catalogUrl, { cache: 'no-cache' })
      .then(response => response.json())
      .then((value: unknown) => validateCatalog(value, directory))
      .catch((error: unknown) => { pending = undefined; throw error; });
    return (await pending).map(entry => ({ ...entry, ...(entry.capabilities ? { capabilities: [...entry.capabilities] } : {}) }));
  }
  return {
    all,
    async search(query: string): Promise<CatalogEntry[]> {
      const term = query.trim().toLowerCase();
      if (term && term.length < 3) return [];
      const entries = await all();
      if (!term) return [...entries].sort((a, b) => a.title.trim().localeCompare(b.title.trim(), 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id)).slice(0, 10).map(entry => ({ ...entry }));
      return entries.filter(entry => [entry.title, entry.shortDescription, entry.fullDescription].some(value => value.toLowerCase().includes(term))).map(entry => ({ ...entry }));
    },
    async download(entry: CatalogEntry, signal: AbortSignal): Promise<InstalledPlugin> {
      signal.throwIfAborted();
      const response = await request(packageUrl(entry.file, directory), { signal });
      const source = await response.text();
      signal.throwIfAborted();
      const plugin = parsePluginHtml(source);
      if (plugin.id !== entry.id || !plugin.payload) throw Error('Package does not match catalog or has no executable payload');
      if (plugin.version !== undefined && plugin.version !== entry.version) throw Error('Package version does not match catalog');
      if (entry.capabilities && (entry.capabilities.length !== (plugin.capabilities ?? ['editor']).length || entry.capabilities.some(mode => !(plugin.capabilities ?? ['editor']).includes(mode)))) throw Error('Package capabilities do not match catalog');
      return { ...plugin, version: entry.version };
    },
  };
}
let catalog: ReturnType<typeof createPluginCatalog> | undefined;
function currentCatalog() {
  return catalog ??= createPluginCatalog(new URL(import.meta.env.BASE_URL, document.baseURI).href);
}
export function searchPlugins(query: string): Promise<CatalogEntry[]> { return currentCatalog().search(query); }
export function downloadPlugin(entry: CatalogEntry, signal: AbortSignal): Promise<InstalledPlugin> { return currentCatalog().download(entry, signal); }

export function listPlugins(): Promise<CatalogEntry[]> { return currentCatalog().all(); }
export function hasPluginUpdate(installed: string | undefined, available: string | undefined): boolean {
  const parse = (version: string | undefined) => version && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ? version.split('.').map(BigInt) : null;
  const next = parse(available);
  if (!next) return false;
  const previous = parse(installed);
  if (!previous) return true;
  for (let i = 0; i < 3; i++) {
    if (next[i] !== previous[i]) return next[i] > previous[i];
  }
  return false;
}
