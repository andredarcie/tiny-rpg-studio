
import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { StateObjectManager } from '../../domain/state/StateObjectManager';
import { ShareConstants } from './ShareConstants';
import { ShareMath } from './ShareMath';
import { ShareVariableCodec } from './ShareVariableCodec';

type ShareSpriteInput = {
    id?: string;
    type?: string;
    name?: string;
    defaultText?: string;
    defaultTextKey?: string;
    text?: string;
    textKey?: string | null;
    placed?: boolean;
    x?: number;
    y?: number;
    roomIndex?: number;
    conditionVariableId?: string | null;
    conditionalVariableId?: string | null;
    conditionText?: string;
    conditionalText?: string;
    rewardVariableId?: string | null;
    activateVariableId?: string | null;
    onCompleteVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
    alternativeRewardVariableId?: string | null;
};

type ShareEnemyInput = {
    id?: string;
    type?: string;
    x?: number;
    y?: number;
    roomIndex?: number;
    defeatVariableId?: string | null;
};

type ShareObjectInput = {
    type?: string;
    x?: number;
    y?: number;
    roomIndex?: number;
    variableId?: string | null;
    on?: boolean;
    endingText?: string;
};

type SharePositionOptions = {
    variableNibbles?: number[];
    endingTexts?: string[];
    stateBits?: number[];
};

type NpcDefinitionLookup = {
    id: string;
    type: string;
    name: string;
    defaultText?: string;
    defaultTextKey?: string | null;
};

type EnemyDefinitionLookup = {
    type: string;
};

type NormalizedSprite = {
    type: string;
    id: string;
    name: string;
    x: number;
    y: number;
    roomIndex: number;
    text: string;
    textKey: string | null;
    conditionVariableId: string | null;
    conditionText: string;
    rewardVariableId: string | null;
    conditionalRewardVariableId: string | null;
};

type NormalizedEnemy = {
    id: string;
    type: string;
    typeIndex: number;
    x: number;
    y: number;
    roomIndex: number;
    defeatVariableId: string | null;
    variableNibble: number;
};

type PositionEntry = {
    x: number;
    y: number;
    roomIndex: number;
};

class ShareDataNormalizer {
    static get Types(): typeof ITEM_TYPES {
        return ITEM_TYPES;
    }
    static normalizeStart(start?: { x?: number; y?: number; roomIndex?: number }) {
        return {
            x: ShareMath.clamp(Number(start?.x), 0, ShareConstants.MATRIX_SIZE - 1, 1),
            y: ShareMath.clamp(Number(start?.y), 0, ShareConstants.MATRIX_SIZE - 1, 1),
            roomIndex: ShareMath.clampRoomIndex(start?.roomIndex)
        };
    }

    static resolveNpcType(npc?: ShareSpriteInput | null): string | null {
        if (typeof npc?.type === 'string') {
            return npc.type;
        }
        const defs = ShareConstants.NPC_DEFINITIONS as NpcDefinitionLookup[];
        if (typeof npc?.id === 'string') {
            const matchById = defs.find((def) => def.id === npc.id);
            if (matchById) return matchById.type;
        }
        if (typeof npc?.name === 'string') {
            const matchByName = defs.find((def) => def.name === npc.name);
            if (matchByName) return matchByName.type;
        }
        return null;
    }

