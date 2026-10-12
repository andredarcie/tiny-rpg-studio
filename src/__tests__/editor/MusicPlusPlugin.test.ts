import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/music-plus/1.1.0/plugin.html?raw';
import catalog from '../../../public/plugins/catalog.json';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { upgradeMusicPlusDependency } from '../../editor/manager/upgradeMusicPlusDependency';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';
import { GameState } from '../../runtime/domain/GameState';
import soundsSource from '../../../public/plugins/sounds-plus/1.0.0/plugin.html?raw';
import mapsSource from '../../../public/plugins/maps-plus/1.0.2/plugin.html?raw';

let runtime: PluginRuntime | undefined;
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
});
afterEach(async () => { await runtime?.destroy(); vi.restoreAllMocks(); });

function setup() {
  const plugin = parsePluginHtml(source);
  const manager = new PluginManager();
  const game = {
    world: { rows: 3, cols: 3 },
    musicPlus: { version: 1, tracks: [] as { id: string; name: string; asset: { format: string; data: string } }[], assignments: {} as Record<string, string> },
    musicPlusSmoothTransition: false,
    musicPlusFadeDurationSeconds: 1,
  };
  const addMusicPlusTrack = vi.fn((name: string, asset: { format: string; data: string }) => { game.musicPlus.tracks.push({ id: `song-${game.musicPlus.tracks.length}`, name, asset }); return Promise.resolve(); });
  const removeMusicPlusTrack = vi.fn((id: string) => {
    game.musicPlus.tracks = game.musicPlus.tracks.filter(track => track.id !== id);
    for (const [room, assigned] of Object.entries(game.musicPlus.assignments)) if (assigned === id) delete game.musicPlus.assignments[room];
    return Promise.resolve();
  });
  const assignMusicPlusTrack = vi.fn((id: string, room: number) => { game.musicPlus.assignments[String(room)] = id; return Promise.resolve(); });
  const detachMusicPlusRoom = vi.fn((room: number) => { delete game.musicPlus.assignments[String(room)]; return Promise.resolve(); });
  const setMusicPlusSmoothTransition = vi.fn((enabled: boolean) => { game.musicPlusSmoothTransition = enabled; return Promise.resolve(); });
  const setMusicPlusFadeDurationSeconds = vi.fn((seconds: number) => { game.musicPlusFadeDurationSeconds = seconds; return Promise.resolve(); });
  const api = { exportGameData: () => game, addMusicPlusTrack, removeMusicPlusTrack, assignMusicPlusTrack, detachMusicPlusRoom, setMusicPlusSmoothTransition, setMusicPlusFadeDurationSeconds } as unknown as TinyRpgApi;
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(plugin);
  runtime.start(document.getElementById('tab-editor') as HTMLElement, api);
  return { plugin, manager, game, addMusicPlusTrack, removeMusicPlusTrack, assignMusicPlusTrack, detachMusicPlusRoom, setMusicPlusSmoothTransition, setMusicPlusFadeDurationSeconds };
}

function upload(name: string) {
  const bytes = Uint8Array.of(77, 84, 104, 100);
  const input = document.querySelector('.music-plus-upload input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name, size: bytes.length, arrayBuffer: () => Promise.resolve(bytes.buffer) }] });
  input.dispatchEvent(new Event('change'));
}

it('shows one upload and assigns one song to several rooms', async () => {
  const { game, addMusicPlusTrack, assignMusicPlusTrack, detachMusicPlusRoom } = setup();
  await runtime?.settled();
  expect(document.querySelectorAll('.music-plus-upload')).toHaveLength(1);
  expect(document.querySelectorAll('.music-plus-upload svg path')).toHaveLength(2);
  upload('theme.mid');
  await vi.waitFor(() => expect(addMusicPlusTrack).toHaveBeenCalledWith('theme.mid', { format: 'midi', data: btoa('MThd') }));
  await vi.waitFor(() => expect(document.querySelectorAll('.music-plus-row')).toHaveLength(1));
  expect(document.querySelector('.music-plus-name')?.textContent).toBe('theme.mid');
  const picker = () => document.querySelector('.music-plus-picker') as HTMLSelectElement;
  picker().value = '0'; picker().dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(assignMusicPlusTrack).toHaveBeenCalledWith('song-0', 0));
  await vi.waitFor(() => expect(document.querySelector('.music-plus-pill')?.textContent).toContain('1,1'));
  expect(Array.from(picker().options).map(option => option.value)).not.toContain('0');
  picker().value = '1'; picker().dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(Object.keys(game.musicPlus.assignments)).toHaveLength(2));
  expect(document.querySelectorAll('.music-plus-pill')).toHaveLength(2);
  (document.querySelector('.music-plus-pill button') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(detachMusicPlusRoom).toHaveBeenCalledWith(0));
});

it('separates uploaded song rows', async () => {
  setup();
  await runtime?.settled();
  upload('one.mid');
  await vi.waitFor(() => expect(document.querySelectorAll('.music-plus-row')).toHaveLength(1));
  upload('two.mid');
  await vi.waitFor(() => expect(document.querySelectorAll('.music-plus-row')).toHaveLength(2));
  const rows = document.querySelectorAll<HTMLElement>('.music-plus-row');
  const divider = document.querySelector('.music-plus-divider');
  expect(divider).toBeInstanceOf(HTMLHRElement);
  expect(divider?.previousElementSibling).toBe(rows[0]);
  expect(divider?.nextElementSibling).toBe(rows[1]);
});

