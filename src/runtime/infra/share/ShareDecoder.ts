
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { ShareConstants } from './ShareConstants';
import { ShareDataNormalizer } from './ShareDataNormalizer';
import { ShareBase64 } from './ShareBase64';
import { ShareMatrixCodec } from './ShareMatrixCodec';
import { SharePositionCodec } from './SharePositionCodec';
import { ShareTextCodec } from './ShareTextCodec';
import { ShareVariableCodec } from './ShareVariableCodec';

type SharePayload = Record<string, string>;

class ShareDecoder {
    private static decodeCustomPalette(segment: string): string[] | undefined {
        if (!segment || segment.length === 0) {
            return undefined;
        }

        if (segment.includes(',')) {
            const colors = segment.split(',').map(c => `#${c.toUpperCase()}`);

            // Validação: deve ter exatamente 16 cores
            if (colors.length !== 16) {
                console.warn('Invalid custom palette segment, expected 16 colors');
                return undefined;
            }

            // Validação: todas devem ser hex válidas
            const hexRegex = /^#[0-9A-F]{6}$/;
            const allValid = colors.every(c => hexRegex.test(c));

            if (!allValid) {
                console.warn('Invalid hex colors in custom palette');
                return undefined;
            }

            return colors;
        }

        const bytes = ShareBase64.fromBase64Url(segment);
        if (bytes.length !== 16 * 3) {
            console.warn('Invalid custom palette segment, expected 48 bytes');
            return undefined;
        }
        const colors: string[] = [];
        for (let index = 0; index < 16; index++) {
            const base = index * 3;
            const r = bytes[base].toString(16).padStart(2, '0');
            const g = bytes[base + 1].toString(16).padStart(2, '0');
            const b = bytes[base + 2].toString(16).padStart(2, '0');
            colors.push(`#${(r + g + b).toUpperCase()}`);
        }
        return colors;
    }

