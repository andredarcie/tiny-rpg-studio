import { afterEach, expect, it, vi } from 'vitest';
import { BitmapFont } from '../../runtime/adapters/renderer/BitmapFont';
import { FontLifecycle } from '../../runtime/adapters/renderer/FontLifecycle';
import { getGameFont, setGameFont, applyGameFont } from '../../runtime/adapters/renderer/FontPresentation';
import { decodeFontBytes, fontBytesToBase64, inspectFont, type FontsPlus } from '../../runtime/services/FontsPlus';
import { setEditorFontDisabled } from '../../config/FontConfig';

const { readFileSync } = await vi.importActual<{ readFileSync: (path: string) => Uint8Array }>('node:fs');
const bytes = new Uint8Array(readFileSync('tests/fixtures/fonts/pixel-operator.ttf'));
const capabilities = inspectFont(bytes);
const asset: FontsPlus = { filename: 'regular.ttf', data: fontBytesToBase64(bytes), applyGame: true, applyEditor: true, bold: capabilities.bold.inherent, italic: capabilities.italic.inherent };
afterEach(() => { setGameFont(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function browser(load: () => Promise<unknown> = () => Promise.resolve()) {
  const faces = new Set<FontFace>();
  const fontSet = { add: vi.fn((f: FontFace) => faces.add(f)), delete: vi.fn((f: FontFace) => faces.delete(f)) };
  Object.defineProperty(document, 'fonts', { configurable: true, value: fontSet });
  vi.stubGlobal('FontFace', class { load = load; });
  return { faces, fontSet };
}

it('loads before activation, keeps one face, coordinates targets and disposes on removal', async () => {
  const { faces } = browser();
  const lifecycle = new FontLifecycle();
  for (const applyGame of [false, true]) for (const applyEditor of [false, true]) {
    const next = { ...asset, applyGame, applyEditor };
    await lifecycle.prepare(next);
    lifecycle.sync(next, vi.fn());
    expect(faces.size).toBe(1);
    expect(getGameFont().family.includes('TinyRpgFont')).toBe(applyGame);
    expect(Boolean(lifecycle.editorPresentation)).toBe(applyEditor);
  }
  lifecycle.destroy();
  expect(faces.size).toBe(0);
  expect(lifecycle.editorPresentation).toBeUndefined();
});

it('retains the previous face on decode failure and cancels late loads after project removal', async () => {
  let fail = false;
  browser(() => fail ? Promise.reject(Error('decode')) : Promise.resolve());
  const lifecycle = new FontLifecycle();
  await lifecycle.prepare(asset);
  lifecycle.sync(asset, vi.fn());
  const before = getGameFont();
  fail = true;
  await expect(lifecycle.prepare({ ...asset, filename: 'broken.ttf' })).rejects.toThrow(/decode/i);
  expect(getGameFont()).toEqual(before);
  let finish!: () => void;
  const { faces } = browser(() => new Promise<void>(resolve => { finish = resolve; }));
  const pending = lifecycle.prepare({ ...asset, filename: 'late.ttf' });
  lifecycle.destroy();
  finish();
  await expect(pending).rejects.toThrow(/superseded/i);
  expect(faces.size).toBe(0);
  expect(getGameFont().family).not.toContain('TinyRpgFont');
});

it('ignores an older load when a replacement finishes first and shares duplicate requests', async () => {
  const completions: (() => void)[] = [];
  const { faces } = browser(() => new Promise<void>(resolve => completions.push(resolve)));
  const lifecycle = new FontLifecycle();
  const old = lifecycle.prepare(asset);
  const replacement = { ...asset, filename: 'replacement.ttf' };
  const latest = lifecycle.prepare(replacement);
  const duplicate = lifecycle.prepare(replacement);
  expect(completions).toHaveLength(2);
  completions[1]();
  await Promise.all([latest, duplicate]);
  lifecycle.sync(replacement, vi.fn());
  const current = getGameFont();
  completions[0]();
  await expect(old).rejects.toThrow(/superseded/i);
  expect(getGameFont()).toEqual(current);
  expect(faces.size).toBe(1);
  lifecycle.destroy();
});

it('uses real proportional measurements and the selected face after repeated fallback refreshes', () => {
  const font = new BitmapFont();
  const measure = vi.fn((text: string) => ({ width: text === 'i' ? 2 : 11, actualBoundingBoxLeft: 2, actualBoundingBoxRight: 12 }));
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw Error('Missing context');
  ctx.measureText = measure as unknown as typeof ctx.measureText;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  setGameFont({ family: '"Proportional"', weight: '700', style: 'italic', variationSettings: 'normal' });
  for (let i = 0; i < 3; i++) {
    font.setDisabled(true);
    expect(font.getCharAdvance(105, 13)).toBe(2);
    expect(font.measureText('Ágj', 13)).toBe(14);
    expect(font.snapSize(13)).toBe(13);
    expect(ctx.font).toContain('italic 700 13px "Proportional"');
  }
  const fill = vi.spyOn(ctx, 'fillText');
  font.drawText(ctx, 'Ágj', 10, 10, 13);
  expect(fill).toHaveBeenCalledWith('Ágj', 10, expect.any(Number));
  const overlay = document.createElement('div');
  applyGameFont(overlay);
  setEditorFontDisabled(false, { family: '"EditorOnly"', weight: '400', style: 'normal', variationSettings: 'normal' });
  expect(overlay.style.fontFamily).toContain('Proportional');
  expect(document.documentElement.style.getPropertyValue('--editor-custom-font-family')).toContain('EditorOnly');
  setEditorFontDisabled(true);
  expect(document.body.hasAttribute('data-editor-custom-font')).toBe(false);
  setGameFont();
  expect(font.measureText('abc', 10)).toBe(18);
  expect(decodeFontBytes(asset.data)).toEqual(bytes);
});
