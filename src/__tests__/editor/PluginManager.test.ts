import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PluginManager, PLUGIN_STORAGE_KEY, parsePluginHtml } from '../../editor/manager/PluginManager';

const plugin = { id: 'retired', title: 'Old plugin', shortDescription: 'Short', fullDescription: 'Full' };
describe('PluginManager', () => {
  it('reads only validated metadata from HTML without executing or mounting it', () => {
    const source = `<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify(plugin)}</script><script>window.pluginExecuted = true</script><img id="plugin-image" src="https://example.invalid/image">`;
    expect(parsePluginHtml(source)).toEqual(plugin);
    expect(document.getElementById('plugin-image')).toBeNull();
    expect(Reflect.get(window, 'pluginExecuted')).toBeUndefined();
  });
  it.each(['<html></html>', '<script id="tiny-rpg-plugin" type="application/json">{</script>', '<script id="tiny-rpg-plugin" type="application/json">{ "id": "incomplete" }</script>'])('rejects invalid HTML manifests', source => {
    expect(() => parsePluginHtml(source)).toThrow();
  });
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it('persists deduplicated metadata, restores missing catalog entries, and removes them', () => {
    const manager = new PluginManager();
    expect(manager.install(plugin)).toBe(true);
    expect(manager.install(plugin)).toBe(true);
    expect(new PluginManager().installed).toEqual([plugin]);
    expect(manager.remove(plugin.id)).toBe(true);
    expect(new PluginManager().installed).toEqual([]);
  });
  it('validates records and ignores duplicates and source code', () => {
    localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify([null, {}, plugin, plugin, { ...plugin, id: 'second', source: '<script>' }]));
    expect(new PluginManager().installed).toEqual([plugin, { ...plugin, id: 'second' }]);
  });
  it.each(['{', '{}', 'null'])('survives malformed storage %s', value => {
    localStorage.setItem(PLUGIN_STORAGE_KEY, value);
    const manager = new PluginManager();
    expect(manager.installed).toEqual([]);
    expect(manager.storageError).toBe(true);
  });
  it('does not change memory when persistence fails and can recover', () => {
    const manager = new PluginManager();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(manager.install(plugin)).toBe(false);
    expect(manager.installed).toEqual([]);
    spy.mockRestore();
    manager.install(plugin);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(manager.remove(plugin.id)).toBe(false);
    expect(manager.installed).toEqual([plugin]);
  });
  it('survives unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(new PluginManager().storageError).toBe(true);
  });

});

it('extracts executable blocks inertly and upgrades legacy records', () => {
  localStorage.clear();
  const metadata = { id: 'example', title: 'Example', shortDescription: 'Short', fullDescription: 'Full' };
  const source = `<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify({ ...metadata, apiVersion: 1 })}</script><style data-tiny-rpg-plugin>body{}</style><script type="module" data-tiny-rpg-plugin>export function activate() {}</script>`;
  const parsed = parsePluginHtml(source);
  expect(parsed).toEqual({ ...metadata, payload: { apiVersion: 1, css: 'body{}', javascript: 'export function activate() {}' } });
  const manager = new PluginManager();
  manager.install(metadata);
  manager.install(parsed);
  expect(new PluginManager().installed).toEqual([parsed]);
  expect(() => parsePluginHtml(source.replace('"apiVersion":1', '"apiVersion":2'))).toThrow();
  expect(() => parsePluginHtml(source.replace('type="module"', 'type="module" src="bad.js"'))).toThrow();
  expect(() => parsePluginHtml(source + '<script type="module" data-tiny-rpg-plugin>x</script>')).toThrow();
});
it('rejects direct invalid payloads and quarantines stored invalid payloads', () => {
  localStorage.clear();
  const bad = { ...plugin, payload: { apiVersion: 2, javascript: 'bad' } };
  const manager = new PluginManager();
  expect(manager.install(bad)).toBe(false);
  expect(manager.lastError).toBe('validation');
  localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify([bad, { ...plugin, id: 'valid' }]));
  const restored = new PluginManager();
  expect(restored.installed).toEqual([plugin, { ...plugin, id: 'valid' }]);
  expect(restored.validationErrors[plugin.id]).toBeTruthy();
});

it.each([
  '',
  '<script data-tiny-rpg-plugin>export function activate() {}</script>',
  '<script type="module" data-tiny-rpg-plugin></script>',
  '<style data-tiny-rpg-plugin></style><style data-tiny-rpg-plugin></style><script type="module" data-tiny-rpg-plugin>export function activate() {}</script>',
])('rejects invalid marked blocks: %s', blocks => {
  expect(() => parsePluginHtml(`<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify({ ...plugin, apiVersion: 1 })}</script>${blocks}`)).toThrow();
});

it('does not notify or replace persisted code when storage fails', () => {
  localStorage.clear();
  const manager = new PluginManager();
  const original = { ...plugin, payload: { apiVersion: 1, javascript: 'original' } };
  manager.install(original);
  const listener = vi.fn();
  const unsubscribe = manager.subscribe(listener);
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  expect(manager.install({ ...original, payload: { apiVersion: 1, javascript: 'replacement' } })).toBe(false);
  expect(manager.lastError).toBe('storage');
  expect(manager.installed).toEqual([original]);
  expect(listener).not.toHaveBeenCalled();
  spy.mockRestore();
  unsubscribe();
});

it('preserves versions through parsing, replacement and reload', () => {
  localStorage.clear();
  const manager = new PluginManager();
  for (const version of ['1.0.2', '1.0.10', 'preview']) {
    const record = { ...plugin, version };
    const parsed = parsePluginHtml(`<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify(record)}</script>`);
    expect(parsed).toEqual(record);
    expect(manager.install(parsed)).toBe(true);
    expect(new PluginManager().installed).toEqual([record]);
  }
});
