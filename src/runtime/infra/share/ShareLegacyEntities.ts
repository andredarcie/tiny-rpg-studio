import { GameConfig } from '../../../config/GameConfig';

type Entry = Record<string, unknown>;
const roomCount = GameConfig.world.rows * GameConfig.world.cols;
const roomSize = GameConfig.world.roomSize;
const bounded = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < max;
const position = (entry: Entry, prefix = '') => prefix
  ? bounded(entry.targetRoomIndex, roomCount) && bounded(entry.targetX, roomSize) && bounded(entry.targetY, roomSize)
  : bounded(entry.roomIndex, roomCount) && bounded(entry.x, roomSize) && bounded(entry.y, roomSize);

/** Legacy dialogue pickups and explicit room links are separate from inventory objects. */
export function normalizeLegacyEntities(value: unknown, kind: 'items' | 'exits'): Entry[] {
  if (!Array.isArray(value)) return [];
  const entries: Entry[] = [];
  const counts = new Map<unknown, number>();
  for (const raw of value.slice(0, roomCount * roomSize * roomSize)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Entry;
    if (!position(source) || (kind === 'exits' && !position(source, 'target'))) continue;
    const count = counts.get(source.roomIndex) ?? 0;
    if (count >= roomSize * roomSize) continue;
    counts.set(source.roomIndex, count + 1);
    const entry: Entry = { roomIndex: source.roomIndex, x: source.x, y: source.y };
    if (kind === 'exits') Object.assign(entry, { targetRoomIndex: source.targetRoomIndex, targetX: source.targetX, targetY: source.targetY });
    else {
      if (typeof source.type === 'string') entry.type = source.type.slice(0, 80);
      if (typeof source.id === 'string') entry.id = source.id.slice(0, 80);
      if (typeof source.text === 'string') entry.text = source.text.slice(0, 4096);
      entry.collected = false;
    }
    entries.push(entry);
  }
  return entries;
}
