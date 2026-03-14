import { Npc } from '../entities/Npc';
import type { NpcDefinitionData, NpcVariant } from '../entities/Npc';
/**
 * NPCDefinitions centralizes the fixed NPCs available in the editor.
 */
declare class NPCDefinitions {
    static NPC_VARIANTS: readonly ["human", "elf", "dwarf", "fixed"];
    static NPC_DEFINITION_DATA: NpcDefinitionData[];
    static NPC_DEFINITIONS: Npc[];
    static get definitions(): Npc[];
    static getNpcDefinition(type: string | null | undefined): Npc | null;
    static normalizeVariant(variant: string | null | undefined): NpcVariant;
    static getVariants(): NpcVariant[];
}
export { NPCDefinitions };
