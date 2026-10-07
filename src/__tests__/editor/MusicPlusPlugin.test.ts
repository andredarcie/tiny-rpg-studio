import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/music-plus/1.0.3/plugin.html?raw';
import catalog from '../../../public/plugins/catalog.json';
import soundsSource from '../../../public/plugins/sounds-plus/1.0.0/plugin.html?raw';
import mapsSource from '../../../public/plugins/maps-plus/1.0.2/plugin.html?raw';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';
import { GameState } from '../../runtime/domain/GameState';
import { upgradeMusicPlusDependency } from '../../editor/manager/upgradeMusicPlusDependency';

let runtime: PluginRuntime | undefined;
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
});
afterEach(async () => { await runtime?.destroy(); vi.restoreAllMocks(); });

function setup() {
  const plugin = parsePluginHtml(source);
  const manager = new PluginManager();
  const game: { world: { rows: number; cols: number }; musicPlus: Record<string, unknown>; musicPlusSmoothTransition?: boolean; musicPlusFadeDurationSeconds?: number } = { world: { rows: 3, cols: 3 }, musicPlus: {} };
  const setRoomMusic = vi.fn((index: number, asset: unknown) => {
    if (asset) game.musicPlus[String(index)] = asset;
    else delete game.musicPlus[String(index)];
    return Promise.resolve();
  });
  const setMusicPlusSmoothTransition = vi.fn((enabled: boolean) => { game.musicPlusSmoothTransition = enabled; return Promise.resolve(); });
  const setMusicPlusFadeDurationSeconds = vi.fn((seconds: number) => { game.musicPlusFadeDurationSeconds = seconds; return Promise.resolve(); });
  const api = { exportGameData: () => game, setRoomMusic, setMusicPlusSmoothTransition, setMusicPlusFadeDurationSeconds } as unknown as TinyRpgApi;
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(plugin);
  runtime.start(document.getElementById('tab-editor') as HTMLElement, api);
  return { plugin, manager, game, setRoomMusic, setMusicPlusSmoothTransition, setMusicPlusFadeDurationSeconds };
}

it('installs the official package and rebuilds named controls after resize and restore', async () => {
  const { plugin, game } = setup();
  await runtime?.settled();
  const { payload: _payload, ...metadata } = plugin;
  expect(catalog.plugins.find(entry => entry.id === 'music-plus')).toEqual({ ...metadata, file: 'music-plus/1.0.3/plugin.html' });
  expect(document.querySelectorAll('.music-plus-row')).toHaveLength(9);
  game.world = { rows: 5, cols: 5 };
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(document.querySelectorAll('.music-plus-row')).toHaveLength(25);
  expect(document.querySelector('.music-plus-row[data-room-index="24"] .music-plus-name')?.textContent).toBe('5,5');
  expect(document.querySelector('.music-plus-row[data-room-index="1"] .music-plus-name')?.textContent).toBe('2,1');
  expect(document.querySelector('.music-plus-row .music-plus-upload')).not.toBeNull();
  expect(document.querySelector('.music-plus-row .music-plus-remove')).not.toBeNull();
  const upload = document.querySelector('.music-plus-row .music-plus-upload') as HTMLElement;
  expect(getComputedStyle(upload).width).toBe('38px');
  expect(getComputedStyle(upload).height).toBe('30px');
  expect(getComputedStyle(upload.querySelector('input') as HTMLElement).position).toBe('absolute');
  game.world = { rows: 1, cols: 2 };
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(document.querySelectorAll('.music-plus-row')).toHaveLength(2);
});

it('saves a typed fade duration and restores the last valid value after invalid input or a failed save', async () => {
  const { game, setMusicPlusFadeDurationSeconds } = setup();
  await runtime?.settled();
  const input = () => document.querySelector('.music-plus-duration input') as HTMLInputElement;
  expect(input().type).toBe('number');
  expect(input().value).toBe('1');
  input().value = '2.5';
  input().dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(game.musicPlusFadeDurationSeconds).toBe(2.5));
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(input().value).toBe('2.5');
  input().value = '11';
  input().dispatchEvent(new Event('change'));
  expect(input().value).toBe('2.5');
  expect(setMusicPlusFadeDurationSeconds).toHaveBeenCalledTimes(1);
  setMusicPlusFadeDurationSeconds.mockRejectedValueOnce(Error('Save failed'));
  input().value = '3';
  input().dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.querySelector('.music-plus-duration + [role="alert"]')?.textContent).toBe('Save failed'));
  expect(input().value).toBe('2.5');
  expect(game.musicPlusFadeDurationSeconds).toBe(2.5);
});

it('saves the smooth transition checkbox, restores it, and reverts it after a failed save', async () => {
  const { game, setMusicPlusSmoothTransition } = setup();
  await runtime?.settled();
  const checkbox = () => document.querySelector('.music-plus-smooth input') as HTMLInputElement;
  expect(checkbox().checked).toBe(false);
  checkbox().click();
  await vi.waitFor(() => expect(game.musicPlusSmoothTransition).toBe(true));
  expect(setMusicPlusSmoothTransition).toHaveBeenCalledWith(true);
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(checkbox().checked).toBe(true);
  setMusicPlusSmoothTransition.mockRejectedValueOnce(Error('Save failed'));
  checkbox().click();
  await vi.waitFor(() => expect(document.querySelector('.music-plus-smooth-error')?.textContent).toBe('Save failed'));
  expect(checkbox().checked).toBe(true);
  expect(game.musicPlusSmoothTransition).toBe(true);
});

