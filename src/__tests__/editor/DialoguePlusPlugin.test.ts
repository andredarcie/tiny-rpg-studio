import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/dialogue-plus/1.0.2/plugin.html?raw';
import oldSource from '../../../public/plugins/dialogue-plus/1.0.0/plugin.html?raw';
import previousSource from '../../../public/plugins/dialogue-plus/1.0.1/plugin.html?raw';
import { parsePluginHtml, PluginManager } from '../../editor/manager/PluginManager';
import { PluginRuntime, renderNpcModalExtensions, type PluginModule } from '../../editor/manager/PluginRuntime';
import { upgradeDialoguePlusDependency } from '../../editor/manager/upgradeDialoguePlusDependency';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import type { DialoguePlusBlock } from '../../runtime/domain/dialoguePlus';

let runtime: PluginRuntime | undefined;
beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
afterEach(async () => { await runtime?.destroy(); vi.restoreAllMocks(); });

it('colors and numbers variable options while keeping special options and selected text white', async () => {
  const plugin = parsePluginHtml(source);
  const manager = new PluginManager();
  const setNpcDialogueBlocks = vi.fn((_id: string, blocks: DialoguePlusBlock[]) => Promise.resolve(blocks));
  const api = {
    getVariables: () => [
      { id: 'var-1', name: 'Black', color: '#000000' },
      { id: 'var-17', name: 'Crimson', color: '#DC143C' },
      { id: 'var-32', name: 'Charcoal', color: '#36454F' },
    ],
    setNpcDialogueBlocks,
  } as unknown as TinyRpgApi;
  runtime = new PluginRuntime(manager, javascript => {
    const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return { activate };') as () => PluginModule;
    return Promise.resolve(factory());
  });
  expect(manager.install(plugin)).toBe(true);
  runtime.start(document.body, api);
  await runtime.settled();
  const body = document.createElement('div');
  body.className = 'npc-edit-modal__body';
  document.body.append(body);
  renderNpcModalExtensions(body, { id: 'npc-1', dialoguePlus: [
    { id: 'alternative', kind: 'alternative', conditionVariableId: 'var-17', text: 'Hello', rewardVariableId: 'var-1', disappearAfterDialog: false },
    { id: 'choice', kind: 'choice', prompt: 'Choose', yesText: 'Yes', noText: 'No', yesVariableId: 'var-32', noVariableId: null, disappearAfterDialog: false },
  ] });
  const selects = [...body.querySelectorAll<HTMLSelectElement>('.dialogue-plus select')];
  expect(selects).toHaveLength(4);
  for (const select of selects) {
    expect(select.querySelector<HTMLOptionElement>('[value=""]')?.style.color).toBe('rgb(255, 255, 255)');
    const original = select.querySelector<HTMLOptionElement>('[value="var-1"]');
    const extra = select.querySelector<HTMLOptionElement>('[value="var-17"]');
    expect(original?.textContent).toBe('Black');
    expect(original?.style.color).toBe('rgb(0, 0, 0)');
    expect(extra?.textContent).toBe('17. Crimson');
    expect(extra?.style.color).toBe('rgb(220, 20, 60)');
    expect(select.querySelector<HTMLOptionElement>('[value="var-32"]')?.textContent).toBe('32. Charcoal');
    expect(select.style.color).toBe('rgb(255, 255, 255)');
  }
  expect(selects[0].querySelector<HTMLOptionElement>('[value="skill:bard"]')?.style.color).toBe('rgb(255, 255, 255)');
  expect(selects[1].querySelector<HTMLOptionElement>('[value="END_GAME"]')?.style.color).toBe('rgb(255, 255, 255)');
  selects[0].value = 'var-32';
  selects[0].dispatchEvent(new Event('change'));
  expect(selects[0].style.color).toBe('rgb(255, 255, 255)');
  await vi.waitFor(() => expect(setNpcDialogueBlocks).toHaveBeenCalled());
});

it('upgrades older Dialogue+ project dependencies to the installed version', () => {
  const old = parsePluginHtml(oldSource);
  const previous = parsePluginHtml(previousSource);
  const latest = parsePluginHtml(source);
  const project = { gameplayPlugins: [{ id: 'dialogue-plus', version: '1.0.0' }, { id: 'variables-plus', version: '1.0.0' }] };
  expect(upgradeDialoguePlusDependency(project, [old])).toBe(project);
  expect(upgradeDialoguePlusDependency(project, [previous]).gameplayPlugins[0].version).toBe('1.0.1');
  const upgraded = upgradeDialoguePlusDependency(project, [latest]);
  expect(upgraded.gameplayPlugins).toEqual([{ id: 'dialogue-plus', version: '1.0.2' }, { id: 'variables-plus', version: '1.0.0' }]);
  expect(upgradeDialoguePlusDependency({ gameplayPlugins: [{ id: 'dialogue-plus', version: '1.0.1' }] }, [latest]).gameplayPlugins[0].version).toBe('1.0.2');
  expect(project.gameplayPlugins[0].version).toBe('1.0.0');
});
