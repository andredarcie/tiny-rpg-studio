import { SpriteMatrixRegistry } from '../sprites/SpriteMatrixRegistry';
import { Enemy } from '../entities/Enemy';
import type { EnemyDefinitionData } from '../entities/Enemy';

type EnemyTypeInput = string | null | undefined;
/**
 * EnemyDefinitions concentra os inimigos disponiveis para o editor.
 */
class EnemyDefinitions {
    static ENEMY_DEFINITION_DATA: EnemyDefinitionData[] = [
        {
            type: 'giant-rat',
            id: 'enemy-giant-rat',
            name: 'Rato Gigante',
            nameKey: 'enemies.names.giantRat',
            description: 'o primeiro inimigo fraco.',
            lives: 1,
            damage: 1,
            missChance: 0.10,
            experience: 3,
            hasEyes: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'giant-rat')
        },
        {
            type: 'bandit',
            id: 'enemy-bandit',
            name: 'Bandido',
            nameKey: 'enemies.names.bandit',
            description: 'inimigo humano comum.',
            lives: 2,
            damage: 1,
            missChance: 0.25,
            experience: 4,
            hasEyes: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'bandit')
        },
        {
            type: 'skeleton',
            id: 'enemy-skeleton',
            name: 'Esqueleto',
            nameKey: 'enemies.names.skeleton',
            description: 'o morto-vivo clássico.',
            lives: 3,
            damage: 1,
            missChance: 0.25,
            experience: 5,
            aliases: ['skull'],
            hasEyes: false,
            sprite: SpriteMatrixRegistry.get('enemy', 'skeleton')
        },
        {
            type: 'dark-knight',
            id: 'enemy-dark-knight',
            name: 'Cavaleiro Negro',
            nameKey: 'enemies.names.darkKnight',
            description: 'o guerreiro corrompido.',
            lives: 4,
            damage: 2,
            missChance: 0.18,
            experience: 7,
            hasEyes: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'dark-knight')
        },
        {
            type: 'necromancer',
            id: 'enemy-necromancer',
            name: 'Necro',
            nameKey: 'enemies.names.necromancer',
            description: 'o mago das trevas.',
            lives: 5,
            damage: 2,
            missChance: 0.12,
            experience: 8,
            hasEyes: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'necromancer')
        },
        {
            type: 'dragon',
            id: 'enemy-dragon',
            name: 'Dragão',
            nameKey: 'enemies.names.dragon',
            description: 'o monstro lendário.',
            lives: 6,
            damage: 3,
            missChance: 0.08,
            defeatActivationMessage: 'Selo do Dragão ativado!',
            defeatActivationMessageKey: 'enemies.defeat.dragon',
            experience: 9,
            hasEyes: true,
            boss: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'dragon')
        },
        {
            type: 'fallen-king',
            id: 'enemy-fallen-king',
            name: 'Rei Caído',
            nameKey: 'enemies.names.fallenKing',
            description: 'o chefe trágico corrompido pelo poder.',
            lives: 7,
            damage: 3,
            missChance: 0.08,
            defeatActivationMessage: 'Selo Real despertou!',
            defeatActivationMessageKey: 'enemies.defeat.fallenKing',
            experience: 10,
            hasEyes: true,
            boss: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'fallen-king')
        },
        {
            type: 'ancient-demon',
            id: 'enemy-ancient-demon',
            name: 'Demônio Ancião',
            nameKey: 'enemies.names.ancientDemon',
            description: 'o mal primordial e final.',
            lives: 8,
            damage: 3,
            missChance: 0.05,
            defeatActivationMessage: 'Selo Demoníaco ativo!',
            defeatActivationMessageKey: 'enemies.defeat.ancientDemon',
            aliases: ['boss'],
            experience: 11,
            hasEyes: false,
            boss: true,
            sprite: SpriteMatrixRegistry.get('enemy', 'ancient-demon')
        }
    ];

    static ENEMY_DEFINITIONS: Enemy[] = EnemyDefinitions.ENEMY_DEFINITION_DATA.map((entry) => new Enemy(entry));

    static get definitions(): Enemy[] {
        return this.ENEMY_DEFINITIONS;
    }

    static getDefault(): Enemy | null {
        return this.ENEMY_DEFINITIONS[0] || null;
    }

    static getEnemyDefinition(type: EnemyTypeInput): Enemy | null {
        if (typeof type !== 'string' || !type) return null;
        return this.ENEMY_DEFINITIONS.find((entry) => entry.matchesType(type)) || null;
    }

    static normalizeType(type: EnemyTypeInput): string {
        const definition = this.getEnemyDefinition(type);
        if (definition) return definition.type;
        return this.getDefault()?.type || 'giant-rat';
    }

    static getExperienceReward(type: EnemyTypeInput): number {
        const definition = this.getEnemyDefinition(type);
        if (!definition) return 0;
        return definition.getExperienceReward();
    }

    static getMissChance(type: EnemyTypeInput): number | null {
        const definition = this.getEnemyDefinition(type);
        if (!definition) return null;
        return definition.getMissChance();
    }
}

export { EnemyDefinitions };
