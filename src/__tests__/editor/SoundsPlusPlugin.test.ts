import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/sounds-plus/1.0.0/plugin.html?raw';
import catalog from '../../../public/plugins/catalog.json';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { SOUND_NAMES } from '../../runtime/services/SoundsPlus';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';
import { GameState } from '../../runtime/domain/GameState';

let runtime: PluginRuntime | undefined;
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
});
afterEach(async () => { await runtime?.destroy(); document.querySelector('[data-sounds-plus-test-style]')?.remove(); vi.restoreAllMocks(); });

function setup() {
  const plugin = parsePluginHtml(source);
  const manager = new PluginManager();
  const game: { soundsPlus?: Record<string, unknown> } = {};
  const setSoundOverride = vi.fn((name: string, asset: unknown) => {
    game.soundsPlus ??= {};
    if (asset) game.soundsPlus[name] = asset;
    else delete game.soundsPlus[name];
    return Promise.resolve();
  });
  const api = { exportGameData: () => game, setSoundOverride } as unknown as TinyRpgApi;
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(plugin);
  runtime.start(document.getElementById('tab-editor') as HTMLElement, api);
  return { plugin, manager, game, setSoundOverride };
}

it('publishes matching metadata and renders all 18 upload/remove rows', async () => {
  const { plugin } = setup();
  await runtime?.settled();
  const { payload: _payload, ...metadata } = plugin;
  expect(catalog.plugins.find(entry => entry.id === 'sounds-plus')).toEqual({ ...metadata, file: 'sounds-plus/1.0.0/plugin.html' });
  const rows = [...document.querySelectorAll('.sounds-plus-row')];
  expect(rows).toHaveLength(SOUND_NAMES.length);
  expect(rows.map(row => (row as HTMLElement).dataset.soundName)).toEqual(SOUND_NAMES);
  expect(rows.map(row => (row.querySelector('input') as HTMLInputElement).accept)).toEqual(Array(18).fill('.mid,.midi,.mp3,.wav,audio/midi,audio/mpeg,audio/wav'));
  expect(rows.every(row => (row.querySelector('button') as HTMLButtonElement).hidden)).toBe(true);
  const row = rows[0];
  const input = row.querySelector('input') as HTMLInputElement;
  const upload = row.querySelector('.sounds-plus-upload') as HTMLLabelElement;
  expect(upload.contains(input)).toBe(true);
  expect(upload.hidden).toBe(false);
  expect(input.getAttribute('aria-label')).toBe('Upload Player attack sound');
  expect(getComputedStyle(row).display).toBe('grid');
  expect(getComputedStyle(upload).fontSize).toBe('0px');
  expect(getComputedStyle(upload).width).toBe('38px');
  expect(getComputedStyle(upload).height).toBe('30px');
  expect(getComputedStyle(input).position).toBe('absolute');
});

it('fits the native picker in an already installed Sounds+ settings row', async () => {
  const style = document.createElement('style');
  style.dataset.soundsPlusTestStyle = '';
  const { readFileSync } = await vi.importActual<{ readFileSync: (path: string, encoding: string) => string }>('node:fs');
  const editorCss = readFileSync('src/styles.css', 'utf8');
  style.textContent = editorCss.slice(editorCss.indexOf('.plugin-settings-content {'), editorCss.indexOf('.plugin-settings-empty {'));
  document.head.append(style);
  expect(style.textContent).toContain('sounds-plus-row');
  expect(style.sheet?.cssRules.length).toBeGreaterThan(1);
  const settings = document.createElement('div');
  settings.className = 'plugin-settings-content';
  settings.innerHTML = '<div class="sounds-plus-row"><label>Player attack<input type="file"></label><button type="button" hidden>x</button><span role="alert"></span></div>';
  document.body.append(settings);
  const row = settings.querySelector('.sounds-plus-row') as HTMLElement;
  const label = settings.querySelector('label') as HTMLLabelElement;
  const input = settings.querySelector('input') as HTMLInputElement;
  const remove = settings.querySelector('button') as HTMLButtonElement;
  expect(getComputedStyle(label).display).toBe('grid');
  expect(getComputedStyle(input).position).toBe('absolute');
  expect(getComputedStyle(input).width).toBe('1px');
  input.hidden = true;
  remove.hidden = false;
  expect(getComputedStyle(row).display).toBe('grid');
  expect(getComputedStyle(remove).gridColumn).toBe('2');
  expect(getComputedStyle(remove).width).toBe('38px');
  expect(getComputedStyle(remove).height).toBe('30px');
  expect(getComputedStyle(remove).color).toBe('rgb(224, 96, 96)');
});

