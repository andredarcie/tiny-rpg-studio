import type { GameEngine } from '../services/GameEngine';
import type { GameDefinition } from '../../types/gameState';
import type { InstalledPlugin } from '../../editor/manager/PluginManager';

export type GameplayDependency = { id: string; version: string };
export type GameplayContext = {
  apiVersion: 1;
  getWorld(): { rows: number; cols: number };
  resizeWorld(rows: number, cols: number): void;
  onCleanup(callback: () => void): void;
};
type GameplayModule = { activate(context: GameplayContext): void | Promise<void> };
export type GameplayLoader = (source: string) => Promise<GameplayModule>;

export const loadGameplayModule: GameplayLoader = async source => {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try { return await import(/* @vite-ignore */ url) as GameplayModule; }
  finally { URL.revokeObjectURL(url); }
};

export class GameplayPluginHost {
  private active = new Map<string, { version: string; cleanup: (() => void)[] }>();
  private engine: GameEngine;
  private packages: () => InstalledPlugin[];
  private loader: GameplayLoader;
  constructor(engine: GameEngine, packages: () => InstalledPlugin[], loader: GameplayLoader = loadGameplayModule) {
    this.engine = engine;
    this.packages = packages;
    this.loader = loader;
  }

  private clear(): void {
    for (const entry of [...this.active.values()].reverse()) for (const cleanup of entry.cleanup.reverse()) {
      try { cleanup(); } catch { /* Continue cleaning up other plugins. */ }
    }
    this.active.clear();
  }

  async load(data: unknown, available = this.packages(), rollback = true): Promise<void> {
    const project = data as Partial<GameDefinition> | null;
    if (!project || typeof project !== 'object') throw Error('Invalid project data');
    const dependencies = project.gameplayPlugins ?? [];
    if (!Array.isArray(dependencies)) throw Error('Invalid gameplay plugin dependencies');
    if (new Set(dependencies.map(item => item.id)).size !== dependencies.length) throw Error('Duplicate gameplay plugin dependencies');
    const required = dependencies.map(dependency => {
      const plugin = available.find(item => item.id === dependency.id && item.version === dependency.version && item.capabilities?.includes('gameplay'));
      if (!plugin?.payload?.gameplayJavascript) throw Error(`Required gameplay plugin ${dependency.id}@${dependency.version} is unavailable`);
      return plugin;
    });
    const previous = this.engine.exportGameData();
    const previousPackages = this.packages();
    const previousDependencies = (previous as GameDefinition).gameplayPlugins ?? [];
    this.clear();
    try {
      for (const plugin of required) {
        const cleanup: (() => void)[] = [];
        const source = plugin.payload?.gameplayJavascript;
        const version = plugin.version;
        if (!source || !version) throw Error(`Gameplay plugin ${plugin.id} has no executable payload`);
        const module = await this.loader(source);
        if (typeof module.activate !== 'function') throw Error(`Gameplay plugin ${plugin.id} must export activate(context)`);
        this.active.set(plugin.id, { version, cleanup });
        await module.activate({
          apiVersion: 1,
          getWorld: () => ({ ...(this.engine.getGame() as unknown as GameDefinition).world }),
          resizeWorld: (rows, cols) => {
            this.engine.gameState.worldManager.resizeWorld(rows, cols);
            const game = this.engine.getGame() as unknown as GameDefinition;
            game.gameplayPlugins = [...(game.gameplayPlugins ?? []).filter(item => item.id !== plugin.id), { id: plugin.id, version }];
          },
          onCleanup: callback => cleanup.push(callback),
        });
      }
      this.engine.importGameData(data);
    } catch (error) {
      this.clear();
      this.engine.importGameData(previous);
      if (rollback && previousDependencies.length) await this.load(previous, previousPackages, false);
      throw error;
    }
  }

  remove(id: string): void {
    const entry = this.active.get(id);
    if (!entry) return;
    for (const cleanup of entry.cleanup.reverse()) {
      try { cleanup(); } catch { /* Continue cleaning up. */ }
    }
    this.active.delete(id);
  }

  isActive(id: string, version: string): boolean { return this.active.get(id)?.version === version; }

  destroy(): void { this.clear(); }
}
