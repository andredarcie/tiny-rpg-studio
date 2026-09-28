import { beforeEach, expect, it, vi } from 'vitest';
import { PluginManager } from '../../editor/manager/PluginManager';
import type { PluginContext, PluginModule } from '../../editor/manager/PluginRuntime';
import { PluginRuntime } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';

const pkg = { id: 'demo', title: 'Demo', shortDescription: 'Short', fullDescription: 'Full', payload: { apiVersion: 1 as const, javascript: 'demo', css: '.demo {}' } };
beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
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
  tiles.click();
  expect(listener).toHaveBeenCalledOnce();
  expect(getComputedStyle(world).display).toBe('none');
  expect(root.querySelector('#example-plugin-toggle')).toBeNull();
  manager.remove('example-plugin');
  await runtime.settled();
  expect(tiles.parentNode).toBe(parent);
  expect(tiles.nextSibling).toBe(next);
  expect(npcs.parentNode).toBe(npcParent);
  expect(npcs.nextSibling).toBe(npcNext);
  expect(root.querySelector('#example-plugin-toggle')).toBeNull();
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


it('applies Minimalist UI to current and new cards and restores the localized interface', async () => {
  const { default: html } = await import('../../../index.html?raw');
  const { default: source } = await import('../../../examples/minimalist-ui.html?raw');
  const { default: published } = await import('../../../public/plugins/minimalist-ui/1.0.2/plugin.html?raw');
  const { default: catalog } = await import('../../../public/plugins/catalog.json');
  const { parsePluginHtml } = await import('../../editor/manager/PluginManager');
  expect(published).toBe(source);
  const plugin = parsePluginHtml(source);
  const entry = catalog.plugins.find(entry => entry.id === plugin.id);
  expect(entry).toMatchObject({ id: plugin.id, title: plugin.title, shortDescription: plugin.shortDescription, fullDescription: plugin.fullDescription, version: '1.0.2', file: 'minimalist-ui/1.0.2/plugin.html' });
  document.body.innerHTML = html;
  const root = document.getElementById('tab-editor') as HTMLElement;
  root.insertAdjacentHTML('beforeend', '<div class="enemy-xp-block">XP</div><div class="npc-card"><canvas></canvas><div class="meta">NPC name</div><button class="sprite-edit-btn">Edit</button></div><div class="enemy-card"><canvas></canvas><div class="enemy-meta">Enemy name</div></div><div class="object-type-card"><canvas></canvas><div class="object-type-meta">Object description</div></div>');
  const manager = new PluginManager();
  const runtime = new PluginRuntime(manager, source => {
    const factory = new Function(source.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  const developmentTab = root.querySelector<HTMLButtonElement>('[data-project-tab-button="development"]');
  const infoTab = root.querySelector<HTMLButtonElement>('[data-project-tab-button="info"]');
  if (!developmentTab || !infoTab) throw Error('Missing project tabs');
  const originalTitle = developmentTab.textContent;
  const selectInfo = vi.spyOn(infoTab, 'click');
  const restoreTab = vi.spyOn(developmentTab, 'click');
  manager.install(plugin);
  runtime.start(root, {} as TinyRpgApi);
  await runtime.settled();
  expect(runtime.getState(plugin.id).status).toBe('active');
  const element = (selector: string): HTMLElement => {
    const found = document.querySelector<HTMLElement>(selector);
    if (!found) throw Error('Missing ' + selector);
    return found;
  };
  const selectors = ['.enemy-xp-block', '.npc-card .meta', '.enemy-meta', '.object-type-meta', '.editor-section--world', '#pixel-art-editor-modal .tiny-modal__header', '.pae-sprite-meta', '.pae-tile-effect-label', '.pae-tools'];
  for (const selector of selectors) expect(getComputedStyle(element(selector)).display).toBe('none');
  const project = element('[data-text-key="sections.project"]').closest('details');
  expect(project?.open).toBe(false);
  project?.setAttribute('open', '');
  expect(project?.open).toBe(true);
  const tab = element('[data-project-tab-button="development"]');
  expect(tab.textContent).toBe(originalTitle);
  expect(selectInfo).toHaveBeenCalledOnce();
  project?.removeAttribute('open');
  const label = element('[data-text-key="pixelArtEditor.mergeEdges"]');
  expect(label.nextElementSibling?.textContent).toBe('Merge');
  label.textContent = 'Updated localized label';
  root.insertAdjacentHTML('beforeend', '<div class="npc-card"><div class="meta" id="new-npc-name">New name</div></div>');
  expect(getComputedStyle(element('#new-npc-name')).display).toBe('none');
  expect(getComputedStyle(element('.npc-card canvas')).display).not.toBe('none');
  expect(getComputedStyle(element('.sprite-edit-btn')).display).not.toBe('none');
  manager.remove(plugin.id);
  await runtime.settled();
  for (const selector of selectors) expect(getComputedStyle(element(selector)).display).not.toBe('none');
  expect(label.nextElementSibling).toBeNull();
  expect(label.textContent).toBe('Updated localized label');
  expect(project?.open).toBe(true);
  expect(tab.textContent).toBe(originalTitle);
  expect(restoreTab).toHaveBeenCalledOnce();
  expect(tab.dataset.textKey).toBe('project.group.development');
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
