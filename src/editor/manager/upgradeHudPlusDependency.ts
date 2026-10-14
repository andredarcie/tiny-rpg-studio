import type { InstalledPlugin } from './PluginManager';
import type { GameDefinition } from '../../types/gameState';

export function upgradeHudPlusDependency<T extends object>(data: T, packages: InstalledPlugin[]): T {
  const installed = packages.find(item => item.id === 'hud-plus' && item.version === '1.0.1' &&
    item.capabilities?.includes('gameplay') && item.payload?.gameplayJavascript);
  if (!installed) return data;
  const dependencies = (data as GameDefinition).gameplayPlugins;
  if (!dependencies?.some(item => item.id === 'hud-plus' && item.version === '1.0.0')) return data;
  return { ...data, gameplayPlugins: dependencies.map(item => item.id === 'hud-plus' && item.version === '1.0.0'
    ? { id: item.id, version: '1.0.1' } : item) } as T;
}
