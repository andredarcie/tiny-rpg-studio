import { expect, it, vi } from 'vitest';
import { GameplayPluginHost, type GameplayContext } from '../../runtime/infra/GameplayPluginHost';
import type { GameEngine } from '../../runtime/services/GameEngine';
import type { InstalledPlugin } from '../../editor/manager/PluginManager';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';
import type { DialoguePlusNpc } from '../../runtime/domain/dialoguePlus';

const plugin: InstalledPlugin = {
  id: 'maps', version: '1', title: 'Maps', shortDescription: 'Maps', fullDescription: 'Maps',
  capabilities: ['gameplay'], payload: { apiVersion: 1, gameplayJavascript: 'export function activate() {}' },
};

it('rejects missing dependencies without replacing the current project', async () => {
  const importGameData = vi.fn();
  const engine = { exportGameData: () => ({ title: 'old' }), importGameData } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine, () => []);
  await expect(host.load({ gameplayPlugins: [{ id: 'maps', version: '1' }] })).rejects.toThrow('unavailable');
  expect(importGameData).not.toHaveBeenCalled();
});

it('cleans effects and restores the previous project after activation fails', async () => {
  const cleanup = vi.fn();
  const importGameData = vi.fn();
  const engine = { exportGameData: () => ({ title: 'old' }), importGameData } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine, () => [plugin], () => Promise.resolve({ activate: ({ onCleanup }) => {
    onCleanup(cleanup);
    throw Error('failed');
  } }));
  await expect(host.load({ gameplayPlugins: [{ id: 'maps', version: '1' }] })).rejects.toThrow('failed');
  expect(cleanup).toHaveBeenCalledOnce();
  expect(importGameData).toHaveBeenCalledWith({ title: 'old' });
});

it('embeds complete plugin projects without a misleading URL or Studio action', () => {
  const result = assembleExportHtml({
    css: '', editableInStudio: true, fontDataUrl: '', gameCode: '', gameMarkup: '', locale: 'en-US',
    openStudioLabel: 'Open Studio', runtimeJavaScript: '', title: 'Game',
    bundledProject: { game: { world: { rows: 3, cols: 5 }, title: '</script>' }, plugins: [plugin] },
  });
  expect(result.html).toContain('tiny-rpg-project');
  expect(result.html).toContain('"rows":3,"cols":5');
  expect(result.html).toContain('\\u003C/script>');
  expect(result.html).toContain('id="btn-open-studio" type="button" hidden');
  expect(result.html).not.toContain('location.hash="#"');
});

it('registers and cleans an NPC dialogue sequence through the gameplay bridge', async () => {
  const sequence = vi.fn((npc: DialoguePlusNpc) => npc.dialoguePlus);
  const setNpcDialogueSequence = vi.fn();
  const engine = {
    exportGameData: () => ({ title: 'old' }),
    importGameData: vi.fn(),
    setNpcDialogueSequence,
  } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine, () => [plugin], () => Promise.resolve({
    activate: ({ registerNpcDialogueSequence }) => registerNpcDialogueSequence(sequence),
  }));
  await host.load({ gameplayPlugins: [{ id: 'maps', version: '1' }] });
  expect(setNpcDialogueSequence).toHaveBeenCalledWith(sequence);
  host.remove('maps');
  expect(setNpcDialogueSequence).toHaveBeenLastCalledWith(null);
});

it('registers variable presets before import and cleans them when the project changes', async () => {
  const cleanup = vi.fn();
  const registerPresets = vi.fn(() => cleanup);
  const importGameData = vi.fn();
  const engine = {
    exportGameData: () => ({ title: 'old' }), importGameData,
    registerVariablePresets: registerPresets,
  } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine, () => [plugin], () => Promise.resolve({
    activate: ({ registerVariablePresets }) => registerVariablePresets([{
      id: 'var-17', order: 17, nameKey: '', fallbackName: 'Crimson', color: '#DC143C',
    }]),
  }));
  await host.load({ gameplayPlugins: [{ id: 'maps', version: '1' }] });
  expect(registerPresets).toHaveBeenCalledOnce();
  expect(registerPresets.mock.invocationCallOrder[0]).toBeLessThan(importGameData.mock.invocationCallOrder[0]);
  await host.load({ title: 'base' });
  expect(cleanup).toHaveBeenCalledOnce();
});

it('rejects online mode for a Variables+ dependency', async () => {
  const importGameData = vi.fn();
  const engine = { exportGameData: () => ({ title: 'old' }), importGameData } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine, () => []);
  await expect(host.load({ online: { enabled: true }, gameplayPlugins: [{ id: 'variables-plus', version: '1.0.0' }] })).rejects.toThrow(/online mode/);
  expect(importGameData).not.toHaveBeenCalled();
});

