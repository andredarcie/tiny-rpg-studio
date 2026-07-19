import { describe, expect, it } from 'vitest';
import { ShareConstants } from '../../runtime/infra/share/ShareConstants';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';
import { ShareDecoder } from '../../runtime/infra/share/ShareDecoder';
import { ShareTextCodec } from '../../runtime/infra/share/ShareTextCodec';

describe('VERSION_36/37 tile visual effects', () => {
  it('registers VERSION_36 and TILE_VISUAL_EFFECT_VERSION', () => {
    expect(ShareConstants.VERSION_36).toBe(36);
    expect(ShareConstants.VERSION).toBe(37);
    expect(ShareConstants.TILE_VISUAL_EFFECT_VERSION).toBe(ShareConstants.VERSION_36);
    expect(ShareConstants.SUPPORTED_VERSIONS.has(ShareConstants.VERSION_36)).toBe(true);
  });

  it('collectTileVisualEffects keeps water/lava/none and skips unset', () => {
    const map = ShareEncoder.collectTileVisualEffects([
      { id: 0, visualEffect: undefined },
      { id: 5, visualEffect: 'water' },
      { id: 6, visualEffect: 'lava' },
      { id: 1, visualEffect: 'none' },
      { id: 2, visualEffect: 'bogus' },
    ]);
    expect(map).toEqual({
      '5': 'water',
      '6': 'lava',
      '1': 'none',
    });
  });

  it('round-trips tile visual effects through share encode/decode', () => {
    const gameData = {
      title: 'FX',
      start: { x: 1, y: 1, roomIndex: 0 },
      rooms: [],
      sprites: [],
      enemies: [],
      objects: [],
      variables: [],
      tileset: {
        tiles: [
          { id: 0, visualEffect: 'none' as const },
          { id: 5, visualEffect: 'water' as const },
          { id: 8, visualEffect: 'lava' as const },
        ],
        maps: [],
      },
    };

    const code = ShareEncoder.buildShareCode(gameData as never);
    expect(code).toContain('.0');
    expect(code.startsWith(`v${ShareConstants.VERSION_37.toString(36)}.`)).toBe(true);

    const decoded = ShareDecoder.decodeShareCode(code) as {
      tileVisualEffects?: Record<string, string>;
      enableEffects?: boolean;
    } | null;
    expect(decoded).toBeTruthy();
    expect(decoded?.tileVisualEffects).toEqual({
      '0': 'none',
      '5': 'water',
      '8': 'lava',
    });
    // Default master switch is on when absent.
    expect(decoded?.enableEffects).toBe(true);
  });

  it('round-trips compact custom definitions, Unicode names, and assignments', () => {
    const customTileEffects = [
      { id: 'custom:0' as const, name: 'Brilho mágico ✨', baseEffectIds: ['glow', 'sparkle'] as const },
      { id: 'custom:1' as const, name: 'Unused', baseEffectIds: ['cool-tint'] as const },
    ];
    const gameData = {
      title: 'Custom FX',
      customTileEffects,
      start: { x: 1, y: 1, roomIndex: 0 },
      rooms: [], sprites: [], enemies: [], objects: [], variables: [],
      tileset: { tiles: [{ id: 2, visualEffect: 'custom:0' }], maps: [] },
    };

    const code = ShareEncoder.buildShareCode(gameData as never);
    const decoded = ShareDecoder.decodeShareCode(code) as {
      customTileEffects?: Array<{ id: string; name: string; baseEffectIds: string[] }>;
      tileVisualEffects?: Record<string, string>;
    } | null;

    expect(decoded?.customTileEffects).toEqual(customTileEffects);
    expect(decoded?.tileVisualEffects).toEqual({ '2': 'custom:0' });
    expect(code).not.toContain('sparkle');
  });

  it('round-trips global enableEffects=false under VERSION_36', () => {
    const gameData = {
      title: 'NoFX',
      enableEffects: false,
      start: { x: 1, y: 1, roomIndex: 0 },
      rooms: [],
      sprites: [],
      enemies: [],
      objects: [],
      variables: [],
      tileset: {
        tiles: [{ id: 5, visualEffect: 'water' as const }],
        maps: [],
      },
    };

    const code = ShareEncoder.buildShareCode(gameData as never);
    expect(code).toContain('.~0');

    const decoded = ShareDecoder.decodeShareCode(code) as {
      enableEffects?: boolean;
      tileVisualEffects?: Record<string, string>;
    } | null;
    expect(decoded?.enableEffects).toBe(false);
    expect(decoded?.tileVisualEffects).toEqual({ '5': 'water' });
  });

  it('decodes the unchanged VERSION_36 assignment-map payload', () => {
    const encoded = ShareTextCodec.encodeText(JSON.stringify({ '0': 'none', '5': 'water' }));
    const decoded = ShareDecoder.decodeShareCode(`v10.0${encoded}`) as {
      tileVisualEffects?: Record<string, string>;
    } | null;
    expect(decoded?.tileVisualEffects).toEqual({ '0': 'none', '5': 'water' });
  });
});
