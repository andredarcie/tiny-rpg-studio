import { describe, expect, it, vi } from 'vitest';
import { applyTileEdgeMerging } from '../../runtime/adapters/renderer/TileEdgeMerger';
import type { TileDefinition, TileId } from '../../runtime/domain/definitions/tileTypes';

function makePixels(width: number, height: number, colorAt: (x: number, y: number) => number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(colorAt(x, y), (y * width + x) * 4);
    }
  }
  return data;
}

function makeContext(source: Uint8ClampedArray, width: number, height: number) {
  let written: Uint8ClampedArray | null = null;
  const imageData = { data: new Uint8ClampedArray(source), width, height } as ImageData;
  const ctx = {
    getTransform: vi.fn(() => ({ e: 0, f: 0 })),
    getImageData: vi.fn(() => imageData),
    putImageData: vi.fn((next: ImageData) => { written = new Uint8ClampedArray(next.data); }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, getWritten: () => written as Uint8ClampedArray | null };
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  return Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
}

function requireWritten(data: Uint8ClampedArray | null): Uint8ClampedArray {
  if (!data) throw new Error('Expected merged image data');
  return data;
}

const red = [255, 0, 0, 255];
const blue = [0, 0, 255, 255];
const green = [0, 255, 0, 255];
const yellow = [255, 255, 0, 255];

describe('TileEdgeMerger', () => {
  it('applies a deterministic two-pixel horizontal dither when both stacks opt in', () => {
    const width = 16;
    const source = makePixels(width, width, (x) => x < 8 ? red : blue);
    const { ctx, getWritten } = makeContext(source, width, width);
    const tiles = new Map<string, TileDefinition>([
      ['1', { id: 1, mergeEdges: true }],
      ['2', { id: 2, mergeEdges: true }],
    ]);

    expect(applyTileEdgeMerging({
      ctx,
      tileMap: { ground: [[1, 2], [null, null]], overlay: [[null, null], [null, null]] },
      getTile: (id: TileId) => tiles.get(String(id)) ?? null,
      tileSize: 8,
      roomSize: 2,
    })).toBe(true);

    const output = requireWritten(getWritten());
    expect(pixel(output, width, 7, 0)).toEqual(blue);
    expect(pixel(output, width, 8, 0)).toEqual(red);
    expect(pixel(output, width, 6, 0)).toEqual(red);
    expect(pixel(output, width, 6, 1)).toEqual(blue);
    expect(pixel(output, width, 9, 1)).toEqual(red);
  });

  it('scales tile-art pixels and merges only from the opted-in side', () => {
    const width = 32;
    const source = makePixels(width, width, (x) => x < 16 ? red : blue);
    const tileById = (mergeSecond: boolean, sameId = false) => (id: TileId): TileDefinition | null => ({
      id,
      mergeEdges: String(id) === '1' || mergeSecond,
      ...(sameId ? { id: 1 } : {}),
    });

    const unchecked = makeContext(source, width, width);
    applyTileEdgeMerging({
      ctx: unchecked.ctx,
      tileMap: { ground: [[1, 2]], overlay: [[null, null]] },
      getTile: tileById(false),
      tileSize: 16,
      roomSize: 2,
    });
    const oneSidedOutput = requireWritten(unchecked.getWritten());
    expect(pixel(oneSidedOutput, width, 14, 0)).toEqual(red);
    expect(pixel(oneSidedOutput, width, 16, 0)).toEqual(red);
    expect(pixel(oneSidedOutput, width, 12, 2)).toEqual(red);
    expect(pixel(oneSidedOutput, width, 18, 2)).toEqual(red);

    const equal = makeContext(source, width, width);
    applyTileEdgeMerging({
      ctx: equal.ctx,
      tileMap: { ground: [[1, 1]], overlay: [[null, null]] },
      getTile: tileById(true, true),
      tileSize: 16,
      roomSize: 2,
    });
    expect(equal.getWritten()).toEqual(source);

    const scaled = makeContext(source, width, width);
    applyTileEdgeMerging({
      ctx: scaled.ctx,
      tileMap: { ground: [[1, 2]], overlay: [[null, null]] },
      getTile: tileById(true),
      tileSize: 16,
      roomSize: 2,
    });
    const scaledOutput = requireWritten(scaled.getWritten());
    expect(pixel(scaledOutput, width, 14, 0)).toEqual(blue);
    expect(pixel(scaledOutput, width, 15, 1)).toEqual(blue);
  });

  it('merges downward without bringing an unchecked lower tile upward', () => {
    const width = 16;
    const source = makePixels(width, width, (_x, y) => y < 8 ? red : blue);
    const fixture = makeContext(source, width, width);
    applyTileEdgeMerging({
      ctx: fixture.ctx,
      tileMap: { ground: [[1, null], [2, null]], overlay: [[null, null], [null, null]] },
      getTile: (id) => ({ id, mergeEdges: String(id) === '1' }),
      tileSize: 8,
      roomSize: 2,
    });

    const output = requireWritten(fixture.getWritten());
    expect(pixel(output, width, 0, 7)).toEqual(red);
    expect(pixel(output, width, 0, 8)).toEqual(red);
    expect(pixel(output, width, 1, 6)).toEqual(red);
    expect(pixel(output, width, 1, 9)).toEqual(red);
  });

  it('merges solid pixels from an enabled overlay over unchecked ground', () => {
    const width = 16;
    const source = makePixels(width, width, (x) => x < 8 ? red : blue);
    const transparent = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null));
    transparent[0][7] = '#FF0000';
    transparent[1][6] = '#FF0000';
    const solid = (color: string): string[][] =>
      Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => color));
    const tiles = new Map<string, TileDefinition>([
      ['1', { id: 1, mergeEdges: false, pixels: solid('#00FF00') }],
      ['2', { id: 2, mergeEdges: true, pixels: transparent as string[][] }],
      ['3', { id: 3, mergeEdges: false, pixels: solid('#0000FF') }],
    ]);
    const fixture = makeContext(source, width, width);

    applyTileEdgeMerging({
      ctx: fixture.ctx,
      tileMap: { ground: [[1, 3]], overlay: [[2, null]] },
      getTile: (id) => tiles.get(String(id)) ?? null,
      getTilePixels: (tile) => tile.pixels as (string | null)[][],
      tileSize: 8,
      roomSize: 2,
    });

    const output = requireWritten(fixture.getWritten());
    expect(pixel(output, width, 8, 0)).toEqual(red);
    expect(pixel(output, width, 9, 1)).toEqual(red);
    expect(pixel(output, width, 8, 2)).toEqual(blue);
    expect(pixel(output, width, 7, 0)).toEqual(red);
  });

  it('merges vertical borders from the immutable source and ignores invalid stacks', () => {
    const width = 16;
    const source = makePixels(width, width, (_x, y) => y < 8 ? red : blue);
    const valid = makeContext(source, width, width);
    applyTileEdgeMerging({
      ctx: valid.ctx,
      tileMap: { ground: [[1, null], [2, null]], overlay: [[null, null], [null, null]] },
      getTile: (id) => ({ id, mergeEdges: true }),
      tileSize: 8,
      roomSize: 2,
    });
    const validOutput = requireWritten(valid.getWritten());
    expect(pixel(validOutput, width, 0, 7)).toEqual(blue);
    expect(pixel(validOutput, width, 0, 8)).toEqual(red);

    const invalid = makeContext(source, width, width);
    applyTileEdgeMerging({
      ctx: invalid.ctx,
      tileMap: { ground: [[1, null], [99, null]], overlay: [[null, null], [null, null]] },
      getTile: (id) => String(id) === '1' ? { id, mergeEdges: true } : null,
      tileSize: 8,
      roomSize: 2,
    });
    expect(invalid.getWritten()).toEqual(source);
  });

  it('resolves horizontal and vertical corner overlap deterministically', () => {
    const width = 16;
    const source = makePixels(width, width, (x, y) => {
      if (y < 8) return x < 8 ? red : blue;
      return x < 8 ? green : yellow;
    });
    const run = () => {
      const fixture = makeContext(source, width, width);
      applyTileEdgeMerging({
        ctx: fixture.ctx,
        tileMap: { ground: [[1, 2], [3, 4]], overlay: [[null, null], [null, null]] },
        getTile: (id) => ({ id, mergeEdges: true }),
        tileSize: 8,
        roomSize: 2,
      });
      return requireWritten(fixture.getWritten());
    };

    const first = run();
    expect(run()).toEqual(first);
    expect(pixel(first, width, 6, 7)).toEqual(green);
  });
});
