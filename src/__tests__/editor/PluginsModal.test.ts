import html from '../../../index.html?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginsModal } from '../../editor/modules/PluginsModal';
import { PluginManager, type PluginMetadata } from '../../editor/manager/PluginManager';
import { TextResources } from '../../runtime/adapters/TextResources';

const plugin = { id: 'test', title: '<img src=x onerror=alert(1)>', shortDescription: 'Short', fullDescription: 'Full description' };
let modal: PluginsModal;
let manager: PluginManager;
let search: ReturnType<typeof vi.fn<(query: string) => Promise<PluginMetadata[]>>>;
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
  beforeEach(() => {
    vi.useFakeTimers();
    TextResources.setLocale('en-US', { silent: true });
    localStorage.clear();
    document.body.innerHTML = html;
    element('#tab-editor').classList.add('active');
    manager = new PluginManager();
    search = vi.fn(() => Promise.resolve([plugin]));
    modal = new PluginsModal(manager, search);
    click('#btn-plugins');
  });
  afterEach(() => { modal.destroy(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
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
    await vi.advanceTimersByTimeAsync(1999);
    expect(search).not.toHaveBeenCalled();
    input(' abcd ');
    await vi.advanceTimersByTimeAsync(1999);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledWith('abcd');
  });
  it('renders safe cards, expands details, installs and removes persisted records', async () => {
    input('test'); await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector('.plugin-card img')).toBeNull();
    expect(document.querySelector('.plugin-card h3')?.textContent).toBe(plugin.title);
    click('.plugin-read-more');
    expect(document.querySelector('.plugin-read-more')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLElement>('.plugin-description')?.hidden).toBe(false);
    click('.plugin-action');
    expect(document.querySelector<HTMLButtonElement>('.plugin-action')?.disabled).toBe(true);
    expect(new PluginManager().installed).toEqual([plugin]);
    click('#plugins-manage'); click('.plugin-action');
    expect(new PluginManager().installed).toEqual([]);
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(0);
    click('#plugins-search'); await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector<HTMLButtonElement>('.plugin-action')?.disabled).toBe(false);
  });
  it.each(['short', 'manage', 'close', 'escape', 'backdrop', 'destroy'])('invalidates pending requests and timers on %s', async action => {
    let resolve!: (value: PluginMetadata[]) => void;
    search.mockImplementation(() => new Promise(done => { resolve = done; }));
    input('test'); await vi.advanceTimersByTimeAsync(2000);
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
    input('first'); await vi.advanceTimersByTimeAsync(2000);
    expect(document.getElementById('plugins-status')?.textContent).toContain('Searching');
    input('second'); search.mockResolvedValueOnce([]);
    await vi.advanceTimersByTimeAsync(2000);
    reject(new Error('stale')); await Promise.resolve();
    expect(document.getElementById('plugins-status')?.textContent).toContain('No plugins found');
    search.mockRejectedValueOnce(new Error('failed'));
    input('third'); await vi.advanceTimersByTimeAsync(2000);
    expect(document.getElementById('plugins-status')?.textContent).toContain('Search failed');
    input('retry'); await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelectorAll('.plugin-card')).toHaveLength(1);
  });
  it('cancels waiting searches and reschedules on reopening, restoring focus', async () => {
    modal.close(); element('#btn-plugins').focus(); modal.open();
    input('test'); await vi.advanceTimersByTimeAsync(1000); modal.close();
    expect(document.activeElement?.id).toBe('btn-plugins');
    await vi.advanceTimersByTimeAsync(3000); expect(search).not.toHaveBeenCalled();
    modal.open(); await vi.advanceTimersByTimeAsync(2000); expect(search).toHaveBeenCalledOnce();
  });
  it('reports storage failures without claiming installation succeeded', async () => {
    input('test'); await vi.advanceTimersByTimeAsync(2000);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    click('.plugin-action');
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
    await vi.waitFor(() => expect(manager.installed).toEqual([plugin]));
    expect(new PluginManager().installed).toEqual([plugin]);
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
  it('restores Manage without searching and exposes the selected mode', () => {
    modal.destroy();
    manager.install(plugin);
    modal = new PluginsModal(new PluginManager(), search);
    modal.open(); click('#plugins-manage');
    expect(search).not.toHaveBeenCalled();
    expect(element('#plugins-manage').getAttribute('aria-pressed')).toBe('true');
    expect(element('#plugins-search').getAttribute('aria-pressed')).toBe('false');
    expect(element('.plugin-card h3').textContent).toBe(plugin.title);
  });
  it.each(['short', 'manage', 'close', 'destroy'])('cancels the debounce timer on %s', async action => {
    input('test'); await vi.advanceTimersByTimeAsync(1000);
    if (action === 'short') input('a');
    if (action === 'manage') click('#plugins-manage');
    if (action === 'close') modal.close();
    if (action === 'destroy') modal.destroy();
    await vi.advanceTimersByTimeAsync(3000);
    expect(search).not.toHaveBeenCalled();
  });
  it('keeps the latest response when older results arrive last', async () => {
    let resolve!: (value: PluginMetadata[]) => void;
    search.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    input('older'); await vi.advanceTimersByTimeAsync(2000);
    input('newer'); await vi.advanceTimersByTimeAsync(2000);
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
