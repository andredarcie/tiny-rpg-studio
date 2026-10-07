import type { InstalledPlugin } from './PluginManager';
import type { GameDefinition } from '../../types/gameState';

export function upgradeMusicPlusDependency<T extends object>(data: T, packages: InstalledPlugin[]): T {
  const versions = ['1.0.0', '1.0.1', '1.0.2', '1.0.3'];
  const installed = versions.reduce<InstalledPlugin | undefined>((best, version) =>
    packages.find(item => item.id === 'music-plus' && item.version === version &&
      item.capabilities?.includes('gameplay') && item.payload?.gameplayJavascript) ?? best, undefined);
  if (!installed) return data;
  const dependencies = (data as GameDefinition).gameplayPlugins;
  const shouldUpgrade = (item: { id: string; version: string }) => item.id === 'music-plus' && versions.indexOf(item.version) >= 0 &&
    versions.indexOf(item.version) < versions.indexOf(installed.version ?? '');
  if (!dependencies?.some(shouldUpgrade)) return data;
  return {
    ...data,
    gameplayPlugins: dependencies.map(item => shouldUpgrade(item) ? { id: item.id, version: installed.version ?? '1.0.3' } : item),
  } as T;
}
