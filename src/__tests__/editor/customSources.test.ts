import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomSources, CUSTOM_SOURCES_KEY } from '../../editor/manager/customSources';

const html = (id: string, version?: string) => `<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify({ id, title: id, shortDescription: 'Short', fullDescription: 'Full', ...(version ? { version } : {}), apiVersion: 1 })}</script><script type="module" data-tiny-rpg-plugin>export function activate() {}</script>`;
const response = (body: string, url: string) => ({ ok: true, url, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body) as unknown) }) as Response;

describe('CustomSources', () => {
  beforeEach(() => localStorage.clear());

  it('validates a direct HTML URL, persists only after discovery, and verifies downloads', async () => {
    const url = 'https://example.com/plugin.html?raw=1';
    const fetcher = vi.fn(() => Promise.resolve(response(html('one'), url)));
    const sources = new CustomSources(fetcher);
    await sources.add(url);
    expect(sources.urls).toEqual([url]);
    expect(JSON.parse(localStorage.getItem(CUSTOM_SOURCES_KEY) ?? 'null') as unknown).toEqual([url]);
    expect(sources.entries[0].version).toBeUndefined();
    expect((await sources.download(sources.entries[0], new AbortController().signal)).id).toBe('one');
    fetcher.mockImplementationOnce(() => Promise.resolve(response(html('changed'), url)));
    await expect(sources.download(sources.entries[0], new AbortController().signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('lists immediate GitHub HTML files on main or a commit and skips unrelated files', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).includes('api.github.com')
      ? response(JSON.stringify([
        { type: 'file', name: 'plugin.html', path: 'examples/plugin.html' },
        { type: 'file', name: 'preview.htm', path: 'examples/preview.htm' },
        { type: 'file', name: 'README.md', path: 'examples/README.md' },
        { type: 'dir', name: 'nested', path: 'examples/nested' },
      ]), String(input))
      : response(html(String(input).includes('preview') ? 'two' : 'one'), String(input))));
    const sources = new CustomSources(fetcher);
    await sources.add('https://github.com/owner/repo/tree/main/examples');
    expect(sources.entries.map(entry => entry.id)).toEqual(['one', 'two']);
    expect(fetcher.mock.calls.map(call => call[0])).toContain('https://api.github.com/repos/owner/repo/contents/examples?ref=main');
    await sources.add('https://github.com/owner/repo/tree/abcdef0/examples');
    expect(sources.urls).toHaveLength(2);
  });

  it('preserves saved sources on validation and storage failures', async () => {
    const url = 'https://example.com/plugin.html';
    const sources = new CustomSources(vi.fn(() => Promise.resolve(response(html('one'), url))));
    await expect(sources.add('javascript:bad')).rejects.toThrow();
    await sources.add(url);
    await expect(sources.add(url)).rejects.toThrow();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(() => sources.remove(url)).toThrow();
    expect(sources.urls).toEqual([url]);
    vi.restoreAllMocks();
  });

  it('loads saved sources on a new session and ignores malformed storage', async () => {
    const url = 'https://example.com/plugin.html';
    localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify([url]));
    const sources = new CustomSources(vi.fn(() => Promise.resolve(response(html('one'), url))));
    await sources.load();
    expect(sources.entries.map(entry => entry.id)).toEqual(['one']);
    localStorage.setItem(CUSTOM_SOURCES_KEY, '{bad');
    expect(new CustomSources().urls).toEqual([]);
  });

  it('rejects missing executable packages and keeps storage unchanged after failed fetches', async () => {
    const url = 'https://example.com/preview.html';
    const preview = `<script id="tiny-rpg-plugin" type="application/json">${JSON.stringify({ id: 'preview', title: 'Preview', shortDescription: 'Short', fullDescription: 'Full' })}</script>`;
    const sources = new CustomSources(vi.fn(() => Promise.resolve(response(preview, url))));
    await expect(sources.add(url)).rejects.toThrow();
    expect(sources.urls).toEqual([]);
    expect(localStorage.getItem(CUSTOM_SOURCES_KEY)).toBeNull();
  });

  it('ignores a pending reload after its source is removed', async () => {
    const url = 'https://example.com/plugin.html';
    localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify([url]));
    let finish: ((value: Response) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const sources = new CustomSources(fetcher);
    const loading = sources.load();
    sources.remove(url);
    finish?.(response(html('one'), url));
    await loading;
    expect(sources.entries).toEqual([]);
    expect(sources.discoveryError).toBe(false);
  });
});
