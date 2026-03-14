import type { Npc } from '../domain/entities/Npc';
import type { GameState } from '../domain/GameState';
type NPCInstance = {
    id: string;
    type: string;
    name: string;
    text: string;
    textKey: string | null;
    roomIndex: number;
    x: number;
    y: number;
    initialX: number;
    initialY: number;
    initialRoomIndex: number;
    placed: boolean;
    conditionVariableId: string | null;
    conditionText: string;
    rewardVariableId: string | null;
    conditionalRewardVariableId: string | null;
};
type NPCInput = {
    id?: string;
    type?: string;
    name?: string;
    nameKey?: string;
    text?: string;
    textKey?: string | null;
    roomIndex?: number;
    x?: number;
    y?: number;
    initialX?: number;
    initialY?: number;
    initialRoomIndex?: number;
    placed?: boolean;
    conditionVariableId?: string | null;
    conditionalVariableId?: string | null;
    conditionText?: string;
    conditionalText?: string;
    rewardVariableId?: string | null;
    activateVariableId?: string | null;
    onCompleteVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
    alternativeRewardVariableId?: string | null;
    [key: string]: unknown;
};
declare class NPCManager {
    private readonly gameState;
    constructor(gameState: GameState);
    private get sprites();
    private set sprites(value);
    generateId(): string;
    getDefinitions(): Npc[];
    getNPCs(): NPCInstance[];
    getNPC(npcId: string | null | undefined): NPCInstance | null;
    getNPCByType(type: string): NPCInstance | null;
    ensureDefaultNPCs(): NPCInstance[];
    normalizeNPC(npc: NPCInput): {
        id: string;
        type: string;
        name: string;
        text: string;
        textKey: string | null;
        roomIndex: number;
        x: number;
        y: number;
        initialX: number;
        initialY: number;
        initialRoomIndex: number;
        placed: boolean;
        conditionVariableId: string | null;
        conditionText: string;
        rewardVariableId: string | null;
        conditionalRewardVariableId: string | null;
    };
    createFromDefinition(def: Npc): NPCInstance;
    resetNPCs(): void;
    /**
     * Create a new NPC instance for the editor (allows multiple instances of same type).
     * This is called when placing an NPC in the editor.
     */
    createNPC(type: string, roomIndex?: number): NPCInstance | null;
    addNPC(data: NPCInput): string | null;
    updateNPC(npcId: string, data: NPCInput): void;
    removeNPC(npcId: string): boolean;
    setNPCPosition(npcId: string, x: number, y: number, roomIndex?: number | null): boolean | undefined;
    updateNPCDialog(npcId: string, text: NPCInput | string): void;
}
export type { NPCInstance };
export { NPCManager };
