import type { AuthoringApi } from './AuthoringApi';

type TinyRpgApi = {
  authoring?: AuthoringApi;
  exportGameData: () => unknown;
  importGameData: (data: unknown) => void;
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
