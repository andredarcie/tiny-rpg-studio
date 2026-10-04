# Tiny RPG Studio SDK 2

Create base-engine games, load and edit projects, generate share links, export standalone HTML, and embed the browser runtime. Importing the builder or HTML helper in Node does not start an engine or require browser globals.

## Build a game

```js
import { TinyRPG, getBaseCapabilities } from 'tiny-rpg-studio-sdk';

const game = new TinyRPG().setTitle('Tiny Adventure').setAuthor('You')
  .setPlayerStart({ x: 1, y: 1, room: 0 }).enableEffects(true);
const door = game.variable('Open door', { initial: false });
game.room(0)
  .addSwitch({ x: 2, y: 2, variable: door })
  .addVariableDoor({ x: 3, y: 2, variable: door })
  .addXpScroll({ x: 4, y: 2, experience: 0 })
  .addNPC({ type: 'old-mage', name: 'Merlin', x: 5, y: 2, text: 'Farewell!',
    disappearAfterDialog: true, rewardVariable: 'END_GAME' });
console.log(game.buildURL());
console.log(getBaseCapabilities());
```

Builder methods chain except `room`, `variable`, `createTileEffect`, and output methods. Inputs and output snapshots are copied. Validation failures leave authoring data unchanged. Art overrides do not introduce enemy or NPC behaviors.

## Load and edit

```js
const loaded = TinyRPG.fromProjectData(game.toProjectData());
const fromLink = TinyRPG.fromShareCode(game.toShareCode());
const object = loaded.toProjectData().objects[0];
loaded.room(object.roomIndex).updateEntity('objects', object.id, { x: 6 });
loaded.room(0).setCell('overlay', 2, 3, null);
loaded.setVariableDefault(1, true, 'Open door');
```

`fromProjectData` validates before constructing a builder. Plugin dependencies, Dialogue+ fields, extended variable rosters, non-base world dimensions, and invalid room/map sizes are rejected. `toProjectData` includes nine room definitions and tile maps, sixteen variable defaults, entity arrays, start, palette, and settings. `toSharePayload` is the authoring payload; `toShareCode` and `buildURL` generate versioned shares. Old share versions remain decodable; base loading requires a 3 by 3 world. The version 47 metadata extension preserves names, IDs, room metadata, custom tiles and string/null tile cells.

Saved variable defaults and runtime variables are separate. Engine exports reset collected/opened flags, restore push-box positions, and exclude NPC disappearance and enemy combat state. Legacy room `bg`, `tiles`, and `walls` remain saved metadata; tile-map layers control tile rendering/collision. Engine normalization fills an entirely empty map with the default ground tile and duplicates single-frame tile art for animation.

## Coverage matrix

