import { beforeAll, describe, expect, it } from 'vitest';
import { setupShareGlobals, ShareConstants, ShareEncoder, ShareDecoder } from './shareTestUtils';

type ShareTestData = {
  objects?: Array<Record<string, unknown>>;
};

const decodeShare = (code: string | null | undefined): ShareTestData | null =>
  ShareDecoder.decodeShareCode(code) as ShareTestData | null;

const baseGame = (objects: Array<Record<string, unknown>>) => ({
  title: 'Gates',
  author: 'A',
  start: { x: 1, y: 1, roomIndex: 0 },
  sprites: [],
  enemies: [],
  objects,
  variables: [],
});

const findObject = (decoded: ShareTestData | null, type: string) =>
  decoded?.objects?.find((o) => o.type === type);

describe('Share round-trip - logic gates and LED', () => {
  beforeAll(() => {
    setupShareGlobals();
  });

  it('encodes the current version (32)', () => {
    expect(ShareConstants.VERSION).toBe(32);
  });

  it('round-trips an AND gate with three variables', () => {
    const game = baseGame([
      {
        type: 'logic-gate-and',
        roomIndex: 0,
        x: 2,
        y: 3,
        inputVariableId: 'var-1',
        inputVariableId2: 'var-2',
        outputVariableId: 'var-3',
      },
    ]);

    const encoded = ShareEncoder.buildShareCode(game);
    const decoded = decodeShare(encoded);
    const gate = findObject(decoded, 'logic-gate-and');

    expect(gate).toBeTruthy();
    expect(gate?.x).toBe(2);
    expect(gate?.y).toBe(3);
    expect(gate?.inputVariableId).toBe('var-1');
    expect(gate?.inputVariableId2).toBe('var-2');
    expect(gate?.outputVariableId).toBe('var-3');
  });

  it('round-trips each gate type preserving its type', () => {
    const types = ['logic-gate-not', 'logic-gate-and', 'logic-gate-or', 'logic-gate-nand', 'logic-gate-nor'];
    types.forEach((type, index) => {
      // place each in a distinct room so they don't dedup
      const game = baseGame([
        { type, roomIndex: index, x: 1, y: 1, inputVariableId: 'var-1', inputVariableId2: 'var-2', outputVariableId: 'var-3' },
      ]);
      const decoded = decodeShare(ShareEncoder.buildShareCode(game));
      expect(findObject(decoded, type)?.type).toBe(type);
    });
  });

  it('round-trips the hidden-in-game flag', () => {
    const game = baseGame([
      { type: 'logic-gate-not', roomIndex: 0, x: 0, y: 0, inputVariableId: 'var-1', outputVariableId: 'var-2', hiddenInGame: true },
      { type: 'logic-gate-and', roomIndex: 0, x: 1, y: 0, inputVariableId: 'var-1', inputVariableId2: 'var-2', outputVariableId: 'var-3' },
    ]);
    const decoded = decodeShare(ShareEncoder.buildShareCode(game));
    const hidden = (decoded?.objects ?? []).find((o) => o.type === 'logic-gate-not');
    const visible = (decoded?.objects ?? []).find((o) => o.type === 'logic-gate-and');
    expect(hidden?.hiddenInGame).toBe(true);
    expect(visible?.hiddenInGame).toBe(false);
  });

  it('round-trips a gate with null variables without error', () => {
    const game = baseGame([
      { type: 'logic-gate-or', roomIndex: 0, x: 1, y: 1, inputVariableId: null, inputVariableId2: null, outputVariableId: null },
    ]);
    const decoded = decodeShare(ShareEncoder.buildShareCode(game));
    const gate = findObject(decoded, 'logic-gate-or');
    expect(gate).toBeTruthy();
    expect(gate?.inputVariableId).toBeNull();
    expect(gate?.inputVariableId2).toBeNull();
    expect(gate?.outputVariableId).toBeNull();
  });

  it('round-trips a LED with its variableId', () => {
    const game = baseGame([
      { type: 'logic-led', roomIndex: 0, x: 4, y: 5, variableId: 'var-7' },
    ]);
    const decoded = decodeShare(ShareEncoder.buildShareCode(game));
    const led = findObject(decoded, 'logic-led');
    expect(led).toBeTruthy();
    expect(led?.x).toBe(4);
    expect(led?.y).toBe(5);
    expect(led?.variableId).toBe('var-7');
  });
});

describe('Share round-trip - multi-instance (same room)', () => {
  beforeAll(() => {
    setupShareGlobals();
  });

  const filterObjects = (decoded: ShareTestData | null, type: string) =>
    (decoded?.objects ?? []).filter((o) => o.type === type);

  it('round-trips 3 AND gates in the same room with distinct positions', () => {
    const game = baseGame([
      { type: 'logic-gate-and', roomIndex: 0, x: 0, y: 0, inputVariableId: 'var-1', inputVariableId2: 'var-2', outputVariableId: 'var-3' },
      { type: 'logic-gate-and', roomIndex: 0, x: 1, y: 0, inputVariableId: 'var-2', inputVariableId2: 'var-1', outputVariableId: 'var-4' },
      { type: 'logic-gate-and', roomIndex: 0, x: 2, y: 0, inputVariableId: 'var-5', inputVariableId2: 'var-6', outputVariableId: 'var-7' },
    ]);
    const gates = filterObjects(decodeShare(ShareEncoder.buildShareCode(game)), 'logic-gate-and');
    expect(gates.length).toBe(3);
    const byX = new Map(gates.map((g) => [g.x, g]));
    expect(byX.get(0)?.outputVariableId).toBe('var-3');
    expect(byX.get(1)?.outputVariableId).toBe('var-4');
    expect(byX.get(2)?.outputVariableId).toBe('var-7');
    expect(new Set(gates.map((g) => g.id)).size).toBe(3);
  });

  it('round-trips 2 switches in the same room', () => {
    const game = baseGame([
      { type: 'switch', roomIndex: 0, x: 0, y: 0, variableId: 'var-1', on: true },
      { type: 'switch', roomIndex: 0, x: 1, y: 0, variableId: 'var-2', on: false },
    ]);
    const switches = filterObjects(decodeShare(ShareEncoder.buildShareCode(game)), 'switch');
    expect(switches.length).toBe(2);
    expect(new Set(switches.map((s) => s.id)).size).toBe(2);
  });

  it('round-trips 4 LEDs in the same room', () => {
    const game = baseGame([
      { type: 'logic-led', roomIndex: 0, x: 0, y: 0, variableId: 'var-1' },
      { type: 'logic-led', roomIndex: 0, x: 1, y: 0, variableId: 'var-2' },
      { type: 'logic-led', roomIndex: 0, x: 2, y: 0, variableId: 'var-3' },
      { type: 'logic-led', roomIndex: 0, x: 3, y: 0, variableId: 'var-4' },
    ]);
    const leds = filterObjects(decodeShare(ShareEncoder.buildShareCode(game)), 'logic-led');
    expect(leds.length).toBe(4);
    expect(new Set(leds.map((l) => l.id)).size).toBe(4);
  });
});
