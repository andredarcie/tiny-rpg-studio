import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupShareGlobals, ShareEncoder, ShareDecoder, ShareUrlHelper } from './shareTestUtils';

describe('ShareUrlHelper', () => {
  const originalHref = globalThis.location.href;

  beforeAll(() => {
    setupShareGlobals();
  });

  afterEach(() => {
    globalThis.history.replaceState({}, '', originalHref);
  });

  it('builds share urls using the current base url in localhost', () => {
    const spy = vi.spyOn(ShareEncoder, 'buildShareCode').mockReturnValue('abc');

    globalThis.history.replaceState({}, '', '/share');
    const url = ShareUrlHelper.buildShareUrl({});

    expect(url).toBe(`${globalThis.location.origin}/share#abc`);

    spy.mockRestore();
  });

  it('builds share urls using GitHub Pages URL in production', () => {
    const spy = vi.spyOn(ShareEncoder, 'buildShareCode').mockReturnValue('abc');
    const originalLocation = globalThis.location;

    delete (globalThis as { location?: Location }).location;
    globalThis.location = {
      ...originalLocation,
      hostname: 'andredarcie.github.io',
      origin: 'https://andredarcie.github.io',
      pathname: '/any-path/',
    } as Location;

    const url = ShareUrlHelper.buildShareUrl({});

    expect(url).toBe('https://andredarcie.github.io/tiny-rpg-studio/#abc');

    globalThis.location = originalLocation;

    spy.mockRestore();
  });

  it.each([
    ['empty game', {}],
    ['Unicode text', { title: 'Olá 世界', author: 'André' }],
    ['tiles and objects', {
      tileset: { maps: [{ ground: [[1, 2]], overlay: [[null, 3]] }] },
      objects: [{ type: 'key', x: 2, y: 3, roomIndex: 0 }],
    }],
    ['custom sprites', {
      customSprites: [{
        group: 'tile',
        key: 'custom:test',
        frames: [Array.from({ length: 8 }, () => Array<number | null>(8).fill(null))],
      }],
    }],
  ])('estimates the exact local share URL length for %s', (_name, gameData) => {
    globalThis.history.replaceState({}, '', '/share');

    expect(ShareUrlHelper.estimateShareUrlLength(gameData)).toBe(
      ShareUrlHelper.buildShareUrl(gameData).length,
    );
  });

  it('includes the canonical production base URL in the estimate', () => {
    const originalLocation = globalThis.location;
    delete (globalThis as { location?: Location }).location;
    globalThis.location = {
      ...originalLocation,
      hostname: 'example.com',
      origin: 'https://example.com',
      pathname: '/embedded/',
    } as Location;

    expect(ShareUrlHelper.estimateShareUrlLength({ title: 'Production' })).toBe(
      ShareUrlHelper.buildShareUrl({ title: 'Production' }).length,
    );

    globalThis.location = originalLocation;
  });

  it('estimates without calling either public URL/code builder', () => {
    const urlSpy = vi.spyOn(ShareUrlHelper, 'buildShareUrl');
    const codeSpy = vi.spyOn(ShareEncoder, 'buildShareCode');

    const length = ShareUrlHelper.estimateShareUrlLength({ title: 'Measured only' });

    expect(length).toBeGreaterThan(ShareUrlHelper.getBaseUrl().length);
    expect(urlSpy).not.toHaveBeenCalled();
    expect(codeSpy).not.toHaveBeenCalled();
  });

  it('extracts game data from a location hash', () => {
    const spy = vi.spyOn(ShareDecoder, 'decodeShareCode').mockReturnValue({ title: 'ok' });

    const data = ShareUrlHelper.extractGameDataFromLocation({ hash: '#code' } as Location);

    expect(data?.title).toBe('ok');
    expect(spy).toHaveBeenCalledWith('code');

    spy.mockRestore();
  });

  it('includes backgroundMusicVolume in the hash when it differs from the default', () => {
    globalThis.history.replaceState({}, '', '/share');

    const url = ShareUrlHelper.buildShareUrl({
      backgroundMusicVideoId: 't0ihNLLZNi0',
      backgroundMusicVolume: 40,
    });

    expect(url).toContain('#');
    expect(url.split('#')[1]?.split('.')).toContain('214');
  });
});
