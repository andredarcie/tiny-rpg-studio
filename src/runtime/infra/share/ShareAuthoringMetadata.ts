import type { TileDefinition } from '../../domain/definitions/tileTypes';
import { TileDefinitions } from '../../domain/definitions/TileDefinitions';
import { StateWorldManager } from '../../domain/state/StateWorldManager';

type Data = Record<string, unknown>;
const list = (value: unknown): Data[] => Array.isArray(value) ? value as Data[] : [];
const locationKey = (entry: Data) => `${entry.type}:${entry.roomIndex}:${entry.x}:${entry.y}`;
const fields = (entry: Data, keys: string[]): Data => Object.fromEntries(keys.filter(key => entry[key] !== undefined).map(key => [key, entry[key]]));

export function collectAuthoringMetadata(data: Data): Data {
    const metadata: Data = {};
    if (Array.isArray(data.palette) && JSON.stringify(data.palette) !== JSON.stringify(['#000000', '#1D2B53', '#FFF1E8'])) metadata.palette = data.palette;
    const sprites = list(data.sprites).filter(entry => entry.placed !== false).map(entry => fields(entry, ['type', 'id', 'name']));
    if (sprites.some(entry => entry.id !== undefined || entry.name !== undefined)) metadata.sprites = sprites;
    for (const kind of ['enemies', 'objects']) {
        const values = list(data[kind]).filter(entry => entry.id).map(entry => ({ key: locationKey(entry), id: entry.id }));
        if (values.length) metadata[kind] = values;
    }
    const variables = list(data.variables).filter(entry => entry.name !== undefined || entry.color !== undefined).map(entry => fields(entry, ['id', 'name', 'color']));
    if (variables.length) metadata.variables = variables;
    const rooms = list(data.rooms).map((entry, index) => ({ index, ...entry })).filter((entry, index) => JSON.stringify(dataRoom(entry)) !== JSON.stringify(StateWorldManager.createEmptyRoom(8, index, 3)));
    if (rooms.length) metadata.rooms = rooms;
    const tileset = data.tileset as Data | undefined;
    const presets = new Map(TileDefinitions.TILE_PRESETS.map(tile => [String(tile.id), tile]));
    const tiles = list(tileset?.tiles).filter(tile => {
        const preset = presets.get(String(tile.id));
        return !preset || Object.keys(tile).some(key => !['collision', 'visualEffect', 'mergeEdges'].includes(key) && JSON.stringify(tile[key]) !== JSON.stringify(Reflect.get(preset, key)));
    });
    if (tiles.length) metadata.tiles = tiles;
    const maps = list(tileset?.maps);
    if (maps.some(map => ['ground', 'overlay'].some(layer => Array.isArray(map[layer]) && (map[layer] as unknown[][]).some(row => row.some(cell => typeof cell === 'string' || (layer === 'ground' && cell === null)))))) metadata.maps = maps;
    return metadata;
}

function dataRoom(entry: Data): Data { const { index: _index, ...room } = entry; return room; }

export function applyAuthoringMetadata(result: Data, metadata: Data): void {
    if (Array.isArray(metadata.palette)) result.palette = metadata.palette;
    for (const npc of list(result.sprites)) {
        const source = list(metadata.sprites).find(entry => entry.type === npc.type);
        if (source) Object.assign(npc, fields(source, ['id', 'name']));
    }
    for (const kind of ['enemies', 'objects']) for (const entry of list(result[kind])) {
        const source = list(metadata[kind]).find(value => value.key === locationKey(entry));
        if (typeof source?.id === 'string') entry.id = source.id;
    }
    for (const variable of list(result.variables)) {
        const source = list(metadata.variables).find(entry => entry.id === variable.id);
        if (typeof source?.name === 'string') variable.name = source.name;
        if (typeof source?.color === 'string') variable.color = source.color;
    }
    const rooms = StateWorldManager.createWorldRooms(3, 3, 8);
    for (const entry of list(metadata.rooms)) {
        if (Number.isInteger(entry.index) && Number(entry.index) >= 0 && Number(entry.index) < 9) Object.assign(rooms[Number(entry.index)], dataRoom(entry));
    }
    if (metadata.rooms) result.rooms = rooms;
    const tileset = result.tileset as Data;
    if (metadata.tiles) {
        const tiles: TileDefinition[] = structuredClone(TileDefinitions.TILE_PRESETS);
        for (const entry of list(metadata.tiles)) {
            const existing = tiles.find(tile => tile.id === entry.id);
            if (existing) Object.assign(existing, entry); else tiles.push(entry);
        }
        tileset.tiles = tiles;
    }
    if (Array.isArray(metadata.maps)) { tileset.maps = metadata.maps; tileset.map = metadata.maps[0]; }
}
