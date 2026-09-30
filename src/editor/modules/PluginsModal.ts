import { TextResources } from '../../runtime/adapters/TextResources';
import { Modal } from '../../ui/Modal';
import type { PluginManager, PluginMetadata } from '../manager/PluginManager';
import { parsePluginHtml } from '../manager/PluginManager';
import { searchPlugins, downloadPlugin, listPlugins, hasPluginUpdate, type CatalogEntry } from '../manager/pluginCatalog';
import { CustomSources, type CustomEntry } from '../manager/customSources';

import type { PluginRuntime } from '../manager/PluginRuntime';

type Search = (query: string) => Promise<CatalogEntry[]>;
type Mode = 'search' | 'manage' | 'sources';
type Entry = CatalogEntry | CustomEntry;
const text = (key: string) => TextResources.get(`plugins.${key}`);

export class PluginsModal {
  private runtime?: PluginRuntime;
  private modal: Modal;
  private unsubscribeRuntime?: () => void;
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
  private sources = new CustomSources();
  private unsubscribeSources?: () => void;
  private sourcesSection = document.createElement('section');
  private sourceInput = document.createElement('input');
  private sourceStatus = document.createElement('p');
  private sourceList = document.createElement('div');
  private addingSource = false;
  private sourceController: AbortController | null = null;
  private installEntry: Entry | null = null;
  private reader: FileReader | null = null;
  private boundImport = () => this.importFile();
  private boundSourceKey = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); void this.addSource(); } };
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
    this.body.append(navigation, content);
    this.sourcesSection.id = 'plugins-sources-content';
    this.sourcesSection.hidden = true;
    this.sourcesSection.className = 'plugins-sources';
    const sourceLabel = document.createElement('label');
    sourceLabel.htmlFor = 'plugins-source-url';
    sourceLabel.textContent = text('sourceUrl');
    this.sourceInput.id = 'plugins-source-url';
    this.sourceInput.type = 'url';
    this.sourceInput.required = true;
    const add = document.createElement('button');
    add.id = 'plugins-source-add'; add.type = 'button'; add.textContent = text('add');
    this.sourceStatus.id = 'plugins-source-status'; this.sourceStatus.setAttribute('role', 'status');
    this.sourceList.id = 'plugins-source-list';
    this.sourcesSection.append(sourceLabel, this.sourceInput, add, this.sourceStatus, this.sourceList);
    this.body.append(this.sourcesSection);
    this.fileInput.type = 'file';
    this.fileInput.accept = '.html,.htm,text/html';
    this.fileInput.id = 'plugins-file';
    this.fileInput.hidden = true;
    this.body.append(this.fileInput);
    this.fileInput.addEventListener('change', this.boundImport);
    this.sourceInput.addEventListener('keydown', this.boundSourceKey);
    this.modal.setBody(this.body);
    this.button?.addEventListener('click', this.boundOpen);
    this.query.addEventListener('input', this.boundInput);
    this.body.addEventListener('click', this.boundClick);
    this.observer = new MutationObserver(this.boundVisibility);
    if (this.editor) this.observer.observe(this.editor, { attributes: true, attributeFilter: ['class'] });
    this.boundVisibility();
    this.selectMode('search');
    this.unsubscribeSources = this.sources.subscribe(() => {
      if (this.destroyed) return;
      if (this.installEntry && 'sourceUrl' in this.installEntry && !this.sources.urls.includes(this.installEntry.sourceUrl)) this.cancelInstall();
      this.renderSources();
      if (this.modal.isOpen && this.mode !== 'sources') this.render();
    });
    void this.sources.load();
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
    const sourceLabel = this.sourcesSection.querySelector('label');
    if (sourceLabel) sourceLabel.textContent = text('sourceUrl');
    const sourceAdd = this.sourcesSection.querySelector<HTMLButtonElement>('#plugins-source-add');
    if (sourceAdd) sourceAdd.textContent = text('add');
    this.modal.root.querySelector('.tiny-modal__close')?.setAttribute('aria-label', TextResources.get('buttons.close', 'Close'));
    this.modal.open();
    this.selectMode('search');
  }

  close(): void {
    this.sourceController?.abort();
    this.sourceController = null;
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
    this.installEntry = null;
  }

  private cancelSearch(): void {
    this.cancelInstall();
    clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
  }

  private selectMode(mode: Mode): void {
    if (this.mode === 'sources' && mode !== 'sources') { this.sourceController?.abort(); this.sourceController = null; }
    this.cancelImport();
    this.cancelSearch();
    if (this.mode !== mode) {
      this.query.value = '';
      this.results = [];
    }
    this.mode = mode;
    this.searchButton.setAttribute('aria-pressed', String(mode === 'search'));
    this.manageButton.setAttribute('aria-pressed', String(mode === 'manage'));
    const content = this.body.querySelector<HTMLElement>('#plugins-content');
    if (!content) return;
    content.hidden = mode === 'sources';
    this.sourcesSection.hidden = mode !== 'sources';
    content.setAttribute('aria-labelledby', `plugins-${mode}`);
    this.searchField.hidden = mode !== 'search';
    this.modal.setFooter(mode === 'search' ? [{
      id: 'plugins-add-sources', label: text('addSources'), onClick: () => { this.selectMode('sources'); this.sourceInput.focus(); },
    }, {
      id: 'plugins-import', label: text('import'), onClick: () => { this.cancelInstall(); this.render(); this.fileInput.click(); },
    }] : mode === 'sources' ? [{ id: 'plugins-sources-back', label: text('back'), onClick: () => { this.selectMode('search'); this.query.focus(); } }] : []);
    if (mode === 'search') this.scheduleSearch();
    else if (mode === 'manage') {
      this.catalog = [];
      this.lookupError = false;
      this.render();
      void this.loadCatalog();
    } else this.renderSources();
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

  private entries(): Entry[] {
    const primary = this.mode === 'manage' ? this.catalog : this.results;
    const term = this.query.value.trim().toLowerCase();
    const custom = this.sources.entries.filter(entry => this.mode === 'manage' || (!term || [entry.title, entry.shortDescription, entry.fullDescription].some(value => value.toLowerCase().includes(term))));
    const ids = new Set(primary.map(entry => entry.id));
    return [...primary, ...custom.filter(entry => { if (ids.has(entry.id)) return false; ids.add(entry.id); return true; })];
  }

  private catalogEntry(id: string): Entry | undefined {
    return this.entries().find(entry => entry.id === id);
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
    if (this.mode === 'sources') return;
    const records = this.mode === 'manage' ? this.manager.installed : this.entries();
    this.grid.replaceChildren(...records.map(record => this.renderCard(record)));
    this.status.textContent = this.mode === 'manage' && this.lookupError ? text('lookupError') : records.length ? '' : text(this.mode === 'manage' ? 'empty' : 'noResults');
    if (this.sources.loading && !records.length) this.status.textContent = text('sourceLoading');
    this.storageStatus.textContent = this.manager.storageError ? text('storageError') : '';
    if (this.sources.discoveryError) this.status.textContent = text('sourceLoadError');
    if (this.sources.storageError) this.storageStatus.textContent = text('storageError');
  }

  private renderSources(): void {
    this.sourceList.replaceChildren(...this.sources.urls.map(url => {
      const row = document.createElement('div'); row.className = 'plugins-source-row';
      const label = document.createElement('span'); label.textContent = url;
      const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.sourceUrl = url; remove.textContent = text('remove');
      row.append(label, remove); return row;
    }));
    if (this.sources.storageError) this.sourceStatus.textContent = text('storageError');
  }

  private async addSource(): Promise<void> {
    if (this.addingSource || !this.sourceInput.value.trim()) return;
    this.addingSource = true;
    const controller = new AbortController();
    this.sourceController = controller;
    this.sourceStatus.textContent = text('sourceLoading');
    const button = this.sourcesSection.querySelector<HTMLButtonElement>('#plugins-source-add');
    if (!button) return;
    button.disabled = true;
    try {
      await this.sources.add(this.sourceInput.value, controller.signal);
      if (this.destroyed || controller.signal.aborted) return;
      this.sourceInput.value = '';
      this.sourceStatus.textContent = text('sourceAdded');
    } catch {
      if (!this.destroyed && !controller.signal.aborted) this.sourceStatus.textContent = this.sources.storageError ? text('storageError') : text('sourceError');
    } finally {
      if (this.sourceController === controller) this.sourceController = null;
      this.addingSource = false; button.disabled = false;
    }
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
    if (button.id === 'plugins-source-add') { void this.addSource(); return; }
    if (button.dataset.sourceUrl) {
      try { this.sources.remove(button.dataset.sourceUrl); this.sourceStatus.textContent = ''; }
      catch { this.sourceStatus.textContent = text('storageError'); }
      return;
    }
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

  private async install(plugin: Entry, button: HTMLButtonElement): Promise<void> {
    const installed = this.manager.installed.find(record => record.id === plugin.id);
    if (this.installController || (installed && !hasPluginUpdate(installed.version, plugin.version))) return;
    const controller = new AbortController();
    this.installController = controller;
    this.installEntry = plugin;
    this.status.textContent = '';
    this.storageStatus.textContent = '';
    const focused = document.activeElement === button;
    const card = button.closest('.plugin-card');
    for (const action of this.grid.querySelectorAll<HTMLButtonElement>('.plugin-action')) action.disabled = true;
    button.textContent = text(installed ? 'updating' : 'installing');
    const generation = this.generation;
    const current = () => this.installController === controller && generation === this.generation && !controller.signal.aborted;
    try {
      const downloaded = 'sourceUrl' in plugin ? await this.sources.download(plugin, controller.signal) : await this.download(plugin, controller.signal);
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
        this.installEntry = null;
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
    this.unsubscribeSources?.();
    this.close();
    this.observer.disconnect();
    this.button?.removeEventListener('click', this.boundOpen);
    this.query.removeEventListener('input', this.boundInput);
    this.fileInput.removeEventListener('change', this.boundImport);
    this.sourceInput.removeEventListener('keydown', this.boundSourceKey);
    this.body.removeEventListener('click', this.boundClick);
    this.modal.remove();
  }
}
