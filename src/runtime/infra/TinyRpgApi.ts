import type { BaseRuntimeApi } from './BaseRuntimeApi';
import type { AuthoringApi } from './AuthoringApi';
import type { InstalledPlugin } from '../../editor/manager/PluginManager';
import type { DialoguePlusBlock } from '../domain/dialoguePlus';
import type { SoundName, SoundOverride } from '../services/SoundsPlus';
import type { MusicAsset } from '../services/MusicPlus';

type TinyRpgApi = {
  runtime?: BaseRuntimeApi;
  authoring?: AuthoringApi;
  exportGameData: () => unknown;
  importGameData: (data: unknown) => void;
  loadProjectData?: (data: unknown, packages?: InstalledPlugin[]) => Promise<void>;
  resizeWorld?: (rows: number, cols: number, pluginId: string) => Promise<void>;
  enableVariablesPlus?: () => Promise<void>;
  setSoundOverride?: (name: SoundName, asset: SoundOverride | null) => Promise<void>;
  setRoomMusic?: (roomIndex: number, asset: MusicAsset | null) => Promise<void>;
  setMusicPlusSmoothTransition?: (enabled: boolean) => Promise<void>;
  setMusicPlusFadeDurationSeconds?: (seconds: number) => Promise<void>;
  setNpcDialogueBlocks?: (npcId: string, blocks: unknown, pluginId: string) => Promise<DialoguePlusBlock[]>;
  getState: () => unknown;
  draw: () => void;
  resetGame: () => void;
  updateTile: (tileId: string | number, data: unknown) => void;
  setMapTile: (x: number, y: number, tileId: string | number) => void;
  getTiles: () => unknown;
  getTileMap: () => unknown;
  getTilePresetNames: () => string[];
  getVariables: () => unknown;
  setVariableDefault: (variableId: string | number, value: unknown) => void;
  addSprite: (npc: unknown) => void;
  getSprites: () => unknown;
  resetNPCs: () => void;
  renderAll: () => void;
};

let api: TinyRpgApi | null = null;

const setTinyRpgApi = (nextApi: TinyRpgApi | null) => {
  api = nextApi;
};

const getTinyRpgApi = (): TinyRpgApi | null => api;

export { getTinyRpgApi, setTinyRpgApi };
export type { TinyRpgApi };

export { createBaseRuntimeApi } from './BaseRuntimeApi';
export type { BaseRuntimeApi } from './BaseRuntimeApi';
