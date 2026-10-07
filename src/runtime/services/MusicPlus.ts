export type MusicAsset = { format: 'midi' | 'mp3' | 'wav'; data: string };
export type MusicPlusMap = Record<string, MusicAsset>;
export type MusicMidiNote = { start: number; duration: number; pitch: number; velocity: number };
export type MusicMidiSequence = { notes: MusicMidiNote[]; duration: number };

export const MAX_MUSIC_FILE_BYTES = 1536 * 1024;
export const MAX_MUSIC_TOTAL_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MUSIC_PLUS_FADE_SECONDS = 1;

export function normalizeMusicPlusFadeDurationSeconds(value: unknown): number {
  if (value === undefined) return DEFAULT_MUSIC_PLUS_FADE_SECONDS;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.1 || value > 10) throw Error('Music+ fade duration must be between 0.1 and 10 seconds');
  return value;
}

export function decodeMusicBytes(data: string): Uint8Array {
  if (!data || data.length > Math.ceil(MAX_MUSIC_FILE_BYTES / 3) * 4 + 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw Error('Invalid music file data');
  let binary: string;
  try { binary = atob(data); } catch { throw Error('Invalid music file data'); }
  if (!binary.length || binary.length > MAX_MUSIC_FILE_BYTES || btoa(binary) !== data) throw Error('Music file is too large or malformed');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function validateMusicBytes(format: MusicAsset['format'], bytes: Uint8Array): void {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (format === 'midi') { parseMusicMidi(bytes); return; }
  if (format === 'wav') {
    if (bytes.length < 44 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') throw Error('Invalid WAV file');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(4, true) + 8 > bytes.length) throw Error('Truncated WAV file');
    let offset = 12; let hasFormat = false; let hasData = false;
    while (offset + 8 <= bytes.length) {
      const size = view.getUint32(offset + 4, true);
      if (offset + 8 + size > bytes.length) throw Error('Truncated WAV chunk');
      if (ascii(offset, 4) === 'fmt ' && size >= 16) hasFormat = true;
      if (ascii(offset, 4) === 'data' && size > 0) hasData = true;
      offset += 8 + size + (size & 1);
    }
    if (!hasFormat || !hasData) throw Error('WAV file has no playable audio');
    return;
  }
  if (bytes.length < 4 || (ascii(0, 3) !== 'ID3' && !(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) throw Error('Invalid MP3 file');
  let frame = false;
  for (let index = 0; index < bytes.length - 3; index++) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0 && (bytes[index + 1] & 0x18) !== 0x08 && (bytes[index + 2] & 0xf0) !== 0xf0) { frame = true; break; }
  }
  if (!frame) throw Error('MP3 file has no audio frames');
}

export async function prepareMusicAsset(asset: MusicAsset): Promise<void> {
  const bytes = decodeMusicBytes(asset.data);
  validateMusicBytes(asset.format, bytes);
  if (asset.format === 'midi') return;
  const Context = Reflect.get(globalThis, 'AudioContext') as typeof AudioContext | undefined;
  if (!Context) throw Error('Browser audio decoding is unavailable');
  const context = new Context();
  try {
    const copy = Uint8Array.from(bytes);
    await context.decodeAudioData(copy.buffer);
  } catch {
    throw Error('Music file could not be decoded');
  } finally {
    await context.close();
  }
}

export function normalizeMusicPlus(value: unknown, dependencies: { id: string; version: string }[] = [], roomCount = 9): MusicPlusMap | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid Music+ map');
  const entries = Object.entries(value);
  if (entries.length && !dependencies.some(item => item.id === 'music-plus' && (item.version === '1.0.0' || item.version === '1.0.1' || item.version === '1.0.2' || item.version === '1.0.3'))) throw Error('Music+ gameplay dependency is required');
  const result: MusicPlusMap = {};
  let total = 0;
  for (const [key, raw] of entries) {
    if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= roomCount || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid Music+ room');
    const asset = raw as Record<string, unknown>;
    if (Object.keys(asset).some(field => field !== 'format' && field !== 'data') || typeof asset.data !== 'string' ||
        (asset.format !== 'midi' && asset.format !== 'mp3' && asset.format !== 'wav')) throw Error('Invalid music file');
    const bytes = decodeMusicBytes(asset.data);
    validateMusicBytes(asset.format, bytes);
    total += bytes.length;
    if (total > MAX_MUSIC_TOTAL_BYTES) throw Error('Music+ project exceeds 2 MB');
    result[key] = { format: asset.format, data: asset.data };
  }
  return entries.length ? result : undefined;
}

export function parseMusicMidi(bytes: Uint8Array): MusicMidiSequence {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length < 14 || ascii(0, 4) !== 'MThd' || view.getUint32(4) !== 6) throw Error('Invalid MIDI header');
  const format = view.getUint16(8), tracks = view.getUint16(10), division = view.getUint16(12);
  if (format > 1 || tracks < 1 || tracks > 64 || !division || (division & 0x8000)) throw Error('Unsupported MIDI file');
  let position = 14, lastTick = 0;
  const events: { tick: number; kind: 'on' | 'off' | 'tempo'; channel?: number; pitch?: number; value: number }[] = [];
  const variable = (end: number) => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      if (position >= end) throw Error('Truncated MIDI event');
      const byte = bytes[position++]; value = (value << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw Error('Invalid MIDI event length');
  };
  for (let track = 0; track < tracks; track++) {
    if (position + 8 > bytes.length || ascii(position, 4) !== 'MTrk') throw Error('Invalid MIDI track');
    const length = view.getUint32(position + 4); position += 8;
    const end = position + length;
    if (end > bytes.length) throw Error('Truncated MIDI track');
    let tick = 0, running = 0;
    while (position < end) {
      tick += variable(end); lastTick = Math.max(lastTick, tick);
      let status = bytes[position];
      if (status & 0x80) { position++; if (status < 0xf0) running = status; }
      else { status = running; if (!status) throw Error('Invalid MIDI running status'); }
      if (status === 0xff) {
        if (position >= end) throw Error('Truncated MIDI metadata');
        const kind = bytes[position++], size = variable(end);
        if (position + size > end) throw Error('Truncated MIDI metadata');
        if (kind === 0x51 && size === 3) events.push({ tick, kind: 'tempo', value: (bytes[position] << 16) | (bytes[position + 1] << 8) | bytes[position + 2] });
        position += size;
      } else if (status === 0xf0 || status === 0xf7) {
        position += variable(end);
        if (position > end) throw Error('Truncated MIDI sysex');
      } else if (status >= 0x80 && status < 0xf0) {
        const kind = status & 0xf0, count = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        if (position + count > end) throw Error('Truncated MIDI event');
        const pitch = bytes[position++], value = count === 2 ? bytes[position++] : 0;
        if (pitch > 127 || value > 127) throw Error('Invalid MIDI data');
        if (kind === 0x90 || kind === 0x80) events.push({ tick, kind: kind === 0x90 && value ? 'on' : 'off', channel: status & 15, pitch, value });
      } else throw Error('Unsupported MIDI event');
    }
  }
  events.push({ tick: lastTick, kind: 'tempo', value: 0 });
  events.sort((a, b) => a.tick - b.tick || (a.kind === 'tempo' ? -1 : b.kind === 'tempo' ? 1 : 0));
  let tick = 0, seconds = 0, tempo = 500000;
  const active = new Map<string, { start: number; velocity: number }>();
  const notes: MusicMidiNote[] = [];
  for (const event of events) {
    seconds += (event.tick - tick) * tempo / division / 1_000_000; tick = event.tick;
    if (event.kind === 'tempo') { if (event.value) tempo = event.value; continue; }
    const key = `${event.channel}:${event.pitch}`;
    if (event.kind === 'on') active.set(key, { start: seconds, velocity: event.value });
    else {
      const start = active.get(key);
      if (start && seconds > start.start) notes.push({ start: start.start, duration: seconds - start.start, pitch: event.pitch ?? 0, velocity: start.velocity });
      active.delete(key);
    }
  }
  if (!notes.length || !seconds) throw Error('MIDI has no complete notes');
  notes.sort((a, b) => a.start - b.start);
  return { notes, duration: seconds };
}
