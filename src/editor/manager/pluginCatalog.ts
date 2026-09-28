import type { PluginMetadata } from './PluginManager';

const PLUGIN_CATALOG: readonly PluginMetadata[] = [
  {
    id: 'weather-preview', title: 'Weather effects',
    shortDescription: 'Imagine rain and snow in your adventure.',
    fullDescription: 'A mock concept for configurable rain and snow. Installing this preview only saves its listing; it does not change your game.',
  },
  {
    id: 'quest-journal-preview', title: 'Quest journal',
    shortDescription: 'A place for players to track their quests.',
    fullDescription: 'A mock concept for a journal of objectives and discoveries. This preview has no runtime behavior and adds no journal to your game.',
  },
  {
    id: 'dialog-themes-preview', title: 'Dialog themes',
    shortDescription: 'Explore a concept for custom dialog styles.',
    fullDescription: 'A mock concept for styling conversations. Installing this preview stores metadata only; no HTML, JavaScript, or CSS is loaded.',
  },
];

export function searchPlugins(query: string): Promise<PluginMetadata[]> {
  const term = query.trim().toLowerCase();
  return Promise.resolve(PLUGIN_CATALOG.filter(plugin =>
    [plugin.title, plugin.shortDescription, plugin.fullDescription].some(text => text.toLowerCase().includes(term)),
  ).map(plugin => ({ ...plugin })));
}