it('switches between upload and remove, preserves a track on failure, and allows reupload', async () => {
  const { game, setRoomMusic } = setup();
  await runtime?.settled();
  const bytes = Uint8Array.of(77, 84, 104, 100);
  const uploadFile = (name: string) => {
    const input = document.querySelector('.music-plus-row input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name, size: bytes.length, arrayBuffer: () => Promise.resolve(bytes.buffer) }] });
    input.dispatchEvent(new Event('change'));
  };
  uploadFile('music.mid');
  await vi.waitFor(() => expect(setRoomMusic).toHaveBeenCalledWith(0, { format: 'midi', data: btoa('MThd') }));
  await vi.waitFor(() => expect((document.querySelector('.music-plus-remove') as HTMLButtonElement).hidden).toBe(false));
  expect((document.querySelector('.music-plus-upload') as HTMLLabelElement).hidden).toBe(true);
  expect(getComputedStyle(document.querySelector('.music-plus-remove') as HTMLElement).width).toBe('38px');
  setRoomMusic.mockRejectedValueOnce(Error('Save failed'));
  (document.querySelector('.music-plus-remove') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(document.querySelector('.music-plus-error')?.textContent).toBe('Save failed'));
  expect(game.musicPlus['0']).toBeTruthy();
  (document.querySelector('.music-plus-remove') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(game.musicPlus['0']).toBeUndefined());
  await vi.waitFor(() => expect((document.querySelector('.music-plus-upload') as HTMLLabelElement).hidden).toBe(false));
  uploadFile('bad.txt');
  await vi.waitFor(() => expect(document.querySelector('.music-plus-row [role="alert"]')?.textContent).toMatch(/Choose/));
  uploadFile('replacement.mid');
  await vi.waitFor(() => expect(game.musicPlus['0']).toBeTruthy());
  await vi.waitFor(() => expect((document.querySelector('.music-plus-remove') as HTMLButtonElement).hidden).toBe(false));
});

it('cleans up its settings on removal', async () => {
  const { manager } = setup();
  await runtime?.settled();
  manager.remove('music-plus');
  await runtime?.settled();
  expect(document.querySelector('.music-plus-row')).toBeNull();
});

it('upgrades a saved 1.0.0 dependency without changing its room tracks or other plugins', () => {
  const plugin = parsePluginHtml(source);
  const old = { gameplayPlugins: [{ id: 'music-plus', version: '1.0.0' }, { id: 'sounds-plus', version: '1.0.0' }], musicPlus: { '0': { format: 'midi', data: 'AAAA' } } };
  expect(upgradeMusicPlusDependency(old, [plugin])).toEqual({
    ...old,
    gameplayPlugins: [{ id: 'music-plus', version: '1.0.3' }, { id: 'sounds-plus', version: '1.0.0' }],
  });
  expect(upgradeMusicPlusDependency({ ...old, gameplayPlugins: [{ id: 'music-plus', version: '1.0.1' }] }, [plugin]).gameplayPlugins[0].version).toBe('1.0.3');
  expect(upgradeMusicPlusDependency({ ...old, gameplayPlugins: [{ id: 'music-plus', version: '1.0.2' }] }, [plugin]).gameplayPlugins[0].version).toBe('1.0.3');
});

it('embeds room music and both gameplay packages in a standalone export', () => {
  const plugins = [source, soundsSource, mapsSource].map(parsePluginHtml);
  const midi = btoa(String.fromCharCode(...[
    77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    77, 84, 114, 107, 0, 0, 0, 12,
    0, 0x90, 60, 100, 96, 0x80, 60, 0, 0, 0xff, 0x2f, 0,
  ]));
  const game = { ...(new GameState().exportGameData() as object),
    gameplayPlugins: plugins.map(plugin => ({ id: plugin.id, version: plugin.version })),
    musicPlus: { '0': { format: 'midi', data: midi } },
  };
  const result = assembleExportHtml({
    css: '', editableInStudio: false, fontDataUrl: '', gameCode: '', gameMarkup: '',
    locale: 'en-US', openStudioLabel: 'Open Studio', runtimeJavaScript: '', title: 'Music+ game',
    bundledProject: { game, plugins },
  });
  const text = new DOMParser().parseFromString(result.html, 'text/html').getElementById('tiny-rpg-project')?.textContent;
  if (!text) throw Error('Standalone project was not embedded');
  const bundled = JSON.parse(text) as { game: typeof game; plugins: typeof plugins };
  expect(bundled.game.musicPlus).toEqual(game.musicPlus);
  expect(bundled.plugins.map(plugin => plugin.id)).toEqual(['music-plus', 'sounds-plus', 'maps-plus']);
});
