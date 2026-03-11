
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { ShareConstants } from './ShareConstants';
import { ShareDataNormalizer } from './ShareDataNormalizer';
import { ShareBase64 } from './ShareBase64';
import { ShareMatrixCodec } from './ShareMatrixCodec';
import { SharePositionCodec } from './SharePositionCodec';
import { ShareTextCodec } from './ShareTextCodec';
import { ShareVariableCodec } from './ShareVariableCodec';
import type { CustomSpriteEntry, CustomSpriteVariant } from '../../../types/gameState';
import { SpriteMatrixRegistry } from '../../domain/sprites/SpriteMatrixRegistry';
import { ShareSpriteCatalog } from './ShareSpriteCatalog';

type SharePayload = Record<string, string>;

class ShareDecoder {
    private static readonly CUSTOM_SPRITE_BINARY_VERSION = 4;
    private static readonly CUSTOM_SPRITE_BINARY_VERSION_1 = 1;
    private static readonly CUSTOM_SPRITE_BINARY_VERSION_2 = 2;
    private static readonly CUSTOM_SPRITE_BINARY_VERSION_3 = 3;
    private static readonly GROUPS: CustomSpriteEntry['group'][] = ['tile', 'npc', 'enemy', 'object'];

    private static countMaskBits(maskBytes: Uint8Array | number[], bitCount: number): number {
        let count = 0;
        for (let bitIndex = 0; bitIndex < bitCount; bitIndex++) {
            const mask = maskBytes[bitIndex >> 3] ?? 0;
            if (((mask >> (bitIndex & 7)) & 1) === 1) {
                count++;
            }
        }
        return count;
    }

    private static resolveBaseFrame(group: CustomSpriteEntry['group'], key: string, variant: CustomSpriteVariant): (number | null)[][] | null {
        if (group === 'tile') {
            return null;
        }

        try {
            if (group === 'object' && variant === 'on') {
                return SpriteMatrixRegistry.get('object', `${key}--on`).map((row) => row.slice());
            }
            return SpriteMatrixRegistry.get(group, key).map((row) => row.slice());
        } catch {
            return null;
        }
    }

    private static decodeCustomSprites(encoded: string): CustomSpriteEntry[] {
        const binaryResult = this.decodeCustomSpritesBinary(encoded);
        if (binaryResult) {
            return binaryResult;
        }

        try {
            const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(json) as Array<{ g: string; k: string; v: string; f: string[] }>;
            return payload.map(item => ({
                group: item.g as CustomSpriteEntry['group'],
                key: item.k,
                variant: (item.v || 'base') as CustomSpriteVariant,
                frames: item.f.map(frameStr => {
                    const pixels: (number | null)[] = [];
                    for (const ch of frameStr) {
                        pixels.push(ch === 'z' ? null : parseInt(ch, 16));
                    }
                    const size = Math.round(Math.sqrt(pixels.length));
                    const frame: (number | null)[][] = [];
                    for (let r = 0; r < size; r++) {
                        frame.push(pixels.slice(r * size, (r + 1) * size));
                    }
                    return frame;
                }),
            }));
        } catch {
            return [];
        }
    }

