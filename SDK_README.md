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
// https://andredarcie.github.io/tiny-rpg-studio/#<code>
```

The playable URL always has the form `<base>#<code>`, where `<base>` defaults to
`https://andredarcie.github.io/tiny-rpg-studio/` and `<code>` is the encoded share string.

---

## API

### `new TinyRPG()` — game builder

All methods return `this` for chaining, except `variable()`, `room()`, `toSharePayload()`, `toShareCode()` and `buildURL()`.

| Method | Signature | Description |
|---|---|---|
| `setTitle` | `(title: string): this` | Sets the game title. Max 80 characters — throws if exceeded. |
| `setAuthor` | `(author: string): this` | Sets the author name. Max 60 characters — throws if exceeded. |
| `setPlayerStart` | `({ x, y, room }: { x: number; y: number; room: number }): this` | Sets the player's starting position. `x` and `y` must be integers in `[0, 7]`, `room` in `[0, 8]`. Throws otherwise. |
| `setPalette` | `(colors: string[]): this` | Sets a custom 16-color palette. Must be exactly 16 strings matching `#RRGGBB`. Throws otherwise. |
| `hideHUD` | `(hide?: boolean): this` | Hides the game HUD. Defaults to `true`. |
| `disableSkills` | `(disable?: boolean): this` | Disables the in-game skill / level-up system. Defaults to `true`. |
| `disablePixelFont` | `(disable?: boolean): this` | Renders text with the system font instead of the bitmap pixel font. Defaults to `true`. |
| `setBackgroundMusic` | `(videoIdOrUrl: string, volume?: number): this` | Sets looping background music from a YouTube video id or URL. `volume` is an integer in `[0, 100]` (default 100). Throws on an invalid id/URL or out-of-range volume. |
| `setSkillOrder` | `(ids: string[]): this` | Sets the order skills are offered in on level-up. Validates each id against the known skill list — throws on unknown ids. |
| `enableOnline` | `(config?: { spawnPoints?: Array<{ x: number; y: number; roomIndex: number }> }): this` | Enables online multiplayer with optional spawn points. |
| `variable` | `(name?: string, opts?: { initial?: boolean }): VariableRef` | Allocates the next boolean variable slot (`var-1`..`var-16`) and returns a handle. `name` is an authoring label only. Set `initial: true` to start it ON. Throws after `MAX_VARIABLES` (16) allocations. |
| `defineSprite` | `(opts: { group; key; variant?; frames }): this` | Defines custom pixel art that overrides a built-in sprite or adds a new one. See [Custom sprites](#custom-sprites). |
| `room` | `(index: number): RoomBuilder` | Returns the `RoomBuilder` for room `index`. `index` must be an integer in `[0, 8]`. Throws otherwise. Rooms are created lazily and cached. |
| `toSharePayload` | `(): SdkSharePayload` | Returns the raw data object passed to the encoder. |
| `toShareCode` | `(): string` | Returns the encoded share hash string. |
| `buildURL` | `(baseUrl?: string): string` | Returns the full playable URL `<base>#<code>`. Uses the official studio URL by default. |

---

### Variables

The share format addresses up to **16 boolean variables** (`var-1` .. `var-16`). Switches,
logic gates, variable-doors, LEDs, traps, pressure-plates, NPCs and enemies all reference
these by id. Instead of typing raw `var-N` strings, allocate handles with `game.variable()`:

```js
import { TinyRPG, MAX_VARIABLES } from 'tiny-rpg-studio-sdk';

const game = new TinyRPG();
const open = game.variable('door open');         // var-1
const lit  = game.variable('lamp', { initial: true }); // var-2, starts ON
```

`game.variable(name?, { initial? })` returns a `VariableRef`:

```ts
type VariableRef = {
  readonly id: string;    // encoded id, e.g. 'var-1'
  readonly index: number; // 1-based slot index (1..16)
  readonly name?: string; // optional authoring label (not encoded)
};
```

Every method that takes a variable accepts **`VariableRef | number`** — you may pass the
handle returned by `variable()` or a 1-based slot index `1..16` directly. `MAX_VARIABLES`
is exported as a constant (`16`); allocating a 17th variable throws.

---

### `room(i)` — `RoomBuilder`

All methods return `this` for chaining. Each call validates coordinates and types
immediately — errors point to the exact call that caused them. No two objects may occupy
the same tile (placing a second object on an occupied tile throws).

#### Tiles

| Method | Signature | Description |
|---|---|---|
| `ground` | `(matrix: number[][]): this` | Sets the ground tile layer. Must be an 8×8 matrix of integers. Throws if dimensions are wrong. |
| `overlay` | `(matrix: (number \| null)[][]): this` | Sets the overlay tile layer. Must be an 8×8 matrix of integers or `null`. Throws if dimensions are wrong. |

#### Entities

| Method | Signature | Description |
|---|---|---|
| `addEnemy` | `({ type: EnemyType; x; y; defeatVariable? }): this` | Adds an enemy at `(x, y)`. Max 9 enemies per room. `defeatVariable` (`VariableRef \| number`) is set ON when the enemy is defeated. Throws on invalid type, out-of-range coordinates, or a full room. |
| `addNPC` | `({ type: NpcType; x; y; text?; conditionVariable?; conditionText?; rewardVariable?; conditionalRewardVariable?; choice? }): this` | Adds an NPC at `(x, y)` with optional dialog. When `conditionVariable` is ON the NPC shows `conditionText`. Reward fields set variables after dialog. `choice` adds a definitive one-time Yes/No prompt with branch text and optional `yesVariable` / `noVariable` rewards. Variable fields accept `VariableRef \| number`. |

An NPC choice is answered once per playthrough. The selected branch displays its
own response text and can optionally turn on a variable:

```js
const accepted = game.variable('accepted');
const refused = game.variable('refused');

game.room(0).addNPC({
  type: 'old-mage',
  x: 3,
  y: 3,
  text: 'There is one decision left.',
  choice: {
    prompt: 'Restart the clock?',
    yesText: 'Then the city lives.',
    noText: 'Then let it finally stop.',
    yesVariable: accepted,
    noVariable: refused,
  },
});
```

`prompt`, `yesText`, and `noText` are required when `choice` is present.
`yesVariable` and `noVariable` are optional and accept either a `VariableRef` or
a 1-based variable slot number.

#### Collectibles & equipment — unique per room

These throw if called twice for the same item type in one room.

| Method | Signature | Description |
|---|---|---|
| `addKey` | `({ x; y }): this` | Places a key at `(x, y)`. |
| `addDoor` | `({ x; y }): this` | Places a key-locked door at `(x, y)`. |
| `addPotion` | `({ x; y }): this` | Places a life potion at `(x, y)`. |
| `addXpScroll` | `({ x; y }): this` | Places an XP scroll at `(x, y)`. |
| `addSword` | `({ x; y; tier?: 'wood' \| 'bronze' \| 'iron' }): this` | Places a sword at `(x, y)`. `tier` defaults to `'iron'`. Each tier maps to a distinct item (`sword`, `sword-bronze`, `sword-wood`) and counts as its own unique type. |

#### Equipment & objects — multiple per room

| Method | Signature | Description |
|---|---|---|
| `addArmor` | `({ x; y }): this` | Places armor at `(x, y)`. |
| `addBoots` | `({ x; y }): this` | Places boots at `(x, y)`. |
| `addPushBox` | `({ x; y }): this` | Places a pushable box at `(x, y)`. |

#### Logic & variable-driven objects — multiple per room (except where noted)

| Method | Signature | Description |
|---|---|---|
| `addSwitch` | `({ x; y; variable: VariableRef \| number; on? }): this` | Lever the player toggles by stepping on it; flips `variable`. `on` sets its starting state (default `false`). Multiple allowed per room. |
| `addVariableDoor` | `({ x; y; variable: VariableRef \| number }): this` | Door that stays locked until `variable` is ON. **One per room** — throws on a second call. |
| `addLed` | `({ x; y; variable: VariableRef \| number }): this` | Indicator lamp that lights up while `variable` is ON. |
| `addTrap` | `({ x; y; variable?: VariableRef \| number }): this` | Spikes that hurt the player. Active unless the optional `variable` is ON. |
| `addPressurePlate` | `({ x; y; variable: VariableRef \| number }): this` | Floor plate that holds `variable` ON while a player or push-box rests on it. |
| `addLogicGate` | `({ type: LogicGateType; x; y; inputA?; inputB?; output; hidden? }): this` | Logic gate that writes `output = gate(inputA, inputB)` whenever an input changes. `not` uses only `inputA`. `hidden: true` hides it in-game (still active) while keeping it visible in the editor. Inputs/output accept `VariableRef \| number`. |
| `addChest` | `({ x; y; contains?: ChestItemType; random? }): this` | Chest revealing a fixed item (`contains`) or a random one (`random: true`). Throws if neither is supplied, or on an unknown item. |

#### Goal — unique per room

| Method | Signature | Description |
|---|---|---|
| `addEnd` | `({ x; y; message? }): this` | Places the game-ending tile at `(x, y)` with an optional victory message. **One per room** — throws on a second call. |

---

### Custom sprites

`game.defineSprite(opts)` defines custom pixel art. When `group` + `key` match a built-in
sprite (e.g. group `'enemy'`, key `'skeleton'`) it overrides that sprite; otherwise it adds
a brand-new one. Each frame is a matrix of palette indices (`0`–`15`) or `null`
(transparent); supplying multiple frames animates the sprite.

```js
game.defineSprite({
  group: 'enemy',     // 'tile' | 'npc' | 'enemy' | 'object' | 'player'
  key: 'skeleton',    // built-in key to override, or a new key
  variant: 'base',    // optional: 'base' (default art) | 'on' (activated state)
  frames: [
    // each frame is a rectangular matrix of 0..15 or null
    [/* ...8×8 rows of palette indices... */],
  ],
});
```

| Option | Type | Notes |
|---|---|---|
| `group` | `'tile' \| 'npc' \| 'enemy' \| 'object' \| 'player'` | Required. Throws on an unknown group. |
| `key` | `string` | Required, non-empty. |
| `variant` | `'base' \| 'on'` | Optional. `'base'` is the default art, `'on'` the activated state. |
| `frames` | `(number \| null)[][][]` | Required, at least one frame. Each frame must be a non-empty rectangular matrix; every pixel is an integer in `[0, 15]` or `null`. Throws on empty frames, ragged matrices, or out-of-range values. |

---

### Logic-gate puzzle example

A complete, runnable example: two switches feed an `AND` gate. The gate's output drives a
status LED and unlocks a variable-door — the door opens only when **both** switches are ON.

```js
import { TinyRPG } from 'tiny-rpg-studio-sdk';

const game = new TinyRPG()
  .setTitle('AND Gate Puzzle')
  .setAuthor('You')
  .setPlayerStart({ x: 1, y: 4, room: 0 });

// Allocate the wiring.
const a    = game.variable('switch A');
const b    = game.variable('switch B');
const open = game.variable('door open');

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
  // Two switches the player toggles.
  .addSwitch({ x: 2, y: 2, variable: a })
  .addSwitch({ x: 2, y: 5, variable: b })
  // open = a AND b, recomputed whenever a or b changes.
  .addLogicGate({ type: 'and', x: 4, y: 3, inputA: a, inputB: b, output: open, hidden: true })
  // Lamp that lights while the door is unlocked.
  .addLed({ x: 5, y: 3, variable: open })
  // Door that stays locked until `open` is ON.
  .addVariableDoor({ x: 6, y: 3, variable: open });

game.room(0).addEnd({ x: 6, y: 4, message: 'Both switches flipped — you escaped!' });

const url = game.buildURL();
// https://andredarcie.github.io/tiny-rpg-studio/#<code>
console.log(url);
```

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

### `SwordTier`

```ts
'wood' | 'bronze' | 'iron'
```

### `LogicGateType`

```ts
'not' | 'and' | 'or' | 'nand' | 'nor'
```

### `ChestItemType`

```ts
'key' | 'life-potion' | 'xp-scroll' |
'sword' | 'sword-bronze' | 'sword-wood' |
'armor' | 'boots'
```

### `VariableRef`

```ts
type VariableRef = {
  readonly id: string;    // encoded id, e.g. 'var-1'
  readonly index: number; // 1-based slot index (1..16)
  readonly name?: string; // optional authoring label (not encoded)
};
```

### `SdkSharePayload`

```ts
type SdkSharePayload = {
  title?: string;
  author?: string;
  hideHud?: boolean;
  disableSkills?: boolean;
  disablePixelFont?: boolean;
  backgroundMusicVideoId?: string;
  backgroundMusicVolume?: number;
  skillOrder?: string[];
  online?: { enabled: boolean; spawnPoints?: Array<{ x: number; y: number; roomIndex: number }> };
  start?: { x: number; y: number; roomIndex: number };
  sprites?: SdkSprite[];
  enemies?: SdkEnemy[];
  objects?: SdkObject[];
  variables?: { id: string; value: boolean; name?: string }[];
  customSprites?: SdkCustomSprite[];
  tileset?: { maps: Array<{ ground?: number[][]; overlay?: (number | null)[][] }> };
  customPalette?: string[];
};
```

---

## Links

- [Play online](https://andredarcie.github.io/tiny-rpg-studio/)
- [Repository](https://github.com/andredarcie/tiny-rpg-studio)
- [Examples](https://github.com/andredarcie/tiny-rpg-studio/tree/main/examples/hello-world)
