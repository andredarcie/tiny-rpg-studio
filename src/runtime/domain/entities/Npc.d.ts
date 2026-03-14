type SpriteMatrix = (number | null)[][];
type NpcVariant = 'human' | 'elf' | 'dwarf' | 'fixed';
type NpcDefinitionData = {
    type: string;
    id: string;
    name: string;
    nameKey: string;
    previewLabel: string;
    defaultText: string;
    defaultTextKey: string;
    sprite: SpriteMatrix;
    variant: NpcVariant;
};
declare class Npc {
    type: string;
    id: string;
    name: string;
    nameKey: string;
    previewLabel: string;
    defaultText: string;
    defaultTextKey: string;
    sprite: SpriteMatrix;
    variant: NpcVariant;
    constructor(data: NpcDefinitionData);
}
export type { NpcDefinitionData, NpcVariant, SpriteMatrix };
export { Npc };