| Feature | Builder / project path | Runtime path | Behavior coverage |
| --- | --- | --- | --- |
| Metadata, start, palette, HUD, outline, font | `setTitle`, `setAuthor`, `setPlayerStart`, `setPalette`, `hideHUD`, `spriteOutline`, `spriteOutlineColor`, `disablePixelFont` | Project import/export; palette and display setters | Builder suites, engine suites |
| Effects and unread dialogue markers | `enableEffects`, `showNewDialogExclamation` | `setEnableEffects`, `setShowNewDialogExclamation` | Parity and share suites |
| Tiles, collision, effects, edge merging, both layers | `defineTile`, `configureTile`, `resetTile`; room `ground`, `overlay`, `setCell` | `defineTile`, `updateTile`, room-aware `setMapCell`, `getTiles`, `getTileMap` | Parity, TileManager and share suites |
| Custom effects | `createTileEffect`, `replaceTileEffects`, `removeTileEffect` | `createCustomTileEffect`, `replaceCustomTileEffects`, `deleteCustomTileEffect` | Parity, custom-effect and share suites |
| Custom art and animation | `defineSprite`, `removeSprite` | `setCustomSprites` | Builder features, custom sprite/share suites |
| Skill order and display customization | `setSkillOrder`, `setSkillCustomizations`, `disableSkills` | Corresponding skill setters; level-up controls | Builder features, skill/engine suites |
| NPC names, dialogue, disappearance, conditional and Yes/No endings | Room `addNPC`, `updateEntity`, `removeEntity` | `addSprite`, `updateNPC`, `removeNPC`, `resetNPCs`; dialogue controls | Parity, NPC, choice and share suites |
| Enemies and XP rewards | Room `addEnemy`, `updateEntity`, `removeEntity` | Enemy delegates and reward setters | Builder features, enemy and XP suites |
| Inventory, XP scrolls, boxes, chests, logic wiring | Room object helpers, `updateEntity`, `removeEntity` | Object position/removal, wiring, gate, chest, trap and XP delegates | Builder features, object/logic/interaction suites |
| Legacy dialogue pickups and exits | `addItem`, `addExit`, removal/clear helpers | `setItems`, `setExits` | Serialization, legacy/share and interaction suites |
| Room background/layout/walls | Room `setLayout`; project loading | `setRoomLayout` | Project and room/share suites |
| Variables | `variable`, `setVariableDefault` | `getVariables`, `getRuntimeVariables`, `setVariableDefault`, `setRuntimeVariable` | Builder, default-variable and logic suites |
| Multiplayer | `enableOnline`, `disableOnline`, `clearOnlineSpawns` | `connectOnline`, `startOnlineGame`, `disconnectOnline` | Mocked online lifecycle and existing online suites |
| Gameplay and blocking overlays | Browser entry point | Movement/interactions, intro/audio, dialogue/choices, pickup, celebration and skill selection, restart/game-over controls | Input, engine, dialogue and browser suites |
| Test settings and inspection | Runtime only | `updateTestSettings`, `getTestSettings`, `getState`, `draw` | Engine and API suites |
| HTML export and lifecycle | `exportHtml` from `/html` | Shared adapter in browser and export boot; `destroy` | HTML escaping, API and browser suites |

`getBaseCapabilities()` and `runtime.capabilities()` return catalog IDs and engine limits. Studio additionally exposes transactional `authoring` tools. Those tools preserve rollback, conflict detection, history, and persistence; they are not required by standalone runtimes. Studio's plugin bridge remains separate from `BaseRuntimeApi`.

## Embed the runtime

```js
import { createRuntime } from 'tiny-rpg-studio-sdk/browser';
import 'tiny-rpg-studio-sdk/styles.css';

const runtime = createRuntime({ container: document.querySelector('#game'), project: game.toProjectData() });
// Alternatively provide an existing canvas with a .game-screen parent.
runtime.dismissIntroScreen(); // The engine's normal intro delay still applies.
runtime.resumeBackgroundMusic(); // Call from a user gesture for browser audio.
runtime.tryMove(1, 0);
const state = runtime.getState(); // Detached inspection snapshot.
// On navigation or unmount:
runtime.destroy(); // Idempotent; disconnects multiplayer and removes owned resources.
```

The container helper creates a canvas, directional controls, screen flash, combat indicator, and restart button using the export markup. It scopes keyboard/touch input to the embedded root; click the game to focus it. For an existing canvas, supply equivalent controls if wanted. The runtime owns listeners/timers/overlays it creates; the supplied canvas/container remains yours. Use the shipped CSS and serve `font.woff` as `pixel-operator.woff` beside it, or replace the CSS font URL. `disablePixelFont(true)` uses system text. Multiple runtime APIs retain independent engines and inspection data.

All blocking overlays have controls: `dismissIntroScreen`, `resumeBackgroundMusic`, `advanceDialog`, `moveDialogChoice`, `handleDialogPointer`, `dismissPickupOverlay`, `dismissLevelUpCelebration`, `moveLevelUpCursor`, `confirmLevelUpSelection`, and `chooseLevelUpSkill`. Use `resetGame` to restart and `handleGameOverInteraction` for the engine's game-over action. `getTestSettings`/`updateTestSettings` are runtime controls and are not saved defaults.

