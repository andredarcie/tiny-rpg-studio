import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareConstants, ShareDataNormalizer, ShareVariableCodec } from './shareTestUtils';

describe('ShareDataNormalizer', () => {
  const objectTypes = {
    DOOR: 'door',
    KEY: 'key',
    LIFE_POTION: 'life-potion',
    XP_SCROLL: 'xp-scroll',
    SWORD: 'sword',
    SWORD_BRONZE: 'sword-bronze',
    SWORD_WOOD: 'sword-wood',
    PLAYER_END: 'player-end',
    SWITCH: 'switch',
    DOOR_VARIABLE: 'door-variable'
  };

  beforeAll(() => {
    setupShareGlobals({
      npcDefinitions: [
        { id: 'npc-1', type: 'bard', name: 'Bard', defaultText: 'ola' }
      ],
      enemyDefinitions: [
        { type: 'slime' }
      ],
      objectTypes,
      enemyNormalize: (type) => (typeof type === 'string' && type ? type : 'slime'),
      playerEndTextLimit: 5
    });
  });

  it('clamps start positions', () => {
    const start = ShareDataNormalizer.normalizeStart({ x: 99, y: -5, roomIndex: 999 });

    expect(start.x).toBe(ShareConstants.MATRIX_SIZE - 1);
    expect(start.y).toBe(0);
    expect(start.roomIndex).toBe(ShareConstants.MAX_ROOM_INDEX);
  });

  it('normalizes sprites with defaults and allows multiple instances of same type', () => {
    const sprites = ShareDataNormalizer.normalizeSprites([
      { type: 'bard', x: 1, y: 2, roomIndex: 0 },
      { type: 'bard', x: 3, y: 3, roomIndex: 1 }
    ]);

    // ✅ NEW: Now supports multiple NPCs of same type (one per scene)
    expect(sprites.length).toBe(2);
    expect(sprites[0].text).toBe('ola');
    expect(sprites[0].x).toBe(1);
    expect(sprites[0].y).toBe(2);
    expect(sprites[0].roomIndex).toBe(0);
    expect(sprites[1].text).toBe('ola');
    expect(sprites[1].x).toBe(3);
    expect(sprites[1].y).toBe(3);
    expect(sprites[1].roomIndex).toBe(1);
  });

  it('limits enemies per room', () => {
    const enemies = Array.from({ length: 10 }, (_, index) => ({
      type: 'slime',
      x: index % 8,
      y: index % 8,
      roomIndex: 0
    }));

    const normalized = ShareDataNormalizer.normalizeEnemies(enemies);

    expect(normalized.length).toBe(9);
  });

  it('normalizes object positions per room and sorts', () => {
    const objects = [
      { type: objectTypes.DOOR, roomIndex: 2, x: 1, y: 1 },
      { type: objectTypes.DOOR, roomIndex: 1, x: 2, y: 0 },
      { type: objectTypes.DOOR, roomIndex: 1, x: 3, y: 3 }
    ];

    const positions = ShareDataNormalizer.normalizeObjectPositions(objects, objectTypes.DOOR);

    expect(positions.length).toBe(2);
    expect(positions[0].roomIndex).toBe(1);
  });

  it('normalizes variable door objects with fallback nibble', () => {
    const fallbackNibble = ShareVariableCodec.variableIdToNibble(ShareVariableCodec.getFirstVariableId());
    const objects = [
      { type: objectTypes.DOOR_VARIABLE, roomIndex: 0, x: 1, y: 1, variableId: 'bad-id' }
    ];

    const normalized = ShareDataNormalizer.normalizeVariableDoorObjects(objects);

    expect(normalized[0].variableNibble).toBe(fallbackNibble);
  });

  it('builds player end entries with text limits', () => {
    const entries = ShareDataNormalizer.buildObjectEntries(
      [{ x: 1, y: 1, roomIndex: 0 }],
      objectTypes.PLAYER_END,
      { endingTexts: ['123456789'] }
    );

    expect(entries[0].endingText).toBe('12345');
  });
});
