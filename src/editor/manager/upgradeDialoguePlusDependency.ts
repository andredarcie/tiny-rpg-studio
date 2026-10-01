import type { InstalledPlugin } from './PluginManager';
import type { GameDefinition } from '../../types/gameState';

export function upgradeDialoguePlusDependency<T extends object>(data: T, packages: InstalledPlugin[]): T {
  const dependencies = (data as GameDefinition).gameplayPlugins;
  const available = packages.filter(item => item.id === 'dialogue-plus' && item.capabilities?.includes('gameplay') &&
    item.payload?.gameplayJavascript);
  const replacement = available.find(item => item.version === '1.0.2') ?? available.find(item => item.version === '1.0.1');
  if (!replacement) return data;
  const previousVersions = replacement.version === '1.0.2' ? ['1.0.0', '1.0.1'] : ['1.0.0'];
  if (!dependencies?.some(item => item.id === 'dialogue-plus' && previousVersions.includes(item.version))) return data;
  return {
    ...data,
    gameplayPlugins: dependencies.map(item => item.id === 'dialogue-plus' && previousVersions.includes(item.version)
      ? { id: item.id, version: replacement.version } : item),
  } as T;
}
