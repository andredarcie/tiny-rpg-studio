import { ITEM_TYPES } from '../../domain/constants/itemTypes';
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
type SharePositionOptions = {
    variableNibbles?: number[];
    endingTexts?: string[];
    stateBits?: number[];
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
declare class ShareDataNormalizer {
    static get Types(): typeof ITEM_TYPES;
    static normalizeStart(start?: {
        x?: number;
        y?: number;
        roomIndex?: number;
    }): {
        x: number;
        y: number;
        roomIndex: number;
    };
    static resolveNpcType(npc?: ShareSpriteInput | null): string | null;
    static normalizeSprites(list: unknown[] | null | undefined): NormalizedSprite[];
    static normalizeEnemies(list: unknown[] | null | undefined): NormalizedEnemy[];
    static normalizeObjectPositions(list: unknown[] | null | undefined, type: string): PositionEntry[];
    static normalizeVariableDoorObjects(list: unknown[] | null | undefined): (PositionEntry & {
        variableNibble: number;
    })[];
    static normalizeSwitchObjects(list: unknown[] | null | undefined): (PositionEntry & {
        variableNibble: number;
        stateNibble: number;
    })[];
    static buildObjectEntries(positions: unknown[] | null | undefined, type: string, options?: SharePositionOptions): Array<Record<string, unknown>>;
    static getPlayerEndTextLimit(): number;
    static normalizeEndingTextValue(value?: string | null): string;
    static collectPlayerEndTexts(objects: unknown[] | null | undefined): string[];
    static normalizeEnemyType(type?: string | null): string;
    static normalizeEnemyVariable(variableId?: string | null): string | null;
}
export { ShareDataNormalizer };