it('reactivates the previous variable presets before rollback import', async () => {
  const previous = { title: 'previous', gameplayPlugins: [{ id: 'variables-plus', version: '1.0.0' }] };
  let current: object = { title: 'base' };
  let presetsActive = false;
  const importGameData = vi.fn((data: object) => {
    if ('gameplayPlugins' in data && !presetsActive) throw Error('Variable presets missing on import');
    current = data;
  });
  const variables = { ...plugin, id: 'variables-plus', version: '1.0.0', payload: { apiVersion: 1 as const, gameplayJavascript: 'variables' } };
  const broken = { ...plugin, id: 'broken', payload: { apiVersion: 1 as const, gameplayJavascript: 'broken' } };
  const engine = {
    exportGameData: () => current,
    importGameData,
    registerVariablePresets: vi.fn(() => { presetsActive = true; return () => { presetsActive = false; }; }),
  } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine, () => [variables, broken], source => Promise.resolve({
    activate: ({ registerVariablePresets }) => {
      if (source === 'broken') throw Error('Activation failed');
      registerVariablePresets([{ id: 'var-17', order: 17, nameKey: '', fallbackName: 'Crimson', color: '#DC143C' }]);
    },
  }));
  await host.load(previous);
  await expect(host.load({ gameplayPlugins: [{ id: 'broken', version: '1' }] })).rejects.toThrow('Activation failed');
  expect(current).toEqual(previous);
  expect(presetsActive).toBe(true);
  expect(importGameData).toHaveBeenLastCalledWith(previous);
});

import hudSource from '../../../public/plugins/hud-plus/1.0.1/plugin.html?raw';
import { parsePluginHtml } from '../../editor/manager/PluginManager';
import { DEFAULT_HEARTS, DEFAULT_HUD_PRESENTATION, type HudPresentationProvider } from '../../runtime/adapters/renderer/HudPresentation';
it('activates the packaged HUD before import, validates incoming data, and restores prior rendering on failure', async () => {
  const hud = parsePluginHtml(hudSource);
  let project: { gameplayPlugins?: {id:string;version:string}[]; pluginData?: Record<string,unknown> } = {};
  let provider: HudPresentationProvider | undefined;
  const cleanup = vi.fn(() => {provider = undefined;});
  const resolve = (data: typeof project) => provider?.({palette:Array.from({length:16},(_,index) => String(index)),hearts:DEFAULT_HEARTS,data:data.pluginData?.['hud-plus']}) ?? DEFAULT_HUD_PRESENTATION;
  const imported: unknown[] = [];
  const engine = {
    exportGameData:() => structuredClone(project),
    importGameData:(data: typeof project) => { imported.push(resolve(data)); project = structuredClone(data); },
    registerHudPresentation:(_id: string,next:HudPresentationProvider) => { provider = next; return cleanup; },
    validateHudPresentation:(data:typeof project) => {resolve(data);},
  } as unknown as GameEngine;
  const host = new GameplayPluginHost(engine,() => [hud],source => {
    const factory = new Function(source.replace('export function activate','function activate') + ';return {activate};') as () => { activate(context: GameplayContext):void };
    return Promise.resolve(factory());
  });
  const dependencies = [{id:'hud-plus',version:'1.0.1'}];
  await host.load({gameplayPlugins:dependencies,pluginData:{'hud-plus':{mode:'overlay',visible:{health:false}}}});
  expect(imported[0]).toMatchObject({mode:'overlay',visible:{health:false}});
  await expect(host.load({gameplayPlugins:dependencies,pluginData:{'hud-plus':{mode:'bad'}}})).rejects.toThrow('HUD+ mode');
  expect(resolve(project)).toMatchObject({mode:'overlay',visible:{health:false}});
  host.destroy(); expect(cleanup).toHaveBeenCalled(); expect(resolve(project).mode).toBe('bars');
  await host.load({}); expect(resolve(project).visible.health).toBe(true);
});

it('does not import an obsolete HUD mutation after project replacement', async () => {
  let finish: (() => void) | undefined;
  const pause = new Promise<void>(resolve => {finish = resolve;});
  const importGameData = vi.fn();
  const engine = {exportGameData:() => ({title:'old'}),importGameData} as unknown as GameEngine;
  const host = new GameplayPluginHost(engine,() => [plugin],async () => { await pause; return {activate:() => {}}; });
  const obsolete = host.load({title:'obsolete',gameplayPlugins:[{id:'maps',version:'1'}]});
  await host.load({title:'current'});
  finish?.();
  await expect(obsolete).rejects.toThrow('changed');
  expect(importGameData).toHaveBeenCalledTimes(1);
  expect(importGameData).toHaveBeenCalledWith({title:'current'});
});
