import { describe, expect, it, vi } from 'vitest';
import { createPluginCatalog, hasPluginUpdate } from '../../editor/manager/pluginCatalog';
import published from '../../../public/plugins/example-plugin/1.0.0/plugin.html?raw';
import index from '../../../public/plugins/catalog.json';
import example from '../../../examples/plugin-preview.html?raw';
import mapsPlus from '../../../examples/maps-plus.html?raw';
import publishedMapsPlus from '../../../public/plugins/maps-plus/1.0.1/plugin.html?raw';
import { GameState } from '../../runtime/domain/GameState';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import { PluginManager } from '../../editor/manager/PluginManager';
import { parsePluginHtml } from '../../editor/manager/PluginManager';

const metadata = parsePluginHtml(example);
const entry = { id: metadata.id, title: metadata.title, shortDescription: metadata.shortDescription, fullDescription: metadata.fullDescription, version: '1.0.0', file: 'example-plugin/1.0.0/plugin.html' };
const response = (body: unknown, url = 'https://studio.test/app/plugins/catalog.json', ok = true) => ({ ok, url, json: () => Promise.resolve(body), text: () => Promise.resolve(body) } as Response);
const document = { schemaVersion: 1, plugins: [entry] };
const setup = (body: unknown = document) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(body));
  return { fetcher, catalog: createPluginCatalog('https://studio.test/app/index.html', fetcher) };
};
describe('static plugin catalog', () => {
  it('keeps installed packages and catalog fields out of exported and shared games', () => {
    localStorage.clear();
    const state = new GameState();
    const before = state.exportGameData() as Record<string, unknown>;
    const code = ShareUtils.encode(before);
    expect(new PluginManager().install(metadata)).toBe(true);
    const after = state.exportGameData() as Record<string, unknown>;
    expect(after).toEqual(before);
    expect(ShareUtils.encode(after)).toBe(code);
    expect(JSON.stringify(after)).not.toContain('example-plugin');
    expect(JSON.stringify(ShareUtils.decode(code))).not.toContain('example-plugin');
    localStorage.clear();
  });
  it('publishes the exact reviewed example and matching metadata', () => {
    expect(published).toBe(example);
    expect(index.schemaVersion).toBe(1);
    expect(index.plugins).toContainEqual(entry);
  });
  it('publishes Maps+ with matching package metadata', () => {
    expect(publishedMapsPlus).toBe(mapsPlus);
    const plugin = parsePluginHtml(publishedMapsPlus);
    expect(index.plugins).toContainEqual({
      id: plugin.id,
      title: plugin.title,
      shortDescription: plugin.shortDescription,
      fullDescription: plugin.fullDescription,
      version: plugin.version,
      file: 'maps-plus/1.0.1/plugin.html',
    });
  });
  it('lists at most ten plugins alphabetically for an empty query and shares the search cache', async () => {
    const titles = ['Zulu', 'alpha', 'Charlie', 'bravo', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo'];
    const entries = titles.map(title => ({ ...entry, id: title, title }));
    const { catalog, fetcher } = setup({ schemaVersion: 1, plugins: entries });
    const defaults = await catalog.search('   ');
    expect(defaults.map(entry => entry.title)).toEqual(['alpha', 'bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet']);
    defaults[0].title = 'changed';
    expect((await catalog.search(''))[0].title).toBe('alpha');
    expect((await catalog.search('zulu')).map(entry => entry.title)).toEqual(['Zulu']);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('lists fewer than ten when the catalog is small or empty', async () => {
    expect(await setup().catalog.search('')).toEqual([entry]);
    expect(await setup({ schemaVersion: 1, plugins: [] }).catalog.search('')).toEqual([]);
  });
  it('fetches once concurrently, revalidates, searches locally and returns copies', async () => {
    const { catalog, fetcher } = setup();
    expect(await catalog.search('ab')).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([catalog.search(' EXAMPLE '), catalog.search('world')]);
    expect(a).toEqual([entry]); expect(b).toEqual([entry]);
    a[0].title = 'changed';
    expect(await catalog.search('example')).toEqual([entry]);
    expect(await catalog.search('missing')).toEqual([]);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://studio.test/app/plugins/catalog.json', expect.objectContaining({ cache: 'no-cache' }));
  });
  it.each(['https://studio.test/', 'https://studio.test/prefix/', 'https://studio.test/prefix/index.html'])('resolves deployment %s', async base => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(url => Promise.resolve(response(document, String(url))));
    await createPluginCatalog(base, fetcher).search('example');
    expect(fetcher.mock.calls[0][0]).toBe(new URL('plugins/catalog.json', base).href);
  });
  it.each([null, {}, { schemaVersion: 2, plugins: [] }, { schemaVersion: 1, plugins: [entry, entry] }, ...['id', 'title', 'shortDescription', 'fullDescription', 'version', 'file'].map(key => ({ schemaVersion: 1, plugins: [{ ...entry, [key]: ' ' }] }))])('rejects invalid catalog %# and retries', async body => {
    const { catalog, fetcher } = setup(body);
    await expect(catalog.search('example')).rejects.toThrow();
    fetcher.mockResolvedValue(response(document));
    expect(await catalog.search('example')).toEqual([entry]);
  });
  it.each(['../escape.html', '/absolute.html', 'https://evil.test/a', '//evil.test/a', 'a/../b', 'a?x', 'a#x', 'a\\b', '%2e%2e/a', 'a/%2f/b'])('rejects unsafe package path %s', async file => {
    await expect(setup({ schemaVersion: 1, plugins: [{ ...entry, file }] }).catalog.search('example')).rejects.toThrow();
  });
  it('recovers from HTTP, JSON and network failures', async () => {
    const { catalog, fetcher } = setup();
    fetcher.mockResolvedValueOnce(response(null, undefined, false)).mockResolvedValueOnce({ ok: true, url: '', json: () => Promise.reject(Error('JSON')) } as unknown as Response).mockRejectedValueOnce(Error('offline'));
    for (let i = 0; i < 3; i++) await expect(catalog.search('example')).rejects.toThrow();
    expect(await catalog.search('example')).toEqual([entry]);
  });
  it('downloads only explicitly and parses without executing', async () => {
    const { catalog, fetcher } = setup();
    await catalog.search('example'); expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(response(example, 'https://studio.test/app/plugins/' + entry.file));
    const signal = new AbortController().signal;
    expect(await catalog.download(entry, signal)).toEqual({ ...metadata, version: entry.version });
    expect(fetcher.mock.calls[1][1]?.signal).toBe(signal);
    expect(globalThis.document.querySelector('.editor-section--tiles')).toBeNull();
  });
  it.each([['bad', true], [example.replace('example-plugin', 'wrong-id'), true], [example.replace('"apiVersion": 1', '"ignored": 1'), true], [example, false]])('rejects invalid package %#', async (body, ok) => {
    const { catalog, fetcher } = setup(); fetcher.mockResolvedValue(response(body, '', ok as boolean));
    await expect(catalog.download(entry, new AbortController().signal)).rejects.toThrow();
  });
  it.each(['https://evil.test/plugin.html', 'https://studio.test/outside.html'])('rejects escaped response URLs %s', async url => {
    const { catalog, fetcher } = setup(); fetcher.mockResolvedValue(response(document, url));
    await expect(catalog.search('example')).rejects.toThrow();
    fetcher.mockResolvedValue(response(example, url));
    await expect(catalog.download(entry, new AbortController().signal)).rejects.toThrow();
  });
});

it.each([
  ['1.0.2', '1.0.10', true], ['1.0.10', '1.0.2', false],
  ['2.0.0', '1.9.9', false], ['1.0.2', '1.0.2', false],
  [undefined, '1.0.2', true], ['preview', '1.0.2', true],
  ['1.0.0', '1.0.2-beta', false], ['1.0', '1.0.2', true],
])('compares installed %s with catalog %s', (installed, available, expected) => {
  expect(hasPluginUpdate(installed, available)).toBe(expected);
});
it('reads the full cached catalog independently of search limits', async () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ ...entry, id: String(i) }));
  const { catalog, fetcher } = setup({ schemaVersion: 1, plugins: entries });
  expect(await catalog.search('')).toHaveLength(10);
  const all = await catalog.all();
  expect(all).toEqual(entries);
  all[0].title = 'changed';
  expect(await catalog.all()).toEqual(entries);
  expect(fetcher).toHaveBeenCalledOnce();
});
it('rejects conflicting explicit manifest versions', async () => {
  const { catalog, fetcher } = setup();
  fetcher.mockResolvedValue(response(example.replace('"apiVersion": 1', '"version": "9.0.0", "apiVersion": 1'), ''));
  await expect(catalog.download(entry, new AbortController().signal)).rejects.toThrow();
});
