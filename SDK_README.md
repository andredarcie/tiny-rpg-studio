# tiny-rpg-studio-sdk

SDK for creating RPG games and generating playable URLs for [Tiny RPG Studio](https://andredarcie.github.io/tiny-rpg-studio/).

```bash
npm install tiny-rpg-studio-sdk
```

## Usage

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

## API

### `new TinyRPG()` — game builder

All methods return `this` for chaining, except `room()`, `toSharePayload()`, `toShareCode()` and `buildURL()`.

| Method | Signature | Description |
|---|---|---|
| `setTitle` | `(title: string): this` | Sets the game title. Max 80 characters — throws if exceeded. |
| `setAuthor` | `(author: string): this` | Sets the author name. Max 60 characters — throws if exceeded. |
| `setPlayerStart` | `({ x, y, room }: { x: number; y: number; room: number }): this` | Sets the player's starting position. `x` and `y` must be integers in `[0, 7]`, `room` in `[0, 8]`. Throws otherwise. |
| `setPalette` | `(colors: string[]): this` | Sets a custom 16-color palette. Must be exactly 16 strings matching `#RRGGBB`. Throws otherwise. |
| `hideHUD` | `(hide?: boolean): this` | Hides the game HUD. Defaults to `true`. |
| `room` | `(index: number): RoomBuilder` | Returns the `RoomBuilder` for room `index`. `index` must be an integer in `[0, 8]`. Throws otherwise. Rooms are created lazily. |
| `toSharePayload` | `(): SdkSharePayload` | Returns the raw data object passed to the encoder. |
| `toShareCode` | `(): string` | Returns the encoded share hash string. |
| `buildURL` | `(baseUrl?: string): string` | Returns the full playable URL. Uses the official studio URL by default. |

---

### `room(i)` — `RoomBuilder`

All methods return `this` for chaining. Each call validates coordinates and types immediately — errors point to the exact call that caused them.

#### Tiles

| Method | Signature | Description |
|---|---|---|
| `ground` | `(matrix: number[][]): this` | Sets the ground tile layer. Must be an 8×8 matrix of integers. Throws if dimensions are wrong. |
| `overlay` | `(matrix: (number \| null)[][]): this` | Sets the overlay tile layer. Must be an 8×8 matrix of integers or `null`. Throws if dimensions are wrong. |

#### Entities

| Method | Signature | Description |
|---|---|---|
| `addEnemy` | `({ type: EnemyType; x: number; y: number }): this` | Adds an enemy at position `(x, y)`. Max 9 enemies per room. Throws if type is invalid, coordinates are out of range, or room is full. |
| `addNPC` | `({ type: NpcType; x: number; y: number; text?: string }): this` | Adds an NPC at position `(x, y)` with optional dialog text. Throws if type is invalid or coordinates are out of range. |

#### Items (unique per room — throws if called twice for the same type)

| Method | Signature | Description |
|---|---|---|
| `addKey` | `({ x: number; y: number }): this` | Places a key at `(x, y)`. |
| `addDoor` | `({ x: number; y: number }): this` | Places a door at `(x, y)`. Requires a key to open. |
| `addPotion` | `({ x: number; y: number }): this` | Places a life potion at `(x, y)`. |
| `addSword` | `({ x: number; y: number; tier?: 'wood' \| 'bronze' \| 'iron' }): this` | Places a sword at `(x, y)`. `tier` defaults to `'iron'`. Each tier counts as a separate unique item. |
| `addEnd` | `({ x: number; y: number; message?: string }): this` | Places the game-ending tile at `(x, y)` with an optional victory message. |

---

## Types

### `EnemyType`

```ts
'giant-rat' | 'bandit' | 'skeleton' | 'dark-knight' |
'necromancer' | 'dragon' | 'fallen-king' | 'ancient-demon'
```

### `NpcType`

```ts
// Human variants
'old-mage' | 'villager-man' | 'villager-woman' | 'child' |
'king' | 'knight' | 'thief' | 'blacksmith' |

// Elf variants
'old-mage-elf' | 'villager-man-elf' | 'villager-woman-elf' | 'child-elf' |
'king-elf' | 'knight-elf' | 'thief-elf' | 'blacksmith-elf' |

// Dwarf variants
'old-mage-dwarf' | 'villager-man-dwarf' | 'villager-woman-dwarf' | 'child-dwarf' |
'king-dwarf' | 'knight-dwarf' | 'thief-dwarf' | 'blacksmith-dwarf' |

// Fixed
'thought-bubble' | 'wooden-sign'
```

### `SdkSharePayload`

```ts
type SdkSharePayload = {
  title?: string;
  author?: string;
  hideHud?: boolean;
  start?: { x: number; y: number; roomIndex: number };
  enemies?: { type: string; x: number; y: number; roomIndex: number }[];
  sprites?: { type: string; x: number; y: number; roomIndex: number; text: string; placed: boolean }[];
  objects?: SdkObject[];
  tileset?: { maps: Array<{ ground?: number[][]; overlay?: (number | null)[][] }> };
  customPalette?: string[];
};
```

---

## Links

- [Play online](https://andredarcie.github.io/tiny-rpg-studio/)
- [Repository](https://github.com/andredarcie/tiny-rpg-studio)
- [Examples](https://github.com/andredarcie/tiny-rpg-studio/tree/main/examples/hello-world)
