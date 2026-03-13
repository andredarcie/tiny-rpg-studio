import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RendererSpriteFactory } from '../../runtime/adapters/renderer/RendererSpriteFactory';

const makeMatrix = (value: number) =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => value));

let enemyDefinitions: Array<{ type: string; sprite: number[][]; aliases?: string[] }> = [];
let npcDefinitions: Array<{ type: string; sprite: number[][] }> = [];
let objectDefinitions: Array<{ type: string; sprite?: number[][]; spriteOn?: number[][] }> = [];
let normalizeType = (type: string) => type;

vi.mock('../../runtime/adapters/renderer/RendererConstants', () => ({
  RendererConstants: {
    get ENEMY_DEFINITIONS() {
      return enemyDefinitions;
    },
    get NPC_DEFINITIONS() {
      return npcDefinitions;
    },
    get OBJECT_DEFINITIONS() {
      return objectDefinitions;
    }
  }
}));

vi.mock('../../runtime/domain/definitions/EnemyDefinitions', () => ({
  EnemyDefinitions: {
    normalizeType: (type: string) => normalizeType(type),
  },
}));

vi.mock('../../runtime/domain/sprites/SpriteMatrixRegistry', () => ({
  SpriteMatrixRegistry: {
    get: () => makeMatrix(0),
  },
}));

describe('RendererSpriteFactory', () => {
  beforeEach(() => {
    enemyDefinitions = [];
    npcDefinitions = [];
    objectDefinitions = [];
    normalizeType = (type: string) => type;
  });

  it('builds sprites using palette mapping', () => {
    enemyDefinitions = [{ type: 'rat', sprite: makeMatrix(1), aliases: ['alias-rat'] }];

    const palette = Array.from({ length: 16 }, (_v, idx) => (idx === 1 ? '#111111' : `#${idx}${idx}${idx}${idx}${idx}${idx}`));
    const paletteManager = {
      getActivePalette: () => palette,
      getDefaultPalette: () => palette,
    };
    const factory = new RendererSpriteFactory(paletteManager, {});

    const sprite = factory.getEnemySprite('rat');
    expect(sprite?.length).toBe(8);
    expect(sprite?.[0]?.[0]).toBe('#111111');

    const aliasSprite = factory.getEnemySprite('alias-rat');
    expect(aliasSprite).toBe(sprite);
  });

  it('mirrors sprites horizontally', () => {
    const paletteManager = {
      getActivePalette: () => ['#000000'],
      getDefaultPalette: () => ['#000000']
    };
    const factory = new RendererSpriteFactory(paletteManager, {});

    const sprite = [
      ['a', 'b'],
      ['c', 'd'],
    ] as (string | null)[][];

    expect(factory.turnSpriteHorizontally(sprite)).toEqual([
      ['b', 'a'],
      ['d', 'c'],
    ]);
  });
});

describe('RendererSpriteFactory - custom sprites', () => {
  const makeCustomMatrix = () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 7));

  const palette = Array.from({ length: 16 }, (_v, idx) => `#${String(idx).padStart(6, '0')}`);
  const paletteManager = {
    getActivePalette: () => palette,
    getDefaultPalette: () => palette,
  };

  beforeEach(() => {
    enemyDefinitions = [];
    npcDefinitions = [];
    objectDefinitions = [];
    normalizeType = (type: string) => type;
  });

  it('uses a custom NPC sprite instead of RendererConstants', () => {
    const customMatrix = makeCustomMatrix();
    const gameState = {
      game: {
        customSprites: [
          { group: 'npc', key: 'guard', variant: 'base', frames: [customMatrix] },
        ],
      },
    };

    npcDefinitions = [{ type: 'guard', sprite: makeMatrix(0) }];

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprites = factory.getNpcSprites();
    expect(sprites['guard']?.[0]?.[0]).not.toBe(palette[0]);
    expect(sprites['guard']?.[0]?.[0]).toBe(palette[7]);
  });

  it('uses a custom enemy sprite instead of RendererConstants', () => {
    const customMatrix = makeCustomMatrix();
    const gameState = {
      game: {
        customSprites: [
          { group: 'enemy', key: 'slime', variant: 'base', frames: [customMatrix] },
        ],
      },
    };

    enemyDefinitions = [{ type: 'slime', sprite: makeMatrix(0) }];

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprites = factory.getEnemySprites();
    expect(sprites['slime']?.[0]?.[0]).toBe(palette[7]);
  });

  it('uses a custom object sprite for the base variant', () => {
    const customMatrix = makeCustomMatrix();
    const gameState = {
      game: {
        customSprites: [
          { group: 'object', key: 'switch', variant: 'base', frames: [customMatrix] },
        ],
      },
    };

    objectDefinitions = [{ type: 'switch', sprite: makeMatrix(0), spriteOn: makeMatrix(0) }];

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprites = factory.getObjectSprites();
    expect(sprites['switch']?.[0]?.[0]).toBe(palette[7]);
  });

  it('uses a custom object sprite for the on variant', () => {
    const customMatrix = makeCustomMatrix();
    const gameState = {
      game: {
        customSprites: [
          { group: 'object', key: 'switch', variant: 'on', frames: [customMatrix] },
        ],
      },
    };

    objectDefinitions = [{ type: 'switch', sprite: makeMatrix(0), spriteOn: makeMatrix(0) }];

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprites = factory.getObjectSprites();
    expect(sprites['switch--on']?.[0]?.[0]).toBe(palette[7]);
  });

  it('uses the RendererConstants sprite when no custom sprite exists', () => {
    const gameState = { game: { customSprites: [] } };

    npcDefinitions = [{ type: 'merchant', sprite: makeMatrix(3) }];

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprites = factory.getNpcSprites();
    expect(sprites['merchant']?.[0]?.[0]).toBe(palette[3]);
  });
});

describe('RendererSpriteFactory - custom player sprite', () => {
  // SpriteMatrixRegistry is mocked at the top of this file to return makeMatrix(0).
  // That serves as the "default" player sprite fallback.

  const palette = Array.from({ length: 16 }, (_v, idx) => `#${String(idx).padStart(6, '0')}`);
  const paletteManager = {
    getActivePalette: () => palette,
    getDefaultPalette: () => palette,
  };

  beforeEach(() => {
    enemyDefinitions = [];
    npcDefinitions = [];
    objectDefinitions = [];
  });

  it('uses the custom player sprite from customSprites when present', () => {
    const customMatrix = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 9));
    const gameState = {
      game: {
        customSprites: [
          { group: 'player', key: 'default', variant: 'base', frames: [customMatrix] },
        ],
      },
    };

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprite = factory.getPlayerSprite();

    // palette[9] is the expected colour (palette index 9 from the custom matrix)
    expect(sprite?.[0]?.[0]).toBe(palette[9]);
  });

  it('falls back to the default player sprite when no customSprites entry exists', () => {
    // SpriteMatrixRegistry mock returns makeMatrix(0), so palette[0] is expected.
    const gameState = { game: { customSprites: [] } };

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprite = factory.getPlayerSprite();

    expect(sprite?.[0]?.[0]).toBe(palette[0]);
  });

  it('falls back when customSprites has entries for other groups but not player', () => {
    const gameState = {
      game: {
        customSprites: [
          { group: 'npc', key: 'guard', variant: 'base', frames: [Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 7))] },
        ],
      },
    };

    const factory = new RendererSpriteFactory(paletteManager, gameState);
    const sprite = factory.getPlayerSprite();

    expect(sprite?.[0]?.[0]).toBe(palette[0]);
  });
});
