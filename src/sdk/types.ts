
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

export type SdkObject =
    | { type: 'key';          x: number; y: number; roomIndex: number }
    | { type: 'door';         x: number; y: number; roomIndex: number }
    | { type: 'life-potion';  x: number; y: number; roomIndex: number }
    | { type: 'sword';        x: number; y: number; roomIndex: number }
    | { type: 'sword-bronze'; x: number; y: number; roomIndex: number }
    | { type: 'sword-wood';   x: number; y: number; roomIndex: number }
    | { type: 'player-end';   x: number; y: number; roomIndex: number; endingText?: string };

export type SdkSprite = {
    type: string;
    x: number;
    y: number;
    roomIndex: number;
    text: string;
    placed: boolean;
};

export type SdkEnemy = {
    type: string;
    x: number;
    y: number;
    roomIndex: number;
};

export type SdkSharePayload = {
    title?: string;
    author?: string;
    hideHud?: boolean;
    start?: { x: number; y: number; roomIndex: number };
    sprites?: SdkSprite[];
    enemies?: SdkEnemy[];
    objects?: SdkObject[];
    tileset?: { maps: Array<{ ground?: number[][]; overlay?: (number | null)[][] }> };
    customPalette?: string[];
};
