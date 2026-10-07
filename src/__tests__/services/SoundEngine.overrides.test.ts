import { afterEach, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../runtime/services/SoundEngine';
import type { SoundOverride } from '../../runtime/services/SoundsPlus';

afterEach(() => vi.unstubAllGlobals());

it('waits for the one-time game start override to decode', async () => {
  let finishDecode: ((buffer: AudioBuffer) => void) | undefined;
  const sources: { start: ReturnType<typeof vi.fn> }[] = [];
  const oscillators: unknown[] = [];
  class MockAudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain = () => ({ gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
    decodeAudioData = () => new Promise<AudioBuffer>(resolve => { finishDecode = resolve; });
    createBufferSource = () => {
      const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    };
    createOscillator = () => {
      const source = { type: 'sine', frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(source);
      return source;
    };
  }
  vi.stubGlobal('AudioContext', MockAudioContext);
  const engine = new SoundEngine();
  const owner = {};
  const asset: SoundOverride = { format: 'mp3', data: btoa(String.fromCharCode(0xff, 0xfb, 0x90, 0x64)) };
  engine.claim(owner);
  engine.sync(owner, { gameStart: asset });
  engine.play('gameStart');
  expect(oscillators).toHaveLength(0);
  expect(sources).toHaveLength(0);
  finishDecode?.({ duration: 1 } as AudioBuffer);
  await vi.waitFor(() => expect(sources).toHaveLength(1));
  expect(sources[0].start).toHaveBeenCalledOnce();

  engine.sync(owner, { gameStart: { ...asset, data: btoa('ID3second') } });
  engine.play('gameStart');
  engine.cancelQueuedGameStart(owner);
  finishDecode?.({ duration: 1 } as AudioBuffer);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(sources).toHaveLength(1);
  engine.release(owner);
});

it('rejects sampled audio that the browser cannot decode', async () => {
  const oscillators: unknown[] = [];
  class BadAudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain = () => ({ gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
    decodeAudioData = () => Promise.reject(Error('decode failed'));
    createOscillator = () => {
      const source = { type: 'sine', frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(source);
      return source;
    };
  }
  vi.stubGlobal('AudioContext', BadAudioContext);
  const engine = new SoundEngine();
  const asset: SoundOverride = { format: 'mp3', data: btoa(String.fromCharCode(0xff, 0xfb, 0x90, 0x64)) };
  await expect(engine.prepare(asset))
    .rejects.toThrow('Cannot play this MP3 file');
  const owner = {};
  engine.claim(owner);
  engine.sync(owner, { gameStart: asset });
  engine.play('gameStart');
  await vi.waitFor(() => expect(oscillators).toHaveLength(4));
  engine.release(owner);
});

it('preflights audio, plays overlapping copies, honors mute, and clears the owning project', async () => {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
  const oscillators: { stop: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
  const gain = () => ({ gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
  class MockAudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain = gain;
    resume = vi.fn();
    decodeAudioData = vi.fn(() => Promise.resolve({ duration: 1 }));
    createBufferSource = () => {
      const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    };
    createOscillator = () => {
      const source = { type: 'sine', frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(source);
      return source;
    };
  }
  vi.stubGlobal('AudioContext', MockAudioContext);
  const engine = new SoundEngine();
  const owner = {};
  const preview = {};
  const asset: SoundOverride = { format: 'mp3', data: btoa(String.fromCharCode(0xff, 0xfb, 0x90, 0x64)) };
  engine.claim(owner);
  const prepared = await engine.prepare(asset);
  engine.sync(owner, { dialog: asset }, { name: 'dialog', asset, sound: prepared });
  engine.play('dialog'); engine.play('dialog');
  expect(sources).toHaveLength(2);
  expect(sources.every(source => source.start.mock.calls.length === 1)).toBe(true);
  engine.enabled = false;
  engine.play('dialog');
  expect(sources).toHaveLength(2);
  await expect(engine.prepare(asset)).resolves.toEqual({ duration: 1 });
  engine.enabled = true;
  engine.sync(preview, {});
  engine.play('dialog');
  expect(sources).toHaveLength(3);
  engine.release(owner);
  expect(sources.slice(0, 2).every(source => source.stop.mock.calls.length > 0)).toBe(true);
  engine.play('dialog');
  expect(oscillators).toHaveLength(1);

  const midi: SoundOverride = { format: 'midi', data: btoa(String.fromCharCode(...[
    77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    77, 84, 114, 107, 0, 0, 0, 12,
    0, 0x90, 60, 100, 96, 0x80, 60, 0, 0, 0xff, 0x2f, 0,
  ])) };
  engine.claim(owner);
  engine.sync(owner, { typewriter: midi }, { name: 'typewriter', asset: midi, sound: await engine.prepare(midi) });
  for (let index = 0; index < 100; index++) engine.play('typewriter');
  expect(oscillators).toHaveLength(49);
  engine.release(owner);
});
