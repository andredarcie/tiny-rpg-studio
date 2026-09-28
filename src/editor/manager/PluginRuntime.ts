import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import type { InstalledPlugin, PluginManager } from './PluginManager';
export interface PluginContext { editorRoot: HTMLElement; api: TinyRpgApi; onCleanup(callback: () => void): void }
export type PluginModule = { activate(context: PluginContext): void | Promise<void> };
export type PluginLoader = (source: string) => Promise<PluginModule>;
export type PluginState = { status: 'inert' | 'pending' | 'active' | 'failed'; error?: string };
export const loadPluginModule: PluginLoader = async source => {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try { return await import(/* @vite-ignore */ url) as PluginModule; }
  finally { URL.revokeObjectURL(url); }
};
export class PluginRuntime {
  private context?: { editorRoot: HTMLElement; api: TinyRpgApi };
  private entries = new Map<string, { signature: string; cleanups: (() => void)[]; state: PluginState }>();
  private queue = Promise.resolve();
  private destroyed = false;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private manager: PluginManager;
  private loader: PluginLoader;
  constructor(manager: PluginManager, loader: PluginLoader = loadPluginModule) {
    this.manager = manager;
    this.loader = loader;
    this.unsubscribe = manager.subscribe(() => this.schedule());
  }
  start(editorRoot: HTMLElement, api: TinyRpgApi): void {
    if (this.destroyed || this.context) return;
    this.context = { editorRoot, api };
    this.schedule();
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  getState(id: string): PluginState {
    const error = this.manager.validationErrors[id];
    if (error) return { status: 'failed', error };
    return this.entries.get(id)?.state ?? { status: this.manager.installed.find(p => p.id === id)?.payload ? 'pending' : 'inert' };
  }
  async settled(): Promise<void> { let pending; do { pending = this.queue; await pending; } while (pending !== this.queue); }
  private schedule(): void { this.queue = this.queue.then(() => this.reconcile()); }
  private current(plugin: InstalledPlugin): boolean { return !this.destroyed && this.manager.installed.some(p => JSON.stringify(p) === JSON.stringify(plugin)); }
  private cleanup(id: string): void {
    const entry = this.entries.get(id);
    this.entries.delete(id);
    for (const callback of entry?.cleanups.reverse() ?? []) { try { callback(); } catch { /* Continue restoring remaining effects. */ } }
  }
  private async reconcile(): Promise<void> {
    const packages = this.destroyed ? [] : this.manager.installed;
    for (const [id, entry] of this.entries) {
      if (!packages.some(p => p.id === id && JSON.stringify(p) === entry.signature)) this.cleanup(id);
    }
    if (this.context && !this.destroyed) for (const plugin of packages) {
      if (!plugin.payload || this.entries.has(plugin.id) || !this.current(plugin)) continue;
      const entry = { signature: JSON.stringify(plugin), cleanups: [] as (() => void)[], state: { status: 'pending' } as PluginState };
      this.entries.set(plugin.id, entry);
      try {
        const module = await this.loader(plugin.payload.javascript);
        if (!this.current(plugin)) { this.cleanup(plugin.id); continue; }
        if (typeof module.activate !== 'function') throw Error('Plugin must export activate(context)');
        if (plugin.payload.css !== undefined) {
          const style = document.createElement('style');
          style.dataset.pluginId = plugin.id;
          style.textContent = plugin.payload.css;
          entry.cleanups.push(() => style.remove());
          document.head.append(style);
        }
        await module.activate({ ...this.context, onCleanup: callback => entry.cleanups.push(callback) });
        if (!this.current(plugin)) this.cleanup(plugin.id);
        else entry.state = { status: 'active' };
      } catch (error) {
        this.cleanup(plugin.id);
        if (this.current(plugin)) this.entries.set(plugin.id, { ...entry, cleanups: [], state: { status: 'failed', error: error instanceof Error ? error.message : String(error) } });
      }
    }
    for (const listener of this.listeners) listener();
  }
  async destroy(): Promise<void> {
    this.destroyed = true;
    this.unsubscribe();
    this.schedule();
    await this.settled();
    this.listeners.clear();
  }
}
