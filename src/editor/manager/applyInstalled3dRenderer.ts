import type { InstalledPlugin } from './PluginManager';
import type { GameDefinition } from '../../types/gameState';

export function applyInstalled3dRenderer<T extends object>(data: T, packages: InstalledPlugin[], replace = false): T {
    const installed = packages.find(plugin => plugin.id === '3d-renderer' && plugin.version
        && plugin.capabilities?.includes('gameplay') && plugin.payload?.gameplayJavascript);
    if (!installed) return data;
    const dependencies = (data as Partial<GameDefinition>).gameplayPlugins ?? [];
    if (!Array.isArray(dependencies)) return data;
    if (dependencies.some(item => item.id === installed.id && item.version === installed.version)) return data;
    if (!replace && dependencies.some(item => item.id === installed.id)) return data;
    return { ...data, gameplayPlugins: [...dependencies.filter(item => item.id !== installed.id),
        { id: installed.id, version: installed.version }] };
}
