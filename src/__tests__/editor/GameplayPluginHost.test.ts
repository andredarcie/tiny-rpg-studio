import { expect, it, vi } from 'vitest';
import { GameplayPluginHost } from '../../runtime/infra/GameplayPluginHost';
import type { GameEngine } from '../../runtime/services/GameEngine';
import type { InstalledPlugin } from '../../editor/manager/PluginManager';
import { assembleExportHtml } from '../../editor/modules/export/ExportHtmlAssembler';

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
