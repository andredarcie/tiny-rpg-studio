import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import type { InstalledPlugin, PluginManager } from './PluginManager';
import type { Modal, ModalOptions } from '../../ui/Modal';
import type { DialoguePlusBlock } from '../../runtime/domain/dialoguePlus';
export type NpcModalView = { id: string; dialoguePlus?: DialoguePlusBlock[]; disappearAfterDialog?: boolean; conditionVariableId?: string | null; conditionText?: string | null; conditionalRewardVariableId?: string | null; choiceEnabled?: boolean; choicePrompt?: string | null; choiceYesText?: string | null; choiceNoText?: string | null; choiceYesVariableId?: string | null; choiceNoVariableId?: string | null };
export type NpcModalRenderer = (body: HTMLElement, npc: NpcModalView) => void;
const npcModalRenderers = new Set<NpcModalRenderer>();
export const renderNpcModalExtensions = (body: HTMLElement, npc: NpcModalView): void => {
  for (const render of npcModalRenderers) render(body, npc);
};
const notifyNpcModalChanged = () => document.dispatchEvent(new Event('npc-modal-plugins-changed'));
export type PluginUi = { createModal(options?: ModalOptions): Modal; text(key: string, fallback: string): string };
export interface PluginContext { editorRoot: HTMLElement; api: TinyRpgApi; ui?: PluginUi; onCleanup(callback: () => void): void; registerSettings(render: (container: HTMLElement) => void): void; registerNpcModal(render: NpcModalRenderer): void }
export type PluginModule = { activate(context: PluginContext): void | Promise<void> };
export type PluginLoader = (source: string) => Promise<PluginModule>;
export type PluginState = { status: 'inert' | 'pending' | 'active' | 'failed'; error?: string };
export const loadPluginModule: PluginLoader = async source => {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try { return await import(/* @vite-ignore */ url) as PluginModule; }
  finally { URL.revokeObjectURL(url); }
};
export class PluginRuntime {
  private context?: { editorRoot: HTMLElement; api: TinyRpgApi; ui?: PluginUi };
  private entries = new Map<string, { signature: string; cleanups: (() => void)[]; state: PluginState; valid: boolean }>();
  private queue = Promise.resolve();
  private destroyed = false;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private manager: PluginManager;
  private loader: PluginLoader;
  constructor(manager: PluginManager, loader: PluginLoader = loadPluginModule) {
    this.manager = manager;
    this.loader = loader;
    this.unsubscribe = manager.subscribe(() => {
      const installed = manager.installed;
      for (const [id, entry] of this.entries) {
        if (!installed.some(plugin => plugin.id === id && JSON.stringify(plugin) === entry.signature)) entry.valid = false;
      }
      this.schedule();
    });
  }
  start(editorRoot: HTMLElement, api: TinyRpgApi, ui?: PluginUi): void {
    if (this.destroyed || this.context) return;
    this.context = { editorRoot, api, ui };
    this.schedule();
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  getState(id: string): PluginState {
    const error = this.manager.validationErrors[id];
    if (error) return { status: 'failed', error };
    return this.entries.get(id)?.state ?? { status: this.manager.installed.find(p => p.id === id)?.payload?.javascript ? 'pending' : 'inert' };
  }
  async settled(): Promise<void> { let pending; do { pending = this.queue; await pending; } while (pending !== this.queue); }
  private schedule(): void { this.queue = this.queue.then(() => this.reconcile()); }
  private current(plugin: InstalledPlugin): boolean { return !this.destroyed && this.manager.installed.some(p => JSON.stringify(p) === JSON.stringify(plugin)); }
  private cleanup(id: string): void {
    const entry = this.entries.get(id);
    this.entries.delete(id);
    if (entry) entry.valid = false;
    for (const callback of entry?.cleanups.reverse() ?? []) { try { callback(); } catch { /* Continue restoring remaining effects. */ } }
  }
  private async reconcile(): Promise<void> {
    const packages = this.destroyed ? [] : this.manager.installed;
    for (const [id, entry] of this.entries) {
      if (!packages.some(p => p.id === id && JSON.stringify(p) === entry.signature)) this.cleanup(id);
    }
    if (this.context && !this.destroyed) for (const plugin of packages) {
      if (!plugin.payload?.javascript || this.entries.has(plugin.id) || !this.current(plugin)) continue;
      const entry = { signature: JSON.stringify(plugin), cleanups: [] as (() => void)[], state: { status: 'pending' } as PluginState, valid: true };
      this.entries.set(plugin.id, entry);
      try {
        const module = await this.loader(plugin.payload.javascript);
        if (!entry.valid || !this.current(plugin)) { this.cleanup(plugin.id); continue; }
        if (typeof module.activate !== 'function') throw Error('Plugin must export activate(context)');
        if (plugin.payload.css !== undefined) {
          const style = document.createElement('style');
          style.dataset.pluginId = plugin.id;
          style.textContent = plugin.payload.css;
          entry.cleanups.push(() => style.remove());
          document.head.append(style);
        }
        let group: HTMLDetailsElement | undefined;
        const registerNpcModal = (render: NpcModalRenderer): void => {
          if (!entry.valid || this.entries.get(plugin.id) !== entry || !this.current(plugin)) throw Error('Plugin activation is no longer current');
          if (typeof render !== 'function') throw Error('NPC modal renderer must be a function');
          npcModalRenderers.add(render);
          entry.cleanups.push(() => { npcModalRenderers.delete(render); notifyNpcModalChanged(); });
          notifyNpcModalChanged();
        };
        const registerSettings = (render: (container: HTMLElement) => void): void => {
          if (!entry.valid || this.entries.get(plugin.id) !== entry || !this.current(plugin)) throw Error('Plugin activation is no longer current');
          const panel = this.context?.editorRoot.querySelector<HTMLElement>('[data-project-tab-panel="plugins"]');
          const groups = panel?.querySelector<HTMLElement>('[data-plugin-settings-groups]');
          const empty = panel?.querySelector<HTMLElement>('[data-plugin-settings-empty]');
          if (!groups || !empty) throw Error('Plugin settings panel is unavailable');
          if (!group) {
            group = document.createElement('details');
            group.className = 'project-card plugin-settings-group';
            group.dataset.pluginSettingsGroup = plugin.id;
            group.open = true;
            const summary = document.createElement('summary');
            summary.textContent = plugin.title;
            group.append(summary);
            groups.append(group);
            empty.hidden = true;
            const ownGroup = group;
            entry.cleanups.push(() => { ownGroup.remove(); empty.hidden = Boolean(groups.querySelector('[data-plugin-settings-group]')); });
          }
          const container = document.createElement('div');
          container.className = 'plugin-settings-content';
          group.append(container);
          render(container);
        };
        await module.activate({ ...this.context, onCleanup: callback => entry.cleanups.push(callback), registerSettings, registerNpcModal });
        if (this.entries.get(plugin.id)?.valid !== true || !this.current(plugin)) this.cleanup(plugin.id);
        else entry.state = { status: 'active' };
      } catch (error) {
        const failedCurrent = this.entries.get(plugin.id)?.valid === true && this.current(plugin);
        this.cleanup(plugin.id);
        if (failedCurrent) this.entries.set(plugin.id, { ...entry, cleanups: [], state: { status: 'failed', error: error instanceof Error ? error.message : String(error) }, valid: false });
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
