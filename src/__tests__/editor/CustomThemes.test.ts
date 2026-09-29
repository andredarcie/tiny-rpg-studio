import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/custom-themes/1.0.0/plugin.html?raw';
import catalog from '../../../public/plugins/catalog.json';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';

let runtime: PluginRuntime | undefined;
const storageKey = 'tiny-rpg-custom-themes-theme-v1';
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="tab-editor"><div class="editor-layout"><button id="original">Original</button><canvas></canvas></div></div><button id="outside">Outside</button>';
});
afterEach(async () => { await runtime?.destroy(); vi.restoreAllMocks(); });

async function setup() {
  const plugin = parsePluginHtml(source);
  const manager = new PluginManager();
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + '; return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(plugin);
  const root = element('#tab-editor');
  runtime.start(root, {} as TinyRpgApi);
  await runtime.settled();
  const trigger = element('.custom-themes-trigger') as HTMLButtonElement;
  const options = [...root.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  return { root, manager, trigger, options, plugin, runtime };
}

function element(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Missing element: ${selector}`);
  return node;
}

it('publishes matching catalog metadata and starts with Default above existing editor panels', async () => {
  const { root, trigger, options, plugin, runtime } = await setup();
  const { payload: _payload, ...metadata } = plugin;
  expect(catalog.plugins.find(entry => entry.id === plugin.id)).toEqual({ ...metadata, file: 'custom-themes/1.0.0/plugin.html' });
  expect(runtime.getState(plugin.id).status).toBe('active');
  expect(root.firstElementChild?.className).toBe('custom-themes-toolbar');
  expect(trigger.textContent).toBe('Theme: Default ▾');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(options.map(button => button.textContent)).toEqual(['Default', 'Darker', 'Dracula', 'Powershell', 'Light', 'Forest', 'Sepia']);
  expect(options[0].getAttribute('aria-checked')).toBe('true');
  expect(root.hasAttribute('data-custom-theme')).toBe(false);
});

it('switches every palette, closes after selection and restores Default without changing artwork or other tabs', async () => {
  const { root, trigger, options } = await setup();
  const canvas = root.querySelector('canvas');
  for (const option of options.slice(1)) {
    trigger.click();
    option.click();
    expect(root.getAttribute('data-custom-theme')).toBe(option.textContent.toLowerCase());
    expect(localStorage.getItem(storageKey)).toBe(option.textContent.toLowerCase());
    expect(options.filter(button => button.getAttribute('aria-checked') === 'true')).toEqual([option]);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  }
  trigger.click();
  options[0].click();
  expect(root.hasAttribute('data-custom-theme')).toBe(false);
  expect(localStorage.getItem(storageKey)).toBe('default');
  expect(root.querySelector('canvas')).toBe(canvas);
  expect(document.body.hasAttribute('data-custom-theme')).toBe(false);
  expect(document.documentElement.hasAttribute('data-custom-theme')).toBe(false);
});

it('supports keyboard navigation, Escape, Tab, outside clicks and leaving the control', async () => {
  const { trigger, options } = await setup();
  const key = (target: Element, value: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  key(trigger, 'ArrowDown');
  expect(document.activeElement).toBe(options[0]);
  key(options[0], 'ArrowUp');
  expect(document.activeElement).toBe(options[6]);
  key(options[6], 'Home');
  expect(document.activeElement).toBe(options[0]);
  key(options[0], 'End');
  expect(document.activeElement).toBe(options[6]);
  key(options[6], 'ArrowDown');
  expect(document.activeElement).toBe(options[0]);
  key(options[0], 'Escape');
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  key(trigger, 'ArrowUp');
  expect(document.activeElement).toBe(options[6]);
  key(options[6], 'Tab');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  trigger.click();
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  trigger.click();
  element('#outside').focus();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('cleans up colors, UI, styles and document listeners on removal and reinstalls once', async () => {
  const listener = vi.spyOn(document, 'removeEventListener');
  const { root, manager, trigger, options, plugin, runtime } = await setup();
  const original = document.getElementById('original');
  trigger.click();
  options[4].click();
  manager.remove(plugin.id);
  await runtime.settled();
  expect(root.hasAttribute('data-custom-theme')).toBe(false);
  expect(root.querySelector('.custom-themes-toolbar')).toBeNull();
  expect(document.querySelector('style[data-plugin-id="custom-themes"]')).toBeNull();
  expect(document.getElementById('original')).toBe(original);
  expect(listener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  manager.install(plugin);
  await runtime.settled();
  expect(root.querySelectorAll('.custom-themes-toolbar')).toHaveLength(1);
  expect(root.querySelector('.custom-themes-trigger')?.textContent).toBe('Theme: Light ▾');
  expect(root.getAttribute('data-custom-theme')).toBe('light');
});

it.each(['default', 'darker', 'dracula', 'powershell', 'light', 'forest', 'sepia'])('loads saved %s directly from plugin storage', async theme => {
  localStorage.setItem(storageKey, theme);
  const { root, trigger, options } = await setup();
  expect(root.getAttribute('data-custom-theme')).toBe(theme === 'default' ? null : theme);
  const checked = options.filter(button => button.getAttribute('aria-checked') === 'true');
  expect(checked).toHaveLength(1);
  expect(checked[0].textContent.toLowerCase()).toBe(theme);
  expect(trigger.textContent).toBe(`Theme: ${checked[0].textContent} ▾`);
  trigger.click();
  expect(document.activeElement).toBe(checked[0]);
});

it.each(['unknown', 'LIGHT', '', '{"theme":"light"}'])('falls back to Default for invalid saved value %s', async theme => {
  localStorage.setItem(storageKey, theme);
  const { root, trigger, options } = await setup();
  expect(root.hasAttribute('data-custom-theme')).toBe(false);
  expect(trigger.textContent).toBe('Theme: Default ▾');
  expect(options[0].getAttribute('aria-checked')).toBe('true');
});

it('keeps the plugin active and themes selectable when storage reads or writes fail', async () => {
  const getItem = Storage.prototype.getItem;
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (key === storageKey) throw new Error('Storage unavailable');
    return getItem.call(this, key);
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === storageKey) throw new Error('Storage unavailable');
    setItem.call(this, key, value);
  });
  const { root, trigger, options, runtime, plugin } = await setup();
  expect(trigger.textContent).toBe('Theme: Default ▾');
  trigger.click();
  options[4].click();
  expect(root.getAttribute('data-custom-theme')).toBe('light');
  expect(trigger.textContent).toBe('Theme: Light ▾');
  expect(options[4].getAttribute('aria-checked')).toBe('true');
  expect(runtime.getState(plugin.id).status).toBe('active');
});