    static decodeShareCode(code?: string | null): Record<string, unknown> | null {
        const OT = ITEM_TYPES;
        if (!code) return null;
        const segments = code.split('.');
        const payload: SharePayload = {};
        for (const segment of segments) {
            if (!segment) continue;
            const key = segment[0];
            const value = segment.slice(1);
            payload[key] = value;
        }

        const version = payload.v ? parseInt(payload.v, 36) : NaN;
        if (!Number.isFinite(version) || !ShareConstants.SUPPORTED_VERSIONS.has(version)) {
            return null;
        }

        const roomCount = version >= ShareConstants.VERSION_3 ? ShareConstants.WORLD_ROOM_COUNT : 1;
        const groundMaps = ShareMatrixCodec.decodeWorldGround(payload.g || '', version, roomCount);
        const overlayMaps = ShareMatrixCodec.decodeWorldOverlay(payload.o || '', version, roomCount);
        const startPosition = SharePositionCodec.decodePositions(payload.s || '')?.[0] ?? ShareDataNormalizer.normalizeStart({});
        const npcPositions = SharePositionCodec.decodePositions(payload.p || '');
        const npcTexts = ShareTextCodec.decodeTextArray(payload.t || '');
        const npcTypeIndexes = SharePositionCodec.decodeNpcTypeIndexes(payload.i || '');
        const npcConditionalTexts = version >= ShareConstants.NPC_VARIABLE_TEXT_VERSION ? ShareTextCodec.decodeTextArray(payload.u || '') : [];
        const npcConditionIndexes = version >= ShareConstants.NPC_VARIABLE_TEXT_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.c || '', npcPositions.length)
            : [];
        const npcRewardIndexes = version >= ShareConstants.NPC_VARIABLE_TEXT_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.r || '', npcPositions.length)
            : [];
        const npcConditionalRewardIndexes = version >= ShareConstants.NPC_CONDITIONAL_REWARD_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.h || '', npcPositions.length)
            : [];
        const enemyPositions = SharePositionCodec.decodePositions(payload.e || '');
        const enemyTypeIndexes = version >= ShareConstants.ENEMY_TYPE_VERSION
            ? SharePositionCodec.decodeEnemyTypeIndexes(payload.f || '', enemyPositions.length)
            : [];
        const enemyVariableNibbles = version >= ShareConstants.ENEMY_VARIABLE_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.w || '', enemyPositions.length)
            : (new Array(enemyPositions.length).fill(0) as number[]);
        const doorPositions = version >= ShareConstants.OBJECTS_VERSION ? SharePositionCodec.decodePositions(payload.d || '') : [];
        const keyPositions = version >= ShareConstants.OBJECTS_VERSION ? SharePositionCodec.decodePositions(payload.k || '') : [];
        const magicDoorPositions = version >= ShareConstants.MAGIC_DOOR_VERSION ? SharePositionCodec.decodePositions(payload.m || '') : [];
        const magicDoorVariableNibbles = version >= ShareConstants.MAGIC_DOOR_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.q || '', magicDoorPositions.length)
            : [];
        const lifePotionPositions = version >= ShareConstants.LIFE_POTION_VERSION
            ? SharePositionCodec.decodePositions(payload.l || '')
            : [];
        const xpScrollPositions = version >= ShareConstants.XP_SCROLL_VERSION
            ? SharePositionCodec.decodePositions(payload.x || '')
            : [];
        const swordPositions = version >= ShareConstants.SWORD_VERSION
            ? SharePositionCodec.decodePositions(payload.a || '')
            : [];
        const swordBronzePositions = version >= ShareConstants.TIERED_SWORD_VERSION
            ? SharePositionCodec.decodePositions(payload.B || '')
            : [];
        const swordWoodPositions = version >= ShareConstants.TIERED_SWORD_VERSION
            ? SharePositionCodec.decodePositions(payload.W || '')
            : [];
        const playerEndPositions = version >= ShareConstants.PLAYER_END_VERSION
            ? SharePositionCodec.decodePositions(payload.z || '')
            : [];
        let playerEndMessages: string[] = [];
        if (version >= ShareConstants.PLAYER_END_TEXT_ARRAY_VERSION) {
            playerEndMessages = ShareTextCodec.decodeTextArray(payload.E || '');
        } else if (version >= ShareConstants.PLAYER_END_TEXT_VERSION) {
            const legacyMessage = ShareTextCodec.decodeText(payload.E || '', '');
            if (legacyMessage) {
                playerEndMessages = [legacyMessage];
            }
        }
        const variableStates = version >= ShareConstants.VARIABLES_VERSION ? ShareVariableCodec.decodeVariables(payload.b || '') : [];
        const switchPositions = version >= ShareConstants.SWITCH_VERSION
            ? SharePositionCodec.decodePositions(payload.J || '')
            : [];
        const switchVariableNibbles = version >= ShareConstants.SWITCH_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.K || '', switchPositions.length)
            : [];
        const switchStateNibbles = version >= ShareConstants.SWITCH_VERSION
            ? ShareVariableCodec.decodeVariableNibbleArray(payload.L || '', switchPositions.length)
            : [];
        const title = (ShareTextCodec.decodeText(payload.n, ShareConstants.DEFAULT_TITLE) || ShareConstants.DEFAULT_TITLE).slice(0, 18);
        const author = (ShareTextCodec.decodeText(payload.y, '') || '').slice(0, 18);
        const buildNpcId = (index: number) => `npc-${index + 1}`;

        const defs = ShareConstants.NPC_DEFINITIONS as Array<{
            id?: string;
            type?: string;
            name?: string;
            defaultText?: string;
            defaultTextKey?: string;
        }>;
        const canUseDefinitions = defs.length > 0 && (npcTypeIndexes.length > 0 || npcPositions.length <= defs.length);
        const sprites = [];
        if (canUseDefinitions) {
            for (let index = 0; index < npcPositions.length; index++) {
                const typeIndex = npcTypeIndexes[index] ?? index;
                const def = defs[typeIndex];
                if (!def) continue;
                const pos = npcPositions[index];
                const conditionVariableId = ShareVariableCodec.nibbleToVariableId(npcConditionIndexes[index] ?? 0);
                const rewardVariableId = ShareVariableCodec.nibbleToVariableId(npcRewardIndexes[index] ?? 0);
                const conditionalRewardVariableId = ShareVariableCodec.nibbleToVariableId(npcConditionalRewardIndexes[index] ?? 0);
                sprites.push({
                    id: buildNpcId(index),
                    type: def.type,
                    name: def.name,
                    x: pos.x,
                    y: pos.y,
                    roomIndex: pos.roomIndex,
                    text: npcTexts[index] ?? (def.defaultText || ''),
                    placed: true,
                    conditionVariableId,
                    conditionText: npcConditionalTexts[index] ?? '',
                    rewardVariableId,
                    conditionalRewardVariableId
                });
            }
        } else {
            for (let index = 0; index < npcPositions.length; index++) {
                const pos = npcPositions[index];
                const conditionVariableId = ShareVariableCodec.nibbleToVariableId(npcConditionIndexes[index] ?? 0);
                const rewardVariableId = ShareVariableCodec.nibbleToVariableId(npcRewardIndexes[index] ?? 0);
                const conditionalRewardVariableId = ShareVariableCodec.nibbleToVariableId(npcConditionalRewardIndexes[index] ?? 0);
                sprites.push({
                    id: buildNpcId(index),
                    name: `NPC ${index + 1}`,
                    x: pos.x,
                    y: pos.y,
                    roomIndex: pos.roomIndex,
                    text: npcTexts[index] ?? '',
                    placed: true,
                    conditionVariableId,
                    conditionText: npcConditionalTexts[index] ?? '',
                    rewardVariableId,
                    conditionalRewardVariableId
                });
            }
        }

        const defaultEnemyType = ShareDataNormalizer.normalizeEnemyType();
        const enemyDefinitions = ShareConstants.ENEMY_DEFINITIONS as Array<{ type?: string }>;
        const enemies = enemyPositions.map((pos, index) => {
            const nibble: number = enemyVariableNibbles[index] ?? 0;
            return {
                id: `enemy-${index + 1}`,
                type: (() => {
                    const idx: number | undefined = enemyTypeIndexes[index];
                    if (Number.isFinite(idx) && idx !== undefined && idx >= 0 && idx < enemyDefinitions.length) {
                        return ShareDataNormalizer.normalizeEnemyType(enemyDefinitions[idx]?.type);
                    }
                    return defaultEnemyType;
                })(),
                x: pos.x,
                y: pos.y,
                roomIndex: pos.roomIndex,
                defeatVariableId: ShareVariableCodec.nibbleToVariableId(nibble)
            };
        });

        const rooms = Array.from({ length: roomCount }, () => ({ bg: 0 }));
        const maps = [];
        for (let index = 0; index < roomCount; index++) {
            const ground = groundMaps[index] ?? ShareMatrixCodec.normalizeGround([]);
            const overlay = overlayMaps[index] ?? ShareMatrixCodec.normalizeOverlay([]);
            maps.push({ ground, overlay });
        }

        const playerEndEntries = ShareDataNormalizer.buildObjectEntries(
            playerEndPositions,
            OT.PLAYER_END,
            { endingTexts: playerEndMessages }
        );

        const objects = [
            ...ShareDataNormalizer.buildObjectEntries(doorPositions, OT.DOOR),
            ...ShareDataNormalizer.buildObjectEntries(keyPositions, OT.KEY),
            ...ShareDataNormalizer.buildObjectEntries(magicDoorPositions, OT.DOOR_VARIABLE, { variableNibbles: magicDoorVariableNibbles }),
            ...ShareDataNormalizer.buildObjectEntries(lifePotionPositions, OT.LIFE_POTION),
            ...ShareDataNormalizer.buildObjectEntries(xpScrollPositions, OT.XP_SCROLL),
            ...ShareDataNormalizer.buildObjectEntries(swordPositions, OT.SWORD),
            ...ShareDataNormalizer.buildObjectEntries(swordBronzePositions, OT.SWORD_BRONZE),
            ...ShareDataNormalizer.buildObjectEntries(swordWoodPositions, OT.SWORD_WOOD),
            ...playerEndEntries,
            ...ShareDataNormalizer.buildObjectEntries(switchPositions, OT.SWITCH, { variableNibbles: switchVariableNibbles, stateBits: switchStateNibbles })
        ];

        // Custom Palette
        const customPalette = payload.P ? this.decodeCustomPalette(payload.P) : undefined;

        const result: Record<string, unknown> = {
            title,
            author,
            start: startPosition,
            sprites,
            enemies,
            world: version >= ShareConstants.VERSION_3
                ? { rows: ShareConstants.WORLD_ROWS, cols: ShareConstants.WORLD_COLS }
                : { rows: 1, cols: 1 },
            rooms,
            objects,
            variables: ShareVariableCodec.buildVariableEntries(variableStates),
            tileset: {
                tiles: [],
                maps,
                map: maps[0] || { ground: ShareMatrixCodec.normalizeGround([]), overlay: ShareMatrixCodec.normalizeOverlay([]) }
            }
        };

        if (customPalette) {
            result.customPalette = customPalette;
        }

        return result;
    }
}

export { ShareDecoder };
