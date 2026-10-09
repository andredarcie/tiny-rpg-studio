import { getBaseCapabilities, type BaseCapabilities } from '../../sdk/capabilities';
import type { GameEngine } from '../services/GameEngine';
import type { RuntimeState, NPCInstance, TestSettings } from '../../types/gameState';
import type { TileDefinition, TileMap } from '../domain/definitions/tileTypes';
import type { BaseProjectData, SdkSprite, SdkEnemy, SdkVariable } from '../../sdk/types';
import { validateBaseProject, validateRuntimeMutation } from '../../sdk/validation';
import { connectOnlineSession, type OnlineSession, type OnlineSessionOptions } from '../../online/OnlineSession';

const methods = [
    'tryMove', 'checkInteractions', 'showDialog', 'completeDialog', 'closeDialog', 'advanceDialog', 'moveDialogChoice',
    'handleDialogPointer', 'isPickupOverlayActive', 'dismissPickupOverlay', 'isLevelUpCelebrationActive',
    'dismissLevelUpCelebration', 'isLevelUpOverlayActive', 'moveLevelUpCursor', 'confirmLevelUpSelection', 'chooseLevelUpSkill',
    'resetGame', 'createCustomTileEffect', 'deleteCustomTileEffect', 'replaceCustomTileEffects',
    'updateTestSettings', 'getMaxPlayerLevel', 'setCustomPalette', 'setHideHud', 'setEnableEffects', 'setSpriteOutline',
    'setSpriteOutlineColor', 'setDisableSkills', 'setDisablePixelFont', 'setSkillCustomizations', 'setSkillOrder',
    'setShowNewDialogExclamation', 'getCustomPalette', 'resetPaletteToDefault', 'draw', 'dismissIntroScreen',
    'resumeBackgroundMusic', 'isIntroVisible', 'getIntroData', 'getTilePresetNames', 'setVariableDefault', 'isVariableOn',
    'setObjectPosition', 'setObjectVariable', 'setGateInputVariable', 'setGateOutputVariable', 'setObjectVariableById', 'setChestActivatesVariableById',
    'setObjectContainsItemById', 'setObjectRandomItemById', 'setTrapSolidById', 'setGateInputVariableById',
    'setGateOutputVariableById', 'setObjectHiddenInGameById', 'setPlayerEndText', 'getPlayerEndText',
    'removeObject', 'removeObjectById', 'moveObjectById', 'getKeyCount', 'updateTile', 'setMapTile',
    'removeEnemy', 'moveEnemyById', 'setEnemyVariable', 'setXpScrollExperienceById', 'setEnemyExperience',
    'handlePlayerDefeat', 'handleGameCompletion', 'isGameOver', 'handleGameOverInteraction',
    'setMapCell', 'setBackgroundMusic', 'setOnlineConfig', 'setRuntimeVariable', 'updateNPC', 'removeNPC',
    'resetNPCs', 'setItems', 'setExits', 'setCustomSprites', 'defineTile', 'setRoomLayout', 'getSkillDisplayName',
] as const satisfies readonly (keyof GameEngine)[];

export type BaseRuntimeApi = Pick<GameEngine, Exclude<(typeof methods)[number], 'updateNPC' | 'updateTestSettings'>> & {
    capabilities(): BaseCapabilities;
    updateNPC(id: string, data: Partial<SdkSprite>): void;
    updateTestSettings(settings: Partial<TestSettings>): void;
    connectOnline(options: OnlineSessionOptions): void;
    disconnectOnline(): void;
    startOnlineGame(): void;
    exportGameData(): BaseProjectData;
    importGameData(data: BaseProjectData): void;
    getState(): RuntimeState;
    getTiles(): TileDefinition[];
    getTileMap(roomIndex?: number | null): TileMap;
    getVariables(): SdkVariable[];
    getRuntimeVariables(): SdkVariable[];
    getSprites(): Omit<NPCInstance, 'dialoguePlus'>[];
    getEnemyDefinitions(): ReturnType<GameEngine['enemyManager']['getEnemyDefinitions']>;
    getActiveEnemies(): ReturnType<GameEngine['enemyManager']['getActiveEnemies']>;
    addSprite(npc: SdkSprite): string | null;
    addEnemy(enemy: SdkEnemy): string | null;
    getObjects(): ReturnType<GameEngine['gameState']['objectManager']['getObjects']>;
    getObjectsForRoom(roomIndex?: number | null): ReturnType<BaseRuntimeApi['getObjects']>;
    getTestSettings(): TestSettings;
    destroy(): void;
};

// Inspection results are detached even when the underlying engine returns its storage.
const copy = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map(copy) as T;
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key, entry]) => typeof entry !== 'function' && key !== 'timeoutId').map(([key, entry]) => [key, copy(entry)])) as T;
};

export function createBaseRuntimeApi(engine: GameEngine, onDestroy: () => void = () => {}): BaseRuntimeApi {
    const api: Record<string, unknown> = { capabilities: getBaseCapabilities };
    let destroyed = false;
    let session: OnlineSession | undefined;
    const active = () => { if (destroyed) throw Error('Runtime has been destroyed'); };
    for (const method of methods) api[method] = (...args: unknown[]) => {
        active();
        validateRuntimeMutation(method, args, () => engine.exportGameData());
        const result = (engine[method] as (...values: unknown[]) => unknown).apply(engine, copy(args));
        return copy(result);
    };
    for (const [publicName, engineName] of Object.entries({
        getState: 'getState', getTiles: 'getTiles', getTileMap: 'getTileMap', getVariables: 'getVariableDefinitions',
        getRuntimeVariables: 'getRuntimeVariables', getSprites: 'getSprites', getEnemyDefinitions: 'getEnemyDefinitions',
        getActiveEnemies: 'getActiveEnemies', getObjects: 'getObjects', getObjectsForRoom: 'getObjectsForRoom', getTestSettings: 'getTestSettings',
    })) api[publicName] = (...args: unknown[]) => {
        active(); return copy((Reflect.get(engine, engineName) as (...values: unknown[]) => unknown).apply(engine, args));
    };
    api.exportGameData = () => { active(); const data = engine.exportGameData(); validateBaseProject(data); return copy(data); };
    api.importGameData = (data: BaseProjectData) => { active(); validateBaseProject(data); engine.importGameData(copy(data)); };
    api.addSprite = (data: SdkSprite) => { active(); validateRuntimeMutation('addSprite', [data], () => engine.exportGameData()); return copy(engine.addSprite(copy(data))); };
    api.addEnemy = (data: SdkEnemy) => { active(); validateRuntimeMutation('addEnemy', [data], () => engine.exportGameData()); return copy(engine.addEnemy(copy(data))); };
    api.connectOnline = (options: OnlineSessionOptions) => { active(); session?.disconnect(); session = connectOnlineSession(engine, options); };
    api.disconnectOnline = () => { session?.disconnect(); session = undefined; };
    api.startOnlineGame = () => { active(); if (!session) throw Error('Connect an online session first'); session.start(); };
    api.destroy = () => { if (destroyed) return; destroyed = true; try { session?.disconnect(); onDestroy(); } finally { engine.destroy(); } };
    return api as BaseRuntimeApi;
}
