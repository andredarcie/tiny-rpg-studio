import html from '../../../index.html?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRuntime } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { PluginsModal } from '../../editor/modules/PluginsModal';
import { PluginManager } from '../../editor/manager/PluginManager';
import { type CatalogEntry, type downloadPlugin } from '../../editor/manager/pluginCatalog';
import { TextResources } from '../../runtime/adapters/TextResources';

const metadata = { id: 'test', title: '<img src=x onerror=alert(1)>', shortDescription: 'Short', fullDescription: 'Full description' };
const plugin = { ...metadata, version: '1.0.0', file: 'test/1.0.0/plugin.html' };
const installed = { version: '1.0.0', id: plugin.id, title: plugin.title, shortDescription: plugin.shortDescription, fullDescription: plugin.fullDescription, payload: { apiVersion: 1 as const, javascript: 'export function activate() {}' } };
let download: ReturnType<typeof vi.fn<typeof downloadPlugin>>;
let lookup: ReturnType<typeof vi.fn<() => Promise<CatalogEntry[]>>>;
let modal: PluginsModal;
let manager: PluginManager;
let search: ReturnType<typeof vi.fn<(query: string) => Promise<CatalogEntry[]>>>;
function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
const click = (selector: string) => element<HTMLButtonElement>(selector).click();
const input = (value: string) => {
  const field = element<HTMLInputElement>('#plugins-query');
  field.value = value;
  field.dispatchEvent(new Event('input'));
};
describe('PluginsModal', () => {
  const selectFile = (source: string, name = 'plugin.html') => {
    const field = element<HTMLInputElement>('#plugins-file');
    Object.defineProperty(field, 'files', { configurable: true, value: { item: () => new File([source], name, { type: 'text/html' }) } });
    field.dispatchEvent(new Event('change'));
  };
  beforeEach(async () => {
    vi.useFakeTimers();
    TextResources.setLocale('en-US', { silent: true });
    localStorage.clear();
    document.body.innerHTML = html;
    element('#tab-editor').classList.add('active');
    manager = new PluginManager();
    search = vi.fn(() => Promise.resolve([plugin]));
    download = vi.fn().mockResolvedValue(installed);
    lookup = vi.fn().mockResolvedValue([plugin]);
    modal = new PluginsModal(manager, search, undefined, download, lookup);
    click('#btn-plugins');
    await Promise.resolve();
    search.mockClear();
  });
  afterEach(() => { modal.destroy(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
  it.each([
    [undefined, '1.0.0', true], ['preview', '1.0.0', true],
    ['1.0.0', '1.0.0', false], ['1.0.10', '1.0.2', false],
    ['1.0.2', '1.0.10', true], ['0.9.0', '1.0.0-beta', false],
  ])('renders update eligibility for installed %s and available %s', async (version, available, eligible) => {
    manager.install({ ...installed, version });
    const entry = { ...plugin, version: available };
    search.mockResolvedValue([entry]); lookup.mockResolvedValue([entry]);
    click('#plugins-search'); await vi.advanceTimersByTimeAsync(0);
    expect(element('.plugin-action').dataset.action).toBe(eligible ? 'update' : 'installed');
    expect(element<HTMLButtonElement>('.plugin-action').disabled).toBe(!eligible);
    click('#plugins-manage'); await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelectorAll('[data-action="update"]')).toHaveLength(eligible ? 1 : 0);
    expect(element<HTMLButtonElement>('[data-action="remove"]').disabled).toBe(false);
  });
  it.each(['search', 'manage'])('updates from %s and refreshes persisted actions', async mode => {
    manager.install({ ...installed, version: '0.9.0' });
    click(`#plugins-${mode}`); await vi.advanceTimersByTimeAsync(0);
    const update = element<HTMLButtonElement>('[data-action="update"]');
    update.focus(); update.click(); update.click();
    expect(update.textContent).toBe('Updating…');
    await vi.advanceTimersByTimeAsync(0);
    expect(download).toHaveBeenCalledOnce();
    expect(new PluginManager().installed).toEqual([installed]);
    expect(document.activeElement?.isConnected).toBe(true);
    click('#plugins-search'); await vi.advanceTimersByTimeAsync(0);
    expect(element<HTMLButtonElement>('[data-action="installed"]').disabled).toBe(true);
    click('#plugins-manage'); await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('[data-action="update"]')).toBeNull();
    expect(element('[data-action="remove"]')).toBeTruthy();
  });
  it('keeps Manage removable during failed lookup and retries on re-entry', async () => {
    manager.install(installed);
    lookup.mockRejectedValueOnce(Error('offline'));
    click('#plugins-manage'); await vi.advanceTimersByTimeAsync(0);
    expect(element('#plugins-status').textContent).toContain('Could not check');
    expect(element<HTMLButtonElement>('[data-action="remove"]').disabled).toBe(false);
    click('#plugins-search'); click('#plugins-manage'); await vi.advanceTimersByTimeAsync(0);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it.each(['search', 'manage'])('preserves the old package on update failures in %s and retries', async mode => {
    const old = { ...installed, version: '0.9.0' };
    manager.install(old);
    click(`#plugins-${mode}`); await vi.advanceTimersByTimeAsync(0);
    download.mockRejectedValueOnce(Error('offline'));
    click('[data-action="update"]'); await vi.advanceTimersByTimeAsync(0);
    expect(manager.installed).toEqual([old]);
    expect(element('#plugins-status').textContent).toContain('Could not download');
    expect(element<HTMLButtonElement>('[data-action="update"]').disabled).toBe(false);
    download.mockResolvedValueOnce({ ...installed, payload: { apiVersion: 2, javascript: '' } } as unknown as typeof installed);
    click('[data-action="update"]'); await vi.advanceTimersByTimeAsync(0);
    expect(manager.installed).toEqual([old]);
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    click('[data-action="update"]'); await vi.advanceTimersByTimeAsync(0);
    expect(manager.installed).toEqual([old]);
    expect(element('#plugins-storage-error').textContent).not.toBe('');
    storage.mockRestore();
    click('[data-action="update"]'); await vi.advanceTimersByTimeAsync(0);
    expect(new PluginManager().installed).toEqual([installed]);
  });
  it('discovers updates in Manage before Search resolves and preserves Remove focus', async () => {
    manager.install({ ...installed, version: '0.9.0' });
    search.mockImplementationOnce(() => new Promise(() => {}));
    click('#plugins-search');
    let resolve!: (entries: CatalogEntry[]) => void;
    lookup.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    click('#plugins-manage');
    element('[data-action="remove"]').focus();
    expect(document.querySelector('[data-action="update"]')).toBeNull();
    resolve([plugin]); await vi.advanceTimersByTimeAsync(0);
    expect(element<HTMLButtonElement>('[data-action="update"]').disabled).toBe(false);
    expect((document.activeElement as HTMLElement).dataset.action).toBe('remove');
  });
  it.each(['search', 'close', 'editor', 'destroy'])('ignores obsolete Manage lookup after %s', async action => {
    manager.install({ ...installed, version: '0.9.0' });
    let resolve!: (entries: CatalogEntry[]) => void;
    lookup.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    click('#plugins-manage');
    if (action === 'search') { search.mockResolvedValue([]); click('#plugins-search'); }
    if (action === 'close') modal.close();
    if (action === 'editor') element('#tab-editor').classList.remove('active');
    if (action === 'destroy') modal.destroy();
    await vi.advanceTimersByTimeAsync(0);
    resolve([plugin]); await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('[data-action="update"]')).toBeNull();
  });
  it.each(['query', 'search', 'manage', 'close', 'editor', 'destroy'])('cancels updates on %s without replacing the old package', async action => {
    const old = { ...installed, version: '0.9.0' };
    manager.install(old);
    click(action === 'search' ? '#plugins-manage' : '#plugins-search');
    await vi.advanceTimersByTimeAsync(0);
    let resolve!: (record: typeof installed) => void;
    download.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    click('[data-action="update"]');
    expect(Array.from(document.querySelectorAll<HTMLButtonElement>('.plugin-action')).every(button => button.disabled)).toBe(true);
    if (action === 'query') input('other');
    if (action === 'search' || action === 'manage') click(`#plugins-${action}`);
    if (action === 'close') modal.close();
    if (action === 'editor') element('#tab-editor').classList.remove('active');
    if (action === 'destroy') modal.destroy();
    await vi.advanceTimersByTimeAsync(0);
    expect(download.mock.calls[0][1].aborted).toBe(true);
    resolve(installed); await vi.advanceTimersByTimeAsync(0);
    expect(new PluginManager().installed).toEqual([old]);
  });
  it('loads default listings immediately on open and when clearing the query', async () => {
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(1);
    expect(download).not.toHaveBeenCalled();
    input('test'); await vi.advanceTimersByTimeAsync(800);
    input('');
    expect(search).toHaveBeenLastCalledWith('');
    await Promise.resolve();
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(1);
    modal.close(); search.mockClear(); modal.open();
    expect(search).toHaveBeenCalledExactlyOnceWith('');
  });
  it('ignores a default listing that resolves after a query change', async () => {
    let resolve!: (entries: CatalogEntry[]) => void;
    search.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    input(''); input('test');
    await vi.advanceTimersByTimeAsync(800);
    resolve([{ ...plugin, title: 'Stale default' }]); await Promise.resolve();
    expect(element('.plugin-card h3').textContent).toBe(plugin.title);
  });
  it('omits the trust paragraph, labels previews and shows activation errors separately', async () => {
    expect(document.querySelector('#plugins-trust')).toBeNull();
    manager.install(plugin);
    click('#plugins-manage');
    expect(element('.plugin-lifecycle').textContent).toBe('Inert preview');
    modal.destroy();
    const runtime = new PluginRuntime(manager, () => Promise.reject(Error('module failed')));
    modal = new PluginsModal(manager, search, runtime, download, lookup);
    modal.open();
    manager.install({ ...plugin, payload: { apiVersion: 1, javascript: 'broken' } });
    runtime.start(element('#tab-editor'), {} as TinyRpgApi);
    click('#plugins-manage');
    await runtime.settled();
    expect(element('.plugin-lifecycle').textContent).toContain('module failed');
    expect(element('#plugins-storage-error').textContent).toBe('');
    await runtime.destroy();
  });
  it.each(['query', 'manage', 'close', 'destroy', 'import'])('cancels pending downloads on %s and ignores late success', async action => {
    let resolve!: (value: Awaited<ReturnType<typeof downloadPlugin>>) => void;
    download.mockImplementation(() => new Promise(done => { resolve = done; }));
    input('test'); await vi.advanceTimersByTimeAsync(800);
    click('.plugin-action'); click('.plugin-action');
    expect(download).toHaveBeenCalledOnce();
    expect(element<HTMLButtonElement>('.plugin-action').disabled).toBe(true);
    expect(element('.plugin-action').textContent).toBe('Installing…');
    const signal = download.mock.calls[0][1] as AbortSignal;
    if (action === 'query') input('other');
    if (action === 'manage') click('#plugins-manage');
    if (action === 'close') modal.close();
    if (action === 'destroy') modal.destroy();
    if (action === 'import') click('#plugins-import');
    expect(signal.aborted).toBe(true);
    resolve(installed); await vi.advanceTimersByTimeAsync(0);
    expect(manager.installed).toEqual([]);
  });
  it('ignores cancelled download errors without stealing focus', async () => {
    let reject!: (reason: Error) => void;
    download.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    input('test'); await vi.advanceTimersByTimeAsync(800);
    click('.plugin-action');
    input('other'); element('#plugins-query').focus();
    reject(Error('late failure')); await vi.advanceTimersByTimeAsync(0);
    expect(element('#plugins-status').textContent).toBe('');
    expect(document.activeElement?.id).toBe('plugins-query');
    expect(manager.installed).toEqual([]);
  });
  it('reports download failure separately and allows retry', async () => {
    download.mockRejectedValueOnce(Error('offline'));
    input('test'); await vi.advanceTimersByTimeAsync(800);
    expect(download).not.toHaveBeenCalled();
    expect(element('.plugin-lifecycle').textContent).toBe('Available');
    click('.plugin-action'); await vi.advanceTimersByTimeAsync(0);
    expect(element('#plugins-status').textContent).toContain('Could not download');
    expect(element('#plugins-storage-error').textContent).toBe('');
    click('.plugin-action'); await vi.advanceTimersByTimeAsync(0);
    expect(manager.installed).toEqual([installed]);
  });
  it('places the button between Load and Updates and hides it outside Editor', async () => {
    const button = element('#btn-plugins');
    expect(button.previousElementSibling?.classList.contains('history-dropdown-wrapper')).toBe(true);
    expect(button.nextElementSibling?.id).toBe('btn-devlog');
    element('#tab-editor').classList.remove('active');
    await Promise.resolve();
    expect(button.style.display).toBe('none');
  });
  it('debounces trimmed queries and resets the timer on every edit', async () => {
    input(' ab ');
    await vi.advanceTimersByTimeAsync(3000);
    expect(search).not.toHaveBeenCalled();
    input(' abc ');
    await vi.advanceTimersByTimeAsync(799);
    expect(search).not.toHaveBeenCalled();
    input(' abcd ');
    await vi.advanceTimersByTimeAsync(799);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledWith('abcd');
  });
  it('renders safe cards, expands details, installs and removes persisted records', async () => {
    input('test'); await vi.advanceTimersByTimeAsync(800);
    expect(document.querySelector('.plugin-card img')).toBeNull();
    expect(document.querySelector('.plugin-card h3')?.textContent).toBe(plugin.title);
    click('.plugin-read-more');
    expect(document.querySelector('.plugin-read-more')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLElement>('.plugin-description')?.hidden).toBe(false);
    click('.plugin-action');
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector<HTMLButtonElement>('.plugin-action')?.disabled).toBe(true);
    expect(new PluginManager().installed).toEqual([installed]);
    click('#plugins-manage'); click('.plugin-action');
    await vi.advanceTimersByTimeAsync(0);
    expect(new PluginManager().installed).toEqual([]);
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(0);
    click('#plugins-search');
    expect(element<HTMLInputElement>('#plugins-query').value).toBe('');
    input('test'); await vi.advanceTimersByTimeAsync(800);
    expect(document.querySelector<HTMLButtonElement>('.plugin-action')?.disabled).toBe(false);
  });
  it.each(['short', 'manage', 'close', 'escape', 'backdrop', 'destroy'])('invalidates pending requests and timers on %s', async action => {
    let resolve!: (value: CatalogEntry[]) => void;
    search.mockImplementation(() => new Promise(done => { resolve = done; }));
    input('test'); await vi.advanceTimersByTimeAsync(800);
    if (action === 'short') input('a');
    if (action === 'manage') click('#plugins-manage');
    if (action === 'close') click('#plugins-modal .tiny-modal__close');
    if (action === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    if (action === 'backdrop') click('#plugins-modal');
    if (action === 'destroy') modal.destroy();
    resolve([plugin]); await Promise.resolve();
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(search).toHaveBeenCalledTimes(1);
  });
  it('ignores stale errors and responses, showing loading, empty and recoverable errors', async () => {
    let reject!: (error: Error) => void;
    search.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    input('first'); await vi.advanceTimersByTimeAsync(800);
    expect(document.getElementById('plugins-status')?.textContent).toContain('Searching');
    input('second'); search.mockResolvedValueOnce([]);
    await vi.advanceTimersByTimeAsync(800);
    reject(new Error('stale')); await Promise.resolve();
    expect(document.getElementById('plugins-status')?.textContent).toContain('No plugins found');
    search.mockRejectedValueOnce(new Error('failed'));
    input('third'); await vi.advanceTimersByTimeAsync(800);
    expect(document.getElementById('plugins-status')?.textContent).toContain('Search failed');
    input('retry'); await vi.advanceTimersByTimeAsync(800);
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(1);
  });
  it('clears the query and cancels waiting searches on close, restoring focus', async () => {
    modal.close(); element('#btn-plugins').focus(); modal.open();
    search.mockClear();
    input('test'); await vi.advanceTimersByTimeAsync(400); modal.close();
    expect(document.activeElement?.id).toBe('btn-plugins');
    await vi.advanceTimersByTimeAsync(3000); expect(search).not.toHaveBeenCalled();
    modal.open();
    expect(element<HTMLInputElement>('#plugins-query').value).toBe('');
    await vi.advanceTimersByTimeAsync(800); expect(search).toHaveBeenCalledWith('');
  });
  it('clears the query on mode changes and when leaving the Editor tab', async () => {
    input('test');
    click('#plugins-manage'); click('#plugins-search');
    expect(element<HTMLInputElement>('#plugins-query').value).toBe('');
    await vi.advanceTimersByTimeAsync(800);
    expect(search).toHaveBeenCalledWith('');
    input('test');
    element('#tab-editor').classList.remove('active');
    await Promise.resolve();
    expect(element<HTMLInputElement>('#plugins-query').value).toBe('');
  });
  it('reports storage failures without claiming installation succeeded', async () => {
    input('test'); await vi.advanceTimersByTimeAsync(800);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    click('.plugin-action');
    await vi.advanceTimersByTimeAsync(0);
    expect(document.getElementById('plugins-storage-error')?.textContent).toContain('storage');
    expect(document.querySelector<HTMLButtonElement>('.plugin-action')?.disabled).toBe(false);
  });
  it('omits the removed help text and shows Import only in Search', () => {
    expect(document.querySelector('#plugins-modal .tiny-modal__desc')).toBeNull();
    input('eligible');
    expect(element('#plugins-status').textContent).toBe('');
    expect(element('#plugins-import').closest('.tiny-modal__footer')).not.toBeNull();
    const picker = vi.spyOn(element<HTMLInputElement>('#plugins-file'), 'click');
    click('#plugins-import'); expect(picker).toHaveBeenCalledOnce();
    click('#plugins-manage'); expect(document.getElementById('plugins-import')).toBeNull();
  });
  it('imports HTML metadata, opens Manage, and persists the listing', async () => {
    vi.useRealTimers();
    selectFile(`<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify(plugin)}</script>`);
    await vi.waitFor(() => expect(manager.installed).toEqual([{ ...metadata, version: plugin.version }]));
    expect(new PluginManager().installed).toEqual([{ ...metadata, version: plugin.version }]);
    expect(element('#plugins-manage').getAttribute('aria-pressed')).toBe('true');
    expect(element('.plugin-card h3').textContent).toBe(plugin.title);
  });
  it('reports malformed files without installing anything', async () => {
    vi.useRealTimers();
    selectFile('<html>No manifest</html>');
    await vi.waitFor(() => expect(element('#plugins-status').textContent).toContain('Could not import'));
    expect(manager.installed).toEqual([]);
  });
  it('reports a failed import write without changing installed metadata', async () => {
    vi.useRealTimers();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    selectFile(`<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify(plugin)}</script>`);
    await vi.waitFor(() => expect(element('#plugins-storage-error').textContent).toContain('storage'));
    expect(manager.installed).toEqual([]);
  });
  it('aborts a pending file read on close', () => {
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(() => {});
    const abort = vi.spyOn(FileReader.prototype, 'abort');
    selectFile('pending'); modal.close();
    expect(abort).toHaveBeenCalledOnce();
    expect(manager.installed).toEqual([]);
  });
  it('switches to Manage without another search and exposes the selected mode', () => {
    modal.destroy();
    manager.install(plugin);
    modal = new PluginsModal(new PluginManager(), search, undefined, download, lookup);
    modal.open(); search.mockClear(); click('#plugins-manage');
    expect(search).not.toHaveBeenCalled();
    expect(element('#plugins-manage').getAttribute('aria-pressed')).toBe('true');
    expect(element('#plugins-search').getAttribute('aria-pressed')).toBe('false');
    expect(element('.plugin-card h3').textContent).toBe(plugin.title);
  });
  it.each(['short', 'manage', 'close', 'destroy'])('cancels the debounce timer on %s', async action => {
    input('test'); await vi.advanceTimersByTimeAsync(400);
    if (action === 'short') input('a');
    if (action === 'manage') click('#plugins-manage');
    if (action === 'close') modal.close();
    if (action === 'destroy') modal.destroy();
    await vi.advanceTimersByTimeAsync(3000);
    expect(search).not.toHaveBeenCalled();
  });
  it('keeps the latest response when older results arrive last', async () => {
    let resolve!: (value: CatalogEntry[]) => void;
    search.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    input('older'); await vi.advanceTimersByTimeAsync(800);
    input('newer'); await vi.advanceTimersByTimeAsync(800);
    resolve([{ ...plugin, title: 'Stale title' }]); await Promise.resolve();
    expect(element('.plugin-card h3').textContent).toBe(plugin.title);
    input('edit'); expect(document.querySelectorAll('.plugin-card')).toHaveLength(0);
  });
  it('uses the current language when reopened after a locale change', () => {
    modal.close();
    TextResources.setLocale('pt-BR', { silent: true });
    modal.open();
    expect(element('#plugins-search').textContent).toBe('Buscar');
    expect(element<HTMLInputElement>('#plugins-query').labels?.[0]?.textContent).toBe('Buscar plugins');
  });
});
