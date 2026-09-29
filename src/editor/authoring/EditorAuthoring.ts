import { GameConfig } from '../../config/GameConfig';
import { NPCDefinitions } from '../../runtime/domain/definitions/NPCDefinitions';
import { EnemyDefinitions } from '../../runtime/domain/definitions/EnemyDefinitions';
import { SkillDefinitions } from '../../runtime/domain/definitions/SkillDefinitions';
import { BASE_TILE_EFFECT_IDS, CUSTOM_TILE_EFFECT_LIMITS, normalizeCustomTileEffects } from '../../runtime/domain/definitions/customTileEffects';
import { StateObjectManager } from '../../runtime/domain/state/StateObjectManager';
import { StateEnemyManager } from '../../runtime/domain/state/StateEnemyManager';
import { MAX_ENEMY_EXPERIENCE } from '../../runtime/domain/definitions/enemyExperience';
import { itemCatalog } from '../../runtime/domain/services/ItemCatalog';
import { NPC_END_GAME_REWARD_ID } from '../../runtime/domain/constants/npcRewards';
import type { AuthoringApi, AuthoringCapabilities, AuthoringTool, JsonSchema } from '../../runtime/infra/AuthoringApi';
import type { EditorHistoryManager } from '../modules/EditorHistoryManager';
import { array, boolean, enumeration, integer, object, record, string, validate } from './schema';

type Data = Record<string, unknown>;
type Host = {
  gameEngine: { exportGameData(): unknown };
  projectGeneration: number;
  history: EditorHistoryManager;
  restore(data: Data, options: { skipHistory: boolean; authoring: boolean }): void;
  updateJSON(): void;
  persistAuthoring(): void;
};
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data)) as T;
const maxPayload = 512_000;
const roomSize = GameConfig.world.roomSize;
const roomCount = (data: Data) => Math.max(1, list(data.rooms).length || GameConfig.world.rows * GameConfig.world.cols);
const worldPosition = (data: Data) => ({ roomIndex: integer(0, roomCount(data) - 1), x: integer(0, roomSize - 1), y: integer(0, roomSize - 1) });
const list = (data: unknown): Data[] => data as Data[];
const tool = (name: string, description: string, parameters: JsonSchema): AuthoringTool => ({ type: 'function', function: { name, description, parameters } });