## Multiplayer

```js
game.enableOnline({ spawnPoints: [
  { role: 'p1', roomIndex: 0, x: 1, y: 1 },
  { role: 'p2', roomIndex: 0, x: 2, y: 1 },
] });
const runtime = createRuntime({ container: document.querySelector('#game'), project: game.toProjectData(),
  online: { partyHost: 'your-server.example', roomId: 'adventure-session', playerName: 'Alex' } });
// The host starts the lobby after connecting; both clients must use the same roomId.
runtime.startOnlineGame();
// runtime.disconnectOnline(); or runtime.destroy();
```

Multiplayer requires a compatible PartyKit server and a browser connection. Saving `online.enabled` configures the project; connection options select a session. `connectOnline` reuses the existing engine, broadcaster, state sync, input relay and coordinator. Disconnect stops sender/broadcaster/sync resources and restores solo mode. Tests use mocked clients and need no live server.

## Standalone HTML

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { exportHtml } from 'tiny-rpg-studio-sdk/html';

const { html } = exportHtml(game.toProjectData(), {
  runtimeJavaScript: readFileSync(new URL(import.meta.resolve('tiny-rpg-studio-sdk/runtime.js')), 'utf8'),
  css: readFileSync(new URL(import.meta.resolve('tiny-rpg-studio-sdk/styles.css')), 'utf8'),
  fontDataUrl: 'data:font/woff;base64,' + readFileSync(new URL(import.meta.resolve('tiny-rpg-studio-sdk/font.woff'))).toString('base64'),
  // For online projects, also provide online: { partyHost, roomId, playerName }.
});
writeFileSync('game.html', html);
```

Use `readFileSync(new URL(import.meta.resolve(...)), 'utf8')` for runtime/CSS paths in portable Node code. Explicit assets make the pure helper usable without fetch or browser globals. The helper reuses Studio's escaping and controls, embeds the complete base project, and provides byte counts. The current assembler hides the Studio reopen button for bundled projects; use `game.toShareCode()` or `game.buildURL()` to reopen the lossless share. Export boot exposes the shared API as `globalThis.__TINY_RPG_API` and tears it down on `pagehide`. Provide explicit online options for online HTML exports.

## Base limits and SDK 2 migration

- Nine 8 by 8 rooms, world dimensions 3 by 3, and sixteen saved boolean slots.
- Coordinates 0 through 7, room indexes 0 through 8; ground and overlay accept `string | number | null`.
- Six enemies per room, unique NPC types and boss types across the world. Engine object multiplicity applies: one for unique types, four for multi-instance types.
- Title/author: eighteen characters, matching engine imports and Studio authoring validation. Skill display text uses the engine's normalization limits. Enemy XP caps at sixteen; XP scroll overrides accept non-negative safe integers.
- Effects default on, unread dialogue markers default on, outline/HUD hiding/skill disabling/system-font mode default off. Outline color defaults to palette index one. Optional reset methods restore engine defaults.
- Custom effects: at most sixteen definitions, names of eight characters. Replacing effects clears custom assignments; removing one changes references to `none`, matching the engine.
- Art overrides replace the same group/key/variant. Frames use 8 by 8 palette indices 0 through 15 or null. Custom tile definitions can use string IDs.

SDK 2 removes `enableVariablesPlus`, `MAX_VARIABLES_PLUS`, and configurable extended variable limits. Maps+, Dialogue+, Variables+, gameplay dependencies, renderer internals, debug instrumentation and editor layout are outside the base contract. Existing plugin projects remain supported in Studio through its plugin APIs. Load base projects with `TinyRPG.fromProjectData`, and edit loaded variable slots with `setVariableDefault`. The major release also corrects enemy limits, tightens metadata/asset validation, preserves IDs and names, and copies authoring data. Nothing is published automatically by the build.
