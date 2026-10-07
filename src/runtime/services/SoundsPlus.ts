export const SOUND_NAMES = [
  'playerAttack', 'playerHit', 'playerDeath', 'enemyHit', 'enemyDeath',
  'itemPickup', 'levelUp', 'miss', 'backstab', 'roomTransition', 'dialog',
  'switchToggle', 'doorUnlock', 'magicGateOpen', 'victory', 'gameStart',
  'skillPick', 'typewriter',
] as const;

export type SoundName = typeof SOUND_NAMES[number];
export type SoundOverride = { format: 'mp3' | 'wav' | 'midi'; data: string };
export type SoundsPlusMap = Partial<Record<SoundName, SoundOverride>>;

const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

export function decodeSoundBytes(data: string): Uint8Array {
  if (!data || data.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw Error('Invalid sound file data');
  }
  let binary: string;
  try { binary = atob(data); } catch { throw Error('Invalid sound file data'); }
  if (!binary.length || binary.length > MAX_FILE_BYTES || btoa(binary) !== data) throw Error('Sound file is too large or malformed');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function soundBytesToBase64(bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw Error('Sound file is empty or exceeds 256 KB');
  let result = '';
  for (let index = 0; index < bytes.length; index += 8192) result += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(result);
}

export function validateSoundBytes(format: SoundOverride['format'], bytes: Uint8Array): void {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (format === 'wav') {
    if (bytes.length < 44 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') throw Error('Invalid WAV file');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(4, true) + 8 > bytes.length) throw Error('Truncated WAV file');
    let offset = 12;
    let hasFormat = false;
    let hasData = false;
    while (offset + 8 <= bytes.length) {
      const size = view.getUint32(offset + 4, true);
      if (offset + 8 + size > bytes.length) throw Error('Truncated WAV chunk');
      if (ascii(offset, 4) === 'fmt ' && size >= 16) hasFormat = true;
      if (ascii(offset, 4) === 'data' && size > 0) hasData = true;
      offset += 8 + size + (size & 1);
    }
    if (!hasFormat || !hasData) throw Error('WAV file has no playable audio');
  } else if (format === 'mp3') {
    if (bytes.length < 4 || (ascii(0, 3) !== 'ID3' && !(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) throw Error('Invalid MP3 file');
    let frame = false;
    for (let index = 0; index < bytes.length - 3; index++) {
      if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0 && (bytes[index + 1] & 0x18) !== 0x08 && (bytes[index + 2] & 0xf0) !== 0xf0) { frame = true; break; }
    }
    if (!frame) throw Error('MP3 file has no audio frames');
  } else {
    parseMidi(bytes);
  }
}

export function normalizeSoundsPlus(value: unknown, dependencies: { id: string; version: string }[] = []): SoundsPlusMap | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid Sounds+ map');
  const entries = Object.entries(value);
  if (entries.length && !dependencies.some(item => item.id === 'sounds-plus' && item.version === '1.0.0')) throw Error('Sounds+ gameplay dependency is required');
  const result: SoundsPlusMap = {};
  let total = 0;
  for (const [name, raw] of entries) {
    if (!SOUND_NAMES.includes(name as SoundName) || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid Sounds+ effect');
    const asset = raw as Record<string, unknown>;
    if (Object.keys(asset).some(key => key !== 'format' && key !== 'data') || typeof asset.data !== 'string') throw Error('Invalid sound file');
    const format = asset.format;
    if (format !== 'midi' && format !== 'mp3' && format !== 'wav') throw Error('Unsupported sound format');
    const bytes = decodeSoundBytes(asset.data);
    validateSoundBytes(format, bytes);
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw Error('Sounds+ project exceeds 1 MB');
    result[name as SoundName] = { format, data: asset.data };
  }
  return entries.length ? result : undefined;
}

export type MidiNote = { start: number; duration: number; pitch: number; velocity: number };

export function parseMidi(bytes: Uint8Array): MidiNote[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length < 14 || ascii(0, 4) !== 'MThd' || view.getUint32(4) !== 6) throw Error('Invalid MIDI header');
  const format = view.getUint16(8);
  const tracks = view.getUint16(10);
  const division = view.getUint16(12);
  if (format > 1 || tracks < 1 || tracks > 32 || !division || division & 0x8000) throw Error('Unsupported MIDI file');
  let position = 14;
  const events: { tick: number; kind: 'on' | 'off' | 'tempo'; channel?: number; pitch?: number; value: number }[] = [];
  const variable = (end: number): number => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      if (position >= end) throw Error('Truncated MIDI event');
      const byte = bytes[position++];
      value = (value << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw Error('Invalid MIDI event length');
  };
  for (let track = 0; track < tracks; track++) {
    if (position + 8 > bytes.length || ascii(position, 4) !== 'MTrk') throw Error('Invalid MIDI track');
    const length = view.getUint32(position + 4);
    position += 8;
    const end = position + length;
    if (end > bytes.length) throw Error('Truncated MIDI track');
    let tick = 0;
    let running = 0;
    while (position < end) {
      tick += variable(end);
      let status = bytes[position];
      if (status & 0x80) { position++; if (status < 0xf0) running = status; }
      else { status = running; if (!status) throw Error('Invalid MIDI running status'); }
      if (status === 0xff) {
        if (position >= end) throw Error('Truncated MIDI metadata');
        const kind = bytes[position++];
        const size = variable(end);
        if (position + size > end) throw Error('Truncated MIDI metadata');
        if (kind === 0x51 && size === 3) events.push({ tick, kind: 'tempo', value: (bytes[position] << 16) | (bytes[position + 1] << 8) | bytes[position + 2] });
        position += size;
      } else if (status === 0xf0 || status === 0xf7) {
        const size = variable(end);
        position += size;
        if (position > end) throw Error('Truncated MIDI sysex');
      } else if (status >= 0x80 && status < 0xf0) {
        const kind = status & 0xf0;
        const count = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        if (position + count > end) throw Error('Truncated MIDI note');
        const pitch = bytes[position++];
        const value = count === 2 ? bytes[position++] : 0;
        if (pitch > 127 || value > 127) throw Error('Invalid MIDI data');
        if (kind === 0x90 || kind === 0x80) events.push({ tick, kind: kind === 0x90 && value ? 'on' : 'off', channel: status & 15, pitch, value });
      } else throw Error('Unsupported MIDI event');
    }
  }
  events.sort((a, b) => a.tick - b.tick || (a.kind === 'tempo' ? -1 : b.kind === 'tempo' ? 1 : 0));
  let tick = 0;
  let seconds = 0;
  let tempo = 500000;
  const active = new Map<string, { start: number; velocity: number }>();
  const notes: MidiNote[] = [];
  for (const event of events) {
    seconds += (event.tick - tick) * tempo / division / 1_000_000;
    tick = event.tick;
    if (event.kind === 'tempo') { if (event.value > 0) tempo = event.value; continue; }
    const key = `${event.channel}:${event.pitch}`;
    if (event.kind === 'on') active.set(key, { start: seconds, velocity: event.value });
    else {
      const start = active.get(key);
      if (start && seconds > start.start && start.start < 15) notes.push({ start: start.start, duration: Math.min(seconds - start.start, 15 - start.start), pitch: event.pitch ?? 0, velocity: start.velocity });
      active.delete(key);
    }
    if (notes.length >= 256) break;
  }
  if (!notes.length) throw Error('MIDI has no complete notes');
  return notes;
}
