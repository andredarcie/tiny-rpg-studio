import { beforeEach, expect, it, vi } from 'vitest';
import { PluginManager } from '../../editor/manager/PluginManager';
import type { PluginContext, PluginModule } from '../../editor/manager/PluginRuntime';
import { PluginRuntime, renderNpcModalExtensions } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';

const pkg = { id: 'demo', title: 'Demo', shortDescription: 'Short', fullDescription: 'Full', payload: { apiVersion: 1 as const, javascript: 'demo', css: '.demo {}' } };
beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
const settingsRoot = () => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-project-tab-panel="plugins"><p data-plugin-settings-empty hidden></p><div data-plugin-settings-groups></div></div>';
  document.body.append(root);
  return root;
};
it('rebuilds NPC modal extensions and removes them with the plugin', async () => {
  const manager = new PluginManager();
  const runtime = new PluginRuntime(manager, () => Promise.resolve({ activate: context => {
    context.registerNpcModal(body => { body.textContent = 'Plugin controls'; });
  } }));
  manager.install(pkg);
  runtime.start(document.body, {} as TinyRpgApi);
  await runtime.settled();
  const first = document.createElement('div');
  const rebuilt = document.createElement('div');
  renderNpcModalExtensions(first, { id: 'npc-1' });
  renderNpcModalExtensions(rebuilt, { id: 'npc-1' });
  expect(first.textContent).toBe('Plugin controls');
  expect(rebuilt.textContent).toBe('Plugin controls');
  manager.remove(pkg.id);
  await runtime.settled();
  const restored = document.createElement('div');
  renderNpcModalExtensions(restored, { id: 'npc-1' });
  expect(restored.textContent).toBe('');
  await runtime.destroy();
});
it('groups settings by installed title and toggles the empty state', async () => {
  const root = settingsRoot();
  const manager = new PluginManager();
  const runtime = new PluginRuntime(manager, () => Promise.resolve({ activate: context => {
    if (context.editorRoot.dataset.noSettings) return;
    context.registerSettings(container => { container.append(document.createElement('input')); });
    context.registerSettings(container => { container.append(document.createElement('button')); });
  } }));
  manager.install(pkg);
  manager.install({ ...pkg, id: 'other', title: 'Other' });
  runtime.start(root, {} as TinyRpgApi);
  await runtime.settled();
  expect(root.querySelectorAll('[data-plugin-settings-group]')).toHaveLength(2);
  const groups = [...root.querySelectorAll<HTMLDetailsElement>('[data-plugin-settings-group]')];
  expect(groups.every(group => group.matches('details.project-card[open]'))).toBe(true);
  expect(groups.map(group => group.querySelector('summary')?.textContent)).toEqual(['Demo', 'Other']);
  expect(root.querySelectorAll('[data-plugin-settings-group] input')).toHaveLength(2);
  expect(root.querySelectorAll('[data-plugin-settings-group] button')).toHaveLength(2);
  groups[0].open = false;
  expect(groups[1].open).toBe(true);
  expect((root.querySelector('[data-plugin-settings-empty]') as HTMLElement).hidden).toBe(true);
  manager.remove('demo');
  manager.remove('other');
  await runtime.settled();
  expect(root.querySelectorAll('[data-plugin-settings-group]')).toHaveLength(0);
  expect((root.querySelector('[data-plugin-settings-empty]') as HTMLElement).hidden).toBe(false);
  root.dataset.noSettings = 'true';
  manager.install(pkg);
  await runtime.settled();
  expect(root.querySelectorAll('[data-plugin-settings-group]')).toHaveLength(0);
  await runtime.destroy();
});
it('removes settings on failure, replacement, destruction and rejects stale async registrations', async () => {
  const root = settingsRoot();
  const manager = new PluginManager();
  let stale!: PluginContext;
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const runtime = new PluginRuntime(manager, source => Promise.resolve({ activate: async context => {
    if (source === 'demo') {
      stale = context;
      context.registerSettings(container => { container.textContent = 'old'; });
      await pending;
      context.registerSettings(container => { container.textContent = 'late'; });
    } else if (source === 'failure') {
      context.registerSettings(container => { container.textContent = 'failure'; });
      throw Error('failed');
    } else context.registerSettings(container => { container.textContent = 'new'; });
  } }));
  manager.install(pkg);
  runtime.start(root, {} as TinyRpgApi);
  await vi.waitFor(() => expect(stale).toBeDefined());
  manager.install({ ...pkg, payload: { ...pkg.payload, javascript: 'replacement' } });
  expect(() => stale.registerSettings(() => {})).toThrow();
  finish();
  await runtime.settled();
  expect(root.querySelectorAll('[data-plugin-settings-group]')).toHaveLength(1);
  expect(root.querySelector('[data-plugin-settings-group]')?.textContent).toContain('new');
  manager.install({ ...pkg, payload: { ...pkg.payload, javascript: 'failure' } });
  await runtime.settled();
  expect(root.querySelectorAll('[data-plugin-settings-group]')).toHaveLength(0);
  manager.install({ ...pkg, payload: { ...pkg.payload, javascript: 'replacement' } });
  await runtime.settled();
  await runtime.destroy();
  expect(root.querySelectorAll('[data-plugin-settings-group]')).toHaveLength(0);
});
it('defers activation, activates once, and cleans up replacement/removal in reverse order', async () => {
  const manager = new PluginManager();
  const calls: number[] = [];
  const activate = vi.fn(({ onCleanup }: PluginContext) => { onCleanup(() => calls.push(1)); onCleanup(() => calls.push(2)); });
  const runtime = new PluginRuntime(manager, () => Promise.resolve({ activate }));
  manager.install(pkg);
  await runtime.settled();
  expect(activate).not.toHaveBeenCalled();
  runtime.start(document.body, {} as TinyRpgApi);
  await runtime.settled();
  manager.install(pkg);
  await runtime.settled();
  expect(activate).toHaveBeenCalledTimes(1);
  manager.install({ ...pkg, payload: { ...pkg.payload, javascript: 'replacement' } });
  await runtime.settled();
  expect(calls).toEqual([2, 1]);
  expect(activate).toHaveBeenCalledTimes(2);
  manager.remove(pkg.id);
  await runtime.settled();
  expect(document.querySelector('style')).toBeNull();
  expect(calls).toEqual([2, 1, 2, 1]);
  await runtime.destroy();
});
it('isolates partial failures and drains cleanup even when a callback throws', async () => {
  const manager = new PluginManager();
  const cleanup = vi.fn();
  const runtime = new PluginRuntime(manager, source => Promise.resolve({ activate: context => {
    context.onCleanup(cleanup);
    context.onCleanup(() => { throw Error('cleanup'); });
    if (source === 'demo') throw Error('activation failed');
  } }));
  manager.install(pkg);
  manager.install({ ...pkg, id: 'good', payload: { ...pkg.payload, javascript: 'good' } });
  runtime.start(document.body, {} as TinyRpgApi);
  await runtime.settled();
  expect(runtime.getState('demo')).toEqual({ status: 'failed', error: 'activation failed' });
  expect(runtime.getState('good').status).toBe('active');
  expect(cleanup).toHaveBeenCalledTimes(1);
  await runtime.destroy();
  expect(cleanup).toHaveBeenCalledTimes(2);
});
it('removal during loading prevents late activation', async () => {
  const manager = new PluginManager();
  const activate = vi.fn();
  let resolve!: (module: { activate: typeof activate }) => void;
  const runtime = new PluginRuntime(manager, () => new Promise(done => { resolve = done; }));
  manager.install(pkg);
  runtime.start(document.body, {} as TinyRpgApi);
  await Promise.resolve();
  manager.remove(pkg.id);
  resolve({ activate });
  await runtime.settled();
  expect(activate).not.toHaveBeenCalled();
  expect(document.querySelector('style')).toBeNull();
  await runtime.destroy();
});