function contract(data: Data): AuthoringCapabilities {
  const rooms = roomCount(data);
  const position = worldPosition(data);
  const tiles = list(record(data.tileset).tiles);
  const variables = list(data.variables).map(entry => entry.id);
  const tileId = enumeration([null, ...tiles.map(entry => entry.id)]);
  const variable = enumeration([null, ...variables]);
  const reward = enumeration([null, ...variables, NPC_END_GAME_REWARD_ID]);
  const npcs = NPCDefinitions.definitions.map(entry => entry.type);
  const enemies = EnemyDefinitions.definitions.map(entry => entry.type);
  const objects = StateObjectManager.getPlaceableTypesArray();
  const skills = SkillDefinitions.getAll().map(entry => entry.id);
  const color: JsonSchema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
  const point = { x: position.x, y: position.y };
  const npc = object({ ...point, type: enumeration(npcs), text: string(), name: string(80), placed: boolean,
    conditionVariableId: variable, conditionText: string(), rewardVariableId: reward, conditionalRewardVariableId: reward,
    disappearAfterDialog: boolean, choiceEnabled: boolean, choicePrompt: string(), choiceYesText: string(), choiceNoText: string(), choiceYesVariableId: reward, choiceNoVariableId: reward,
  }, ['x', 'y', 'type', 'text']);
  const enemy = object({ ...point, type: enumeration(enemies), defeatVariableId: variable, experience: integer(0, MAX_ENEMY_EXPERIENCE) }, ['x', 'y', 'type']);
  const obj = object({ ...point, type: enumeration(objects.filter(type => type !== 'player-start')), variableId: variable, solid: boolean,
    on: boolean, endingText: string(StateObjectManager.PLAYER_END_TEXT_LIMIT), inputVariableId: variable, inputVariableId2: variable,
    outputVariableId: variable, hiddenInGame: boolean, containsItemType: enumeration([null, ...itemCatalog.getCollectibleTypes()]), randomItem: boolean, experience: integer(0, 65535),
  }, ['x', 'y', 'type']);
  const exit = object({ ...point, targetRoomIndex: position.roomIndex, targetX: position.x, targetY: position.y });
  const item = object({ ...point, type: enumeration(itemCatalog.getCollectibleTypes()), text: string() }, ['x', 'y', 'type']);
  const pixel = enumeration([null, ...Array.from({ length: 16 }, (_, i) => i)]);
  const frame = array(array(pixel, 8, 8), 8, 8);
  const effect = object({ id: { type: 'string', pattern: '^custom:[0-9a-z]+$' }, name: string(CUSTOM_TILE_EFFECT_LIMITS.maxNameLength),
    baseEffectIds: array(enumeration([...BASE_TILE_EFFECT_IDS]), CUSTOM_TILE_EFFECT_LIMITS.maxPasses, 1), color }, ['id', 'name', 'baseEffectIds']);
  return { version: 1, limits: { roomSize, rooms, maxPayload }, assets: {
    tiles: tiles.map(({ id, name, collision, visualEffect }) => ({ id, name, collision, visualEffect })), npcs, enemies, objects, variables, skills,
    baseEffects: [...BASE_TILE_EFFECT_IDS], player: ['default'], maxObjectsPerTypePerRoom: StateObjectManager.MULTI_INSTANCE_LIMIT,
    maxEnemiesPerRoom: StateEnemyManager.MAX_ENEMIES_PER_ROOM,
  }, tools: [
    tool('read_game', 'Read a compact project summary, one room, or available assets. Read before editing. Room entities are replaced as a group.', object({ section: enumeration(['summary', 'room', 'assets']), roomIndex: position.roomIndex }, ['section'])),
    tool('set_project', 'Update only supplied metadata/options. Music uses an 11-character YouTube video ID, or empty string to clear.', object({
      title: string(18), author: string(18), hideHud: boolean, enableEffects: boolean, showNewDialogExclamation: boolean,
      spriteOutline: boolean, spriteOutlineColor: integer(0, 15), disableSkills: boolean, disablePixelFont: boolean,
      backgroundMusicVideoId: { type: 'string', pattern: '^([A-Za-z0-9_-]{11})?$' }, backgroundMusicVolume: integer(0, 100),
      customPalette: array(color, 16, 16),
    }, [])),
    tool('set_start', 'Move the player start.', object(position)),
    tool('set_map_cell', 'Set a ground or overlay cell. null erases. Use existing tile IDs.', object({ ...position, layer: enumeration(['ground', 'overlay']), tileId })),
    tool('set_map_layer', 'Replace an entire 8x8 ground or overlay layer.', object({ roomIndex: position.roomIndex, layer: enumeration(['ground', 'overlay']), cells: array(array(tileId, roomSize, roomSize), roomSize, roomSize) })),
    ...Object.entries({ sprites: npc, enemies: enemy, objects: obj, items: item, exits: exit }).map(([kind, entry]) => tool(`set_${kind}`, `Replace ${kind} in one room only; empty entities removes them. Preserve entries you want to keep.${kind === 'items' ? ' Legacy items are dialogue pickups only. For inventory items (keys, potions, equipment), use set_objects.' : ''}`, object({ roomIndex: position.roomIndex, entities: array(entry, kind === 'enemies' ? StateEnemyManager.MAX_ENEMIES_PER_ROOM : roomSize * roomSize) }))),
    tool('set_variable', 'Set an existing boolean variable default and optional display name.', object({ id: enumeration(variables), value: boolean, name: string(80) }, ['id', 'value'])),
    tool('set_sprite', 'Replace art for an existing asset; 8x8 palette indices, null transparent, one or two frames.', object({ group: enumeration(['tile', 'npc', 'enemy', 'object', 'player']), key: string(100), variant: enumeration(['base', 'on']), frames: array(frame, 2, 1) }, ['group', 'key', 'frames'])),
    tool('set_tile', 'Update collision, edge merging and visual effect of an existing tile.', object({ id: enumeration(tiles.map(entry => entry.id)), collision: boolean, mergeEdges: boolean, visualEffect: { type: 'string', pattern: '^(none|water|lava|custom:[0-9a-z]+)$' } }, ['id'])),
    tool('set_effects', 'Replace custom effect definitions. Keep IDs referenced by tiles.', object({ effects: array(effect, CUSTOM_TILE_EFFECT_LIMITS.maxDefinitions) })),
    tool('set_skills', 'Set skill order (remaining skills keep their default order) and/or individual display customizations.', object({ order: array(enumeration(skills), skills.length),
      customizations: array(object({ id: enumeration(skills), name: string(SkillDefinitions.NAME_MAX_LENGTH), description: string(SkillDefinitions.DESCRIPTION_MAX_LENGTH), icon: string(SkillDefinitions.ICON_MAX_LENGTH) }, ['id']), skills.length),
    }, [])),
  ] };
}

