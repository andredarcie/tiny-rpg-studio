
import { ITEM_TYPES } from '../../domain/constants/itemTypes';
import { TileDefinitions } from '../../domain/definitions/TileDefinitions';
import { ShareConstants } from './ShareConstants';
import { ShareDataNormalizer } from './ShareDataNormalizer';
import { ShareMatrixCodec } from './ShareMatrixCodec';
import { SharePositionCodec } from './SharePositionCodec';
import { ShareTextCodec } from './ShareTextCodec';
import { ShareVariableCodec } from './ShareVariableCodec';
import { ShareBase64 } from './ShareBase64';

type ShareGameData = {
    title?: unknown;
    author?: unknown;
    start?: unknown;
    sprites?: unknown[];
    enemies?: unknown[];
    objects?: unknown[];
    variables?: unknown[];
    rooms?: unknown[];
    tileset?: unknown;
    world?: unknown;
    customPalette?: string[];
};

class ShareEncoder {
    static buildShareCode(gameData: ShareGameData | null | undefined) {
        const OT = ITEM_TYPES;
        const roomCount = ShareConstants.WORLD_ROOM_COUNT;
        const data = gameData as Parameters<typeof ShareMatrixCodec.collectGroundMatrices>[0];
        const groundMatrices = ShareMatrixCodec.collectGroundMatrices(data, roomCount);
        const overlayMatrices = ShareMatrixCodec.collectOverlayMatrices(data, roomCount);
        const start = ShareDataNormalizer.normalizeStart(gameData?.start ?? {});
        const sprites = ShareDataNormalizer.normalizeSprites(gameData?.sprites);
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
        const magicDoorVariableNibbles = magicDoorEntries.map((entry) => entry.variableNibble ?? 0);
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
            const enemyVariableNibbles = enemies.map((enemy) => enemy.variableNibble ?? 0);
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
                const switchVariableCode = ShareVariableCodec.encodeVariableNibbleArray(switchEntries.map((entry) => entry.variableNibble ?? 0));
                const switchStateCode = ShareVariableCodec.encodeVariableNibbleArray(switchEntries.map((entry) => entry.stateNibble ?? 0));
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

        // Custom Palette
        const customPalette = Array.isArray(gameData?.customPalette) ? gameData.customPalette : undefined;
        if (customPalette && customPalette.length === 16) {
            // Verifica se é igual ao padrão (não precisa serializar)
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
