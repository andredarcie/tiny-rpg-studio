import { parsePluginHtml, type InstalledPlugin, type PluginMetadata } from './PluginManager';

export const CUSTOM_SOURCES_KEY = 'tiny-rpg-plugin-sources-v1';
export interface CustomEntry extends PluginMetadata { sourceUrl: string; fileUrl: string }
type Fetcher = typeof fetch;

function sourceLocation(value: string): { kind: 'file' | 'folder'; url: URL; api?: string; owner?: string; repo?: string; ref?: string; folder?: string } {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw Error('Invalid source URL');
  const match = url.hostname === 'github.com' && url.protocol === 'https:' && !url.search
    ? /^\/([^/]+)\/([^/]+)\/tree\/(main|[a-fA-F0-9]{7,40})\/(.+)\/?$/.exec(url.pathname) : null;
  if (match) {
    const [, owner, repo, ref, rawFolder] = match;
    const folder = rawFolder.replace(/\/$/, '');
    if (folder.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid GitHub folder');
    const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${folder.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`;
    return { kind: 'folder', url, api, owner, repo, ref, folder };
  }
  if (!/\.html?$/i.test(url.pathname)) throw Error('Expected an HTML plugin URL or GitHub folder');
  return { kind: 'file', url };
}

export class CustomSources {
  private saved: string[] = [];
  private discovered = new Map<string, CustomEntry[]>();
  private revisions = new Map<string, number>();
  private listeners = new Set<() => void>();
  storageError = false;
  discoveryError = false;
  loading = false;

  private fetcher: Fetcher;
  constructor(fetcher: Fetcher = (...args) => fetch(...args)) {
    this.fetcher = fetcher;
    try {
      const raw = localStorage.getItem(CUSTOM_SOURCES_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string' || !value.trim())) throw Error('Invalid sources');
        this.saved = [...new Set(parsed as string[])].filter(value => { try { sourceLocation(value); return true; } catch { this.storageError = true; return false; } });
      }
    } catch { this.storageError = true; }
  }

  get urls(): string[] { return [...this.saved]; }
  get entries(): CustomEntry[] { return this.saved.flatMap(url => this.discovered.get(url) ?? []); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
  private async request(url: string, signal?: AbortSignal): Promise<Response> {
    const response = await this.fetcher(url, { cache: 'no-cache', redirect: 'error', signal });
    if (!response.ok) throw Error('Source request failed');
    return response;
  }
  private async discover(sourceUrl: string, signal?: AbortSignal): Promise<CustomEntry[]> {
    const location = sourceLocation(sourceUrl);
    let files: string[];
    if (location.kind === 'file') files = [location.url.href];
    else {
      const listing: unknown = await (await this.request(location.api ?? '', signal)).json();
      if (!Array.isArray(listing)) throw Error('Invalid GitHub folder');
      files = (listing as unknown[]).filter((item): item is { type: string; name: string; path: string } => {
        if (!item || typeof item !== 'object') return false;
        const value = item as Record<string, unknown>;
        return value.type === 'file' && typeof value.name === 'string' && /\.html?$/i.test(value.name) &&
          typeof value.path === 'string' && value.path.startsWith(`${location.folder}/`) && !value.path.slice((location.folder ?? '').length + 1).includes('/');
      })
        .map(item => `https://raw.githubusercontent.com/${location.owner}/${location.repo}/${location.ref}/${item.path.split('/').map(encodeURIComponent).join('/')}`);
    }
    const entries: CustomEntry[] = [];
    const ids = new Set<string>();
    for (const fileUrl of files) {
      try {
        const plugin = parsePluginHtml(await (await this.request(fileUrl, signal)).text());
        if (!plugin.payload || ids.has(plugin.id)) continue;
        ids.add(plugin.id);
        const { id, title, shortDescription, fullDescription, version, capabilities } = plugin;
        entries.push({ id, title, shortDescription, fullDescription, ...(version ? { version } : {}), ...(capabilities ? { capabilities } : {}), sourceUrl, fileUrl });
      } catch { /* Invalid files do not hide valid plugins in the same folder. */ }
    }
    signal?.throwIfAborted();
    if (!entries.length) throw Error('No executable HTML plugins found');
    return entries;
  }
  async add(url: string, signal?: AbortSignal): Promise<void> {
    const value = url.trim();
    sourceLocation(value);
    if (this.saved.includes(value)) throw Error('Source already added');
    const entries = await this.discover(value, signal);
    signal?.throwIfAborted();
    if (this.saved.includes(value)) throw Error('Source already added');
    try { localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify([...this.saved, value])); }
    catch { this.storageError = true; this.notify(); throw Error('Could not save source'); }
    this.saved.push(value);
    this.discovered.set(value, entries);
    this.storageError = false;
    this.notify();
  }
  remove(url: string): void {
    if (!this.saved.includes(url)) return;
    try { localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify(this.saved.filter(value => value !== url))); }
    catch { this.storageError = true; this.notify(); throw Error('Could not remove source'); }
    this.saved = this.saved.filter(value => value !== url);
    this.revisions.set(url, (this.revisions.get(url) ?? 0) + 1);
    this.discovered.delete(url);
    this.storageError = false;
    this.notify();
  }
  async load(): Promise<void> {
    this.loading = true; this.discoveryError = false; this.notify();
    await Promise.all(this.saved.map(async url => {
      const revision = this.revisions.get(url) ?? 0;
      try {
        const entries = await this.discover(url);
        if (this.saved.includes(url) && revision === (this.revisions.get(url) ?? 0)) this.discovered.set(url, entries);
      } catch { if (this.saved.includes(url) && revision === (this.revisions.get(url) ?? 0)) this.discoveryError = true; }
      this.notify();
    }));
    this.loading = false; this.notify();
  }
  async download(entry: CustomEntry, signal: AbortSignal): Promise<InstalledPlugin> {
    signal.throwIfAborted();
    if (!this.saved.includes(entry.sourceUrl)) throw Error('Source removed');
    const plugin = parsePluginHtml(await (await this.request(entry.fileUrl, signal)).text());
    signal.throwIfAborted();
    if (!this.saved.includes(entry.sourceUrl) || !plugin.payload || plugin.id !== entry.id || plugin.version !== entry.version ||
      JSON.stringify([...(plugin.capabilities ?? ['editor'])].sort()) !== JSON.stringify([...(entry.capabilities ?? ['editor'])].sort())) throw Error('Source package changed');
    return plugin;
  }
}
