import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PluginManager, PLUGIN_STORAGE_KEY, parsePluginHtml } from '../../editor/manager/PluginManager';
import { searchPlugins } from '../../editor/manager/pluginCatalog';

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
  it('searches local titles and descriptions case insensitively', async () => {
    expect((await searchPlugins('WEATHER')).length).toBeGreaterThan(0);
    expect(await searchPlugins('no-such-plugin')).toEqual([]);
  });
});
