export interface PluginMetadata {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
}

export const PLUGIN_STORAGE_KEY = 'tiny-rpg-plugins-v1';

function validatedRecord(value: unknown): PluginMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const keys = ['id', 'title', 'shortDescription', 'fullDescription'] as const;
  if (!keys.every(key => typeof record[key] === 'string' && record[key].trim().length > 0)) return null;
  return Object.fromEntries(keys.map(key => [key, record[key]])) as unknown as PluginMetadata;
}

export function parsePluginHtml(source: string): PluginMetadata {
  const template = document.createElement('template');
  template.innerHTML = source;
  const manifests = template.content.querySelectorAll('script#tiny-rpg-plugin[type="application/json"]');
  if (manifests.length !== 1) throw new Error('Missing or duplicate plugin manifest');
  const record = validatedRecord(JSON.parse(manifests[0].textContent) as unknown);
  if (!record) throw new Error('Invalid plugin manifest');
  return record;
}

export class PluginManager {
  private records: PluginMetadata[] = [];
  storageError = false;

  constructor() {
    try {
      const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Invalid plugin metadata');
      const seen = new Set<string>();
      for (const value of parsed) {
        const record = validatedRecord(value);
        if (!record) { this.storageError = true; continue; }
        if (!seen.has(record.id)) this.records.push(record);
        seen.add(record.id);
      }
    } catch {
      this.storageError = true;
    }
  }

  get installed(): PluginMetadata[] {
    return this.records.map(record => ({ ...record }));
  }

  has(id: string): boolean {
    return this.records.some(record => record.id === id);
  }

  install(plugin: PluginMetadata): boolean {
    const record = validatedRecord(plugin);
    if (!record) return false;
    if (this.has(record.id)) return true;
    return this.persist([...this.records, record]);
  }

  remove(id: string): boolean {
    return this.persist(this.records.filter(record => record.id !== id));
  }

  private persist(records: PluginMetadata[]): boolean {
    try {
      localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(records));
      this.records = records;
      this.storageError = false;
      return true;
    } catch {
      this.storageError = true;
      return false;
    }
  }
}