it('uploads a MIDI file, refreshes on restore, and removes the override', async () => {
  const { game, setSoundOverride } = setup();
  await runtime?.settled();
  const row = document.querySelector('.sounds-plus-row') as HTMLElement;
  const input = row.querySelector('input') as HTMLInputElement;
  const upload = row.querySelector('.sounds-plus-upload') as HTMLLabelElement;
  const remove = row.querySelector('button') as HTMLButtonElement;
  const bytes = Uint8Array.of(77, 84, 104, 100);
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'hit.mid', size: bytes.length, arrayBuffer: () => Promise.resolve(bytes.buffer) }] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(setSoundOverride).toHaveBeenCalledWith('playerAttack', { format: 'midi', data: btoa('MThd') }));
  expect(input.hidden).toBe(true);
  expect(upload.hidden).toBe(true);
  expect(remove.hidden).toBe(false);
  expect(getComputedStyle(remove).width).toBe('38px');
  expect(getComputedStyle(remove).height).toBe('30px');
  expect(getComputedStyle(remove).color).toBe('rgb(224, 96, 96)');
  game.soundsPlus = {};
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(input.hidden).toBe(false);
  expect(upload.hidden).toBe(false);
  game.soundsPlus = { playerAttack: { format: 'midi', data: 'AAAA' } };
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  remove.click();
  await vi.waitFor(() => expect(setSoundOverride).toHaveBeenLastCalledWith('playerAttack', null));
  expect(remove.hidden).toBe(true);
  expect(upload.hidden).toBe(false);
});

it('keeps a working override when validation fails', async () => {
  const { game, setSoundOverride } = setup();
  await runtime?.settled();
  game.soundsPlus = { playerAttack: { format: 'midi', data: 'AAAA' } };
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  const row = document.querySelector('.sounds-plus-row') as HTMLElement;
  const input = row.querySelector('input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'bad.txt', size: 4, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(row.querySelector('[role="alert"]')?.textContent).toMatch(/Choose/));
  expect(setSoundOverride).not.toHaveBeenCalled();
  expect(game.soundsPlus.playerAttack).toEqual({ format: 'midi', data: 'AAAA' });
});

it('embeds override bytes and its gameplay module in a reloadable standalone project', () => {
  const plugin = parsePluginHtml(source);
  const midi = btoa(String.fromCharCode(...[
    77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    77, 84, 114, 107, 0, 0, 0, 12,
    0, 0x90, 60, 100, 96, 0x80, 60, 0, 0, 0xff, 0x2f, 0,
  ]));
  const game = { ...new GameState().exportGameData() as object,
    gameplayPlugins: [{ id: 'sounds-plus', version: '1.0.0' }],
    soundsPlus: { dialog: { format: 'midi', data: midi } },
  };
  const result = assembleExportHtml({
    css: '', editableInStudio: false, fontDataUrl: '', gameCode: '', gameMarkup: '',
    locale: 'en-US', openStudioLabel: 'Open Studio', runtimeJavaScript: '', title: 'Sounds+ game',
    bundledProject: { game, plugins: [plugin] },
  });
  const text = new DOMParser().parseFromString(result.html, 'text/html').getElementById('tiny-rpg-project')?.textContent;
  if (!text) throw Error('Standalone project was not embedded');
  const bundled = JSON.parse(text) as { game: typeof game; plugins: typeof plugin[] };
  expect(bundled.game.soundsPlus).toEqual(game.soundsPlus);
  expect(bundled.plugins[0].payload?.gameplayJavascript).toBe(plugin.payload?.gameplayJavascript);
  const reloaded = new GameState();
  reloaded.importGameData(bundled.game);
  expect(reloaded.game.soundsPlus).toEqual(game.soundsPlus);
});
