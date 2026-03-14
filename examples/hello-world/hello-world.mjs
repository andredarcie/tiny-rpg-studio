/**
 * tiny-rpg-studio-sdk — Hello World
 *
 * Run:  node hello-world.mjs
 *
 * This creates a minimal 2-room RPG:
 *   Room 0 — starting room with a skeleton guard and a key
 *   Room 8 — final room with a locked door and a victory screen
 *
 * Open the printed URL in the browser to play it instantly.
 */

import { TinyRPG } from 'tiny-rpg-studio-sdk';

// ─── World layout ───────────────────────────────────────────────────────────
// 8x8 tile grid: 1 = wall, 0 = floor
const WALLS_ONLY = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

// ─── Build the game ─────────────────────────────────────────────────────────
const game = new TinyRPG()
  .setTitle('Hello World RPG')
  .setAuthor('SDK Example')
  .setPlayerStart({ x: 1, y: 1, room: 0 });

// Room 0 — starting room
game.room(0)
  .ground(WALLS_ONLY)
  .addNPC({ type: 'villager-man', x: 2, y: 2, text: 'Welcome! Grab the key and reach the end.' })
  .addEnemy({ type: 'skeleton', x: 5, y: 5 })
  .addKey({ x: 6, y: 6 });

// Room 8 (last room) — final room with victory screen
game.room(8)
  .ground(WALLS_ONLY)
  .addDoor({ x: 1, y: 4 })
  .addEnd({ x: 6, y: 4, message: 'Congratulations! You completed the Hello World RPG!' });

// ─── Output ─────────────────────────────────────────────────────────────────
const url = game.buildURL();

console.log('\n🎮 tiny-rpg-studio-sdk — Hello World\n');
console.log('Open the URL below in a browser to play:\n');
console.log(url);
console.log('\n');

// Also print a short payload summary
const payload = game.toSharePayload();
console.log('── Payload summary ──────────────────────────────────────');
console.log(`Title  : ${payload.title}`);
console.log(`Author : ${payload.author}`);
const nonEmptyRooms = payload.tileset?.maps.filter(m => Object.keys(m).length > 0).length ?? 0;
console.log(`Rooms  : ${payload.tileset?.maps.length} total, ${nonEmptyRooms} with content`);
console.log(`Enemies: ${payload.enemies?.length}`);
console.log(`NPCs   : ${payload.sprites?.length}`);
console.log(`Objects: ${payload.objects?.length} (${payload.objects?.map(o => o.type).join(', ')})`);
console.log('─────────────────────────────────────────────────────────\n');
