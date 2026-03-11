
import { SpriteMatrixRegistry } from '../sprites/SpriteMatrixRegistry';
import { Npc } from '../entities/Npc';
import type { NpcDefinitionData, NpcVariant } from '../entities/Npc';
/**
 * NPCDefinitions centralizes the fixed NPCs available in the editor.
 */
class NPCDefinitions {
    static NPC_VARIANTS = ['human', 'elf', 'dwarf', 'fixed'] as const;

    static NPC_DEFINITION_DATA: NpcDefinitionData[] = [
        // Humans
        {
            type: 'old-mage',
            id: 'npc-old-mage',
            name: 'Velho Mago',
            nameKey: 'npcs.names.oldMage.human',
            previewLabel: 'Mago',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.oldMage.human',
            sprite: SpriteMatrixRegistry.get('npc', 'old-mage'),
            variant: 'human'
        },
        {
            type: 'villager-man',
            id: 'npc-villager-man',
            name: 'Homem comum',
            nameKey: 'npcs.names.villagerMan.human',
            previewLabel: 'Homem',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.villagerMan.human',
            sprite: SpriteMatrixRegistry.get('npc', 'villager-man'),
            variant: 'human'
        },
        {
            type: 'villager-woman',
            id: 'npc-villager-woman',
            name: 'Mulher comum',
            nameKey: 'npcs.names.villagerWoman.human',
            previewLabel: 'Mulher',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.villagerWoman.human',
            sprite: SpriteMatrixRegistry.get('npc', 'villager-woman'),
            variant: 'human'
        },
        {
            type: 'child',
            id: 'npc-child',
            name: 'Crianca curiosa',
            nameKey: 'npcs.names.child.human',
            previewLabel: 'Crianca',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.child.human',
            sprite: SpriteMatrixRegistry.get('npc', 'child'),
            variant: 'human'
        },
        {
            type: 'king',
            id: 'npc-king',
            name: 'Rei',
            nameKey: 'npcs.names.king.human',
            previewLabel: 'Rei',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.king.human',
            sprite: SpriteMatrixRegistry.get('npc', 'king'),
            variant: 'human'
        },
        {
            type: 'knight',
            id: 'npc-knight',
            name: 'Cavaleiro',
            nameKey: 'npcs.names.knight.human',
            previewLabel: 'Cavaleiro',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.knight.human',
            sprite: SpriteMatrixRegistry.get('npc', 'knight'),
            variant: 'human'
        },
        {
            type: 'thief',
            id: 'npc-thief',
            name: 'Ladra',
            nameKey: 'npcs.names.thief.human',
            previewLabel: 'Ladra',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.thief.human',
            sprite: SpriteMatrixRegistry.get('npc', 'thief'),
            variant: 'human'
        },
        {
            type: 'blacksmith',
            id: 'npc-blacksmith',
            name: 'Ferreira',
            nameKey: 'npcs.names.blacksmith.human',
            previewLabel: 'Ferreira',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.blacksmith.human',
            sprite: SpriteMatrixRegistry.get('npc', 'blacksmith'),
            variant: 'human'
        },

        // Elves
        {
            type: 'old-mage-elf',
            id: 'npc-old-mage-elf',
            name: 'Velho Mago',
            nameKey: 'npcs.names.oldMage.elf',
            previewLabel: 'Mago',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.oldMage.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'old-mage-elf'),
            variant: 'elf'
        },
        {
            type: 'villager-man-elf',
            id: 'npc-villager-man-elf',
            name: 'Homem comum',
            nameKey: 'npcs.names.villagerMan.elf',
            previewLabel: 'Homem',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.villagerMan.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'villager-man-elf'),
            variant: 'elf'
        },
        {
            type: 'villager-woman-elf',
            id: 'npc-villager-woman-elf',
            name: 'Mulher comum',
            nameKey: 'npcs.names.villagerWoman.elf',
            previewLabel: 'Mulher',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.villagerWoman.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'villager-woman-elf'),
            variant: 'elf'
        },
        {
            type: 'child-elf',
            id: 'npc-child-elf',
            name: 'Crianca curiosa',
            nameKey: 'npcs.names.child.elf',
            previewLabel: 'Crianca',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.child.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'child-elf'),
            variant: 'elf'
        },
        {
            type: 'king-elf',
            id: 'npc-king-elf',
            name: 'Rei',
            nameKey: 'npcs.names.king.elf',
            previewLabel: 'Rei',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.king.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'king-elf'),
            variant: 'elf'
        },
        {
            type: 'knight-elf',
            id: 'npc-knight-elf',
            name: 'Cavaleiro',
            nameKey: 'npcs.names.knight.elf',
            previewLabel: 'Cavaleiro',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.knight.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'knight-elf'),
            variant: 'elf'
        },
        {
            type: 'thief-elf',
            id: 'npc-thief-elf',
            name: 'Ladra',
            nameKey: 'npcs.names.thief.elf',
            previewLabel: 'Ladra',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.thief.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'thief-elf'),
            variant: 'elf'
        },
        {
            type: 'blacksmith-elf',
            id: 'npc-blacksmith-elf',
            name: 'Ferreira',
            nameKey: 'npcs.names.blacksmith.elf',
            previewLabel: 'Ferreira',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.blacksmith.elf',
            sprite: SpriteMatrixRegistry.get('npc', 'blacksmith-elf'),
            variant: 'elf'
        },

        // Dwarves
        {
            type: 'old-mage-dwarf',
            id: 'npc-old-mage-dwarf',
            name: 'Velho Mago',
            nameKey: 'npcs.names.oldMage.dwarf',
            previewLabel: 'Mago',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.oldMage.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'old-mage-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'villager-man-dwarf',
            id: 'npc-villager-man-dwarf',
            name: 'Homem comum',
            nameKey: 'npcs.names.villagerMan.dwarf',
            previewLabel: 'Homem',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.villagerMan.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'villager-man-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'villager-woman-dwarf',
            id: 'npc-villager-woman-dwarf',
            name: 'Mulher comum',
            nameKey: 'npcs.names.villagerWoman.dwarf',
            previewLabel: 'Mulher',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.villagerWoman.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'villager-woman-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'child-dwarf',
            id: 'npc-child-dwarf',
            name: 'Crianca curiosa',
            nameKey: 'npcs.names.child.dwarf',
            previewLabel: 'Crianca',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.child.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'child-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'king-dwarf',
            id: 'npc-king-dwarf',
            name: 'Rei',
            nameKey: 'npcs.names.king.dwarf',
            previewLabel: 'Rei',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.king.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'king-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'knight-dwarf',
            id: 'npc-knight-dwarf',
            name: 'Cavaleiro',
            nameKey: 'npcs.names.knight.dwarf',
            previewLabel: 'Cavaleiro',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.knight.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'knight-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'thief-dwarf',
            id: 'npc-thief-dwarf',
            name: 'Ladra',
            nameKey: 'npcs.names.thief.dwarf',
            previewLabel: 'Ladra',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.thief.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'thief-dwarf'),
            variant: 'dwarf'
        },
        {
            type: 'blacksmith-dwarf',
            id: 'npc-blacksmith-dwarf',
            name: 'Ferreira',
            nameKey: 'npcs.names.blacksmith.dwarf',
            previewLabel: 'Ferreira',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.blacksmith.dwarf',
            sprite: SpriteMatrixRegistry.get('npc', 'blacksmith-dwarf'),
            variant: 'dwarf'
        },

        // Fixed
        {
            type: 'thought-bubble',
            id: 'npc-thought-bubble',
            name: 'Balao',
            nameKey: 'npcs.names.thoughtBubble',
            previewLabel: 'Balao',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.thoughtBubble',
            sprite: SpriteMatrixRegistry.get('npc', 'thought-bubble'),
            variant: 'fixed'
        },
        {
            type: 'wooden-sign',
            id: 'npc-wooden-sign',
            name: 'Placa de madeira',
            nameKey: 'npcs.names.woodenSign',
            previewLabel: 'Placa',
            defaultText: '',
            defaultTextKey: 'npcs.dialog.woodenSign',
            sprite: SpriteMatrixRegistry.get('npc', 'wooden-sign'),
            variant: 'fixed'
        }
    ];

    static NPC_DEFINITIONS: Npc[] = NPCDefinitions.NPC_DEFINITION_DATA.map((entry) => new Npc(entry));

    static get definitions(): Npc[] {
        return this.NPC_DEFINITIONS;
    }

    static getNpcDefinition(type: string | null | undefined): Npc | null {
        return this.NPC_DEFINITIONS.find((entry) => entry.type === type) || null;
    }

    static normalizeVariant(variant: string | null | undefined): NpcVariant {
        const normalized = String(variant || '').toLowerCase();
        return this.NPC_VARIANTS.includes(normalized as NpcVariant) ? (normalized as NpcVariant) : 'human';
    }

    static getVariants(): NpcVariant[] {
        return this.NPC_VARIANTS.slice();
    }
}

export { NPCDefinitions };
