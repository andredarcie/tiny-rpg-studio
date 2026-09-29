import { TextResources } from '../../runtime/adapters/TextResources';
import { Modal } from '../../ui/Modal';
import type { PluginManager, PluginMetadata } from '../manager/PluginManager';
import { parsePluginHtml } from '../manager/PluginManager';
import { searchPlugins, downloadPlugin, listPlugins, hasPluginUpdate, type CatalogEntry } from '../manager/pluginCatalog';

import type { PluginRuntime } from '../manager/PluginRuntime';

type Search = (query: string) => Promise<CatalogEntry[]>;
type Mode = 'search' | 'manage';
const text = (key: string) => TextResources.get(`plugins.${key}`);

export class PluginsModal {
  private runtime?: PluginRuntime;
  private modal: Modal;
  private unsubscribeRuntime?: () => void;
  private trust = document.createElement('p');
  private button = document.getElementById('btn-plugins');
  private editor = document.getElementById('tab-editor');
  private body = document.createElement('div');
  private query = document.createElement('input');
  private searchButton = document.createElement('button');
  private manageButton = document.createElement('button');
  private searchField = document.createElement('div');
  private status = document.createElement('p');
  private storageStatus = document.createElement('p');
  private grid = document.createElement('div');
  private fileInput = document.createElement('input');
  private reader: FileReader | null = null;
  private boundImport = () => this.importFile();
  private mode: Mode = 'search';
  private results: CatalogEntry[] = [];
  private catalog: CatalogEntry[] = [];
  private lookup: typeof listPlugins;
  private lookupError = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private installController: AbortController | null = null;
  private cardSequence = 0;
  private destroyed = false;
  private manager: PluginManager;
  private search: Search;
  private download: typeof downloadPlugin;
  private observer: MutationObserver;
  private boundOpen = () => this.open();
  private boundInput = () => this.scheduleSearch();
  private boundClick = (event: MouseEvent) => this.handleClick(event);
  private boundVisibility = () => {
    const active = this.editor?.classList.contains('active') ?? false;
    if (this.button) this.button.style.display = active ? '' : 'none';
    if (!active) this.close();
  };

  constructor(manager: PluginManager, search: Search = searchPlugins, runtime?: PluginRuntime, download = downloadPlugin, lookup = listPlugins) {
    this.lookup = lookup;
    this.runtime = runtime;
    this.download = download;
    this.manager = manager;
    this.search = search;
    this.modal = new Modal({ size: 'xl', className: 'plugins-modal', onClose: () => this.close() });
    this.modal.root.id = 'plugins-modal';
    this.modal.setHeader({ title: text('title') });
    this.body.className = 'tiny-modal__body tiny-modal__body--stack';
    const navigation = document.createElement('div');
    navigation.className = 'plugins-navigation';
    for (const [button, mode] of [[this.searchButton, 'search'], [this.manageButton, 'manage']] as const) {
      button.type = 'button';
      button.id = `plugins-${mode}`;
      button.className = 'btn-secondary';
      button.textContent = text(mode);
      button.dataset.mode = mode;
      button.setAttribute('aria-controls', 'plugins-content');
      navigation.append(button);
    }
    const label = document.createElement('label');
    label.htmlFor = 'plugins-query';
    label.textContent = text('query');
    this.query.id = 'plugins-query';
    this.query.type = 'search';
    this.query.setAttribute('aria-describedby', 'plugins-status');
    this.searchField.className = 'plugins-search-field';
    this.searchField.append(label, this.query);
    this.status.id = 'plugins-status';
    this.status.setAttribute('role', 'status');
    this.storageStatus.id = 'plugins-storage-error';
    this.storageStatus.setAttribute('role', 'status');
    this.grid.className = 'plugins-grid';
    const content = document.createElement('section');
    content.id = 'plugins-content';
    content.append(this.searchField, this.status, this.storageStatus, this.grid);
    this.trust.id = 'plugins-trust';
    this.trust.textContent = text('trust');
    this.body.append(navigation, this.trust, content);
    this.fileInput.type = 'file';
    this.fileInput.accept = '.html,.htm,text/html';
    this.fileInput.id = 'plugins-file';
    this.fileInput.hidden = true;
    this.body.append(this.fileInput);
    this.fileInput.addEventListener('change', this.boundImport);
    this.modal.setBody(this.body);
    this.button?.addEventListener('click', this.boundOpen);
    this.query.addEventListener('input', this.boundInput);
    this.body.addEventListener('click', this.boundClick);
    this.observer = new MutationObserver(this.boundVisibility);
    if (this.editor) this.observer.observe(this.editor, { attributes: true, attributeFilter: ['class'] });
    this.boundVisibility();
    this.selectMode('search');
    this.unsubscribeRuntime = runtime?.subscribe(() => {
      for (const card of this.grid.querySelectorAll<HTMLElement>('.plugin-card')) {
        const lifecycle = card.querySelector<HTMLElement>('.plugin-lifecycle');
        if (lifecycle) lifecycle.textContent = this.lifecycleText(card.dataset.pluginId ?? '');
      }
    });
  }

