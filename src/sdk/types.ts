
export type EnemyType =
    | 'giant-rat'
    | 'bandit'
    | 'skeleton'
    | 'dark-knight'
    | 'necromancer'
    | 'dragon'
    | 'fallen-king'
    | 'ancient-demon';

export type NpcType =
    | 'old-mage' | 'villager-man' | 'villager-woman' | 'child'
    | 'king' | 'knight' | 'thief' | 'blacksmith'
    | 'old-mage-elf' | 'villager-man-elf' | 'villager-woman-elf' | 'child-elf'
    | 'king-elf' | 'knight-elf' | 'thief-elf' | 'blacksmith-elf'
    | 'old-mage-dwarf' | 'villager-man-dwarf' | 'villager-woman-dwarf' | 'child-dwarf'
    | 'king-dwarf' | 'knight-dwarf' | 'thief-dwarf' | 'blacksmith-dwarf'
    | 'thought-bubble' | 'wooden-sign';

/** Sword tiers accepted by `addSword`. */
export type SwordTier = 'wood' | 'bronze' | 'iron';

/** Friendly logic-gate names accepted by `addLogicGate`. */
export type LogicGateType = 'not' | 'and' | 'or' | 'nand' | 'nor';

/** Item types a chest may contain. */
export type ChestItemType =
    | 'key' | 'life-potion' | 'xp-scroll'
    | 'sword' | 'sword-bronze' | 'sword-wood'
    | 'armor' | 'boots';

export type SdkObject =
    | { type: 'key' | 'door' | 'life-potion' | 'xp-scroll'
            | 'sword' | 'sword-bronze' | 'sword-wood'
            | 'armor' | 'boots' | 'push-box';
        x: number; y: number; roomIndex: number }
    | { type: 'player-end';   x: number; y: number; roomIndex: number; endingText?: string }
    | { type: 'switch';       x: number; y: number; roomIndex: number; variableId: string; on?: boolean }
    | { type: 'door-variable'; x: number; y: number; roomIndex: number; variableId: string }
    | { type: 'logic-led';    x: number; y: number; roomIndex: number; variableId: string }
    | { type: 'trap' | 'pressure-plate'; x: number; y: number; roomIndex: number; variableId?: string }
    | { type: 'logic-gate-not' | 'logic-gate-and' | 'logic-gate-or' | 'logic-gate-nand' | 'logic-gate-nor';
        x: number; y: number; roomIndex: number;
        inputVariableId?: string; inputVariableId2?: string; outputVariableId?: string; hiddenInGame?: boolean }
    | { type: 'chest'; x: number; y: number; roomIndex: number; containsItemType?: string | null; randomItem?: boolean };

export type SdkSprite = {
    type: string;
    x: number;
    y: number;
    roomIndex: number;
    text: string;
    placed: boolean;
    conditionVariableId?: string | null;
    conditionText?: string;
    rewardVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
};

export type SdkEnemy = {
    type: string;
    x: number;
    y: number;
    roomIndex: number;
    defeatVariableId?: string | null;
};

export type SdkVariable = {
    id: string;
    value: boolean;
    name?: string;
};

/** Sprite groups that can be overridden or extended with custom pixel art. */
export type CustomSpriteGroup = 'tile' | 'npc' | 'enemy' | 'object' | 'player';

/** Sprite variant: `'base'` is the default art, `'on'` the activated state. */
export type CustomSpriteVariant = 'base' | 'on';

/** A single animation frame: a matrix of palette indices (0-15) or `null` (transparent). */
export type CustomSpriteFrame = (number | null)[][];

export type SdkCustomSprite = {
    group: CustomSpriteGroup;
    key: string;
    variant?: CustomSpriteVariant;
    frames: CustomSpriteFrame[];
};

export type SdkOnlineConfig = {
    enabled: boolean;
    spawnPoints?: Array<{ x: number; y: number; roomIndex: number }>;
};

export type SdkSharePayload = {
    title?: string;
    author?: string;
    hideHud?: boolean;
    spriteOutline?: boolean;
    spriteOutlineColor?: number;
    disableSkills?: boolean;
    disablePixelFont?: boolean;
    backgroundMusicVideoId?: string;
    backgroundMusicVolume?: number;
    skillOrder?: string[];
    online?: SdkOnlineConfig;
    start?: { x: number; y: number; roomIndex: number };
    sprites?: SdkSprite[];
    enemies?: SdkEnemy[];
    objects?: SdkObject[];
    variables?: SdkVariable[];
    customSprites?: SdkCustomSprite[];
    tileset?: { maps: Array<{ ground?: number[][]; overlay?: (number | null)[][] }> };
    customPalette?: string[];
};
