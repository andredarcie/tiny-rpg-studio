# tiny-rpg-studio-sdk — Hello World

Example usage of the SDK to create RPG games and generate playable URLs.

## Setup

```bash
cd examples/hello-world
npm install
```

> **Note:** `npm install` uses `file:../..` pointing to the local package.
> Make sure to build the SDK first:
>
> ```bash
> # From the repository root
> npm run build:sdk
> ```

---

## Available examples

### Hello World (`hello-world.mjs`)

Minimal example: 2 rooms, 1 enemy, 1 NPC, a key and a game-ending tile.

```bash
node hello-world.mjs
```

### Advanced (`advanced.mjs`)

Demonstrates all SDK features:
- Custom color palette
- 6 rooms with different enemy types
- NPCs with dialog
- All item types (key, door, potion, all sword tiers, game end)

```bash
node advanced.mjs
```

---

## How it works

```js
import { TinyRPG } from 'tiny-rpg-studio-sdk';

const game = new TinyRPG()
  .setTitle('My RPG')
  .setAuthor('You')
  .setPlayerStart({ x: 1, y: 1, room: 0 });

game.room(0)
  .ground([
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ])
  .addEnemy({ type: 'skeleton', x: 3, y: 3 })
  .addNPC({ type: 'villager-man', x: 2, y: 2, text: 'Hello!' })
  .addKey({ x: 6, y: 6 });

game.room(8)
  .addEnd({ x: 4, y: 4, message: 'You won!' });

const url = game.buildURL();
// https://andredarcie.github.io/tiny-rpg-studio/#v25.g...
```

---

## API reference

### `new TinyRPG()`

| Method | Description |
|---|---|
| `.setTitle(text)` | Game title (max 80 chars) |
| `.setAuthor(text)` | Author name (max 60 chars) |
| `.setPlayerStart({ x, y, room })` | Player starting position |
| `.setPalette(colors)` | 16 colors in `#RRGGBB` format |
| `.hideHUD()` | Hide the game UI |
| `.room(index)` | Returns the `RoomBuilder` for room `index` (0–8) |
| `.buildURL()` | Generates the full playable URL |
| `.toShareCode()` | Returns only the hash code |
| `.toSharePayload()` | Returns the raw data object |

### `room(i)` — `RoomBuilder`

| Method | Description |
|---|---|
| `.ground(matrix)` | 8×8 ground tile matrix |
| `.overlay(matrix)` | 8×8 overlay tile matrix |
| `.addEnemy({ type, x, y })` | Add an enemy (max 9 per room) |
| `.addNPC({ type, x, y, text? })` | Add an NPC with optional dialog |
| `.addKey({ x, y })` | Add a key (unique per room) |
| `.addDoor({ x, y })` | Add a door (unique per room) |
| `.addPotion({ x, y })` | Add a life potion (unique per room) |
| `.addSword({ x, y, tier? })` | `'wood'`, `'bronze'`, or `'iron'` (default) |
| `.addEnd({ x, y, message? })` | Add a game-ending tile (unique per room) |

### Enemy types (`EnemyType`)
`giant-rat` · `bandit` · `skeleton` · `dark-knight` · `necromancer` · `dragon` · `fallen-king` · `ancient-demon`

### NPC types (`NpcType`)
`old-mage` · `villager-man` · `villager-woman` · `child` · `king` · `knight` · `thief` · `blacksmith`
+ `-elf` and `-dwarf` variants for each of the above
+ `thought-bubble` · `wooden-sign`
