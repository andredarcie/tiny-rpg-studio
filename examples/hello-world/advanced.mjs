/**
 * tiny-rpg-studio-sdk — Advanced Example
 *
 * Run:  node advanced.mjs
 *
 * Demonstrates all SDK features:
 *   - Custom palette
 *   - Multiple rooms with enemies of different types
 *   - NPCs with dialog
 *   - All item types (key, door, potion, sword tiers, end)
 *   - hideHUD mode
 */

import { TinyRPG } from 'tiny-rpg-studio-sdk';

// ─── Tile patterns ──────────────────────────────────────────────────────────
const OPEN_ROOM = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

const THRONE_ROOM = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 1, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 0, 0, 0, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

// ─── Custom dark palette ────────────────────────────────────────────────────
const DARK_PALETTE = [
  '#000000', '#1a1a2e', '#16213e', '#0f3460',
  '#533483', '#e94560', '#f5a623', '#f7f7f7',
  '#a8dadc', '#457b9d', '#1d3557', '#e63946',
  '#2a9d8f', '#e9c46a', '#f4a261', '#264653',
];

// ─── Build the game ─────────────────────────────────────────────────────────
const game = new TinyRPG()
  .setTitle('A Dungeon of Many Secrets')
  .setAuthor('SDK Advanced Example')
  .setPalette(DARK_PALETTE)
  .setPlayerStart({ x: 3, y: 3, room: 0 });

// Room 0 — Village entrance
game.room(0)
  .ground(OPEN_ROOM)
  .addNPC({ type: 'old-mage', x: 2, y: 2, text: 'A dungeon lies ahead. Take this sword and be careful!' })
  .addNPC({ type: 'villager-woman', x: 5, y: 2, text: 'I heard the dragon hoards the final key...' })
  .addSword({ x: 4, y: 4, tier: 'wood' });

// Room 1 — Forest path with bandits
game.room(1)
  .ground(OPEN_ROOM)
  .addEnemy({ type: 'bandit', x: 2, y: 3 })
  .addEnemy({ type: 'bandit', x: 5, y: 3 })
  .addEnemy({ type: 'giant-rat', x: 3, y: 5 })
  .addPotion({ x: 6, y: 6 });

// Room 2 — Dungeon entrance
game.room(2)
  .ground(OPEN_ROOM)
  .addNPC({ type: 'knight', x: 1, y: 1, text: 'The dark knight guards the bronze sword. Be ready.' })
  .addEnemy({ type: 'dark-knight', x: 4, y: 4 })
  .addSword({ x: 6, y: 2, tier: 'bronze' })
  .addKey({ x: 1, y: 6 });

// Room 3 — Crypt
game.room(3)
  .ground(OPEN_ROOM)
  .addEnemy({ type: 'skeleton', x: 2, y: 2 })
  .addEnemy({ type: 'skeleton', x: 4, y: 2 })
  .addEnemy({ type: 'skeleton', x: 6, y: 2 })
  .addEnemy({ type: 'necromancer', x: 3, y: 5 })
  .addDoor({ x: 6, y: 6 });

// Room 4 — Boss chamber
game.room(4)
  .ground(THRONE_ROOM)
  .addNPC({ type: 'king', x: 3, y: 1, text: 'I am the Fallen King! You shall not pass!' })
  .addEnemy({ type: 'fallen-king', x: 3, y: 2 })
  .addSword({ x: 1, y: 6, tier: 'iron' });

// Room 8 — Victory room (last room index)
game.room(8)
  .ground(OPEN_ROOM)
  .addNPC({ type: 'old-mage-elf', x: 3, y: 3, text: 'You have done it, hero. The realm is saved!' })
  .addEnd({ x: 4, y: 4, message: 'You conquered the dungeon!\n\nThank you for playing.' });

// ─── Output ─────────────────────────────────────────────────────────────────
const url = game.buildURL();
const payload = game.toSharePayload();

console.log('\n🎮 tiny-rpg-studio-sdk — Advanced Example\n');
console.log('Open the URL below in a browser to play:\n');
console.log(url);
console.log('\n');

console.log('── Payload summary ──────────────────────────────────────');
console.log(`Title    : ${payload.title}`);
console.log(`Author   : ${payload.author}`);
const nonEmptyRooms = payload.tileset?.maps.filter(m => Object.keys(m).length > 0).length ?? 0;
console.log(`Rooms    : ${payload.tileset?.maps.length} total, ${nonEmptyRooms} with content`);
console.log(`Enemies  : ${payload.enemies?.length} (${[...new Set(payload.enemies?.map(e => e.type))].join(', ')})`);
console.log(`NPCs     : ${payload.sprites?.length}`);
console.log(`Objects  : ${payload.objects?.length} (${payload.objects?.map(o => o.type).join(', ')})`);
console.log(`Share ID : ${url.split('#')[1]?.slice(0, 20)}...`);
console.log('─────────────────────────────────────────────────────────\n');
