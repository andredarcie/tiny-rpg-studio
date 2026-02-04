import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RendererSpriteFactory } from '../../runtime/adapters/renderer/RendererSpriteFactory';

const makeMatrix = (value: number) =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => value));

let enemyDefinitions: Array<{ type: string; sprite: number[][]; aliases?: string[] }> = [];
let normalizeType = (type: string) => type;

vi.mock('../../runtime/adapters/renderer/RendererConstants', () => ({
  RendererConstants: {
    get ENEMY_DEFINITIONS() {
      return enemyDefinitions;
    },
    get NPC_DEFINITIONS() {
      return [];
    },
    get OBJECT_DEFINITIONS() {
      return [];
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
    normalizeType = (type: string) => type;
  });

  it('builds sprites using palette mapping', () => {
    enemyDefinitions = [{ type: 'rat', sprite: makeMatrix(1), aliases: ['alias-rat'] }];

    const palette = Array.from({ length: 16 }, (_v, idx) => (idx === 1 ? '#111111' : `#${idx}${idx}${idx}${idx}${idx}${idx}`));
    const paletteManager = {
      getPalette: () => palette,
      getPicoPalette: () => palette,
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
      getPalette: () => ['#000000'],
      getPicoPalette: () => ['#000000']
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