function checkReferences(data: Data): void {
  const bosses = new Set<unknown>();
  for (const entry of list(data.enemies)) {
    if (!EnemyDefinitions.getEnemyDefinition(entry.type as string)?.boss) continue;
    if (bosses.has(entry.type)) throw Error('Each boss type can be placed only once');
    bosses.add(entry.type);
  }
  const outputs = new Set<unknown>();
  const counts = new Map<string, number>();
  const occupied = new Set<string>();
  for (const entry of list(data.objects)) {
    const type = entry.type as Parameters<typeof itemCatalog.allowsMultiplePerRoom>[0];
    const key = `${entry.roomIndex}:${type}`;
    const count = (counts.get(key) ?? 0) + 1; counts.set(key, count);
    if (count > (itemCatalog.allowsMultiplePerRoom(type) ? StateObjectManager.MULTI_INSTANCE_LIMIT : 1)) throw Error('Object limit per room exceeded');
    const tile = `${key}:${entry.x}:${entry.y}`;
    if (occupied.has(tile)) throw Error('Duplicate object position'); occupied.add(tile);
    if (itemCatalog.requiresVariable(type) && !entry.variableId) throw Error('This object requires a variable');
    if (itemCatalog.isLogicGate(type) && (!entry.inputVariableId || !entry.outputVariableId || (!itemCatalog.isSingleInputGate(type) && !entry.inputVariableId2))) throw Error('Logic gates require input and output variables');
    if (entry.outputVariableId) {
      if (outputs.has(entry.outputVariableId)) throw Error('Logic outputs must be unique');
      outputs.add(entry.outputVariableId);
    }
  }
  const npcTypes = new Set<unknown>();
  for (const entry of list(data.sprites)) {
    if (!entry.placed) continue;
    if (npcTypes.has(entry.type)) throw Error('Each NPC type can be placed only once');
    npcTypes.add(entry.type);
  }
  const effectIds = list(data.customTileEffects ?? []).map(entry => entry.id);
  for (const entry of list(record(data.tileset).tiles)) {
    if (typeof entry.visualEffect === 'string' && entry.visualEffect.startsWith('custom:') && !effectIds.includes(entry.visualEffect)) throw Error('Tile references a missing custom effect');
  }
}

function apply(data: Data, name: string, a: Data): void {
  const tileset = record(data.tileset);
  if (name === 'set_project') Object.assign(data, a);
  else if (name === 'set_start') {
    data.start = a;
    data.objects = list(data.objects).map(entry => entry.type === 'player-start' ? { ...entry, ...a } : entry);
  } else if (name === 'set_map_cell' || name === 'set_map_layer') {
    const maps = tileset.maps as Record<string, unknown[][]>[];
    const map = maps[a.roomIndex as number]; const layer = a.layer as string;
    if (name === 'set_map_layer') map[layer] = a.cells as unknown[][];
    else map[layer][a.y as number][a.x as number] = a.tileId;
    tileset.map = maps[0];
  } else if (['set_sprites', 'set_enemies', 'set_objects', 'set_items', 'set_exits'].includes(name)) {
    const kind = name.slice(4); const roomIndex = a.roomIndex;
    if (kind === 'objects') for (const entry of list(a.entities)) {
      const type = entry.type as Parameters<typeof itemCatalog.requiresVariable>[0];
      const allowed = new Set(['type', 'x', 'y']);
      if (itemCatalog.requiresVariable(type) || type === 'chest') allowed.add('variableId');
      if (type === 'trap') allowed.add('solid');
      if (type === 'switch') allowed.add('on');
      if (type === 'player-end') allowed.add('endingText');
      if (type === 'xp-scroll') allowed.add('experience');
      if (type === 'chest') { allowed.add('containsItemType'); allowed.add('randomItem'); }
      if (itemCatalog.isLogicGate(type)) {
        allowed.add('inputVariableId'); allowed.add('outputVariableId'); allowed.add('hiddenInGame');
        if (!itemCatalog.isSingleInputGate(type)) allowed.add('inputVariableId2');
      }
      if (Object.keys(entry).some(key => !allowed.has(key))) throw Error('Unsupported property for this object type');
    }
    const incoming = list(a.entities).map((entry, i) => ({ ...entry, roomIndex,
      ...(['sprites', 'enemies', 'objects'].includes(kind) ? { id: `authoring-${kind}-${roomIndex}-${i}` } : {}),
      ...(kind === 'sprites' ? { placed: entry.placed !== false, initialX: entry.x, initialY: entry.y, initialRoomIndex: roomIndex, textKey: null } : {}),
      ...(kind === 'enemies' ? { lastX: entry.x } : {}),
    }));
    data[kind] = [...list(data[kind]).filter(entry => entry.roomIndex !== roomIndex || (kind === 'objects' && entry.type === 'player-start')), ...incoming];
  } else if (name === 'set_variable') {
    data.variables = list(data.variables).map(entry => entry.id === a.id ? { ...entry, ...a } : entry);
  } else if (name === 'set_sprite') {
    const capabilities = contract(data).assets;
    const keys = a.group === 'tile' ? list(tileset.tiles).map(entry => String(entry.id))
      : a.group === 'player' ? ['default'] : capabilities[a.group === 'npc' ? 'npcs' : a.group === 'enemy' ? 'enemies' : 'objects'] as unknown[];
    if (!keys.includes(a.key)) throw Error('Unknown sprite asset key');
    const sprites = list(data.customSprites ?? []);
    data.customSprites = [...sprites.filter(entry => !(entry.group === a.group && entry.key === a.key && (entry.variant ?? 'base') === (a.variant ?? 'base'))), a];
  } else if (name === 'set_tile') {
    tileset.tiles = list(tileset.tiles).map(entry => entry.id === a.id ? { ...entry, ...a } : entry);
  } else if (name === 'set_effects') {
    const effects = normalizeCustomTileEffects(a.effects);
    const input = list(a.effects);
    if (effects.length !== input.length || effects.some((effect, i) => effect.baseEffectIds.length !== (input[i].baseEffectIds as unknown[]).length)) throw Error('Invalid or duplicate custom effects');
    data.customTileEffects = effects;
  } else if (name === 'set_skills') {
    if (a.order) {
      if (new Set(a.order as unknown[]).size !== (a.order as unknown[]).length) throw Error('Duplicate skills');
      data.skillOrder = a.order;
    }
    if (a.customizations) {
      const customizations = record(data.skillCustomizations ?? {});
      for (const entry of list(a.customizations)) { const { id, ...fields } = entry; customizations[id as string] = fields; }
      data.skillCustomizations = customizations;
    }
  } else throw Error('Unsupported authoring operation');
  checkReferences(data);
}

