import { describe, expect, it } from 'vitest';
import { normalizeSoundsPlus, parseMidi, SOUND_NAMES } from '../../runtime/services/SoundsPlus';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';

const midi = btoa(String.fromCharCode(...[
  77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
  77, 84, 114, 107, 0, 0, 0, 12,
  0, 0x90, 60, 100, 96, 0x80, 60, 0, 0, 0xff, 0x2f, 0,
]));
const dependencies = [{ id: 'sounds-plus', version: '1.0.0' }];

describe('Sounds+', () => {
  it('exposes every synthesised effect and preserves validated MIDI bytes', () => {
    expect(SOUND_NAMES).toHaveLength(18);
    for (const name of SOUND_NAMES) expect(typeof name).toBe('string');
    expect(normalizeSoundsPlus({ dialog: { format: 'midi', data: midi } }, dependencies))
      .toEqual({ dialog: { format: 'midi', data: midi } });
  });

  it('rejects unknown names, missing dependencies, and corrupt files', () => {
    expect(() => normalizeSoundsPlus({ unknown: { format: 'midi', data: midi } }, dependencies)).toThrow();
    expect(() => normalizeSoundsPlus({ dialog: { format: 'midi', data: midi } }, [])).toThrow();
    expect(() => normalizeSoundsPlus({ dialog: { format: 'midi', data: 'AAAA' } }, dependencies)).toThrow();
    expect(() => normalizeSoundsPlus({ dialog: { format: 'wav', data: btoa('not a wave') } }, dependencies)).toThrow();
    expect(() => normalizeSoundsPlus({ dialog: { format: 'mp3', data: btoa('ID3') } }, dependencies)).toThrow();
    expect(() => normalizeSoundsPlus({ dialog: { format: 'midi', data: btoa('A'.repeat(256 * 1024 + 1)) } }, dependencies)).toThrow();
  });

  it('accepts structurally valid MP3 and WAV assets for decode preflight', () => {
    const wav = new Uint8Array(46);
    const view = new DataView(wav.buffer);
    wav.set([82, 73, 70, 70], 0); view.setUint32(4, 38, true);
    wav.set([87, 65, 86, 69, 102, 109, 116, 32], 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    wav.set([100, 97, 116, 97], 36); view.setUint32(40, 2, true);
    const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    expect(normalizeSoundsPlus({ dialog: { format: 'wav', data: encode(wav) } }, dependencies)?.dialog?.format).toBe('wav');
    expect(normalizeSoundsPlus({ dialog: { format: 'mp3', data: encode(Uint8Array.of(0xff, 0xfb, 0x90, 0x64)) } }, dependencies)?.dialog?.format).toBe('mp3');
  });

  it('parses note duration and velocity from MIDI tracks', () => {
    expect(parseMidi(Uint8Array.from(atob(midi), character => character.charCodeAt(0))))
      .toEqual([{ start: 0, duration: 0.5, pitch: 60, velocity: 100 }]);
  });

  it('requires full snapshots when override bytes are present', () => {
    const project = { soundsPlus: { dialog: { format: 'midi', data: midi } } };
    expect(ShareUtils.needsFullProject(project)).toBe(true);
    expect(ShareUtils.encode(project)).toBe('');
    const stored = ShareUtils.buildStoredProject(project);
    expect(stored.startsWith('snapshot:')).toBe(true);
    expect(ShareUtils.readStoredProject(stored)).toEqual(project);
  });
});
