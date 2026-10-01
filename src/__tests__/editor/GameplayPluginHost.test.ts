import { expect, it, vi } from 'vitest';
import { GameplayPluginHost } from '../../runtime/infra/GameplayPluginHost';
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
