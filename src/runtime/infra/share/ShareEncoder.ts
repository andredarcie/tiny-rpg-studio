
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { TileDefinitions } from '../../domain/definitions/TileDefinitions';
import { SkillDefinitions } from '../../domain/definitions/SkillDefinitions';
import { ShareConstants } from './ShareConstants';
import { ShareDataNormalizer } from './ShareDataNormalizer';
import { ShareMatrixCodec } from './ShareMatrixCodec';
import { SharePositionCodec } from './SharePositionCodec';
import { ShareTextCodec } from './ShareTextCodec';
import { ShareVariableCodec } from './ShareVariableCodec';
import { ShareBase64 } from './ShareBase64';
import { SpriteMatrixRegistry } from '../../domain/sprites/SpriteMatrixRegistry';
import { ShareSpriteCatalog } from './ShareSpriteCatalog';
import type { CustomSpriteEntry } from '../../../types/gameState';

type CustomSpriteEntryLike = {
    group: string;
    key: string;
    variant?: string;
    frames: ((number | null)[][])[];
};

type ShareGameData = {
    title?: unknown;
    author?: unknown;
    hideHud?: unknown;
    disableSkills?: unknown;
    start?: unknown;
    sprites?: unknown[];
    enemies?: unknown[];
    objects?: unknown[];
    variables?: unknown[];
    rooms?: unknown[];
    tileset?: unknown;
    world?: unknown;
    customPalette?: string[];
    customSprites?: CustomSpriteEntryLike[];
    skillOrder?: string[];
};

class ShareEncoder {
    private static readonly CUSTOM_SPRITE_BINARY_VERSION = 5;
    private static readonly GROUP_TO_ID: Record<string, number> = {
        tile: 0,
        npc: 1,
        enemy: 2,
        object: 3,
        player: 4
    };

    private static packNibblePair(values: number[], index: number): number {
        const left = values[index] & 0x0f;
        const right = index + 1 < values.length ? (values[index + 1] & 0x0f) : 0;
        return (left << 4) | right;
    }

    private static resolveBaseFrame(entry: CustomSpriteEntryLike): (number | null)[][] | null {
        if (entry.group === 'tile') {
            return null;
        }

        try {
            if (entry.group === 'object' && entry.variant === 'on') {
                return SpriteMatrixRegistry.get('object', `${entry.key}--on`).map((row) => row.slice());
            }
            return SpriteMatrixRegistry.get(entry.group, entry.key).map((row) => row.slice());
        } catch {
            return null;
        }
    }

    private static encodeFullFrame(bytes: number[], frame: (number | null)[][]): void {
        const rows = Array.isArray(frame) ? frame.length : 0;
        const cols = rows > 0 && Array.isArray(frame[0]) ? frame[0].length : 0;
        bytes.push(rows & 0xff);
        bytes.push(cols & 0xff);

        const flat = frame.flat();
        const pixelCount = rows * cols;
        const maskBytes = new Uint8Array(Math.ceil(pixelCount / 8));
        const colors: number[] = [];

        for (let index = 0; index < pixelCount; index++) {
            const px = flat[index];
            if (px !== null) {
                maskBytes[index >> 3] |= 1 << (index & 7);
                colors.push(px & 0x0f);
            }
        }

        bytes.push(...maskBytes);
        for (let index = 0; index < colors.length; index += 2) {
            bytes.push(ShareEncoder.packNibblePair(colors, index));
        }
    }