it('keeps unassigned uploads, removes songs, and reports save failures', async () => {
  const { game, removeMusicPlusTrack } = setup();
  await runtime?.settled();
  upload('one.mid');
  await vi.waitFor(() => expect(document.querySelectorAll('.music-plus-row')).toHaveLength(1));
  expect(game.musicPlus.assignments).toEqual({});
  removeMusicPlusTrack.mockRejectedValueOnce(Error('Save failed'));
  (document.querySelector('.music-plus-remove') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(document.querySelector('.music-plus-row [role="alert"]')?.textContent).toBe('Save failed'));
  expect(game.musicPlus.tracks).toHaveLength(1);
  (document.querySelector('.music-plus-remove') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(game.musicPlus.tracks).toHaveLength(0));
});

it('releases assigned rooms when a song is removed and reports invalid uploads', async () => {
  const { game } = setup();
  await runtime?.settled();
  upload('one.mid');
  await vi.waitFor(() => expect(document.querySelectorAll('.music-plus-row')).toHaveLength(1));
  const picker = document.querySelector('.music-plus-picker') as HTMLSelectElement;
  picker.value = '2'; picker.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(game.musicPlus.assignments['2']).toBe('song-0'));
  (document.querySelector('.music-plus-remove') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(game.musicPlus.assignments['2']).toBeUndefined());
  upload('bad.txt');
  await vi.waitFor(() => expect(document.querySelector('.music-plus-upload + [role="alert"]')?.textContent).toMatch(/Choose/));
});

it('refreshes picker choices after a Maps+ resize and restores settings', async () => {
  const { game, setMusicPlusFadeDurationSeconds, setMusicPlusSmoothTransition } = setup();
  await runtime?.settled();
  upload('one.mid');
  await vi.waitFor(() => expect(document.querySelector('.music-plus-picker')).not.toBeNull());
  game.world = { rows: 5, cols: 5 };
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect((document.querySelector('.music-plus-picker') as HTMLSelectElement).options).toHaveLength(26);
  const duration = () => document.querySelector('.music-plus-duration input') as HTMLInputElement;
  duration().value = '2.5'; duration().dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(game.musicPlusFadeDurationSeconds).toBe(2.5));
  duration().value = '11'; duration().dispatchEvent(new Event('change'));
  expect(duration().value).toBe('2.5');
  setMusicPlusFadeDurationSeconds.mockRejectedValueOnce(Error('Save failed'));
  duration().value = '3'; duration().dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.querySelector('.music-plus-duration + [role="alert"]')?.textContent).toBe('Save failed'));
  const smooth = () => document.querySelector('.music-plus-smooth input') as HTMLInputElement;
  smooth().click();
  await vi.waitFor(() => expect(game.musicPlusSmoothTransition).toBe(true));
  setMusicPlusSmoothTransition.mockRejectedValueOnce(Error('Save failed'));
  smooth().click();
  await vi.waitFor(() => expect(document.querySelector('.music-plus-smooth-error')?.textContent).toBe('Save failed'));
  expect(smooth().checked).toBe(true);
});

it('publishes the new package and upgrades every earlier dependency', () => {
  const plugin = parsePluginHtml(source);
  const { payload: _payload, ...metadata } = plugin;
  expect(catalog.plugins.find(entry => entry.id === 'music-plus')).toEqual({ ...metadata, file: 'music-plus/1.1.0/plugin.html' });
  for (const version of ['1.0.0', '1.0.1', '1.0.2', '1.0.3']) {
    const old = { gameplayPlugins: [{ id: 'music-plus', version }, { id: 'sounds-plus', version: '1.0.0' }] };
    expect(upgradeMusicPlusDependency(old, [plugin]).gameplayPlugins).toEqual([{ id: 'music-plus', version: '1.1.0' }, old.gameplayPlugins[1]]);
  }
});

it('embeds unassigned tracks and assignments in a standalone export', () => {
  const plugins = [source, soundsSource, mapsSource].map(parsePluginHtml);
  const library = { version: 1, tracks: [{ id: 'a', name: 'theme.mid', asset: { format: 'midi', data: 'AAAA' } },
    { id: 'b', name: 'unused.mid', asset: { format: 'midi', data: 'BBBB' } }], assignments: { '0': 'a', '1': 'a' } };
  const game = { ...(new GameState().exportGameData() as object), gameplayPlugins: plugins.map(item => ({ id: item.id, version: item.version })), musicPlus: library };
  const result = assembleExportHtml({ css: '', editableInStudio: false, fontDataUrl: '', gameCode: '', gameMarkup: '', locale: 'en-US', openStudioLabel: 'Open Studio', runtimeJavaScript: '', title: 'Music+ game', bundledProject: { game, plugins } });
  const text = new DOMParser().parseFromString(result.html, 'text/html').getElementById('tiny-rpg-project')?.textContent;
  const embedded = JSON.parse(text ?? '{}') as unknown as { game: { musicPlus: typeof library } };
  expect(embedded.game.musicPlus).toEqual(library);
});
