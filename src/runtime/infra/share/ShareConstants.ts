
import { EnemyDefinitions } from '../../domain/definitions/EnemyDefinitions';
import { NPCDefinitions } from '../../domain/definitions/NPCDefinitions';
import { GameConfig } from '../../../config/GameConfig';

class ShareConstants {
    static _supportedVersions?: Set<number>;
    static _npcDefinitions: unknown[] = [];
    static _enemyDefinitions: unknown[] = [];
    static get VERSION_1() { return 1; }
    static get VERSION_2() { return 2; }
    static get VERSION_3() { return 3; }
    static get VERSION_4() { return 4; }
    static get VERSION_5() { return 5; }
    static get VERSION_6() { return 6; }
    static get VERSION_7() { return 7; }
    static get VERSION_8() { return 8; }
    static get VERSION_9() { return 9; }
    static get VERSION_10() { return 10; }
    static get VERSION_11() { return 11; }
    static get VERSION_12() { return 12; }
    static get VERSION_13() { return 13; }
    static get VERSION_14() { return 14; }
    static get VERSION_15() { return 15; }
    static get VERSION_16() { return 16; }
    static get VERSION_17() { return 17; }
    static get VERSION_18() { return 18; }
    static get VERSION_19() { return 19; }

    static get VERSION() {
        return ShareConstants.VERSION_19;
    }

    static get LEGACY_VERSION() {
        return ShareConstants.VERSION_1;
    }

    static get OBJECTS_VERSION() {
        return ShareConstants.VERSION_4;
    }

    static get VARIABLES_VERSION() {
        return ShareConstants.VERSION_5;
    }

    static get WORLD_MULTIMAP_VERSION() {
        return ShareConstants.VERSION_6;
    }

    static get NPC_VARIABLE_TEXT_VERSION() {
        return ShareConstants.VERSION_6;
    }

    static get MAGIC_DOOR_VERSION() {
        return ShareConstants.VERSION_7;
    }

    static get NPC_CONDITIONAL_REWARD_VERSION() {
        return ShareConstants.VERSION_8;
    }

    static get ENEMY_TYPE_VERSION() {
        return ShareConstants.VERSION_9;
    }

    static get ENEMY_VARIABLE_VERSION() {
        return ShareConstants.VERSION_10;
    }

    static get LIFE_POTION_VERSION() {
        return ShareConstants.VERSION_11;
    }

    static get XP_SCROLL_VERSION() {
        return ShareConstants.VERSION_12;
    }

    static get SWORD_VERSION() {
        return ShareConstants.VERSION_13;
    }

    static get PLAYER_END_VERSION() {
        return ShareConstants.VERSION_14;
    }

    static get SWITCH_VERSION() {
        return ShareConstants.VERSION_15;
    }

    static get TILE_EXTENDED_VERSION() {
        return ShareConstants.VERSION_16;
    }

    static get PLAYER_END_TEXT_VERSION() {
        return ShareConstants.VERSION_17;
    }

    static get PLAYER_END_TEXT_ARRAY_VERSION() {
        return ShareConstants.VERSION_18;
    }

    static get TIERED_SWORD_VERSION() {
        return ShareConstants.VERSION_19;
    }

    static get MATRIX_SIZE() {
        return GameConfig.world.matrixSize;
    }

    static get TILE_COUNT() {
        return ShareConstants.MATRIX_SIZE * ShareConstants.MATRIX_SIZE;
    }

    static get WORLD_ROWS() {
        return GameConfig.world.rows;
    }

    static get WORLD_COLS() {
        return GameConfig.world.cols;
    }

    static get WORLD_ROOM_COUNT() {
        return ShareConstants.WORLD_ROWS * ShareConstants.WORLD_COLS;
    }

    static get MAX_ROOM_INDEX() {
        return ShareConstants.WORLD_ROOM_COUNT - 1;
    }

    static get NULL_CHAR() {
        return 'z';
    }

    static get TILE_LEGACY_MAX() {
        return GameConfig.tiles.legacyMax;
    }

    static get TILE_VALUE_MAX() {
        return GameConfig.tiles.valueMax;
    }

    static get GROUND_SPARSE_PREFIX() {
        return 'x';
    }

    static get OVERLAY_BINARY_PREFIX() {
        return 'y';
    }

    static get POSITION_WIDE_PREFIX() {
        return '~';
    }

    static get DEFAULT_TITLE() {
        return 'My Tiny RPG Game';
    }

    static get DEFAULT_PALETTE() {
        return [...GameConfig.palette.colors];
    }

    static get VARIABLE_IDS() {
        return ['var-1', 'var-2', 'var-3', 'var-4', 'var-5', 'var-6', 'var-7', 'var-8', 'var-9', 'skill:bard'];
    }

    static get VARIABLE_NAMES() {
        return ['1 - Preto', '2 - Azul Escuro', '3 - Roxo', '4 - Verde', '5 - Marrom', '6 - Cinza', '7 - Azul Claro', '8 - Rosa Choque', '9 - Amarelo', 'Habilidade: Bardo'];
    }

    static get VARIABLE_COLORS() {
        return ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#29ADFF', '#FF77A8', '#FFCCAA', '#FFD700'];
    }

    static get SUPPORTED_VERSIONS() {
        if (!this._supportedVersions) {
            this._supportedVersions = new Set([
                ShareConstants.VERSION_1,
                ShareConstants.VERSION_2,
                ShareConstants.VERSION_3,
                ShareConstants.VERSION_4,
                ShareConstants.VERSION_5,
                ShareConstants.VERSION_6,
                ShareConstants.VERSION_7,
                ShareConstants.VERSION_8,
                ShareConstants.VERSION_9,
                ShareConstants.VERSION_10,
                ShareConstants.VERSION_11,
                ShareConstants.VERSION_12,
                ShareConstants.VERSION_13,
                ShareConstants.VERSION_14,
                ShareConstants.VERSION_15,
                ShareConstants.VERSION_16,
                ShareConstants.VERSION_17,
                ShareConstants.VERSION_18,
                ShareConstants.VERSION_19
            ]);
        }
        return this._supportedVersions;
    }

    static get NPC_DEFINITIONS() {
        if (!this._npcDefinitions.length) {
            this._npcDefinitions = NPCDefinitions.definitions;
        }
        return this._npcDefinitions;
    }

    static get ENEMY_DEFINITIONS() {
        if (!this._enemyDefinitions.length) {
            this._enemyDefinitions = EnemyDefinitions.definitions;
        }
        return this._enemyDefinitions;
    }
}

export { ShareConstants };
