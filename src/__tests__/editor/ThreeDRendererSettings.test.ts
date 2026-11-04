import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import source from '../../../public/plugins/3d-renderer/1.0.0/plugin.html?raw';
import { PluginManager, parsePluginHtml } from '../../editor/manager/PluginManager';
import { PluginRuntime, type PluginModule } from '../../editor/manager/PluginRuntime';
import type { TinyRpgApi } from '../../runtime/infra/TinyRpgApi';
import type { JsonValue } from '../../runtime/domain/state/PluginData';

let runtime: PluginRuntime | undefined;
beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="tab-editor"><button data-project-tab-button="plugins">Plugins</button><div data-project-tab-panel="plugins"><p data-plugin-settings-empty></p><div data-plugin-settings-groups></div></div></div>';
});
afterEach(async () => { await runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

const setup = async (initial?: Record<string, JsonValue>) => {
    const game: { pluginData?: Record<string, JsonValue> } = { pluginData: structuredClone(initial) };
    const palette = Array.from({ length: 16 }, (_, index) => `#${index.toString(16).repeat(6)}`);
    const save = vi.fn((id: string, data: JsonValue | undefined) => {
        game.pluginData = { ...game.pluginData, [id]: structuredClone(data ?? {}) };
        document.dispatchEvent(new Event('tiny-rpg-project-restored'));
        return Promise.resolve();
    });
    const api = { exportGameData: () => structuredClone(game), setPluginData: save, getHudResources: () => ({ palette: [...palette] }) } as unknown as TinyRpgApi;
    const manager = new PluginManager(); manager.install(parsePluginHtml(source));
    runtime = new PluginRuntime(manager, javascript => {
        const factory = new Function(javascript.replace('export function activate', 'function activate') + ';return {activate};') as () => PluginModule;
        return Promise.resolve(factory());
    });
    const root = document.getElementById('tab-editor'); if (!root) throw Error('Missing editor');
    runtime.start(root, api); await runtime.settled();
    const select = (label: string) => {
        const node = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
        if (!node) throw Error(`Missing ${label}`); return node;
    };
    return { game, palette, save, manager, select };
};

it('adds two palette choices under the plugin group, saves indices independently, and supports defaults', async () => {
    const { game, save, select } = await setup();
    expect(document.querySelector('[data-plugin-settings-group="3d-renderer"] > summary')?.textContent).toBe('3D Renderer');
    const top = select('Top void'); const bottom = select('Bottom void');
    expect(top.options).toHaveLength(17); expect(bottom.options).toHaveLength(17);
    expect(top.value).toBe(''); expect(bottom.value).toBe(''); expect(save).not.toHaveBeenCalled();
    top.value = '0'; top.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(top.disabled).toBe(false));
    bottom.value = '12'; bottom.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(bottom.disabled).toBe(false));
    expect(game.pluginData?.['3d-renderer']).toEqual({ topColor: 0, bottomColor: 12 });
    top.value = ''; top.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(top.disabled).toBe(false));
    expect(game.pluginData?.['3d-renderer']).toEqual({ bottomColor: 12 });
});

it('refreshes project and palette changes, reports failed saves, and cleans up on uninstall', async () => {
    const { game, palette, save, manager, select } = await setup();
    const top = select('Top void'); const bottom = select('Bottom void');
    game.pluginData = { '3d-renderer': { topColor: 8, bottomColor: 5 } };
    document.dispatchEvent(new Event('tiny-rpg-project-restored'));
    expect(top.value).toBe('8'); expect(bottom.value).toBe('5');
    palette[8] = '#123456'; top.dispatchEvent(new FocusEvent('focus'));
    expect(top.options.namedItem('three-d-topColor-color-8')?.textContent).toContain('#123456');
    save.mockRejectedValueOnce(Error('Storage full'));
    top.value = '9'; top.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(top.disabled).toBe(false));
    expect(top.value).toBe('8'); expect(document.querySelector('[role="alert"]')?.textContent).toContain('Storage full');
    game.pluginData = {}; document.dispatchEvent(new Event('tiny-rpg-project-restored'));
    expect(top.value).toBe(''); expect(bottom.value).toBe('');
    manager.remove('3d-renderer'); await runtime?.settled();
    expect(document.querySelector('[data-plugin-settings-group="3d-renderer"]')).toBeNull();
    save.mockClear(); top.dispatchEvent(new Event('change'));
    expect(save).not.toHaveBeenCalled();
});