export function createAuthoring(host: Host): AuthoringApi {
  const snapshot = () => clone(record(host.gameEngine.exportGameData()));
  return {
    capabilities: () => contract(snapshot()),
    begin: () => {
      const original = snapshot(); const token = JSON.stringify(original); const generation = host.projectGeneration;
      let draft = clone(original); let closed = false; let operations = 0;
      const active = () => { if (closed) throw Error('This edit has ended'); };
      return {
        read: (section, roomIndex) => {
          active();
          if (section === 'assets') return clone({ ...contract(draft).assets, customSprites: draft.customSprites, customTileEffects: draft.customTileEffects, skillOrder: draft.skillOrder, skillCustomizations: draft.skillCustomizations, customPalette: draft.customPalette });
          if (section === 'project') return clone(draft);
          if (section === 'summary') return clone({ title: draft.title, author: draft.author, start: draft.start, variables: draft.variables,
            counts: Object.fromEntries(['sprites', 'enemies', 'objects', 'items', 'exits'].map(kind => [kind, list(draft[kind]).length])), limits: { rooms: roomCount(draft), roomSize } });
          if (!['room'].includes(section)) throw Error('Unsupported read');
          validate(worldPosition(draft).roomIndex, roomIndex);
          return clone({ room: list(draft.rooms)[roomIndex as number], map: list(record(draft.tileset).maps)[roomIndex as number],
            ...Object.fromEntries(['sprites', 'enemies', 'objects', 'items', 'exits'].map(kind => [kind, list(draft[kind]).filter(entry => entry.roomIndex === roomIndex)])) });
        },
        apply: (name, argumentsValue) => {
          active();
          const definition = contract(draft).tools.find(entry => entry.function.name === name && name !== 'read_game');
          if (!definition) throw Error('Unsupported authoring operation');
          const encoded = JSON.stringify(argumentsValue);
          if (!encoded || encoded.length > maxPayload) throw Error('Tool arguments too large');
          validate(definition.function.parameters, argumentsValue);
          const next = clone(draft); apply(next, name, clone(record(argumentsValue)));
          if (JSON.stringify(next).length > maxPayload * 4) throw Error('Project too large');
          draft = next; operations++;
        },
        commit: () => {
          active(); closed = true;
          if (host.projectGeneration !== generation || JSON.stringify(snapshot()) !== token) throw Error('Project changed during the editing transaction. Retry the operation.');
          if (JSON.stringify(draft) === token) return { changed: false, operations: 0 };
          const stack = [...host.history.stack]; const index = host.history.index;
          try {
            host.history.pushSnapshot(token);
            host.restore(clone(draft), { skipHistory: true, authoring: true });
            host.updateJSON(); host.history.pushCurrentState();
            host.persistAuthoring();
          } catch (error) {
            host.history.stack = stack; host.history.index = index;
            host.restore(clone(original), { skipHistory: true, authoring: true }); host.updateJSON();
            throw error;
          }
          return { changed: true, operations };
        },
        discard: () => { closed = true; draft = {}; },
      };
    },
  };
}
