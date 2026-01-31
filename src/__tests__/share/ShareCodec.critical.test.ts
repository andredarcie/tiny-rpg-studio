import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareConstants, ShareEncoder, ShareDecoder } from './shareTestUtils';

type ShareTestData = {
  title?: string;
  author?: string;
  start?: { x?: number; y?: number; roomIndex?: number };
  sprites?: unknown[];
  enemies?: unknown[];
  objects?: unknown[];
  variables?: unknown[];
  rooms?: unknown[];
  world?: unknown;
  tileset?: unknown;
};

const decodeShare = (code: string | null | undefined): ShareTestData | null =>
  ShareDecoder.decodeShareCode(code) as ShareTestData | null;

describe('Share Encoder/Decoder - Critical Round-Trip Tests', () => {
  beforeAll(() => {
    setupShareGlobals({
      npcDefinitions: [
        { id: 'npc-1', type: 'merchant', name: 'Merchant', defaultText: 'Hello!' },
        { id: 'npc-2', type: 'quest-giver', name: 'Quest NPC', defaultText: 'Quest text' },
        { id: 'npc-3', type: 'simple', name: 'Simple NPC', defaultText: '' },
      ],
      enemyDefinitions: [
        { type: 'slime' },
        { type: 'boss' },
      ],
      objectTypes: {
        DOOR: 'door',
        KEY: 'key',
        LIFE_POTION: 'life-potion',
        XP_SCROLL: 'xp-scroll',
        SWORD: 'sword',
        SWORD_BRONZE: 'sword-bronze',
        SWORD_WOOD: 'sword-wood',
        PLAYER_END: 'player-end',
        SWITCH: 'switch',
        DOOR_VARIABLE: 'door-variable',
      },
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime'),
    });
  });

  describe('Complete game data round-trip', () => {
    it('preserves all data through encode-decode cycle', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      ground[0][0] = 1;
      ground[1][1] = 2;

      const overlay: (number | null)[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => null as number | null));
      overlay[2][2] = 3;

      const original = {
        title: 'Test Game',
        author: 'Test Author',
        start: { x: 2, y: 3, roomIndex: 0 },
        sprites: [
          {
            id: 'npc-1',
            type: 'merchant',
            name: 'Merchant',
            x: 1,
            y: 1,
            roomIndex: 0,
            text: 'Hello!',
            placed: true,
          },
        ],
        enemies: [
          {
            id: 'enemy-1',
            type: 'slime',
            x: 4,
            y: 4,
            roomIndex: 0,
            defeatVariableId: null,
          },
        ],
        objects: [
          { id: 'obj-1', type: 'key', x: 3, y: 3, roomIndex: 0 },
        ],
        variables: [
          { id: 'var-1', name: 'Switch 1', value: false },
        ],
        tileset: {
          tiles: [],
          maps: [{ ground, overlay }],
          map: { ground, overlay },
        },
      };

      const encoded = ShareEncoder.buildShareCode(original);
      expect(encoded).toBeTruthy();

      const decoded = decodeShare(encoded);
      expect(decoded).toBeTruthy();

      expect(decoded?.title).toBe(original.title);
      expect(decoded?.author).toBe(original.author);
      expect(decoded?.start).toEqual(original.start);
      expect(decoded?.sprites?.length).toBe(1);
      expect(decoded?.enemies?.length).toBe(1);
    });

    it('handles empty game data', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const minimal = {
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(minimal);
      const decoded = decodeShare(encoded);

      expect(decoded).toBeTruthy();
      expect(decoded?.sprites).toEqual([]);
      expect(decoded?.enemies).toEqual([]);
    });
  });

  describe('NPC data preservation', () => {
    it('preserves NPC conditional text and variables', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        sprites: [
          {
            id: 'npc-1',
            type: 'quest-giver',
            name: 'Quest NPC',
            x: 2,
            y: 2,
            roomIndex: 0,
            text: 'Initial quest text',
            conditionText: 'Quest completed!',
            conditionVariableId: 'var-1',
            rewardVariableId: 'var-2',
            conditionalRewardVariableId: 'var-3',
            placed: true,
          },
        ],
        variables: [
          { id: 'var-1', name: 'Quest Done', value: false },
          { id: 'var-2', name: 'Quest Reward', value: false },
          { id: 'var-3', name: 'Bonus Reward', value: false },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const npc = (decoded?.sprites as Array<Record<string, unknown>> | undefined)?.[0] as Record<string, unknown> | undefined;
      expect(npc?.text).toBe('Initial quest text');
      expect(npc?.conditionText).toBe('Quest completed!');
      expect(npc?.conditionVariableId).toBeTruthy();
      expect(npc?.rewardVariableId).toBeTruthy();
      expect(npc?.conditionalRewardVariableId).toBeTruthy();
    });

    it('handles NPCs without conditional text', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        sprites: [
          {
            id: 'npc-1',
            type: 'simple',
            name: 'Simple NPC',
            x: 1,
            y: 1,
            roomIndex: 0,
            text: 'Hello',
            placed: true,
          },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const npc = (decoded?.sprites as Array<Record<string, unknown>> | undefined)?.[0] as Record<string, unknown> | undefined;
      expect(npc?.text).toBe('Hello');
      expect(npc?.conditionText).toBe('');
    });
  });

  describe('Enemy variable linking', () => {
    it('preserves enemy defeat variables', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        enemies: [
          {
            id: 'enemy-1',
            type: 'boss',
            x: 5,
            y: 5,
            roomIndex: 0,
            defeatVariableId: 'var-1',
          },
        ],
        variables: [
          { id: 'var-1', name: 'Boss Defeated', value: false },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const enemy = (decoded?.enemies as Array<Record<string, unknown>> | undefined)?.[0] as Record<string, unknown> | undefined;
      expect(enemy?.defeatVariableId).toBeTruthy();
    });
  });

  describe('Magic door and switch systems', () => {
    it('preserves magic door variable links', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        objects: [
          {
            id: 'door-1',
            type: 'door-variable',
            x: 3,
            y: 3,
            roomIndex: 0,
            variableId: 'var-1',
          },
        ],
        variables: [
          { id: 'var-1', name: 'Door Switch', value: false },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const door = (decoded?.objects as Array<Record<string, unknown>> | undefined)?.find((obj: Record<string, unknown>) => obj.type === 'door-variable') as Record<string, unknown> | undefined;
      expect(door).toBeDefined();
      expect(door?.variableId).toBeTruthy();
    });

    it('preserves switch variable and state', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        objects: [
          {
            id: 'switch-1',
            type: 'switch',
            x: 2,
            y: 2,
            roomIndex: 0,
            variableId: 'var-1',
            state: 1, // On
          },
        ],
        variables: [
          { id: 'var-1', name: 'Switch State', value: true },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const switchObj = (decoded?.objects as Array<Record<string, unknown>> | undefined)?.find((obj: Record<string, unknown>) => obj.type === 'switch') as Record<string, unknown> | undefined;
      expect(switchObj).toBeDefined();
      expect(switchObj?.variableId).toBeTruthy();
    });
  });

  describe('Player end positions and messages', () => {
    it('preserves ending messages for player end objects', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        objects: [
          {
            id: 'end-1',
            type: 'player-end',
            x: 7,
            y: 7,
            roomIndex: 0,
            endingText: 'You won!',
          },
          {
            id: 'end-2',
            type: 'player-end',
            x: 7,
            y: 7,
            roomIndex: 1,
            endingText: 'Alternative ending',
          },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const endObjects = (decoded?.objects as Array<{ type: string; endingText?: string }>).filter(
        (obj) => obj.type === 'player-end'
      );
      expect(endObjects.length).toBe(2);
      expect(endObjects[0]?.endingText).toBe('You won!');
      expect(endObjects[1]?.endingText).toBe('Alternative ending');
    });
  });

  describe('Multi-room world encoding', () => {
    it('handles 3x3 world with different tiles in each room', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const createRoom = (fillValue: number | null) =>
        Array.from({ length: size }, () => Array.from({ length: size }, () => fillValue));

      const gameData = {
        world: { rows: 3, cols: 3 },
        rooms: Array.from({ length: 9 }, (_, i) => ({ bg: i })),
        tileset: {
          tiles: [],
          maps: Array.from({ length: 9 }, (_, i) => ({
            ground: createRoom(i),
            overlay: createRoom(null),
          })),
          map: { ground: createRoom(0), overlay: createRoom(null) },
        },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      expect(decoded?.world).toEqual({ rows: 3, cols: 3 });
      expect(decoded?.rooms?.length).toBe(9);

      const maps = (decoded?.tileset as { maps?: Array<{ ground: number[][] }> }).maps;
      expect(maps?.length).toBe(9);
    });
  });

  describe('Special character handling', () => {
    it('encodes and decodes special characters in text', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        title: 'Test: "Special" Game!',
        author: 'Author & Co.',
        sprites: [
          {
            id: 'npc-1',
            name: 'NPC',
            x: 1,
            y: 1,
            roomIndex: 0,
            text: 'Hello, world! How are you?',
            placed: true,
          },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      expect(decoded?.title).toBeTruthy();
      expect(decoded?.author).toBeTruthy();
      expect(((decoded?.sprites as Array<Record<string, unknown>> | undefined)?.[0] as Record<string, unknown> | undefined)?.text).toBeTruthy();
    });
  });

  describe('Version compatibility', () => {
    it('includes version in encoded data', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);

      expect(encoded.startsWith('v')).toBe(true);
    });

    it('rejects unsupported version codes', () => {
      const invalidCode = 'vzz.g1,2,3'; // Invalid version

      const decoded = decodeShare(invalidCode);

      expect(decoded).toBeNull();
    });

    it('rejects null or empty codes', () => {
      expect(decodeShare(null)).toBeNull();
      expect(decodeShare('')).toBeNull();
      expect(decodeShare(undefined)).toBeNull();
    });
  });

  describe('Item types preservation', () => {
    it('preserves all item types through round-trip', () => {
      const size = ShareConstants.MATRIX_SIZE;
      const ground = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
      const overlay = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

      const gameData = {
        objects: [
          { id: 'obj-1', type: 'key', x: 0, y: 0, roomIndex: 0 },
          { id: 'obj-2', type: 'life-potion', x: 1, y: 1, roomIndex: 0 },
          { id: 'obj-3', type: 'xp-scroll', x: 2, y: 2, roomIndex: 0 },
          { id: 'obj-4', type: 'sword', x: 3, y: 3, roomIndex: 0 },
          { id: 'obj-5', type: 'sword-bronze', x: 4, y: 4, roomIndex: 0 },
          { id: 'obj-6', type: 'sword-wood', x: 5, y: 5, roomIndex: 0 },
          { id: 'obj-7', type: 'door', x: 6, y: 6, roomIndex: 0 },
        ],
        tileset: { map: { ground, overlay }, maps: [] },
      };

      const encoded = ShareEncoder.buildShareCode(gameData);
      const decoded = decodeShare(encoded);

      const objects = decoded?.objects as Array<{ type: string }>;
      expect(objects.some((obj) => obj.type === 'key')).toBe(true);
      expect(objects.some((obj) => obj.type === 'life-potion')).toBe(true);
      expect(objects.some((obj) => obj.type === 'xp-scroll')).toBe(true);
      expect(objects.some((obj) => obj.type === 'sword')).toBe(true);
      expect(objects.some((obj) => obj.type === 'sword-bronze')).toBe(true);
      expect(objects.some((obj) => obj.type === 'sword-wood')).toBe(true);
      expect(objects.some((obj) => obj.type === 'door')).toBe(true);
    });
  });
});