it('runs the actual example with preserved panel nodes, listeners and restoration', async () => {
  const { default: html } = await import('../../../index.html?raw');
  const { default: source } = await import('../../../examples/plugin-preview.html?raw');
  const { parsePluginHtml } = await import('../../editor/manager/PluginManager');
  document.body.innerHTML = html;
  const root = document.getElementById('tab-editor') as HTMLElement;
  const tiles = root.querySelector('.editor-section--tiles') as HTMLElement;
  const npcs = root.querySelector('.editor-section--npcs') as HTMLElement;
  const world = root.querySelector('.editor-section--world') as HTMLElement;
  const parent = tiles.parentNode;
  const next = tiles.nextSibling;
  const npcParent = npcs.parentNode;
  const npcNext = npcs.nextSibling;
  const listener = vi.fn();
  tiles.addEventListener('click', listener);
  const manager = new PluginManager();
  const runtime = new PluginRuntime(manager, source => {
    const factory = new Function(source.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  manager.install(parsePluginHtml(source));
  runtime.start(root, {} as TinyRpgApi);
  await runtime.settled();
  expect(root.querySelector('.editor-right')?.firstElementChild).toBe(tiles);
  expect(root.querySelector('.editor-left')?.firstElementChild).toBe(npcs);
  const flip = root.querySelector<HTMLInputElement>('#example-plugin-flip');
  if (!flip) throw Error('Example plugin Flip checkbox is missing');
  expect(flip.checked).toBe(true);
  expect(flip.closest('label')?.textContent).toBe('Flip');
  flip.checked = false;
  flip.dispatchEvent(new Event('change'));
  expect(tiles.parentNode).toBe(parent);
  expect(tiles.nextSibling).toBe(next);
  expect(npcs.parentNode).toBe(npcParent);
  expect(npcs.nextSibling).toBe(npcNext);
  flip.checked = true;
  flip.dispatchEvent(new Event('change'));
  expect(root.querySelector('.editor-right')?.firstElementChild).toBe(tiles);
  expect(root.querySelector('.editor-left')?.firstElementChild).toBe(npcs);
  tiles.click();
  expect(listener).toHaveBeenCalledOnce();
  expect(getComputedStyle(world).display).toBe('none');
  expect(root.querySelector('#example-plugin-flip')).toBe(flip);
  manager.remove('example-plugin');
  await runtime.settled();
  expect(tiles.parentNode).toBe(parent);
  expect(tiles.nextSibling).toBe(next);
  expect(npcs.parentNode).toBe(npcParent);
  expect(npcs.nextSibling).toBe(npcNext);
  expect(root.querySelector('#example-plugin-flip')).toBeNull();
  expect(getComputedStyle(world).display).not.toBe('none');
  await runtime.destroy();
});
it('keeps active effects unchanged after a storage failure', async () => {
  const manager = new PluginManager();
  const cleanup = vi.fn();
  const runtime = new PluginRuntime(manager, () => Promise.resolve({ activate: context => context.onCleanup(cleanup) }));
  manager.install(pkg);
  runtime.start(document.body, {} as TinyRpgApi);
  await runtime.settled();
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  expect(manager.remove(pkg.id)).toBe(false);
  expect(manager.install({ ...pkg, version: '2.0.0' })).toBe(false);
  await runtime.settled();
  expect(cleanup).not.toHaveBeenCalled();
  expect(runtime.getState(pkg.id).status).toBe('active');
  spy.mockRestore();
  await runtime.destroy();
});

it('cleans effects registered during asynchronous activation after removal', async () => {
  const manager = new PluginManager();
  const cleanup = vi.fn();
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const started = vi.fn();
  const runtime = new PluginRuntime(manager, () => Promise.resolve({ activate: async context => {
    started();
    await pending;
    context.onCleanup(cleanup);
  } }));
  manager.install(pkg);
  runtime.start(document.body, {} as TinyRpgApi);
  await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
  manager.remove(pkg.id);
  finish();
  await runtime.settled();
  expect(cleanup).toHaveBeenCalledOnce();
  expect(document.querySelector('style[data-plugin-id]')).toBeNull();
  await runtime.destroy();
});


it('cleans old effects and styles before version-only replacement activation', async () => {
  const manager = new PluginManager();
  const events: string[] = [];
  const runtime = new PluginRuntime(manager, () => {
    expect(document.querySelector('style[data-plugin-id]')).toBeNull();
    return Promise.resolve({ activate: context => {
      events.push('activate');
      context.onCleanup(() => { events.push('cleanup'); });
    } });
  });
  manager.install({ ...pkg, version: '1.0.0' });
  runtime.start(document.body, {} as TinyRpgApi);
  await runtime.settled();
  manager.install({ ...pkg, version: '1.0.1' });
  await runtime.settled();
  expect(events).toEqual(['activate', 'cleanup', 'activate']);
  await runtime.destroy();
});

it('reports replacement activation failures after cleaning the old runtime', async () => {
  const manager = new PluginManager();
  const cleanup = vi.fn();
  const loader = vi.fn().mockResolvedValueOnce({ activate: ({ onCleanup }: PluginContext) => onCleanup(cleanup) })
    .mockRejectedValueOnce(Error('replacement failed'));
  const runtime = new PluginRuntime(manager, loader);
  manager.install({ ...pkg, version: '1.0.0' });
  runtime.start(document.body, {} as TinyRpgApi);
  await runtime.settled();
  manager.install({ ...pkg, version: '1.0.1' });
  await runtime.settled();
  expect(cleanup).toHaveBeenCalledOnce();
  expect(document.querySelector('style[data-plugin-id]')).toBeNull();
  expect(runtime.getState(pkg.id)).toEqual({ status: 'failed', error: 'replacement failed' });
  expect(new PluginManager().installed).toEqual([{ ...pkg, version: '1.0.1' }]);
  await runtime.destroy();
});
