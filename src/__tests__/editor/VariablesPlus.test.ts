import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/variables-plus/1.0.0/plugin.html?raw';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';
import { TinyRPG } from '../../sdk/index';
import { GameState } from '../../runtime/domain/GameState';

let runtime: PluginRuntime | undefined;
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div id="project-variable-usage-list"></div><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
});
afterEach(async () => { await runtime?.destroy(); vi.restoreAllMocks(); });

it('enables its project dependency on installation and after creating a new project, without settings', async () => {
  const plugin = parsePluginHtml(source);
  const manager = new PluginManager();
  const game: { gameplayPlugins?: { id: string; version: string }[] } = {};
  const api = {
    exportGameData: vi.fn(() => game),
    enableVariablesPlus: vi.fn(() => { game.gameplayPlugins = [{ id: 'variables-plus', version: '1.0.0' }]; return Promise.resolve(); }),
  } as unknown as TinyRpgApi;
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export async function activate', 'async function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  expect(manager.install(plugin)).toBe(true);
  runtime.start(document.getElementById('tab-editor') as HTMLElement, api);
  await runtime.settled();
  expect(api.enableVariablesPlus).toHaveBeenCalledOnce();
  expect(game.gameplayPlugins).toEqual([{ id: 'variables-plus', version: '1.0.0' }]);
  expect(document.querySelector('[data-plugin-settings-group="variables-plus"]')).toBeNull();
  game.gameplayPlugins = [];
  document.getElementById('project-variable-usage-list')?.append(document.createElement('span'));
  await vi.waitFor(() => expect(api.enableVariablesPlus).toHaveBeenCalledTimes(2));
  manager.remove(plugin.id);
  await runtime.settled();
  game.gameplayPlugins = [];
  document.getElementById('project-variable-usage-list')?.append(document.createElement('span'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(api.enableVariablesPlus).toHaveBeenCalledTimes(2);
});

it('registers all 16 distinct color presets through the gameplay module', () => {
  const plugin = parsePluginHtml(source);
  const factory = new Function(plugin.payload?.gameplayJavascript?.replace('export function activate', 'function activate') + ';return { activate };') as () => { activate(context: { apiVersion: number; registerVariablePresets: (presets: { id: string; order: number; color: string }[]) => void }): void };
  const registerVariablePresets = vi.fn();
  factory().activate({ apiVersion: 1, registerVariablePresets });
  const presets = registerVariablePresets.mock.calls[0]?.[0] as { id: string; order: number; color: string }[];
  expect(presets.map(preset => preset.id)).toEqual(Array.from({ length: 16 }, (_, index) => `var-${index + 17}`));
  expect(presets.map(preset => preset.order)).toEqual(Array.from({ length: 16 }, (_, index) => index + 17));
  expect(new Set(presets.map(preset => preset.color)).size).toBe(16);
});

it('bundles the dependency and all 32 slots into a standalone project that reloads', () => {
  const plugin = parsePluginHtml(source);
  const builder = new TinyRPG().enableVariablesPlus();
  for (let index = 1; index <= 32; index++) builder.variable(`Slot ${index}`, { initial: index === 32 });
  builder.room(0).addSwitch({ x: 2, y: 2, variable: 32 });
  const game = builder.toProjectData();
  const { html } = assembleExportHtml({
    css: '', editableInStudio: false, fontDataUrl: '', gameCode: '', gameMarkup: '',
    locale: 'en-US', openStudioLabel: 'Open Studio', runtimeJavaScript: '', title: 'Variables+ game',
    bundledProject: { game, plugins: [plugin] },
  });
  const projectText = new DOMParser().parseFromString(html, 'text/html').getElementById('tiny-rpg-project')?.textContent;
  if (!projectText) throw Error('Standalone project was not embedded');
  const bundled = JSON.parse(projectText) as { game: ReturnType<TinyRPG['toProjectData']>; plugins: typeof plugin[] };
  expect(bundled.plugins[0].payload?.gameplayJavascript).toBe(plugin.payload?.gameplayJavascript);
  const state = new GameState();
  const factory = new Function(bundled.plugins[0].payload?.gameplayJavascript?.replace('export function activate', 'function activate') + ';return { activate };') as () => { activate(context: { apiVersion: number; registerVariablePresets: (presets: Parameters<GameState['registerVariablePresets']>[0]) => void }): void };
  factory().activate({ apiVersion: 1, registerVariablePresets: presets => { state.registerVariablePresets(presets); } });
  state.importGameData(bundled.game);
  expect(state.game.variables).toHaveLength(32);
  expect(state.game.variables[31]).toMatchObject({ id: 'var-32', value: true });
  expect(state.game.objects.some(object => object.variableId === 'var-32')).toBe(true);
});
