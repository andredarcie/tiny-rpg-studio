export interface PluginMetadata {
  version?: string;
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
}
export interface PluginPayload { apiVersion: 1; javascript: string; css?: string }
export interface InstalledPlugin extends PluginMetadata { payload?: PluginPayload }
export const PLUGIN_STORAGE_KEY = 'tiny-rpg-plugins-v1';
function metadata(value: unknown): PluginMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const keys = ['id', 'title', 'shortDescription', 'fullDescription'] as const;
  if (!keys.every(key => typeof record[key] === 'string' && record[key].trim())) return null;
  return { ...Object.fromEntries(keys.map(key => [key, record[key]])),
    ...(typeof record.version === 'string' && record.version.trim() ? { version: record.version } : {}),
  } as unknown as PluginMetadata;
}
function validate(value: unknown): InstalledPlugin {
  const record = metadata(value);
  if (!record) throw Error('Invalid plugin metadata');
  const raw = value as Record<string, unknown>;
  if (raw.payload !== undefined) {
    const p = raw.payload as Partial<PluginPayload> | null;
    if (!p || p.apiVersion !== 1 || typeof p.javascript !== 'string' || !p.javascript.trim() || (p.css !== undefined && typeof p.css !== 'string')) throw Error('Invalid or unsupported plugin payload');
    return { ...record, payload: { apiVersion: 1, javascript: p.javascript, ...(p.css === undefined ? {} : { css: p.css }) } };
  }
  return record;
}
export function parsePluginHtml(source: string): InstalledPlugin {
  const template = document.createElement('template');
  template.innerHTML = source;
  const manifests = template.content.querySelectorAll('script#tiny-rpg-plugin[type="application/json"]');
  if (manifests.length !== 1) throw Error('Missing or duplicate plugin manifest');
  const raw = JSON.parse(manifests[0].textContent) as Record<string, unknown>;
  const record = metadata(raw);
  if (!record) throw Error('Invalid plugin manifest');
  if (raw.apiVersion === undefined) return record;
  const scripts = template.content.querySelectorAll('script[data-tiny-rpg-plugin]');
  const styles = template.content.querySelectorAll('style[data-tiny-rpg-plugin]');
  if (raw.apiVersion !== 1 || scripts.length !== 1 || styles.length > 1 || scripts[0].getAttribute('type') !== 'module' || scripts[0].hasAttribute('src')) throw Error('Invalid executable blocks or API version');
  return validate({ ...record, payload: { apiVersion: 1, javascript: scripts[0].textContent, ...(styles.length ? { css: styles[0].textContent } : {}) } });
}
export class PluginManager {
  private records: InstalledPlugin[] = [];
  private listeners = new Set<() => void>();
  storageError = false;
  lastError: 'validation' | 'storage' | null = null;
  validationErrors: Record<string, string> = Object.create(null) as Record<string, string>;
  constructor() {
    try {
      const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw Error('Invalid plugin records');
      for (const value of parsed) {
        let record: InstalledPlugin;
        try { record = validate(value); }
        catch {
          const legacy = metadata(value);
          if (!legacy) { this.storageError = true; continue; }
          record = legacy;
          this.validationErrors[record.id] = 'Invalid or unsupported stored plugin payload';
        }
        if (!this.has(record.id)) this.records.push(record);
      }
    } catch { this.storageError = true; }
  }
  get installed(): InstalledPlugin[] { return this.records.map(record => ({ ...record, ...(record.payload ? { payload: { ...record.payload } } : {}) })); }
  has(id: string): boolean { return this.records.some(record => record.id === id); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  install(plugin: unknown): boolean {
    let record: InstalledPlugin;
    try { record = validate(plugin); } catch { this.lastError = 'validation'; return false; }
    const existing = this.records.find(item => item.id === record.id);
    if (JSON.stringify(existing) === JSON.stringify(record)) { this.lastError = null; return true; }
    return this.persist(existing ? this.records.map(item => item.id === record.id ? record : item) : [...this.records, record], record.id);
  }
  remove(id: string): boolean { return this.persist(this.records.filter(record => record.id !== id), id); }
  private persist(records: InstalledPlugin[], id: string): boolean {
    try { localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(records)); }
    catch { this.storageError = true; this.lastError = 'storage'; return false; }
    this.records = records;
    delete this.validationErrors[id];
    this.storageError = false;
    this.lastError = null;
    for (const listener of this.listeners) listener();
    return true;
  }
}
