import type { HudPresentationProvider, HudPart, HudResources } from '../../runtime/adapters/renderer/HudPresentation';
import { expect, it } from 'vitest';
import source from '../../../public/plugins/hud-plus/1.0.1/plugin.html?raw';
import { parsePluginHtml } from '../../editor/manager/PluginManager';

function provider() {
  const plugin = parsePluginHtml(source);
  let resolve: HudPresentationProvider | undefined;
  const factory = new Function((plugin.payload?.gameplayJavascript ?? "").replace('export function activate', 'function activate') + ';return {activate};') as () => { activate(context: { registerHudPresentation: (fn: HudPresentationProvider) => void }): void };
  const module = factory();
  module.activate({ registerHudPresentation: (fn: typeof resolve) => { resolve = fn; } });
  if (!resolve) throw Error('Provider was not registered');
  return resolve;
}
const hearts: HudResources["hearts"] = { full: Array.from({length:8}, () => Array.from({length:8}, () => 8)), empty: Array.from({length:8}, () => Array.from({length:8}, () => null)) };
const resources = { palette: Array.from({length:16}, () => '#abc'), hearts };
it('preserves defaults and six independent visibility choices', () => {
  const resolve = provider();
  expect(resolve({ ...resources, data: undefined }).mode).toBe('bars');
  for (const part of ['health','level','xp','minimap','items','gear'] as HudPart[]) {
    const result = resolve({ ...resources, data: { visible: { [part]: false } } });
    expect(result.visible[part]).toBe(false);
    expect(Object.values(result.visible).filter(Boolean)).toHaveLength(5);
  }
  expect(Object.values(resolve({ ...resources, data: { visible: Object.fromEntries(['health','level','xp','minimap','items','gear'].map(key => [key,false])), mode:'overlay' } }).visible).some(Boolean)).toBe(false);
});
it('resolves palette indices without confusing repeated colors and rejects malformed art', () => {
  const resolve = provider();
  const art = structuredClone(hearts);
  art.full[0][0] = 7;
  expect(resolve({ ...resources, data: { hearts: art } }).hearts?.full[0][0]).toBe('#abc');
  const palette = resources.palette.slice(); palette[7] = '#fff';
  expect(resolve({ palette, hearts, data: { hearts: art } }).hearts?.full[0][0]).toBe('#fff');
  expect(() => resolve({ ...resources, data: { hearts: { full: [[16]], empty: hearts.empty } } })).toThrow();
  expect(() => resolve({ ...resources, data: { mode: 'bad' } })).toThrow();
});

import { afterEach, beforeEach, vi } from 'vitest';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import { PluginManager } from '../../editor/manager/PluginManager';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import type { JsonValue } from '../../runtime/domain/state/PluginData';
let runtime: PluginRuntime | undefined;
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
});
afterEach(async () => { await runtime?.destroy(); vi.restoreAllMocks(); });
function editor() {
  const game: { pluginData?: Record<string, JsonValue> } = {};
  const mutate = vi.fn((id: string, value: JsonValue | undefined) => {
    if (value === undefined) delete game.pluginData?.[id];
    else game.pluginData = { ...game.pluginData, [id]: structuredClone(value) };
    return Promise.resolve();
  });
  const api = { exportGameData: () => game, getHudResources: () => structuredClone(resources), setPluginData: mutate } as unknown as TinyRpgApi;
  const manager = new PluginManager();
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate','function activate') + ';return {activate};') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(parsePluginHtml(source));
  const root = document.getElementById('tab-editor');
  if (!root) throw Error('No root');
  runtime.start(root,api);
  return { game,mutate,manager };
}
const click = (root: ParentNode, text: string) => {
  const button = [...root.querySelectorAll('button')].find(node => node.textContent === text);
  if (!button) throw Error(`No ${text} button`);
  button.click();
};
it('registers project settings, saves toggles and mode, refreshes restored data, and cleans listeners', async () => {
  const {game,mutate} = editor();
  await runtime?.settled();
  expect(mutate).not.toHaveBeenCalled();
  const checks = [...document.querySelectorAll<HTMLInputElement>('[data-hud-part]')];
  expect(checks).toHaveLength(6);
  expect(checks.every(input => input.checked)).toBe(true);
  for (const input of checks) {
    input.checked = false; input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(input.disabled).toBe(false));
  }
  expect(mutate).toHaveBeenCalledTimes(6);
  const mode = document.querySelector('select');
  if (!mode) throw Error('No mode');
  mode.value = 'overlay'; mode.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(mode.disabled).toBe(false));
  expect(game.pluginData?.['hud-plus']).toMatchObject({ mode:'overlay',visible:{health:false,level:false,xp:false,minimap:false,items:false,gear:false} });
  game.pluginData = { 'hud-plus':{visible:{health:true},mode:'bars'} };
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(checks.every(input => input.checked)).toBe(true);
  expect(mode.value).toBe('bars');
  await runtime?.destroy();
  mutate.mockClear();
  checks[0].dispatchEvent(new Event('change'));
  document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(mutate).not.toHaveBeenCalled();
});
it('keeps full/empty drafts local until saved, cancels, erases, and resets artwork', async () => {
  const {game,mutate} = editor(); await runtime?.settled();
  for (const kind of ['full','empty']) {
    const section = document.querySelector(`[data-heart="${kind}"]`);
    if (!section) throw Error('No heart');
    click(section,'Edit artwork');
    const pixel = section.querySelector<HTMLButtonElement>('.hud-plus-grid button');
    if (!pixel) throw Error('No pixel');
    const swatch = section.querySelector<HTMLButtonElement>('[aria-label="Palette color 7"]');
    swatch?.click(); pixel.click();
    expect(mutate).not.toHaveBeenCalled();
    click(section,'Cancel');
    click(section,'Edit artwork');
    section.querySelector<HTMLButtonElement>('[aria-label="Palette color 7"]')?.click(); pixel.click();
    click(section,'Save artwork');
    await vi.waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(pixel.disabled).toBe(false));
    expect((game.pluginData?.['hud-plus'] as {hearts:Record<string,(number|null)[][]>}).hearts[kind][0][0]).toBe(7);
    mutate.mockClear();
    click(section,'Edit artwork'); click(section,'Erase'); pixel.click(); click(section,'Save artwork');
    await vi.waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(pixel.disabled).toBe(false));
    const saved = game.pluginData?.['hud-plus'] as { hearts: Record<string,(number|null)[][]> };
    expect(saved.hearts[kind][0][0]).toBeNull();
    click(section,'Reset artwork');
    await vi.waitFor(() => expect(pixel.disabled).toBe(false));
    expect((game.pluginData?.['hud-plus'] as typeof saved).hearts[kind]).toEqual(hearts[kind as 'full'|'empty']);
    mutate.mockClear();
  }
  const beforeReset = structuredClone(game.pluginData);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  click(document,'Reset HUD settings');
  expect(confirm).toHaveBeenCalledWith('Are you sure?');
  expect(mutate).not.toHaveBeenCalled();
  expect(game.pluginData).toEqual(beforeReset);
  confirm.mockReturnValue(true);
  click(document,'Reset HUD settings');
  await vi.waitFor(() => expect(game.pluginData?.['hud-plus']).toBeUndefined());
});
it('shows mutation errors and restores saved controls', async () => {
  const {mutate} = editor(); await runtime?.settled();
  mutate.mockRejectedValueOnce(Error('Cannot save'));
  const input = document.querySelector<HTMLInputElement>('[data-hud-part]');
  if (!input) throw Error('No input');
  input.checked = false; input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Cannot save'));
  expect(input.checked).toBe(true);
});

