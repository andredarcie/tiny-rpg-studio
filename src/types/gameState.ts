import type { Tileset } from '../runtime/domain/definitions/tileTypes';
import type { ObjectEntry } from '../runtime/domain/state/StateObjectManager';
import type { DialogMeta } from '../runtime/services/engine/DialogManager';
import type { ExitState } from '../runtime/services/engine/InteractionManager';
import type { NPCInstance } from '../runtime/services/NPCManager';

// Re-export domain types
export type { ObjectEntry, DialogMeta, ExitState, NPCInstance };

export type TestSettings = {
    startLevel: number;
    skills: string[];
    godMode: boolean;
};

export type PlayerRuntimeState = {
    x: number;
    y: number;
    lastX: number;
    roomIndex: number;
    lastRoomChangeTime?: number | null;
    level: number;
    maxLives: number;
    currentLives: number;
    lives: number;
    keys: number;
    experience: number;
    damageShield: number;
    damageShieldMax: number;
    swordType: string | null;
    lastDamageReduction: number;
    godMode: boolean;
};

export type DialogState = {
    active: boolean;
    text: string;
    page: number;
    maxPages: number;
    meta: DialogMeta | null;
};

export type EnemyDefinition = {
    id: string;
    type: string;
    roomIndex: number;
    x: number;
    y: number;
    lastX: number;
    lives?: number;
    defeatVariableId?: string | null;
    playerInVision?: boolean;
    alertUntil?: number | null;
    alertStart?: number | null;
};

export type VariableDefinition = {
    id: string;
    value?: unknown;
};

export type RoomDefinition = {
    size: number;
    bg: number;
    tiles: number[][];
    walls: boolean[][];
    worldX?: number;
    worldY?: number;
};

export type ItemInstance = {
    type: string;
    roomIndex: number;
    x: number;
    y: number;
    collected?: boolean;
    text?: string;
};

export type SkillRuntimeState = {
    owned: string[];
    bonusMaxLives: number;
    xpBoost: number;
    pendingSelections: number;
    necromancerCharges: number;
    pendingManualRevive: boolean;
    recentRevive: boolean;
    carryoverSkills: string[];
    currentChoicePool: string[];
    pendingLevelQueue: number[];
};

export type PickupOverlayState = {
    active: boolean;
    name: string;
    spriteGroup: string | null;
    spriteType: string | null;
    effect: (() => void) | null;
};

export type PickupOverlayOptions = {
    name?: string;
    title?: string;
    spriteGroup?: string | null;
    spriteType?: string | null;
    effect?: (() => void) | null;
};

export type LevelUpChoice = {
    id: string;
    nameKey?: string;
    descriptionKey?: string;
    icon?: string;
};

export type LevelUpOverlayState = {
    active: boolean;
    choices: LevelUpChoice[];
    cursor: number;
};

export type LevelUpCelebrationState = {
    active: boolean;
    level: number | null;
    startTime: number;
    timeoutId: ReturnType<typeof setTimeout> | null;
    durationMs: number;
};

export type LevelUpCelebrationOptions = {
    durationMs?: number;
};

export type LevelUpCelebrationHideOptions = {
    skipResume?: boolean;
};

export type LevelUpResult = {
    leveledUp?: boolean;
    level?: number;
    levelsGained?: number;
};

export type GameDefinition = {
    title: string;
    author: string;
    palette: string[];
    customPalette?: string[];
    roomSize: number;
    world: { rows: number; cols: number };
    rooms: RoomDefinition[];
    start: { x: number; y: number; roomIndex: number };
    sprites: NPCInstance[];
    enemies: EnemyDefinition[];
    items: ItemInstance[];
    objects: ObjectEntry[];
    variables: VariableDefinition[];
    exits: ExitState[];
    tileset: Tileset;
};

export type RuntimeState = {
    player: PlayerRuntimeState;
    dialog: DialogState;
    enemies: EnemyDefinition[];
    variables: VariableDefinition[];
    gameOver: boolean;
    gameOverReason: string | null;
    pickupOverlay: PickupOverlayState;
    levelUpOverlay: LevelUpOverlayState;
    levelUpCelebration: LevelUpCelebrationState;
    skillRuntime: SkillRuntimeState | null;
};

export type ReviveSnapshot = {
    game: GameDefinition;
    state: RuntimeState;
};
