
import { expect, it, vi } from 'vitest';
import { inspectFont, normalizeFontsPlus, fontBytesToBase64, decodeFontBytes, fontFaceSettings } from '../runtime/services/FontsPlus';
import { GameState } from '../runtime/domain/GameState';

const { readFileSync } = await vi.importActual<{ readFileSync: (path: string) => Uint8Array }>('node:fs');
const bytes = new Uint8Array(readFileSync('tests/fixtures/fonts/pixel-operator.ttf'));
const dependencies = [{ id: 'fonts-plus', version: '1.0.0' }];
const asset = () => ({ filename: 'regular.ttf', data: fontBytesToBase64(bytes) });

it('validates real TrueType bytes and derives fixed styles independently of filenames', () => {
  const capabilities = inspectFont(bytes);
  expect(capabilities.bold.switchable).toBe(false);
  expect(capabilities.italic.switchable).toBe(false);
  const normalized = normalizeFontsPlus({ ...asset(), filename: 'fake-bold-italic.ttf' }, dependencies);
  if (!normalized) throw Error('Missing normalized font');
  expect(normalized).toMatchObject({ applyGame: true, applyEditor: true, bold: capabilities.bold.inherent, italic: capabilities.italic.inherent });
  expect(() => normalizeFontsPlus({ ...normalized, bold: !normalized.bold }, dependencies)).toThrow(/bold/i);
});

it('round trips independent targets and requires the dependency even with both targets off', () => {
  for (const applyGame of [false, true]) for (const applyEditor of [false, true]) {
    const state = new GameState();
    state.importGameData({ ...state.exportGameData() as object, gameplayPlugins: dependencies, fontsPlus: { ...asset(), applyGame, applyEditor } });
    const saved = state.exportGameData() as { fontsPlus: unknown };
    expect(saved.fontsPlus).toMatchObject({ applyGame, applyEditor });
    const restored = new GameState();
    restored.importGameData(saved);
    expect(restored.game.fontsPlus).toEqual(saved.fontsPlus);
  }
  expect(() => normalizeFontsPlus({ ...asset(), applyGame: false, applyEditor: false })).toThrow(/dependency/i);
  expect(normalizeFontsPlus(undefined)).toBeUndefined();
});

it('rejects malformed, noncanonical, empty, oversized and forged assets', () => {
  for (const data of ['', '!!!!', 'AB==', 'AAAA===']) expect(() => decodeFontBytes(data)).toThrow();
  expect(() => fontBytesToBase64(new Uint8Array(1024 * 1024 + 1))).toThrow();
  expect(() => normalizeFontsPlus({ ...asset(), filename: 'font.woff' }, dependencies)).toThrow(/ttf/i);
  expect(() => normalizeFontsPlus({ ...asset(), capabilities: {} }, dependencies)).toThrow();
  expect(() => normalizeFontsPlus({ ...asset(), applyGame: 'yes' }, dependencies)).toThrow();
  for (const length of [0, 4, 11, 30, bytes.length - 100]) expect(() => inspectFont(bytes.slice(0, length))).toThrow();
  const corrupt = bytes.slice();
  new DataView(corrupt.buffer).setUint32(20, 0xffffffff);
  expect(() => inspectFont(corrupt)).toThrow();
});

it('decodes the full allowed size without truncation or regexp stack exhaustion', () => {
  const maximum = new Uint8Array(1024 * 1024);
  maximum[maximum.length - 1] = 255;
  const decoded = decodeFontBytes(fontBytesToBase64(maximum));
  expect(decoded.length).toBe(maximum.length);
  expect(decoded.at(-1)).toBe(255);
  expect(decoded.subarray(0, -1).every(value => value === 0)).toBe(true);
});

it('preserves intrinsic styles and maps all supported variable combinations to real axes', () => {
  const italic = new Uint8Array(readFileSync('tests/fixtures/fonts/proportional-italic.ttf'));
  expect(inspectFont(italic).italic).toEqual({ inherent: true, switchable: false });
  const fixed = normalizeFontsPlus({ filename: 'italic.ttf', data: fontBytesToBase64(italic) }, dependencies);
  expect(fixed?.italic).toBe(true);
  const variable = new Uint8Array(readFileSync('tests/fixtures/fonts/pixel-variable.ttf'));
  const c = inspectFont(variable);
  expect(c.bold.switchable).toBe(true);
  expect(c.italic.switchable).toBe(true);
  for (const bold of [false, true]) for (const styled of [false, true]) {
    const font = normalizeFontsPlus({ filename: 'variable.ttf', data: fontBytesToBase64(variable), bold, italic: styled }, dependencies);
    if (!font) throw Error('Missing font');
    const settings = fontFaceSettings(font);
    expect(settings.weight).toBe(bold ? '700' : '400');
    expect(settings.style).toBe(styled ? 'italic' : 'normal');
    expect(settings.variationSettings).toBe(`"wght" ${bold ? 700 : 400}, "ital" ${styled ? 1 : 0}`);
  }
  const corrupt = variable.slice();
  const view = new DataView(corrupt.buffer);
  for (let p = 12; p < 12 + view.getUint16(4) * 16; p += 16) {
    const tag = String.fromCharCode(...corrupt.slice(p, p + 4));
    if (tag === 'fvar') {
      const offset = view.getUint32(p + 8);
      view.setUint16(offset + 10, 65535);
    }
  }
  expect(() => inspectFont(corrupt)).toThrow();
});