it('restores serialized palette indices after reopening the plugin', async () => {
    const first = await setup();
    const top = first.select('Top void'); top.value = '8'; top.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(top.disabled).toBe(false));
    const saved = JSON.parse(JSON.stringify(first.game.pluginData)) as Record<string, JsonValue>;
    await runtime?.destroy();
    const reopened = await setup(saved);
    expect(reopened.select('Top void').value).toBe('8');
    expect(reopened.select('Bottom void').value).toBe('');
    expect(reopened.save).not.toHaveBeenCalled();
});

it('keeps the new project settings when a save from the previous project fails late', async () => {
    const { game, save, select } = await setup();
    let reject!: (reason: Error) => void;
    save.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    const top = select('Top void'); top.value = '8'; top.dispatchEvent(new Event('change'));
    expect(top.disabled).toBe(true);
    game.pluginData = { '3d-renderer': { topColor: 3 } };
    document.dispatchEvent(new Event('tiny-rpg-project-restored'));
    reject(Error('Old project failed'));
    await vi.waitFor(() => expect(top.disabled).toBe(false));
    expect(top.value).toBe('3'); expect(document.querySelector('[role="alert"]')?.textContent).toBe('');
});

it('defaults the distance gradient on, persists disabling it, and restores it across projects and failed saves', async () => {
    const { game, save, select } = await setup();
    const checkbox = document.querySelector<HTMLInputElement>('input[aria-label="Distance gradient"]');
    if (!checkbox) throw Error('Missing distance gradient checkbox');
    expect(checkbox.checked).toBe(true);
    checkbox.click();
    await vi.waitFor(() => expect(checkbox.disabled).toBe(false));
    expect(game.pluginData?.['3d-renderer']).toEqual({ distanceGradient: false });
    const top = select('Top void'); top.value = '8'; top.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(top.disabled).toBe(false));
    expect(game.pluginData?.['3d-renderer']).toEqual({ distanceGradient: false, topColor: 8 });
    const saved = JSON.parse(JSON.stringify(game.pluginData)) as Record<string, JsonValue>;
    await runtime?.destroy();
    const reopened = await setup(saved);
    const restored = document.querySelector<HTMLInputElement>('input[aria-label="Distance gradient"]');
    if (!restored) throw Error('Missing restored distance gradient checkbox');
    expect(restored.checked).toBe(false);
    reopened.save.mockRejectedValueOnce(Error('Storage full'));
    restored.click();
    await vi.waitFor(() => expect(restored.disabled).toBe(false));
    expect(restored.checked).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Storage full');
    restored.click();
    await vi.waitFor(() => expect(restored.disabled).toBe(false));
    expect(reopened.game.pluginData?.['3d-renderer']).toEqual({ distanceGradient: true, topColor: 8 });
    reopened.game.pluginData = {}; document.dispatchEvent(new Event('tiny-rpg-project-restored'));
    expect(restored.checked).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
});

it('saves the initial direction independently and restores it after reopening, failures, and project changes', async () => {
    const { game, select, save } = await setup({ '3d-renderer': { topColor: 8, distanceGradient: false } });
    const direction = select('Initial direction');
    expect(Array.from(direction.options).map(option => option.textContent)).toEqual(['North', 'South', 'West', 'East']);
    expect(direction.value).toBe('0');
    direction.value = '3'; direction.dispatchEvent(new Event('change'));
    expect(direction.disabled).toBe(true);
    await vi.waitFor(() => expect(direction.disabled).toBe(false));
    expect(game.pluginData?.['3d-renderer']).toEqual({ topColor: 8, distanceGradient: false, initialDirection: 3 });
    save.mockRejectedValueOnce(Error('Storage full'));
    direction.value = '2'; direction.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(direction.disabled).toBe(false));
    expect(direction.value).toBe('3');
    const saved = JSON.parse(JSON.stringify(game.pluginData)) as Record<string, JsonValue>;
    await runtime?.destroy();
    const reopened = await setup(saved);
    expect(reopened.select('Initial direction').value).toBe('3');
    reopened.game.pluginData = { '3d-renderer': { initialDirection: 99 } };
    document.dispatchEvent(new Event('tiny-rpg-project-restored'));
    expect(reopened.select('Initial direction').value).toBe('0');
    reopened.game.pluginData = { '3d-renderer': { initialDirection: 1 } };
    document.dispatchEvent(new Event('tiny-rpg-project-restored'));
    expect(reopened.select('Initial direction').value).toBe('1');
});