  open(): void {
    if (this.destroyed || this.modal.isOpen) return;
    this.modal.setHeader({ title: text('title') });
    this.searchButton.textContent = text('search');
    this.manageButton.textContent = text('manage');
    const label = this.searchField.querySelector('label');
    if (label) label.textContent = text('query');
    this.modal.root.querySelector('.tiny-modal__close')?.setAttribute('aria-label', TextResources.get('buttons.close', 'Close'));
    this.trust.textContent = text('trust');
    this.modal.open();
    this.selectMode('search');
  }

  close(): void {
    this.query.value = '';
    this.cancelImport();
    this.cancelSearch();
    this.results = [];
    this.grid.replaceChildren();
    this.modal.close();
  }

  private cancelInstall(): void {
    this.installController?.abort();
    this.installController = null;
  }

  private cancelSearch(): void {
    this.cancelInstall();
    clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
  }

  private selectMode(mode: Mode): void {
    this.cancelImport();
    this.cancelSearch();
    if (this.mode !== mode) {
      this.query.value = '';
      this.results = [];
    }
    this.mode = mode;
    this.searchButton.setAttribute('aria-pressed', String(mode === 'search'));
    this.manageButton.setAttribute('aria-pressed', String(mode === 'manage'));
    this.body.querySelector('section')?.setAttribute('aria-labelledby', `plugins-${mode}`);
    this.searchField.hidden = mode !== 'search';
    this.modal.setFooter(mode === 'search' ? [{
      id: 'plugins-import', label: text('import'), onClick: () => { this.cancelInstall(); this.render(); this.fileInput.click(); },
    }] : []);
    if (mode === 'search') this.scheduleSearch();
    else {
      this.catalog = [];
      this.lookupError = false;
      this.render();
      void this.loadCatalog();
    }
  }

  private async loadCatalog(): Promise<void> {
    const generation = this.generation;
    try {
      const entries = await this.lookup();
      if (generation !== this.generation) return;
      this.catalog = entries;
      this.refreshActions();
    } catch {
      if (generation !== this.generation) return;
      this.lookupError = true;
      this.status.textContent = text('lookupError');
    }
  }

  private catalogEntry(id: string): CatalogEntry | undefined {
    return (this.mode === 'manage' ? this.catalog : this.results).find(entry => entry.id === id);
  }

