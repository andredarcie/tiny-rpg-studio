import { afterEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/fonts-plus/1.0.0/plugin.html?raw';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { GameState } from '../../runtime/domain/GameState';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';
import { fontBytesToBase64, normalizeFontsPlus, inspectFont, decodeFontBytes, type FontsPlus } from '../../runtime/services/FontsPlus';

let runtime: PluginRuntime | undefined;
afterEach(async () => { await runtime?.destroy(); runtime = undefined; });
it('activates official settings, restores independent targets, and removes the asset through the bridge', async () => {
  document.body.innerHTML = '<div id="tab-editor"><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
  localStorage.clear();
  const manager = new PluginManager();
  let fontsPlus: unknown = { filename: '<font>.ttf', applyGame: false, applyEditor: true, bold: false, italic: false };
  const api = { exportGameData: () => ({ fontsPlus }), getFontsPlusCapabilities: () => ({ bold: { switchable: false }, italic: { switchable: false } }), setFontsPlus: (next: unknown) => { fontsPlus = next; return Promise.resolve(); } } as unknown as TinyRpgApi;
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(parsePluginHtml(source));
  const root = document.getElementById('tab-editor');
  if (!root) throw Error('Missing editor');
  runtime.start(root, api);
  await runtime.settled();
  expect(document.querySelector('input[type=file]')?.getAttribute('accept')).toBe('.ttf');
  const checks = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  expect(checks.map(input => input.checked)).toEqual([false, true, false, false]);
  expect(checks.slice(2).every(input => input.disabled)).toBe(true);
  expect(document.body.textContent).toContain('<font>.ttf');
  document.querySelector<HTMLButtonElement>('[aria-label="Remove font"]')?.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fontsPlus).toBeNull();
  expect(checks.every(input => input.disabled)).toBe(true);
});

it('embeds hostile filenames safely alongside the matching gameplay package and reloadable bytes', async () => {
  const { readFileSync } = await vi.importActual<{ readFileSync: (path: string) => Uint8Array }>('node:fs');
  const state = new GameState();
  state.importGameData({ ...state.exportGameData() as object, gameplayPlugins: [{ id: 'fonts-plus', version: '1.0.0' }],
    fontsPlus: { filename: '</script><script>alert(1)</script>.ttf', data: fontBytesToBase64(new Uint8Array(readFileSync('tests/fixtures/fonts/pixel-operator.ttf'))) } });
  const result = assembleExportHtml({ css: '', editableInStudio: false, fontDataUrl: '', gameCode: '', gameMarkup: '', locale: 'en-US', openStudioLabel: 'Open Studio', runtimeJavaScript: '', title: 'Font game', bundledProject: { game: state.exportGameData(), plugins: [parsePluginHtml(source)] } });
  const doc = new DOMParser().parseFromString(result.html, 'text/html');
  expect([...doc.scripts].some(script => script.textContent === 'alert(1)')).toBe(false);
  const text = doc.getElementById('tiny-rpg-project')?.textContent;
  if (!text) throw Error('Missing bundled project');
  const bundled = JSON.parse(text) as { game: unknown; plugins: { id: string }[] };
  const restored = new GameState();
  restored.importGameData(bundled.game);
  expect(restored.game.fontsPlus).toEqual(state.game.fontsPlus);
  expect(bundled.plugins.map(plugin => plugin.id)).toEqual(['fonts-plus']);
});

it('uploads with defaults, preserves a working file on errors, and ignores a late read after a project switch', async () => {
  const { readFileSync } = await vi.importActual<{ readFileSync: (path: string) => Uint8Array }>('node:fs');
  const bytes = new Uint8Array(readFileSync('tests/fixtures/fonts/pixel-operator.ttf'));
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
  let fontsPlus: FontsPlus | undefined;
  const setFontsPlus = vi.fn((next: unknown) => {
    fontsPlus = normalizeFontsPlus(next, [{ id: 'fonts-plus', version: '1.0.0' }]);
    return Promise.resolve();
  });
  const api = { setFontsPlus, exportGameData: () => ({ fontsPlus }), getFontsPlusCapabilities: () => fontsPlus && inspectFont(decodeFontBytes(fontsPlus.data)) } as unknown as TinyRpgApi;
  const manager = new PluginManager();
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(parsePluginHtml(source));
  const root = document.getElementById('tab-editor');
  if (!root) throw Error('Missing root');
  runtime.start(root, api);
  await runtime.settled();
  const input = document.querySelector<HTMLInputElement>('input[type=file]');
  if (!input) throw Error('Missing picker');
  const choose = (name: string, arrayBuffer = () => Promise.resolve(bytes.buffer)) => {
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name, size: bytes.length, arrayBuffer }] });
    input.dispatchEvent(new Event('change'));
  };
  choose('regular.ttf');
  await vi.waitFor(() => expect(document.querySelector('.fonts-plus-filename')?.textContent).toBe('regular.ttf'));
  expect([...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].map(c => c.checked)).toEqual([true, true, false, false]);
  expect(input.disabled).toBe(false);
  expect(input.value).toBe('');
  choose('wrong.otf');
  await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toMatch(/ttf/i));
  expect(fontsPlus?.filename).toBe('regular.ttf');
  expect(setFontsPlus).toHaveBeenCalledTimes(1);
  let finish!: (data: ArrayBuffer) => void;
  choose('late.ttf', () => new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
  expect(input.disabled).toBe(true);
  fontsPlus = undefined;
  document.dispatchEvent(new Event('tiny-rpg-project-changing'));
  finish(bytes.buffer);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(setFontsPlus).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.fonts-plus-filename')?.textContent).toBe('');
});