    static normalizeSprites(list: unknown[] | null | undefined): NormalizedSprite[] {
        if (!Array.isArray(list)) return [];
        const seen = new Set<string>();
        const normalized: NormalizedSprite[] = [];
        const defs = ShareConstants.NPC_DEFINITIONS as NpcDefinitionLookup[];
        for (const raw of list) {
            const npc = raw as ShareSpriteInput;
            const type = ShareDataNormalizer.resolveNpcType(npc);
            if (!type || seen.has(type)) continue;
            const def = defs.find((entry) => entry.type === type);
            if (!def) continue;
            const placed = npc.placed !== false;
            if (!placed) continue;
            const x = ShareMath.clamp(Number(npc.x), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const y = ShareMath.clamp(Number(npc.y), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const conditionId = typeof npc.conditionVariableId === 'string'
                ? npc.conditionVariableId
                : (typeof npc.conditionalVariableId === 'string' ? npc.conditionalVariableId : null);
            const rewardId = typeof npc.rewardVariableId === 'string'
                ? npc.rewardVariableId
                : (typeof npc.activateVariableId === 'string' ? npc.activateVariableId : null);
            const conditionalRewardId = typeof npc.conditionalRewardVariableId === 'string'
                ? npc.conditionalRewardVariableId
                : (typeof npc.alternativeRewardVariableId === 'string' ? npc.alternativeRewardVariableId : null);
            const hasConditionId = typeof conditionId === 'string' && ShareConstants.VARIABLE_IDS.includes(conditionId);
            const hasRewardId = typeof rewardId === 'string' && ShareConstants.VARIABLE_IDS.includes(rewardId);
            const hasConditionalRewardId =
                typeof conditionalRewardId === 'string' && ShareConstants.VARIABLE_IDS.includes(conditionalRewardId);
            normalized.push({
                type,
                id: def.id,
                name: def.name,
                x,
                y,
                roomIndex: ShareMath.clampRoomIndex(npc.roomIndex),
                text: typeof npc.text === 'string' ? npc.text : (def.defaultText || ''),
                textKey: typeof npc.textKey === 'string' && npc.textKey.length
                    ? npc.textKey
                    : (def.defaultTextKey || null),
                conditionVariableId: hasConditionId ? conditionId : null,
                conditionText: typeof npc.conditionText === 'string'
                    ? npc.conditionText
                    : (typeof npc.conditionalText === 'string' ? npc.conditionalText : ''),
                rewardVariableId: hasRewardId ? rewardId : null,
                conditionalRewardVariableId: hasConditionalRewardId ? conditionalRewardId : null
            });
            seen.add(type);
        }
        return normalized;
    }

    static normalizeEnemies(list: unknown[] | null | undefined): NormalizedEnemy[] {
        if (!Array.isArray(list)) return [];
        const defs = ShareConstants.ENEMY_DEFINITIONS as EnemyDefinitionLookup[];
        const perRoomCounts = new Map<number, number>();

        return list
            .map((raw, index) => {
                const enemy = raw as ShareEnemyInput;
                const type = ShareDataNormalizer.normalizeEnemyType(enemy.type);
                const typeIndex = Array.isArray(defs) && defs.length
                    ? defs.findIndex((def) => def.type === type)
                    : -1;
                const defeatVariableId = ShareDataNormalizer.normalizeEnemyVariable(enemy.defeatVariableId);
                return {
                    x: ShareMath.clamp(Number(enemy.x), 0, ShareConstants.MATRIX_SIZE - 1, 0),
                    y: ShareMath.clamp(Number(enemy.y), 0, ShareConstants.MATRIX_SIZE - 1, 0),
                    roomIndex: ShareMath.clampRoomIndex(enemy.roomIndex),
                    type,
                    id: enemy.id || `enemy-${index + 1}`,
                    typeIndex,
                    defeatVariableId,
                    variableNibble: ShareVariableCodec.variableIdToNibble(defeatVariableId)
                };
            })
            .filter((enemy) => {
                if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return false;
                const count = perRoomCounts.get(enemy.roomIndex) || 0;
                if (count >= 9) return false;
                perRoomCounts.set(enemy.roomIndex, count + 1);
                return true;
            });
    }

    static normalizeObjectPositions(list: unknown[] | null | undefined, type: string): PositionEntry[] {
        if (!Array.isArray(list)) return [];
        const seenRooms = new Set<number>();
        const result: PositionEntry[] = [];
        for (const raw of list) {
            const entry = raw as ShareObjectInput;
            if (entry.type !== type) continue;
            const x = ShareMath.clamp(Number(entry.x), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const y = ShareMath.clamp(Number(entry.y), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const roomIndex = ShareMath.clampRoomIndex(entry.roomIndex);
            if (seenRooms.has(roomIndex)) continue;
            seenRooms.add(roomIndex);
            result.push({ x, y, roomIndex });
        }
        return result.sort((a, b) => {
            if (a.roomIndex !== b.roomIndex) return a.roomIndex - b.roomIndex;
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }

    static normalizeVariableDoorObjects(list: unknown[] | null | undefined) {
        if (!Array.isArray(list)) return [];
        const seenRooms = new Set<number>();
        const fallbackNibble = ShareVariableCodec.variableIdToNibble(ShareVariableCodec.getFirstVariableId()) || 1;
        const result: Array<PositionEntry & { variableNibble: number }> = [];
        for (const raw of list) {
            const entry = raw as ShareObjectInput;
            if (entry.type !== ShareDataNormalizer.Types.DOOR_VARIABLE) continue;
            const x = ShareMath.clamp(Number(entry.x), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const y = ShareMath.clamp(Number(entry.y), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const roomIndex = ShareMath.clampRoomIndex(entry.roomIndex);
            if (seenRooms.has(roomIndex)) continue;
            seenRooms.add(roomIndex);
            const variableNibble =
                ShareVariableCodec.variableIdToNibble(typeof entry.variableId === 'string' ? entry.variableId : null) ||
                fallbackNibble;
            result.push({ x, y, roomIndex, variableNibble });
        }
        return result.sort((a, b) => {
            if (a.roomIndex !== b.roomIndex) return a.roomIndex - b.roomIndex;
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }

    static normalizeSwitchObjects(list: unknown[] | null | undefined) {
        if (!Array.isArray(list)) return [];
        const seenRooms = new Set<number>();
        const fallbackNibble = ShareVariableCodec.variableIdToNibble(ShareVariableCodec.getFirstVariableId()) || 1;
        const result: Array<PositionEntry & { variableNibble: number; stateNibble: number }> = [];
        for (const raw of list) {
            const entry = raw as ShareObjectInput;
            if (entry.type !== ShareDataNormalizer.Types.SWITCH) continue;
            const x = ShareMath.clamp(Number(entry.x), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const y = ShareMath.clamp(Number(entry.y), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const roomIndex = ShareMath.clampRoomIndex(entry.roomIndex);
            if (seenRooms.has(roomIndex)) continue;
            seenRooms.add(roomIndex);
            const variableNibble =
                ShareVariableCodec.variableIdToNibble(typeof entry.variableId === 'string' ? entry.variableId : null) ||
                fallbackNibble;
            const stateNibble = entry.on ? 1 : 0;
            result.push({ x, y, roomIndex, variableNibble, stateNibble });
        }
        return result.sort((a, b) => {
            if (a.roomIndex !== b.roomIndex) return a.roomIndex - b.roomIndex;
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }

    static buildObjectEntries(
        positions: unknown[] | null | undefined,
        type: string,
        options: SharePositionOptions = {}
    ): Array<Record<string, unknown>> {
        if (!Array.isArray(positions) || !positions.length) return [];
        const variableNibbles = Array.isArray(options.variableNibbles) ? options.variableNibbles : [];
        const endingTexts = Array.isArray(options.endingTexts) ? options.endingTexts : [];
        const fallbackVariableId = ShareVariableCodec.getFirstVariableId();
        return positions.map((raw, index) => {
            const pos = raw as ShareObjectInput;
            const roomIndex = ShareMath.clampRoomIndex(pos.roomIndex);
            const x = ShareMath.clamp(Number(pos.x), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const y = ShareMath.clamp(Number(pos.y), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const entry: Record<string, unknown> = {
                id: `${type}-${roomIndex}`,
                type,
                roomIndex,
                x,
                y
            };
            if (type === ShareDataNormalizer.Types.KEY) {
                entry.collected = false;
            }
            if (type === ShareDataNormalizer.Types.LIFE_POTION) {
                entry.collected = false;
            }
            if (type === ShareDataNormalizer.Types.XP_SCROLL) {
                entry.collected = false;
            }
            if (type === ShareDataNormalizer.Types.SWORD || type === ShareDataNormalizer.Types.SWORD_BRONZE || type === ShareDataNormalizer.Types.SWORD_WOOD) {
                entry.collected = false;
            }
            if (type === ShareDataNormalizer.Types.DOOR) {
                entry.opened = false;
            }
            if (type === ShareDataNormalizer.Types.DOOR_VARIABLE) {
                const nibble = variableNibbles[index] ?? ShareVariableCodec.variableIdToNibble(fallbackVariableId);
                const variableId = ShareVariableCodec.nibbleToVariableId(nibble) || fallbackVariableId;
                if (variableId) {
                    entry.variableId = variableId;
                }
            }
            if (type === ShareDataNormalizer.Types.SWITCH) {
                const nibble = variableNibbles[index] ?? ShareVariableCodec.variableIdToNibble(fallbackVariableId);
                const variableId = ShareVariableCodec.nibbleToVariableId(nibble) || fallbackVariableId;
                if (variableId) {
                    entry.variableId = variableId;
                }
                const state = Array.isArray(options.stateBits) ? options.stateBits[index] : null;
                entry.on = Boolean(state);
            }
            if (type === ShareDataNormalizer.Types.PLAYER_END) {
                const endingText = ShareDataNormalizer.normalizeEndingTextValue(endingTexts[index] ?? '');
                if (endingText) {
                    entry.endingText = endingText;
                }
            }
            return entry;
        });
    }

    static getPlayerEndTextLimit() {
        if (typeof StateObjectManager.PLAYER_END_TEXT_LIMIT === 'number') {
            return StateObjectManager.PLAYER_END_TEXT_LIMIT;
        }
        return 40;
    }

    static normalizeEndingTextValue(value?: string | null): string {
        if (typeof value !== 'string') return '';
        const normalized = value.replace(/\r\n/g, '\n');
        const max = ShareDataNormalizer.getPlayerEndTextLimit();
        return normalized.slice(0, max).trim();
    }

    static collectPlayerEndTexts(objects: unknown[] | null | undefined): string[] {
        if (!Array.isArray(objects)) return [];
        const entries: Array<{ roomIndex: number; x: number; y: number; text: string }> = [];
        const seenRooms = new Set<number>();
        for (const raw of objects) {
            const object = raw as ShareObjectInput;
            if (object.type !== ShareDataNormalizer.Types.PLAYER_END) continue;
            const roomIndex = ShareMath.clampRoomIndex(object.roomIndex);
            if (seenRooms.has(roomIndex)) continue;
            seenRooms.add(roomIndex);
            const x = ShareMath.clamp(Number(object.x), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            const y = ShareMath.clamp(Number(object.y), 0, ShareConstants.MATRIX_SIZE - 1, 0);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            entries.push({
                roomIndex,
                x,
                y,
                text: ShareDataNormalizer.normalizeEndingTextValue(object.endingText)
            });
        }
        entries.sort((a, b) => {
            if (a.roomIndex !== b.roomIndex) return a.roomIndex - b.roomIndex;
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
        return entries.map((entry) => entry.text);
    }

    static normalizeEnemyType(type?: string | null) {
        return EnemyDefinitions.normalizeType(type);
    }

    static normalizeEnemyVariable(variableId?: string | null) {
        if (typeof variableId !== 'string') return null;
        return ShareConstants.VARIABLE_IDS.includes(variableId) ? variableId : null;
    }
}

export { ShareDataNormalizer };