    private static decodeCustomSpritesBinary(encoded: string): CustomSpriteEntry[] | null {
        const bytes = ShareBase64.fromBase64Url(encoded);
        if (bytes.length < 2) {
            return null;
        }
        if (
            bytes[0] !== this.CUSTOM_SPRITE_BINARY_VERSION &&
            bytes[0] !== this.CUSTOM_SPRITE_BINARY_VERSION_3 &&
            bytes[0] !== this.CUSTOM_SPRITE_BINARY_VERSION_2 &&
            bytes[0] !== this.CUSTOM_SPRITE_BINARY_VERSION_1
        ) {
            return null;
        }

        try {
            const decoder = new TextDecoder();
            let offset = 1;
            const entryCount = bytes[offset++] ?? 0;
            const entries: CustomSpriteEntry[] = [];

            for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
                const flags = bytes[offset++] ?? 0;
                const group = this.GROUPS[flags & 0x03] ?? 'tile';
                const variant = (((flags >> 2) & 0x01) === 1 ? 'on' : 'base') as CustomSpriteVariant;
                const usesDelta = bytes[0] >= this.CUSTOM_SPRITE_BINARY_VERSION_2 && (((flags >> 3) & 0x01) === 1);
                const usesIndexedKey = bytes[0] >= this.CUSTOM_SPRITE_BINARY_VERSION_3 && (((flags >> 4) & 0x01) === 1);
                const usesFixed8x8Indexed = bytes[0] >= this.CUSTOM_SPRITE_BINARY_VERSION && (((flags >> 5) & 0x01) === 1);
                let frameCount = 0;
                let key = '';
                if (bytes[0] >= this.CUSTOM_SPRITE_BINARY_VERSION_3) {
                    frameCount = bytes[offset++] ?? 0;
                }
                if (usesIndexedKey) {
                    const keyIndex = bytes[offset++] ?? 0;
                    key = ShareSpriteCatalog.getKeyByIndex(group, keyIndex, variant) ?? '';
                } else {
                    const keyLength = bytes[offset++] ?? 0;
                    if (bytes[0] < this.CUSTOM_SPRITE_BINARY_VERSION_3) {
                        frameCount = bytes[offset++] ?? 0;
                    }
                    const keyBytes = bytes.slice(offset, offset + keyLength);
                    offset += keyLength;
                    key = decoder.decode(keyBytes);
                }
                const frames: CustomSpriteEntry['frames'] = [];
                const baseFrame = usesDelta ? this.resolveBaseFrame(group, key, variant) : null;

                for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
                    const rows = usesFixed8x8Indexed ? 8 : (bytes[offset++] ?? 0);
                    const cols = usesFixed8x8Indexed ? 8 : (bytes[offset++] ?? 0);
                    const pixelCount = rows * cols;

                    if (usesDelta && baseFrame && baseFrame.length === rows && (baseFrame[0]?.length ?? 0) === cols) {
                        const changedMaskLength = Math.ceil(pixelCount / 8);
                        const changedMask = bytes.slice(offset, offset + changedMaskLength);
                        offset += changedMaskLength;

                        const changedCount = this.countMaskBits(changedMask, pixelCount);

                        const stateMaskLength = Math.ceil(changedCount / 8);
                        const stateMask = bytes.slice(offset, offset + stateMaskLength);
                        offset += stateMaskLength;

                        const opaqueChangedCount = this.countMaskBits(stateMask, changedCount);

                        const colorByteLength = Math.ceil(opaqueChangedCount / 2);
                        const colorBytes = bytes.slice(offset, offset + colorByteLength);
                        offset += colorByteLength;

                        const flat = baseFrame.flat().slice(0, pixelCount) as (number | null)[];
                        let changedIndex = 0;
                        let colorIndex = 0;
                        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                            const mask = changedMask[pixelIndex >> 3] ?? 0;
                            if (((mask >> (pixelIndex & 7)) & 1) !== 1) continue;
                            const state = stateMask[changedIndex >> 3] ?? 0;
                            const isOpaque = ((state >> (changedIndex & 7)) & 1) === 1;
                            if (!isOpaque) {
                                flat[pixelIndex] = null;
                            } else {
                                const packed = colorBytes[colorIndex >> 1] ?? 0;
                                flat[pixelIndex] = (colorIndex & 1) === 0 ? ((packed >> 4) & 0x0f) : (packed & 0x0f);
                                colorIndex++;
                            }
                            changedIndex++;
                        }

                        const frame: (number | null)[][] = [];
                        for (let row = 0; row < rows; row++) {
                            frame.push(flat.slice(row * cols, (row + 1) * cols));
                        }
                        frames.push(frame);
                    } else {
                        const maskLength = Math.ceil(pixelCount / 8);
                        const maskBytes = bytes.slice(offset, offset + maskLength);
                        offset += maskLength;

                        const opaqueCount = this.countMaskBits(maskBytes, pixelCount);
                        const colorByteLength = Math.ceil(opaqueCount / 2);
                        const colorBytes = bytes.slice(offset, offset + colorByteLength);
                        offset += colorByteLength;

                        const flat = Array.from({ length: pixelCount }, () => null as number | null);
                        let colorIndex = 0;
                        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                            const mask = maskBytes[pixelIndex >> 3] ?? 0;
                            if (((mask >> (pixelIndex & 7)) & 1) !== 1) continue;
                            const packed = colorBytes[colorIndex >> 1] ?? 0;
                            flat[pixelIndex] = (colorIndex & 1) === 0 ? ((packed >> 4) & 0x0f) : (packed & 0x0f);
                            colorIndex++;
                        }

                        const frame: (number | null)[][] = [];
                        for (let row = 0; row < rows; row++) {
                            frame.push(flat.slice(row * cols, (row + 1) * cols));
                        }
                        frames.push(frame);
                    }
                }

                entries.push({ group, key, variant, frames });
            }

            return entries;
        } catch {
            return [];
        }
    }

    private static decodeCustomPalette(segment: string): string[] | undefined {
        if (!segment || segment.length === 0) {
            return undefined;
        }

        if (segment.includes(',')) {
            const colors = segment.split(',').map(c => `#${c.toUpperCase()}`);

            // Validation: it must contain exactly 16 colors.
            if (colors.length !== 16) {
                console.warn('Invalid custom palette segment, expected 16 colors');
                return undefined;
            }

            // Validation: every color must be a valid hex value.
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
        const startPositions = SharePositionCodec.decodePositions(payload.s || '');
        const startPosition = startPositions[0] ?? ShareDataNormalizer.normalizeStart({});
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
                const def = defs[typeIndex] as (typeof defs)[number] | undefined;
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
                    const idx = enemyTypeIndexes[index];
                    if (Number.isFinite(idx) && idx >= 0 && idx < enemyDefinitions.length) {
                        return ShareDataNormalizer.normalizeEnemyType(enemyDefinitions[idx].type);
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

        // Custom Sprites
        const customSprites = payload.S ? this.decodeCustomSprites(payload.S) : undefined;

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

        if (customSprites && customSprites.length > 0) {
            result.customSprites = customSprites;
        }

        return result;
    }
}

export { ShareDecoder };