it('validates size multipliers and makes overlay inventory translucent', () => {
  const resolve = provider();
  expect(resolve({...resources,data:undefined}).scale).toBe(1);
  for (const size of [0.1,0.5,1]) expect(resolve({...resources,data:{size}}).scale).toBe(size);
  for (const size of [0,1.1,'0.5',null]) expect(() => resolve({...resources,data:{size}})).toThrow('size');
  expect(resolve({...resources,data:{mode:'overlay'}}).inventoryOpacity).toBe(0.5);
  expect(resolve({...resources,data:{mode:'bars'}}).inventoryOpacity).toBe(1);
});
it('saves Size, rejects out-of-range input, and refreshes restored size', async () => {
  const {game,mutate} = editor(); await runtime?.settled();
  const input = document.querySelector<HTMLInputElement>('[aria-label="Size"]');
  if (!input) throw Error('No Size input');
  expect(input.value).toBe('1');
  input.value = '0.5'; input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(game.pluginData?.['hud-plus']).toMatchObject({size:0.5}));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  mutate.mockClear(); input.value = '0'; input.dispatchEvent(new Event('change'));
  expect(mutate).not.toHaveBeenCalled();
  game.pluginData = {'hud-plus':{size:0.1}}; document.dispatchEvent(new Event('tiny-rpg-project-restored'));
  expect(input.value).toBe('0.1');
});
it('paints and erases by dragging, stops on release, and keeps strokes local until saved', async () => {
  const {game,mutate} = editor(); await runtime?.settled();
  const section = document.querySelector('[data-heart="full"]'); if (!section) throw Error('No heart');
  click(section,'Edit artwork');
  section.querySelector<HTMLButtonElement>('[aria-label="Palette color 7"]')?.click();
  const pixels = section.querySelectorAll<HTMLButtonElement>('.hud-plus-grid button');
  pixels[0].dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,buttons:1}));
  pixels[1].dispatchEvent(new MouseEvent('pointerover',{bubbles:true,buttons:1}));
  document.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));
  pixels[2].dispatchEvent(new MouseEvent('pointerover',{bubbles:true,buttons:0}));
  expect(mutate).not.toHaveBeenCalled();
  click(section,'Save artwork'); await vi.waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(pixels[0].disabled).toBe(false));
  const saved = game.pluginData?.['hud-plus'] as {hearts:{full:(number|null)[][]}};
  expect(saved.hearts.full[0].slice(0,3)).toEqual([7,7,8]);
  click(section,'Edit artwork'); click(section,'Erase');
  pixels[0].dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,buttons:1}));
  pixels[1].dispatchEvent(new MouseEvent('pointerover',{bubbles:true,buttons:1}));
  document.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));
  click(section,'Save artwork'); await vi.waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
  expect((game.pluginData?.['hud-plus'] as typeof saved).hearts.full[0].slice(0,3)).toEqual([null,null,8]);
});

import { upgradeHudPlusDependency } from '../../editor/manager/upgradeHudPlusDependency';
it('upgrades existing projects to the installed HUD release without altering saved customization', () => {
  const plugin = parsePluginHtml(source);
  const project = {gameplayPlugins:[{id:'hud-plus',version:'1.0.0'}],pluginData:{'hud-plus':{mode:'overlay',hearts}}};
  const upgraded = upgradeHudPlusDependency(project,[plugin]);
  expect(upgraded.gameplayPlugins).toEqual([{id:'hud-plus',version:'1.0.1'}]);
  expect(upgraded.pluginData).toEqual(project.pluginData);
  expect(project.gameplayPlugins[0].version).toBe('1.0.0');
  expect(upgradeHudPlusDependency(project,[])).toBe(project);
});