    private static tryEncodeDeltaFrame(bytes: number[], frame: (number | null)[][], baseFrame: (number | null)[][]): boolean {
        const rows = Array.isArray(frame) ? frame.length : 0;
        const cols = rows > 0 && Array.isArray(frame[0]) ? frame[0].length : 0;
        if (rows === 0 || cols === 0 || baseFrame.length !== rows || (baseFrame[0]?.length ?? 0) !== cols) {
            return false;
        }

        const flat = frame.flat();
        const baseFlat = baseFrame.flat();
        const pixelCount = rows * cols;
        const changedMask = new Uint8Array(Math.ceil(pixelCount / 8));
        const changedStates: number[] = [];
        const changedColors: number[] = [];
        let changedCount = 0;

        for (let index = 0; index < pixelCount; index++) {
            const next = flat[index] ?? null;
            const base = baseFlat[index] ?? null;
            if (next === base) continue;
            changedMask[index >> 3] |= 1 << (index & 7);
            changedCount++;
            if (next !== null) {
                changedStates.push(1);
                changedColors.push(next & 0x0f);
            } else {
                changedStates.push(0);
            }
        }

        if (changedCount === 0) {
            bytes.push(rows & 0xff);
            bytes.push(cols & 0xff);
            bytes.push(...new Uint8Array(Math.ceil(pixelCount / 8)));
            bytes.push(0);
            return true;
        }

        const changedStateMask = new Uint8Array(Math.ceil(changedCount / 8));
        for (let index = 0; index < changedStates.length; index++) {
            if (changedStates[index] === 1) {
                changedStateMask[index >> 3] |= 1 << (index & 7);
            }
        }

        const deltaSize = 2 + changedMask.length + changedStateMask.length + Math.ceil(changedColors.length / 2);
        const fullOpaqueCount = flat.reduce((count: number, px) => count + (px !== null ? 1 : 0), 0);
        const fullSize = 2 + Math.ceil(pixelCount / 8) + Math.ceil(fullOpaqueCount / 2);
        if (deltaSize >= fullSize) {
            return false;
        }

        bytes.push(rows & 0xff);
        bytes.push(cols & 0xff);
        bytes.push(...changedMask);
        bytes.push(...changedStateMask);
        for (let index = 0; index < changedColors.length; index += 2) {
            bytes.push(ShareEncoder.packNibblePair(changedColors, index));
        }
        return true;
    }

    private static encodeIndexed8x8DeltaFrame(bytes: number[], frame: (number | null)[][], baseFrame: (number | null)[][]): void {
        const flat = frame.flat();
        const baseFlat = baseFrame.flat();
        const pixelCount = 64;
        const changedMask = new Uint8Array(8);
        const changedStates: number[] = [];
        const changedColors: number[] = [];
        let changedCount = 0;

        for (let index = 0; index < pixelCount; index++) {
            const next = flat[index] ?? null;
            const base = baseFlat[index] ?? null;
            if (next === base) continue;
            changedMask[index >> 3] |= 1 << (index & 7);
            changedCount++;
            if (next !== null) {
                changedStates.push(1);
                changedColors.push(next & 0x0f);
            } else {
                changedStates.push(0);
            }
        }

        const changedStateMask = new Uint8Array(Math.ceil(changedCount / 8));
        for (let index = 0; index < changedStates.length; index++) {
            if (changedStates[index] === 1) {
                changedStateMask[index >> 3] |= 1 << (index & 7);
            }
        }

        bytes.push(...changedMask);
        bytes.push(...changedStateMask);
        for (let index = 0; index < changedColors.length; index += 2) {
            bytes.push(ShareEncoder.packNibblePair(changedColors, index));
        }
    }

    private static encodeCustomSprites(entries: CustomSpriteEntryLike[]): string {
        const encoder = new TextEncoder();
        const bytes: number[] = [ShareEncoder.CUSTOM_SPRITE_BINARY_VERSION, entries.length & 0xff];

        for (const entry of entries) {
            const keyBytes = encoder.encode(entry.key);
            const groupId = ShareEncoder.GROUP_TO_ID[entry.group] ?? 0;
            const variantId = entry.variant === 'on' ? 1 : 0;
            const frames = entry.frames;
            const baseFrame = ShareEncoder.resolveBaseFrame(entry);
            const keyIndex = ShareSpriteCatalog.getKeyIndex(entry.group as CustomSpriteEntry['group'], entry.key, (entry.variant ?? 'base') as 'base' | 'on');
            const useIndexedKey = keyIndex >= 0 && keyIndex <= 0xff;
            const isFixed8x8Indexed = useIndexedKey && frames.every((frame) =>
                Array.isArray(frame) &&
                frame.length === 8 &&
                (frame[0]?.length ?? 0) === 8
            );
            const canUseDelta = baseFrame !== null && frames.every((frame) =>
                Array.isArray(frame) &&
                frame.length === baseFrame.length &&
                (frame[0]?.length ?? 0) === (baseFrame[0]?.length ?? 0)
            );
            // Binary version 5+: groupId uses 3 bits (0-2), remaining flags shift up by 1.
            const flags = (groupId & 0x07) | ((variantId & 0x01) << 3) | ((canUseDelta ? 1 : 0) << 4) | ((useIndexedKey ? 1 : 0) << 5) | ((isFixed8x8Indexed ? 1 : 0) << 6);

            bytes.push(flags);
            bytes.push(frames.length & 0xff);
            if (useIndexedKey) {
                bytes.push(keyIndex & 0xff);
            } else {
                bytes.push(keyBytes.length & 0xff);
                bytes.push(...keyBytes);
            }

            for (const frame of frames) {
                if (isFixed8x8Indexed && canUseDelta) {
                    ShareEncoder.encodeIndexed8x8DeltaFrame(bytes, frame, baseFrame);
                    continue;
                }
                if (!(canUseDelta && ShareEncoder.tryEncodeDeltaFrame(bytes, frame, baseFrame))) {
                    ShareEncoder.encodeFullFrame(bytes, frame);
                }
            }
        }

        return ShareBase64.toBase64Url(Uint8Array.from(bytes));
    }

