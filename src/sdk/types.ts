
import type { TileDefinition, TileMapLayer, TileMap } from '../runtime/domain/definitions/tileTypes';
import type { CustomTileEffectDefinition } from '../runtime/domain/definitions/customTileEffects';
import type { RoomDefinition, ItemInstance, ExitState, SkillCustomizationMap } from '../types/gameState';

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

type SdkObjectFields =
    | { type: 'key' | 'door' | 'life-potion' | 'xp-scroll'
            | 'sword' | 'sword-bronze' | 'sword-wood'
            | 'armor' | 'boots' | 'push-box';
        x: number; y: number; roomIndex: number }
    | { type: 'player-end';   x: number; y: number; roomIndex: number; endingText?: string }
    | { type: 'switch';       x: number; y: number; roomIndex: number; variableId: string; on?: boolean }
    | { type: 'door-variable'; x: number; y: number; roomIndex: number; variableId: string }
    | { type: 'logic-led';    x: number; y: number; roomIndex: number; variableId: string }
    | { type: 'trap'; x: number; y: number; roomIndex: number; variableId?: string; solid?: boolean }
    | { type: 'pressure-plate'; x: number; y: number; roomIndex: number; variableId?: string }
    | { type: 'logic-gate-not' | 'logic-gate-and' | 'logic-gate-or' | 'logic-gate-nand' | 'logic-gate-nor';
        x: number; y: number; roomIndex: number;
        inputVariableId: string; inputVariableId2?: string; outputVariableId: string; hiddenInGame?: boolean }
    | { type: 'chest'; x: number; y: number; roomIndex: number; containsItemType?: string | null; randomItem?: boolean; variableId?: string | null };

export type SdkObject = SdkObjectFields & { id?: string; experience?: number };

export type SdkSprite = {
    id?: string;
    name?: string;
    disappearAfterDialog?: boolean;
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
    choiceEnabled?: boolean;
    choicePrompt?: string;
    choiceYesText?: string;
    choiceNoText?: string;
    choiceYesVariableId?: string | null;
    choiceNoVariableId?: string | null;
};

export type SdkEnemy = {
    id?: string;
    type: string;
    x: number;
    y: number;
    roomIndex: number;
    defeatVariableId?: string | null;
    experience?: number;
};

export type SdkVariable = {
    id: string;
    value: boolean;
    name?: string;
    color?: string;
    order?: number;
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
    spawnPoints?: Array<{ role: 'p1' | 'p2'; x: number; y: number; roomIndex: number }>;
};

export type SdkSharePayload = {
    enableEffects?: boolean;
    showNewDialogExclamation?: boolean;
    customTileEffects?: CustomTileEffectDefinition[];
    skillCustomizations?: SkillCustomizationMap;
    rooms?: RoomDefinition[];
    items?: Omit<ItemInstance, 'collected'>[];
    exits?: ExitState[];
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
    tileset?: { tiles?: TileDefinition[]; maps: Array<{ ground?: TileMapLayer; overlay?: TileMapLayer }>; map?: { ground?: TileMapLayer; overlay?: TileMapLayer } };
    customPalette?: string[];
};

export type BaseProjectData = SdkSharePayload & {
    roomSize: 8; world: { rows: 3; cols: 3 }; palette: string[]; title: string; author: string;
    start: { x: number; y: number; roomIndex: number }; rooms: RoomDefinition[];
    sprites: SdkSprite[]; enemies: SdkEnemy[]; objects: SdkObject[]; variables: SdkVariable[];
    items: Omit<ItemInstance, 'collected'>[]; exits: ExitState[];
    tileset: { tiles: TileDefinition[]; maps: TileMap[]; map: TileMap };
};
export type { TileId, TileDefinition, TileMapLayer, TileMap } from '../runtime/domain/definitions/tileTypes';
export type { CustomTileEffectDefinition, CustomTileEffectId, BaseTileEffectId, TileVisualEffectKind } from '../runtime/domain/definitions/customTileEffects';
export type { SkillCustomizationMap, TestSettings, ExitState, RoomDefinition } from '../types/gameState';
