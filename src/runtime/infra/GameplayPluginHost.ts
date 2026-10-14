import { normalizePluginData } from '../domain/state/PluginData';
import type { HudPresentationProvider } from '../adapters/renderer/HudPresentation';
import type { GameEngine } from '../services/GameEngine';
import type { GameDefinition } from '../../types/gameState';
import type { InstalledPlugin } from '../../editor/manager/PluginManager';
import type { NpcDialogueSequence } from '../domain/dialoguePlus';
import type { VariablePreset } from '../domain/state/StateVariableManager';

export class GameplayLoadSupersededError extends Error {
  constructor() { super('The project changed during gameplay plugin loading'); }
}

export type GameplayDependency = { id: string; version: string };
export type GameplayContext = {
  apiVersion: 1;
  getWorld(): { rows: number; cols: number };
  resizeWorld(rows: number, cols: number): void;
  registerNpcDialogueSequence(sequence: NpcDialogueSequence): void;
  registerHudPresentation(provider: HudPresentationProvider): void;
  registerVariablePresets(presets: VariablePreset[]): void;
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
  private loadGeneration = 0;
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

  async load(data: unknown, available = this.packages(), rollback = true, isCurrent: () => boolean = () => true): Promise<void> {
    const project = data as Partial<GameDefinition> | null;
    if (!project || typeof project !== 'object') throw Error('Invalid project data');
    const dependencies = project.gameplayPlugins ?? [];
    if (!Array.isArray(dependencies)) throw Error('Invalid gameplay plugin dependencies');
    if (project.online?.enabled && dependencies.some(item => item.id === 'variables-plus')) throw Error('Variables+ projects cannot use online mode');
    if (new Set(dependencies.map(item => item.id)).size !== dependencies.length) throw Error('Duplicate gameplay plugin dependencies');
    const required = dependencies.map(dependency => {
      const plugin = available.find(item => item.id === dependency.id && item.version === dependency.version && item.capabilities?.includes('gameplay'));
      if (!plugin?.payload?.gameplayJavascript) throw Error(`Required gameplay plugin ${dependency.id}@${dependency.version} is unavailable`);
      return plugin;
    });
    normalizePluginData(project.pluginData, dependencies);
    const previous = this.engine.exportGameData();
    const previousPackages = this.packages();
    const previousDependencies = (previous as GameDefinition).gameplayPlugins ?? [];
    const generation = ++this.loadGeneration;
    const assertCurrent = () => {
      if (generation !== this.loadGeneration || !isCurrent()) throw new GameplayLoadSupersededError();
    };
    this.clear();
    const hudRegistrations: string[] = [];
    try {
      for (const plugin of required) {
        const cleanup: (() => void)[] = [];
        const source = plugin.payload?.gameplayJavascript;
        const version = plugin.version;
        if (!source || !version) throw Error(`Gameplay plugin ${plugin.id} has no executable payload`);
        const module = await this.loader(source);
        assertCurrent();
        if (typeof module.activate !== 'function') throw Error(`Gameplay plugin ${plugin.id} must export activate(context)`);
        this.active.set(plugin.id, { version, cleanup });
        await module.activate({
          apiVersion: 1,
          getWorld: () => ({ ...(this.engine.getGame() as unknown as GameDefinition).world }),
          resizeWorld: (rows, cols) => {
            assertCurrent();
            this.engine.gameState.worldManager.resizeWorld(rows, cols);
            const game = this.engine.getGame() as unknown as GameDefinition;
            game.gameplayPlugins = [...(game.gameplayPlugins ?? []).filter(item => item.id !== plugin.id), { id: plugin.id, version }];
          },
          registerNpcDialogueSequence: sequence => {
            assertCurrent();
            if (typeof sequence !== 'function') throw Error('NPC dialogue sequence must be a function');
            this.engine.setNpcDialogueSequence(sequence);
            cleanup.push(() => this.engine.setNpcDialogueSequence(null));
          },
          registerHudPresentation: provider => {
            assertCurrent();
            if (typeof provider !== 'function') throw Error('HUD presentation provider must be a function');
            cleanup.push(this.engine.registerHudPresentation(plugin.id, provider));
            hudRegistrations.push(plugin.id);
          },
          registerVariablePresets: presets => {
            assertCurrent();
            cleanup.push(this.engine.registerVariablePresets(presets));
          },
          onCleanup: callback => {
            if (generation !== this.loadGeneration) callback();
            else cleanup.push(callback);
          },
        });
      }
      assertCurrent();
      if (hudRegistrations.length) this.engine.validateHudPresentation(data);
      this.engine.importGameData(data);
    } catch (error) {
      if (generation !== this.loadGeneration) throw error;
      this.clear();
      if (!isCurrent()) throw error;
      if (rollback && previousDependencies.length) await this.load(previous, previousPackages, false);
      else this.engine.importGameData(previous);
      throw error;
    }
  }

  remove(id: string): void {
    this.loadGeneration++;
    const entry = this.active.get(id);
    if (!entry) return;
    for (const cleanup of entry.cleanup.reverse()) {
      try { cleanup(); } catch { /* Continue cleaning up. */ }
    }
    this.active.delete(id);
  }

  isActive(id: string, version: string): boolean { return this.active.get(id)?.version === version; }

  destroy(): void { this.loadGeneration++; this.clear(); }
}