  private actions(id: string): HTMLButtonElement[] {
    const installed = this.manager.installed.find(record => record.id === id);
    const update = installed && hasPluginUpdate(installed.version, this.catalogEntry(id)?.version);
    const names = this.mode === 'manage' ? [...(update ? ['update'] : []), 'remove'] : [!installed ? 'install' : update ? 'update' : 'installed'];
    return names.map(name => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-secondary plugin-action';
      button.dataset.action = name;
      button.textContent = text(name);
      button.disabled = name === 'installed' || this.installController !== null;
      return button;
    });
  }

  private refreshActions(): void {
    for (const card of this.grid.querySelectorAll<HTMLElement>('.plugin-card')) {
      const focused = card.contains(document.activeElement) && document.activeElement?.classList.contains('plugin-action');
      const action = (document.activeElement as HTMLElement | null)?.dataset.action;
      card.querySelectorAll('.plugin-action').forEach(button => button.remove());
      const buttons = this.actions(card.dataset.pluginId ?? '');
      card.append(...buttons);
      const lifecycle = card.querySelector('.plugin-lifecycle');
      if (lifecycle) lifecycle.textContent = this.lifecycleText(card.dataset.pluginId ?? '');
      if (focused) (buttons.find(button => button.dataset.action === action && !button.disabled) ?? buttons.find(button => !button.disabled) ?? card.querySelector<HTMLButtonElement>('.plugin-read-more'))?.focus();
    }
  }

  private scheduleSearch(): void {
    this.cancelSearch();
    this.results = [];
    this.render();
    const query = this.query.value.trim();
    this.status.textContent = query && query.length < 3 ? text('prompt') : '';
    if ((query && query.length < 3) || !this.modal.isOpen || this.mode !== 'search' || this.destroyed) return;
    const generation = this.generation;
    const runSearch = async () => {
      this.timer = undefined;
      this.status.textContent = text('loading');
      try {
        const results = await this.search(query);
        if (generation !== this.generation) return;
        this.results = results;
        this.render();
      } catch {
        if (generation !== this.generation) return;
        this.status.textContent = text('searchError');
      }
    };
    if (query) this.timer = setTimeout(() => { void runSearch(); }, 800);
    else void runSearch();
  }

  private render(): void {
    const records = this.mode === 'manage' ? this.manager.installed : this.results;
    this.grid.replaceChildren(...records.map(record => this.renderCard(record)));
    this.status.textContent = this.mode === 'manage' && this.lookupError ? text('lookupError') : records.length ? '' : text(this.mode === 'manage' ? 'empty' : 'noResults');
    this.storageStatus.textContent = this.manager.storageError ? text('storageError') : '';
  }

  private cancelImport(): void {
    if (this.reader) {
      this.reader.onload = null;
      this.reader.onerror = null;
      this.reader.abort();
      this.reader = null;
    }
    this.fileInput.value = '';
  }

  private importFile(): void {
    const file = this.fileInput.files?.item(0);
    if (!file) return;
    this.cancelImport();
    this.cancelSearch();
    if (!/\.html?$/i.test(file.name)) {
      this.status.textContent = text('importError');
      return;
    }
    const reader = new FileReader();
    this.reader = reader;
    reader.onerror = () => {
      this.status.textContent = text('importError');
      this.cancelImport();
    };
    reader.onload = () => {
      try {
        const plugin = parsePluginHtml(String(reader.result));
        if (this.manager.install(plugin)) {
          this.selectMode('manage');
          this.manageButton.focus();
        } else {
          if (this.manager.lastError === 'validation') this.status.textContent = text('importError');
          else this.storageStatus.textContent = text('storageError');
        }
      } catch {
        this.status.textContent = text('importError');
      }
      this.cancelImport();
    };
    reader.readAsText(file);
  }

  private renderCard(plugin: PluginMetadata): HTMLElement {
    const card = document.createElement('article');
    card.className = 'plugin-card';
    card.dataset.pluginId = plugin.id;
    const title = document.createElement('h3');
    title.textContent = plugin.title;
    const capabilities = document.createElement('span');
    capabilities.className = 'plugin-capabilities';
    capabilities.textContent = (plugin.capabilities ?? ['editor']).join(' + ');
    const summary = document.createElement('p');
    summary.className = 'plugin-summary';
    summary.textContent = plugin.shortDescription;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'plugin-read-more';
    more.textContent = text('readMore');
    more.setAttribute('aria-expanded', 'false');
    const description = document.createElement('p');
    description.className = 'plugin-description';
    description.id = `plugin-description-${++this.cardSequence}`;
    description.hidden = true;
    description.textContent = plugin.fullDescription;
    more.setAttribute('aria-controls', description.id);
    const lifecycle = document.createElement('p');
    lifecycle.className = 'plugin-lifecycle';
    lifecycle.textContent = this.lifecycleText(plugin.id);
    card.append(title, capabilities, summary, lifecycle, more, description, ...this.actions(plugin.id));
    return card;
  }

  private lifecycleText(id: string): string {
    const state = this.runtime?.getState(id);
    if (!this.manager.has(id)) return text('available');
    return state ? `${text(state.status)}${state.error ? ': ' + state.error : ''}` : text('inert');
  }

  private handleClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.mode) { this.selectMode(button.dataset.mode as Mode); return; }
    const card = button.closest<HTMLElement>('.plugin-card');
    if (!card) return;
    if (button.classList.contains('plugin-read-more')) {
      const description = card.querySelector<HTMLElement>('.plugin-description');
      if (!description) return;
      description.hidden = !description.hidden;
      button.setAttribute('aria-expanded', String(!description.hidden));
      return;
    }
    if (!button.classList.contains('plugin-action') || button.disabled) return;
    const id = card.dataset.pluginId;
    if (!id) return;
    if (button.dataset.action === 'remove') this.manager.remove(id);
    else {
      const plugin = this.catalogEntry(id);
      if (plugin) void this.install(plugin, button);
      return;
    }
    const index = Array.from(this.grid.children).indexOf(card);
    this.render();
    const replacement = this.grid.children.item(Math.min(index, this.grid.children.length - 1));
    const focusTarget = replacement?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    (focusTarget ?? this.manageButton).focus();
  }

  private async install(plugin: CatalogEntry, button: HTMLButtonElement): Promise<void> {
    const installed = this.manager.installed.find(record => record.id === plugin.id);
    if (this.installController || (installed && !hasPluginUpdate(installed.version, plugin.version))) return;
    const controller = new AbortController();
    this.installController = controller;
    this.status.textContent = '';
    this.storageStatus.textContent = '';
    const focused = document.activeElement === button;
    const card = button.closest('.plugin-card');
    for (const action of this.grid.querySelectorAll<HTMLButtonElement>('.plugin-action')) action.disabled = true;
    button.textContent = text(installed ? 'updating' : 'installing');
    const generation = this.generation;
    const current = () => this.installController === controller && generation === this.generation && !controller.signal.aborted;
    try {
      const downloaded = await this.download(plugin, controller.signal);
      if (!current()) return;
      if (!this.manager.install(downloaded)) {
        if (this.manager.lastError === 'storage') this.storageStatus.textContent = text('storageError');
        else this.status.textContent = text('downloadError');
      }
    } catch {
      if (!current()) return;
      this.status.textContent = text('downloadError');
    } finally {
      if (current()) {
        this.installController = null;
        this.refreshActions();
        if (focused && document.activeElement === document.body) {
          (card?.querySelector<HTMLButtonElement>('.plugin-action:not(:disabled)') ?? card?.querySelector<HTMLButtonElement>('.plugin-read-more'))?.focus();
        }
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribeRuntime?.();
    this.close();
    this.observer.disconnect();
    this.button?.removeEventListener('click', this.boundOpen);
    this.query.removeEventListener('input', this.boundInput);
    this.fileInput.removeEventListener('change', this.boundImport);
    this.body.removeEventListener('click', this.boundClick);
    this.modal.remove();
  }
}