    static buildShareCode(gameData: ShareGameData | null | undefined) {
        const OT = ITEM_TYPES;
        const roomCount = ShareConstants.WORLD_ROOM_COUNT;
        const data = gameData as Parameters<typeof ShareMatrixCodec.collectGroundMatrices>[0];
        const groundMatrices = ShareMatrixCodec.collectGroundMatrices(data, roomCount);
        const overlayMatrices = ShareMatrixCodec.collectOverlayMatrices(data, roomCount);
        const startInput = gameData && gameData.start ? gameData.start : {};
        const start = ShareDataNormalizer.normalizeStart(startInput);
        const sprites = ShareDataNormalizer.normalizeSprites(gameData?.sprites);
        const toNibble = (value: number | null | undefined): number =>
            typeof value === 'number' && Number.isFinite(value) ? value : 0;
        const enemies = ShareDataNormalizer.normalizeEnemies(gameData?.enemies);
        const objects = Array.isArray(gameData?.objects) ? gameData.objects : [];
        const doorPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.DOOR);
        const keyPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.KEY);
        const lifePotionPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.LIFE_POTION);
        const xpScrollPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.XP_SCROLL);
        const swordPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.SWORD);
        const swordBronzePositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.SWORD_BRONZE);
        const swordWoodPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.SWORD_WOOD);
        const playerEndPositions = ShareDataNormalizer.normalizeObjectPositions(objects, OT.PLAYER_END);
        const playerEndMessages = ShareDataNormalizer.collectPlayerEndTexts(objects);
        const switchEntries = ShareDataNormalizer.normalizeSwitchObjects(objects);
        const magicDoorEntries = ShareDataNormalizer.normalizeVariableDoorObjects(objects);
        const magicDoorPositions = magicDoorEntries.map((entry) => ({
            x: entry.x,
            y: entry.y,
            roomIndex: entry.roomIndex
        }));
        const magicDoorVariableNibbles = magicDoorEntries.map((entry) => toNibble(entry.variableNibble));
        const variables = Array.isArray(gameData?.variables) ? gameData.variables : [];
        const variableCode = ShareVariableCodec.encodeVariables(variables as Parameters<typeof ShareVariableCodec.encodeVariables>[0]);

        const groundSegments = groundMatrices.map((matrix) => ShareMatrixCodec.encodeGround(matrix));
        const hasGround = groundSegments.some((segment) => Boolean(segment));

        const overlaySegments = [];
        let hasOverlay = false;
        for (let index = 0; index < roomCount; index++) {
            const { text, hasData } = ShareMatrixCodec.encodeOverlay(overlayMatrices[index] ?? []);
            overlaySegments.push(text);
            if (hasData) hasOverlay = true;
        }

        const parts = [];
        parts.push('v' + ShareConstants.VERSION.toString(36));
        if (hasGround) {
            parts.push('g' + groundSegments.join(','));
        }
        if (hasOverlay) {
            parts.push('o' + overlaySegments.join(','));
        }

        const defaultStart = ShareDataNormalizer.normalizeStart({});
        const needsStart = start.x !== defaultStart.x ||
            start.y !== defaultStart.y ||
            start.roomIndex !== defaultStart.roomIndex;
        if (needsStart) {
            const startCode = SharePositionCodec.encodePositions([start]);
            if (startCode) {
                parts.push('s' + startCode);
            }
        }

        if (sprites.length) {
            const positions = SharePositionCodec.encodePositions(sprites);
            const typeIndexes = SharePositionCodec.encodeNpcTypeIndexes(sprites);
            const spriteTexts = sprites.map((npc) => (typeof npc.text === 'string' ? npc.text : ''));
            const conditionalTexts = sprites.map((npc) => (typeof npc.conditionText === 'string' ? npc.conditionText : ''));
            const conditionIndexes = sprites.map((npc) => ShareVariableCodec.variableIdToNibble(npc.conditionVariableId));
            const rewardIndexes = sprites.map((npc) => ShareVariableCodec.variableIdToNibble(npc.rewardVariableId));
            const conditionalRewardIndexes = sprites.map((npc) => ShareVariableCodec.variableIdToNibble(npc.conditionalRewardVariableId));
            const hasConditionalTexts = conditionalTexts.some((text) => typeof text === 'string' && text.trim().length);
            const texts = ShareTextCodec.encodeTextArray(spriteTexts);
            const conditionalTextCode = hasConditionalTexts ? ShareTextCodec.encodeTextArray(conditionalTexts) : '';
            const conditionCode = ShareVariableCodec.encodeVariableNibbleArray(conditionIndexes);
            const rewardCode = ShareVariableCodec.encodeVariableNibbleArray(rewardIndexes);
            const conditionalRewardCode = ShareVariableCodec.encodeVariableNibbleArray(conditionalRewardIndexes);
            if (positions) parts.push('p' + positions);
            if (typeIndexes) parts.push('i' + typeIndexes);
            if (texts) parts.push('t' + texts);
            if (conditionalTextCode) parts.push('u' + conditionalTextCode);
            if (conditionCode) parts.push('c' + conditionCode);
            if (rewardCode) parts.push('r' + rewardCode);
            if (conditionalRewardCode) parts.push('h' + conditionalRewardCode);
        }

        if (enemies.length) {
            const enemyPositions = SharePositionCodec.encodePositions(enemies);
            const enemyTypeIndexes = SharePositionCodec.encodeEnemyTypeIndexes(enemies);
            const enemyVariableNibbles = enemies.map((enemy) => toNibble(enemy.variableNibble));
            const enemyVariableCode = ShareVariableCodec.encodeVariableNibbleArray(enemyVariableNibbles);
            if (enemyPositions) {
                parts.push('e' + enemyPositions);
            }
            if (enemyTypeIndexes) {
                parts.push('f' + enemyTypeIndexes);
            }
            if (enemyVariableCode) {
                parts.push('w' + enemyVariableCode);
            }
        }

        if (doorPositions.length) {
            const doorCode = SharePositionCodec.encodePositions(doorPositions);
            if (doorCode) {
                parts.push('d' + doorCode);
            }
        }

        if (magicDoorPositions.length) {
            const magicDoorCode = SharePositionCodec.encodePositions(magicDoorPositions);
            if (magicDoorCode) {
                parts.push('m' + magicDoorCode);
            }
            const magicDoorVariableCode = ShareVariableCodec.encodeVariableNibbleArray(magicDoorVariableNibbles);
            if (magicDoorVariableCode) {
                parts.push('q' + magicDoorVariableCode);
            }
        }

        if (keyPositions.length) {
            const keyCode = SharePositionCodec.encodePositions(keyPositions);
            if (keyCode) {
                parts.push('k' + keyCode);
            }
        }

        if (lifePotionPositions.length) {
            const potionCode = SharePositionCodec.encodePositions(lifePotionPositions);
            if (potionCode) {
                parts.push('l' + potionCode);
            }
        }

        if (xpScrollPositions.length) {
            const xpCode = SharePositionCodec.encodePositions(xpScrollPositions);
            if (xpCode) {
                parts.push('x' + xpCode);
            }
        }

        if (swordPositions.length) {
            const swordCode = SharePositionCodec.encodePositions(swordPositions);
            if (swordCode) {
                parts.push('a' + swordCode);
            }
        }
        if (swordBronzePositions.length) {
            const bronzeCode = SharePositionCodec.encodePositions(swordBronzePositions);
            if (bronzeCode) {
                parts.push('B' + bronzeCode);
            }
        }
        if (swordWoodPositions.length) {
            const woodCode = SharePositionCodec.encodePositions(swordWoodPositions);
            if (woodCode) {
                parts.push('W' + woodCode);
            }
        }

        if (playerEndPositions.length) {
            const endCode = SharePositionCodec.encodePositions(playerEndPositions);
            if (endCode) {
                parts.push('z' + endCode);
            }
        }

        const hasEndingMessages = Array.isArray(playerEndMessages)
            ? playerEndMessages.some((message) => typeof message === 'string' && message.length)
            : false;
        if (hasEndingMessages) {
            parts.push('E' + ShareTextCodec.encodeTextArray(playerEndMessages));
        }

        if (switchEntries.length) {
            const switchPositions = switchEntries.map((entry) => ({ x: entry.x, y: entry.y, roomIndex: entry.roomIndex }));
            const switchPositionCode = SharePositionCodec.encodePositions(switchPositions);
            if (switchPositionCode) {
                parts.push('J' + switchPositionCode);
                const switchVariableCode = ShareVariableCodec.encodeVariableNibbleArray(switchEntries.map((entry) => toNibble(entry.variableNibble)));
                const switchStateCode = ShareVariableCodec.encodeVariableNibbleArray(switchEntries.map((entry) => toNibble(entry.stateNibble)));
                if (switchVariableCode) {
                    parts.push('K' + switchVariableCode);
                }
                if (switchStateCode) {
                    parts.push('L' + switchStateCode);
                }
            }
        }

        if (variableCode) {
            parts.push('b' + variableCode);
        }

        const title = typeof gameData?.title === 'string' ? gameData.title.trim() : '';
        if (title && title !== ShareConstants.DEFAULT_TITLE) {
            parts.push('n' + ShareTextCodec.encodeText(title.slice(0, 80)));
        }
        const author = typeof gameData?.author === 'string' ? gameData.author.trim() : '';
        if (author) {
            parts.push('y' + ShareTextCodec.encodeText(author.slice(0, 60)));
        }

        if (gameData?.hideHud) {
            parts.push('H1');
        }
        if (gameData?.disableSkills) {
            parts.push('R1');
        }

        // Skill Order
        const skillOrder = Array.isArray(gameData?.skillOrder) ? gameData.skillOrder : [];
        if (skillOrder.length > 0) {
            const defaultOrder = SkillDefinitions.getDefaultSkillOrder();
            const isDefault = skillOrder.length === defaultOrder.length &&
                skillOrder.every((id, i) => id === defaultOrder[i]);
            if (!isDefault) {
                const encoded = skillOrder.map((id) => {
                    const idx = SkillDefinitions.SKILL_DEFINITION_DATA.findIndex((s) => s.id === id);
                    return (idx >= 0 ? idx : 0).toString(16);
                }).join('');
                parts.push('Q' + encoded);
            }
        }

        // Custom Sprites
        if (Array.isArray(gameData?.customSprites) && gameData.customSprites.length > 0) {
            parts.push('S' + ShareEncoder.encodeCustomSprites(gameData.customSprites));
        }

        // Custom Palette
        const customPalette = Array.isArray(gameData?.customPalette) ? gameData.customPalette : undefined;
        if (customPalette && customPalette.length === 16) {
            // Skip serialization when it matches the default palette.
            const isDefault = customPalette.every((color, index) =>
                color.toUpperCase() === TileDefinitions.PICO8_COLORS[index].toUpperCase()
            );

            if (!isDefault) {
                const bytes = new Uint8Array(16 * 3);
                customPalette.forEach((color, index) => {
                    const hex = color.replace('#', '').toUpperCase();
                    const base = index * 3;
                    bytes[base] = parseInt(hex.slice(0, 2), 16);
                    bytes[base + 1] = parseInt(hex.slice(2, 4), 16);
                    bytes[base + 2] = parseInt(hex.slice(4, 6), 16);
                });
                parts.push('P' + ShareBase64.toBase64Url(bytes));
            }
        }

        return parts.join('.');
    }
}

export { ShareEncoder };
