import { NPCDefinitions } from '../runtime/domain/definitions/NPCDefinitions';
import { EnemyDefinitions } from '../runtime/domain/definitions/EnemyDefinitions';
import { StateEnemyManager } from '../runtime/domain/state/StateEnemyManager';
import { StateObjectManager } from '../runtime/domain/state/StateObjectManager';
import { itemCatalog } from '../runtime/domain/services/ItemCatalog';
import type { ItemType } from '../runtime/domain/constants/itemTypes';
import { normalizeCustomTileEffects } from '../runtime/domain/definitions/customTileEffects';
import { MAX_ENEMY_EXPERIENCE } from '../runtime/domain/definitions/enemyExperience';
import { MAX_VARIABLES } from './variables';

const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected project object');
    return value as Record<string, unknown>;
};
const entries = (value: unknown): Record<string, unknown>[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw Error('Expected array');
    return value.map(record);
};
const integer = (value: unknown, max: number) => {
    if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max) throw Error(`Expected integer from 0 to ${max}`);
};
const position = (value: Record<string, unknown>) => { integer(value.x, 7); integer(value.y, 7); integer(value.roomIndex, 8); };
const text = (value: unknown, max = Infinity) => {
    if (value !== undefined && (typeof value !== 'string' || value.length > max)) throw Error('Invalid text');
};
const experience = (value: unknown, max = Number.MAX_SAFE_INTEGER) => {
    if (value !== undefined && (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)) throw Error('Invalid experience');
};
const variable = (value: unknown, reward = false) => {
    if (value === undefined || value === null || (reward && value === 'END_GAME') || (!reward && value === 'skill:bard')) return;
    if (typeof value !== 'string' || (!/^var-[1-9]\d*$/.test(value) || Number(value.slice(4)) > MAX_VARIABLES)) throw Error('Invalid base variable reference');
};

const tileId = (value: unknown) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const matrix = (value: unknown, cell: (value: unknown) => boolean) => Array.isArray(value) && value.length === 8 && Array.from(value).every(row => Array.isArray(row) && row.length === 8 && Array.from(row).every(cell));

export function validateTileLayer(value: unknown): void {
    if (!matrix(value, cell => cell === null || tileId(cell))) throw Error('Map layers must be 8x8 tile IDs or null');
}

function validateTileDefinition(tile: Record<string, unknown>): void {
    if (tile.id !== undefined && !tileId(tile.id)) throw Error('Invalid tile ID');
    for (const key of ['name', 'nameKey', 'category']) text(tile[key]);
    for (const key of ['collision', 'mergeEdges', 'animated']) if (tile[key] !== undefined && typeof tile[key] !== 'boolean') throw Error('Invalid tile flag');
    const color = (value: unknown) => typeof value === 'string' && (value === 'transparent' || /^#[0-9a-f]{6}$/i.test(value));
    if (tile.pixels !== undefined && !matrix(tile.pixels, color)) throw Error('Tile pixels must be 8x8 colors');
    for (const key of ['frames', 'layouts']) {
        const frames = tile[key];
        const pixel = key === 'frames' ? color : (value: unknown) => value === null || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 15);
        if (frames !== undefined && (!Array.isArray(frames) || frames.length === 0 || frames.length > 255 || !Array.from(frames).every(frame => matrix(frame, pixel)))) throw Error('Invalid tile art');
    }
    if (tile.visualEffect !== undefined && (typeof tile.visualEffect !== 'string' || !/^(none|water|lava|custom:[0-9a-z]+)$/.test(tile.visualEffect))) throw Error('Invalid tile visual effect');
}

