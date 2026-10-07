import { describe, expect, it } from 'vitest';
import { GameState } from '../../runtime/domain/GameState';
import { StateWorldManager } from '../../runtime/domain/state/StateWorldManager';
import { normalizeMusicPlus, parseMusicMidi } from '../../runtime/services/MusicPlus';

const midi = Uint8Array.of(
  77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
  77, 84, 114, 107, 0, 0, 0, 12,
  0, 0x90, 60, 100, 96, 0x80, 60, 0, 96, 0xff, 0x2f, 0,
);
const asset = { format: 'midi' as const, data: btoa(String.fromCharCode(...midi)) };
const dependency = [{ id: 'music-plus', version: '1.0.0' }];

describe('Music+', () => {
  it('keeps MIDI end-of-track rests and supports notes beyond the effect duration', () => {
    const sequence = parseMusicMidi(midi);
    expect(sequence.notes).toHaveLength(1);
    expect(sequence.notes[0].duration).toBeCloseTo(0.5);
    expect(sequence.duration).toBeCloseTo(1);
  });

  it('parses complete tracks longer than 15 seconds with more than 256 notes', () => {
    const events: number[] = [];
    for (let index = 0; index < 300; index++) events.push(0, 0x90, 60, 100, 96, 0x80, 60, 0);
    events.push(0x82, 0x60, 0xff, 0x2f, 0);
    const length = events.length;
    const bytes = Uint8Array.from([...midi.slice(0, 18), (length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...events]);
    const sequence = parseMusicMidi(bytes);
    expect(sequence.notes).toHaveLength(300);
    expect(sequence.duration).toBeGreaterThan(15);
    const lastNote = sequence.notes.at(-1);
    if (!lastNote) throw Error('Missing MIDI note');
    expect(sequence.duration).toBeGreaterThan(lastNote.start + lastNote.duration);
  });

  it('validates room bounds and the dependency before import mutates the project', () => {
    const state = new GameState();
    const before = state.exportGameData() as Record<string, unknown>;
    expect(() => state.importGameData({ ...before, musicPlus: { '9': asset }, gameplayPlugins: dependency })).toThrow();
    expect(state.exportGameData()).toEqual(before);
    expect(() => normalizeMusicPlus({ '0': asset }, [], 9)).toThrow(/dependency/i);
    expect(normalizeMusicPlus({ '0': asset }, [{ id: 'music-plus', version: '1.0.1' }], 9)).toEqual({ '0': asset });
    expect(normalizeMusicPlus({ '0': asset }, [{ id: 'music-plus', version: '1.0.2' }], 9)).toEqual({ '0': asset });
    expect(normalizeMusicPlus({ '0': asset }, [{ id: 'music-plus', version: '1.0.3' }], 9)).toEqual({ '0': asset });
    expect(() => normalizeMusicPlus({ '0': { format: 'midi', data: '%%%=' } }, dependency, 9)).toThrow(/data/i);
    expect(() => normalizeMusicPlus({ '0': { format: 'mp3', data: asset.data } }, dependency, 9)).toThrow(/MP3/i);
    expect(normalizeMusicPlus({}, [], 9)).toBeUndefined();
    state.importGameData({ ...before, musicPlus: { '0': asset }, gameplayPlugins: dependency });
    expect(state.exportGameData()).toMatchObject({ musicPlus: { '0': asset } });
  });

  it('validates and persists the numeric fade duration with its Music+ dependency', () => {
    const state = new GameState();
    const before = state.exportGameData() as Record<string, unknown>;
    expect(() => state.importGameData({ ...before, musicPlusFadeDurationSeconds: 2.5 })).toThrow(/dependency/i);
    for (const value of [0, 10.1, NaN, '2']) {
      expect(() => state.importGameData({ ...before, musicPlusFadeDurationSeconds: value })).toThrow(/duration/i);
    }
    expect(state.exportGameData()).toEqual(before);
    state.importGameData({ ...before, gameplayPlugins: [{ id: 'music-plus', version: '1.0.3' }], musicPlusFadeDurationSeconds: 2.5 });
    expect(state.exportGameData()).toMatchObject({ musicPlusFadeDurationSeconds: 2.5 });
    state.importGameData({ ...before, gameplayPlugins: [{ id: 'music-plus', version: '1.0.3' }] });
    expect((state.exportGameData() as Record<string, unknown>).musicPlusFadeDurationSeconds).toBeUndefined();
  });

  it('keeps the smooth transition option in project saves and requires Music+ when enabled', () => {
    const state = new GameState();
    const before = state.exportGameData() as Record<string, unknown>;
    expect(() => state.importGameData({ ...before, musicPlusSmoothTransition: true })).toThrow(/dependency/i);
    state.importGameData({ ...before, gameplayPlugins: [{ id: 'music-plus', version: '1.0.2' }], musicPlusSmoothTransition: true });
    expect(state.exportGameData()).toMatchObject({ musicPlusSmoothTransition: true });
    state.importGameData({ ...before, gameplayPlugins: [{ id: 'music-plus', version: '1.0.2' }] });
    expect((state.exportGameData() as Record<string, unknown>).musicPlusSmoothTransition).toBeUndefined();
  });

  it('remaps room assignments by coordinate on resize', () => {
    const state = new GameState();
    state.importGameData({ ...(state.exportGameData() as Record<string, unknown>), musicPlus: { '4': asset, '8': asset }, gameplayPlugins: dependency });
    new StateWorldManager(state.game).resizeWorld(3, 2);
    expect(state.game.musicPlus).toEqual({ '3': asset });
  });

  it('keeps Music+ tracks that fit when a Maps+ world returns to 3 by 3', () => {
    const state = new GameState();
    new StateWorldManager(state.game).resizeWorld(5, 5);
    state.game.musicPlus = { '12': asset, '14': asset };
    state.game.gameplayPlugins = [...dependency, { id: 'maps-plus', version: '1.0.2' }];
    new StateWorldManager(state.game).resizeWorld(3, 3);
    expect(state.game.musicPlus).toEqual({ '8': asset });
    expect(state.game.gameplayPlugins).toContainEqual(dependency[0]);
  });
});