export function validateBaseProject(input: unknown): void {
    const data = record(input);
    for (const key of ['hideHud', 'enableEffects', 'showNewDialogExclamation', 'spriteOutline', 'disableSkills', 'disablePixelFont']) {
        if (data[key] !== undefined && typeof data[key] !== 'boolean') throw Error(`Invalid ${key}`);
    }
    for (const key of ['title', 'author']) if (data[key] !== undefined && (typeof data[key] !== 'string' || String(data[key]).length > 18)) throw Error(`${key} must have at most 18 characters`);
    if (data.spriteOutlineColor !== undefined) integer(data.spriteOutlineColor, 15);
    if (data.backgroundMusicVolume !== undefined) integer(data.backgroundMusicVolume, 100);
    if (data.customPalette !== undefined && (!Array.isArray(data.customPalette) || data.customPalette.length !== 16 || data.customPalette.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)))) throw Error('Invalid custom palette');
    if (entries(data.gameplayPlugins).length) throw Error('Base SDK does not support gameplay plugins');
    const world = data.world === undefined ? {} : record(data.world);
    if ((world.rows !== undefined && world.rows !== 3) || (world.cols !== undefined && world.cols !== 3)) throw Error('Base world must be 3x3');
    if (data.roomSize !== undefined && data.roomSize !== 8) throw Error('Base rooms must be 8x8');
    if (entries(data.rooms).length > 9) throw Error('Base games support nine rooms');
    for (const room of entries(data.rooms)) {
        if (room.size !== undefined && room.size !== 8) throw Error('Base rooms must be 8x8');
        for (const key of ['tiles', 'walls']) if (room[key] !== undefined && (!Array.isArray(room[key]) || (room[key] as unknown[]).length !== 8 || (room[key] as unknown[]).some(row => !Array.isArray(row) || row.length !== 8))) throw Error('Room layouts must be 8x8');
    }
    const vars = entries(data.variables);
    if (vars.length > MAX_VARIABLES) throw Error('Base games support 16 variables');
    for (const entry of vars) { if (entry.id === 'skill:bard') throw Error('Skill conditions are runtime values, not saved variable defaults'); variable(entry.id); if (entry.id == null) throw Error('Missing variable ID');
        if (typeof entry.value !== 'boolean') throw Error('Invalid variable default');
        text(entry.name);
        if (entry.color !== undefined && (typeof entry.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.color))) throw Error('Invalid variable color');
        if (entry.order != null) integer(entry.order, MAX_VARIABLES + 1);
    }
    if (new Set(vars.map(entry => entry.id)).size !== vars.length) throw Error('Duplicate variables');
    if (data.start !== undefined) position(record(data.start));
    for (const key of ['sprites', 'enemies', 'objects']) {
        const ids = new Set<unknown>();
        for (const entity of entries(data[key])) {
            if (entity.id === undefined) continue;
            text(entity.id, 100);
            if (!String(entity.id).trim() || ids.has(entity.id)) throw Error('Invalid or duplicate entity ID');
            ids.add(entity.id);
        }
    }
    const npcTypes = new Set<unknown>(); const bossTypes = new Set<unknown>();
    for (const sprite of entries(data.sprites)) {
        if (sprite.dialoguePlus !== undefined) throw Error('Dialogue+ is outside the base SDK');
        if (!NPCDefinitions.getNpcDefinition(String(sprite.type))) throw Error('Unknown NPC behavior');
        position(sprite);
        text(sprite.name, 80);
        for (const key of ['text', 'conditionText', 'choicePrompt', 'choiceYesText', 'choiceNoText']) text(sprite[key]);
        for (const key of ['placed', 'disappearAfterDialog', 'choiceEnabled']) if (sprite[key] !== undefined && typeof sprite[key] !== 'boolean') throw Error('Invalid NPC flag');
        if (sprite.placed !== false) {
            if (npcTypes.has(sprite.type)) throw Error('Each NPC type can be placed only once');
            npcTypes.add(sprite.type);
        }
        variable(sprite.conditionVariableId);
        for (const key of ['rewardVariableId', 'conditionalRewardVariableId', 'choiceYesVariableId', 'choiceNoVariableId']) variable(sprite[key], true);
    }
    const enemyCounts = new Map<unknown, number>();
    for (const enemy of entries(data.enemies)) {
        const definition = EnemyDefinitions.getEnemyDefinition(String(enemy.type));
        if (!definition) throw Error('Unknown enemy behavior');
        position(enemy); variable(enemy.defeatVariableId); experience(enemy.experience, MAX_ENEMY_EXPERIENCE);
        const count = (enemyCounts.get(enemy.roomIndex) ?? 0) + 1; enemyCounts.set(enemy.roomIndex, count);
        if (count > StateEnemyManager.MAX_ENEMIES_PER_ROOM) throw Error('Enemy limit exceeded');
        if (definition.boss) {
            if (bossTypes.has(enemy.type)) throw Error('Each boss type can be placed only once');
            bossTypes.add(enemy.type);
        }
    }
    const counts = new Map<string, number>(); const outputs = new Set<unknown>();
    for (const object of entries(data.objects)) {
        const type = object.type as ItemType;
        if (!StateObjectManager.getPlaceableTypesArray().includes(type)) throw Error('Unknown object behavior');
        position(object); experience(object.experience);
        for (const key of ['on', 'solid', 'hiddenInGame', 'randomItem']) if (object[key] !== undefined && typeof object[key] !== 'boolean') throw Error('Invalid object flag');
        text(object.endingText, StateObjectManager.PLAYER_END_TEXT_LIMIT);
        if (itemCatalog.requiresVariable(type) && type !== 'trap' && !object.variableId) throw Error('This object requires a variable');
        if (itemCatalog.isLogicGate(type) && (!object.inputVariableId || !object.outputVariableId || (!itemCatalog.isSingleInputGate(type) && !object.inputVariableId2))) throw Error('Logic gates require input and output variables');
        if (type === 'chest' && object.containsItemType != null && !itemCatalog.getCollectibleTypes().includes(object.containsItemType as ItemType)) throw Error('Invalid chest item');
        const key = `${object.roomIndex}:${type}`;
        const count = (counts.get(key) ?? 0) + 1; counts.set(key, count);
        if (count > (itemCatalog.allowsMultiplePerRoom(type) ? StateObjectManager.MULTI_INSTANCE_LIMIT : 1)) throw Error('Object limit exceeded');
        for (const field of ['variableId', 'inputVariableId', 'inputVariableId2', 'outputVariableId']) variable(object[field]);
        if (object.outputVariableId) {
            if (outputs.has(object.outputVariableId)) throw Error('Logic gate outputs must be unique');
            outputs.add(object.outputVariableId);
        }
    }
    for (const item of entries(data.items)) { position(item); text(item.text); }
    for (const exit of entries(data.exits)) {
        position(exit); position({ x: exit.targetX, y: exit.targetY, roomIndex: exit.targetRoomIndex });
    }
    const online = data.online === undefined ? {} : record(data.online);
    if (online.enabled !== undefined && typeof online.enabled !== 'boolean') throw Error('Invalid online enabled flag');
    const roles = new Set<unknown>();
    for (const spawn of entries(online.spawnPoints)) {
        position(spawn);
        if (!['p1', 'p2'].includes(String(spawn.role)) || roles.has(spawn.role)) throw Error('Invalid or duplicate spawn role');
        roles.add(spawn.role);
    }
    const effects = normalizeCustomTileEffects(data.customTileEffects);
    if (effects.length !== entries(data.customTileEffects).length) throw Error('Invalid custom effects');
    const tileset = data.tileset === undefined ? {} : record(data.tileset);
    if (entries(tileset.maps).length > 9) throw Error('Base games support nine maps');
    for (const tile of entries(tileset.tiles)) {
        validateTileDefinition(tile);
        if (typeof tile.visualEffect === 'string' && tile.visualEffect.startsWith('custom:') && !effects.some(effect => effect.id === tile.visualEffect)) throw Error('Missing custom effect');
    }
    const maps = entries(tileset.maps);
    if (tileset.map !== undefined) maps.push(record(tileset.map));
    for (const map of maps) for (const layer of ['ground', 'overlay']) {
        const matrix = map[layer]; if (matrix === undefined) continue;
        validateTileLayer(matrix);
    }
    for (const sprite of entries(data.customSprites)) {
        if (!['tile', 'enemy', 'npc', 'object', 'player'].includes(String(sprite.group)) || typeof sprite.key !== 'string' || !sprite.key.trim()) throw Error('Invalid sprite asset');
        const frames = sprite.frames;
        if (!Array.isArray(frames) || frames.length === 0 || frames.length > 255 || frames.some(frame => !Array.isArray(frame) || frame.length !== 8 || frame.some(row => !Array.isArray(row) || row.length !== 8 || row.some(pixel => pixel !== null && (!Number.isInteger(pixel) || Number(pixel) < 0 || Number(pixel) > 15))))) throw Error('Sprite frames must be 8x8 palette indices or null');
    }
}

export function validateRuntimeMutation(method: string, args: unknown[], project: () => unknown): void {
    const room = (value: unknown) => integer(value, 8);
    const coord = (value: unknown) => integer(value, 7);
    const bool = (value: unknown) => { if (typeof value !== 'boolean') throw Error('Expected boolean'); };
    const reference = (value: unknown) => variable(value);
    const collections: Record<string, string> = { setItems: 'items', setExits: 'exits', setCustomSprites: 'customSprites', setOnlineConfig: 'online', replaceCustomTileEffects: 'customTileEffects' };
    if (collections[method]) validateBaseProject({ [collections[method]]: args[0] });
    const settings: Record<string, string> = { setCustomPalette: 'customPalette', setHideHud: 'hideHud', setEnableEffects: 'enableEffects', setSpriteOutline: 'spriteOutline', setSpriteOutlineColor: 'spriteOutlineColor', setDisableSkills: 'disableSkills', setDisablePixelFont: 'disablePixelFont', setShowNewDialogExclamation: 'showNewDialogExclamation' };
    if (settings[method] && args[0] != null) validateBaseProject({ [settings[method]]: args[0] });
    if (method === 'setRoomLayout') { room(args[0]); validateBaseProject({ rooms: [args[1]] }); }
    if (method === 'setBackgroundMusic') { text(args[0] ?? undefined); integer(args[1] ?? 100, 100); }
    if (method === 'setVariableDefault' || method === 'setRuntimeVariable') { reference(args[0]); bool(args[1]); }
    if (method === 'setObjectPosition') {
        if (!StateObjectManager.getPlaceableTypesArray().includes(args[0] as ItemType)) throw Error('Unknown object behavior');
        room(args[1]); coord(args[2]); coord(args[3]);
    }
    if (['moveObjectById', 'moveEnemyById'].includes(method)) { coord(args[1]); coord(args[2]); }
    if (method === 'setMapCell') {
        room(args[0]); if (!['ground', 'overlay'].includes(String(args[1]))) throw Error('Invalid map layer');
        coord(args[2]); coord(args[3]); if (args[4] !== null && !tileId(args[4])) throw Error('Invalid tile ID');
    }
    if (method === 'setMapTile') { coord(args[0]); coord(args[1]); if (args[2] !== null && !tileId(args[2])) throw Error('Invalid tile ID'); if (args[3] != null) room(args[3]); }
    if (['setObjectVariable', 'setGateInputVariable', 'setGateOutputVariable'].includes(method)) { room(args[1]); reference(args[2]); }
    if (['setObjectVariableById', 'setGateInputVariableById', 'setGateOutputVariableById', 'setEnemyVariable'].includes(method)) reference(args[1]);
    if (method.startsWith('setGateInputVariable') && ![1, 2].includes(Number(args[method.endsWith('ById') ? 2 : 3]))) throw Error('Invalid gate slot');
    if (['setObjectRandomItemById', 'setTrapSolidById', 'setObjectHiddenInGameById'].includes(method)) bool(args[1]);
    if (method === 'setObjectContainsItemById' && args[1] != null && !itemCatalog.getCollectibleTypes().includes(args[1] as ItemType)) throw Error('Invalid chest item');
    if (method === 'setPlayerEndText') { room(args[0]); text(args[1], StateObjectManager.PLAYER_END_TEXT_LIMIT); }
    if (method === 'setXpScrollExperienceById') experience(args[1]);
    if (method === 'setEnemyExperience') experience(args[1], MAX_ENEMY_EXPERIENCE);
    if (['addSprite', 'addEnemy', 'updateNPC', 'defineTile', 'updateTile'].includes(method)) {
        const data = structuredClone(project()) as Record<string, unknown>;
        if (method === 'addSprite' || method === 'addEnemy') {
            const key = method === 'addSprite' ? 'sprites' : 'enemies';
            data[key] = [...entries(data[key]), args[0]];
        } else if (method === 'updateNPC') {
            data.sprites = entries(data.sprites).map(sprite => sprite.id === args[0] ? { ...sprite, ...record(args[1]) } : sprite);
        } else {
            const tileset = record(data.tileset);
            const tile = method === 'defineTile' ? record(args[0]) : { ...entries(tileset.tiles).find(tile => tile.id === args[0]), ...record(args[1]), id: args[0] };
            tileset.tiles = [...entries(tileset.tiles).filter(entry => entry.id !== tile.id), tile];
        }
        validateBaseProject(data);
    }
}
