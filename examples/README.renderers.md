# Renderer plugin API

Renderer plugins are ordinary self-contained HTML gameplay packages. Start with
[the plugin package guide](README.plugins.md). No renderer library or camera
perspective is required. Bundle any library into the inline gameplay module so
the installed package and exported games work offline.

The public TypeScript contracts are in
[`GameplayPresentation.ts`](../src/runtime/adapters/renderer/GameplayPresentation.ts)
and [`GameplayContext`](../src/runtime/infra/GameplayPluginHost.ts).

## Registering a renderer

During `activate(context)`, call
`context.registerGameplayPresentation({ draw, direction, reset })`. Only one
renderer can be registered at a time; a second registration throws. The returned
function unregisters that provider. The host also unregisters it automatically
on removal, replacement, activation failure, or destruction.

`draw(frame)` paints the gameplay area. Return `true` when another animation frame
is needed; return `false` or nothing when it is not. The engine owns scheduling,
redraws for game changes, and tile animation. Avoid starting a second animation
loop. `context.requestRedraw()` requests a draw after a plugin-owned change.

`direction(input)` receives `left`, `right`, `up`, or `down` from the existing
directional controls. Return `[dx, dy]` for one engine movement attempt: integers
with `Math.abs(dx) + Math.abs(dy) === 1`. Return `null` to consume input for a
camera change without moving. Arbitrary movement vectors, teleportation, and
direct state mutation are not supported. The engine retains collision,
interactions, combat, and the rules for accepting input.

An optional `look(deltaRadians)` handles horizontal mouse movement over the game
canvas and mobile drags. Clicking the canvas captures the mouse when look is
enabled; Escape releases it. Captured movement uses relative mouse deltas, so
rotation continues beyond screen edges. Browsers without pointer lock use mouse
movement over the canvas. Positive deltas turn right; dragging across the canvas
width sends PI radians. Return `true` when look support is enabled, or `false`
to keep normal touch swipe movement. A zero delta queries support and must not
change the camera. The engine suppresses rotation while movement controls are
held or gameplay input is blocked, and redraws after accepted look input. Keep
free camera angles inside the plugin and snap them in `direction()` before
returning a cardinal movement delta. To finish a turn before a requested step,
return `null` while animating and call `context.requestGameplayDirection(input)`
after the last frame. The engine checks normal movement rules again. Cancel any
pending request on reset, cleanup, or an interrupted turn, and dispatch it after
`draw()` returns to avoid drawing recursively.

`reset()` resets presentation state such as camera heading and interpolation.
It runs before registration, on game resets/project imports, and on unregister.
It must tolerate repeated calls. Use `context.onCleanup(callback)` to dispose
plugin-owned resources, event listeners, secondary canvases, textures, and GPU
resources when the activation ends. Do not dispose resources needed by later
draws in `reset()`.

The editor continues using its default renderer. Gameplay plugins replace the
world presentation; HUD, dialogue, and engine overlays remain engine-owned.
Default room-transition animation is disabled while a renderer is registered.
Unregistering restores default rendering and transitions.

## Frames and timing

| Field | Meaning |
| --- | --- |
| `ctx` | Engine-owned Canvas 2D context, clipped to the gameplay area. |
| `width`, `height` | Gameplay viewport dimensions in canvas pixels, excluding reserved HUD space. |
| `timeMs` | Monotonic `performance.now()` timestamp for this draw. |
| `deltaMs` | Milliseconds since this renderer's previous draw; zero after registration or reset. |
| `scene` | Detached world snapshot described below. |
| `feedback` | Player flash/attack feedback, floating text, and particles. |

Draw coordinates start at the gameplay area's top-left. Cover the viewport each
frame and restore any context state you change. CSS display size can differ from
canvas resolution. Use `width`/`height` for the camera aspect ratio and resize
plugin-owned buffers when those dimensions change.

`deltaMs` includes idle/hidden time between draws; cap or reset your visual
interpolation after long gaps. Returning `true` requests visual frames, not extra
simulation updates. The engine does not continue requesting these frames while
the document is hidden. Existing engine redraws can occur while the game is
paused; use `scene.status` when deciding which animations should advance.

For WebGL or another renderer library, render to a **plugin-owned secondary
canvas**, then composite it with `frame.ctx.drawImage(canvas, 0, 0, width, height)`.
The secondary canvas can use WebGL, WebGL2, or Canvas 2D. Do not acquire WebGL on
the engine canvas, replace it, or transfer it to a library: the engine still needs
its 2D context for HUD and overlays. Dispose the secondary renderer in cleanup.

## World coordinates and original scene data

All world positions use **tile units**, with positive X to the right and positive
Y downward. `scene.width` and `scene.height` describe the entire world, not just
the current room. `cells[y * scene.width + x]` selects a cell at integer X/Y.
Player/entity world positions point to tile centers, so a player at local tile
`(3, 2)` in the room starting at `(8, 0)` has world position `(11.5, 2.5)`.
Local coordinates are zero-based tile positions without the added half tile.

| Field | Meaning |
| --- | --- |
| `world` | `{ rows, cols, roomSize, activeRoomIndex }`. Rooms are row-major. |
| `rooms` | One entry per world slot: `index`, world origin `x`/`y`, `width`/`height`, `backgroundIndex`, resolved `background` color, and `exists`. |
| `palette` | Copy of the active project's resolved color palette. |
| `cells[].roomIndex`, `localX`, `localY` | Source room and cell coordinates. |
| `cells[].groundTileId`, `overlayTileId` | Original tile IDs, or `null` for an empty layer. IDs retain their string/number type. |
| `cells[].terrainWall` | Original authored room-wall flag. |
| `cells[].color` | Resolved room-cell background color. |
| `tiles` | Asset list keyed by `id`, with `name`, `category`, `collision`, resolved `visualEffect`, `mergeEdges`, all `frames`, and current `pixels`. |
| `animationFrame` | Engine's global tile animation index. Current pixels already select the correct frame for each tile. |
| `animationIntervalMs` | Engine tile animation interval in milliseconds. |
| `customTileEffects` | Project effect definitions: `id`, `name`, ordered `baseEffectIds`, and optional `color`. |
| `status` | `{ playing, gameOver, dialogActive }`, for presentation decisions. |

Tile frames and sprites are row-major arrays of resolved color strings and
`null` pixels. **Null is transparent; `#000000` is opaque black.** The engine
normalizes its internal `"transparent"` sentinel to `null`. Tiles without artwork
have `pixels: null` and no frames. Missing tile IDs may have no asset entry.
Artwork includes project edits; read each new snapshot rather than assuming an
asset is unchanged because its ID is unchanged.

Effects are semantic metadata, not pre-rendered shader output. `visualEffect`
can be `none`, `water`, `lava`, or a project-defined `custom:...` ID. A plugin
chooses how to present them; it can look up custom effect definitions by ID.
`mergeEdges` is also an authoring hint, not precomputed geometry. Tile collision
is the asset's authored setting, not the player's effective ability to cross it.

## Player and entities

`scene.player` includes world `x`/`y`, `roomIndex`, `localX`/`localY`, resolved
unflipped `pixels`, `facing`, `lives`, and `maxLives`. `facing` is `left` or `right`
and matches the built-in horizontal sprite-flip decision. It is **not** a full
compass direction or a plugin's camera heading. Keep camera orientation inside
the plugin. Flip the artwork yourself when the desired presentation needs it.

`scene.entities` includes currently visible objects, NPCs, living enemies,
uncollected pickups, live remote players, and the legacy tile billboards.
Entities have:

| Field | Meaning |
| --- | --- |
| `key` | Unique runtime identity for retaining render objects across frames and movement. |
| `id` | Legacy display/feedback identity; it can depend on position or be shared by pickups. Prefer `key` for render caches. |
| `kind` | `object`, `npc`, `enemy`, `item`, `remote-player`, or `tile`. |
| `type` | Object/NPC/enemy/item type, or a stringified tile ID for tile billboards. |
| `x`, `y` | World-space center. |
| `roomIndex`, `localX`, `localY` | Source room and local position. |
| `pixels` | Current detached artwork. |
| `lives`, `warning`, `flash` | Optional enemy feedback. |

Keys survive movement of a runtime entity object. They are not saved project
IDs and can change after imports, resets, or runtime-object replacement. Remove
cached render objects when their keys disappear. Tile billboard keys identify
the room/layer/cell instead. Pixels can change while a key stays the same.

The scene contains the whole world's visible entities; choose your own culling.
The engine can suppress entities during some overlays, in which case the frame's
entity list is empty. Pickups currently use their built-in one-pixel artwork.
The snapshot does not expose hidden NPC dialogue, reward logic, or engine manager
objects. It is for presentation, not a second game simulation.

`feedback.playerFlash` is a color or `null`; `feedback.attacking` indicates player
attack feedback. Texts contain `{ text, x, y, color, opacity }`; particles contain
`{ x, y, color, opacity }`. Their X/Y positions are world tile coordinates. Apply
your projection and visual effects. Do not interpret these as gameplay events.

`feedback.playerHit` is `null` until an enemy hit connects, then retains the latest
`{ sequence, sourceId, x, y }` across frames. The position is the attacker's world
tile center at impact; `sourceId` is optional. Compare `sequence` with the last
value your renderer handled to react once, including when successive hits overlap
the player flash. Misses and environmental damage do not create enemy-hit feedback.
Blocked enemy hits still count as impacts. Registration, reset, and unregister
clear the retained hit. This feedback can drive camera reactions; it does not
change the player's position or gameplay-facing rules.

`feedback.incomingAttack` has the same shape and reports an enemy starting an
attack against the local player, before impact. It can be present even if the
attack later misses or the player escapes. Both fields share an increasing
sequence counter, so a renderer can select the latest reaction and ignore older
retained feedback. Incoming attacks are cleared by the same lifecycle resets.

## Compatibility view and collision

The existing `cells[].solid`, `blocked`, `wall`, `floor`, and scene
`ceiling`/`floor`/`boundary` colors remain available for existing plugins.
`solid`, wall/floor artwork, and `kind: 'tile'` billboards describe the original
raycaster's presentation choices. They do not impose a cube/billboard model on
new renderers. For example, liquids retain blocking rules but are presented as
ground, and transparent solid tiles become billboards.

When rendering the original ground/overlay layers yourself, skip `kind: 'tile'`
entities to avoid drawing the same tile twice. Render other entity kinds normally.

`blocked` summarizes current terrain and dynamic object blockers, including
applicable traversal skills. It is useful for visual hints, but is not a complete
pathfinding or interaction query: NPCs, enemies, world edges, scripted conditions,
and movement restrictions still belong to the engine. Request movement through
`direction()` and let the engine decide the result.

## Snapshot ownership, settings, and compatibility

Scene data is detached from engine state. Treat it as read-only. Mutating a
snapshot must not mutate the engine; related fields within one snapshot may share
detached artwork. Do not rely on array/object reference identity between frames
and do not attach state to snapshots. Use entity keys or typed tile IDs instead.

`context.getPresentationResources()` returns the live palette and a detached copy
of this plugin's own project `data`. Read it during draws or settings refreshes:
activation happens before the incoming project is imported. Persist settings
from an editor module with `api.setPluginData(pluginId, value)` as explained in
[Project settings](README.plugins.md#project-settings). Settings and gameplay
packages travel with standalone exports.

These additions retain gameplay `apiVersion: 1`; old providers can ignore new
fields. New fields are optional in TypeScript so older engines and hand-built
scenes remain representable. The current engine supplies them on its snapshots.
Feature-detect data your renderer needs and show a useful error or provide a
fallback when running on older engines. Future compatible extensions add fields;
they should not change existing fields' meanings. No API can promise support for
every future renderer or arbitrary changes to gameplay.

## Minimal provider

This module illustrates lifecycle, cardinal input, original layers, and player
artwork. Include it in a gameplay package using the manifest format in the main
plugin guide. It uses the engine's own redraws and does not request animation.

```html
<script type="module" data-tiny-rpg-gameplay-plugin>
export function activate(context) {
  const steps = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  context.registerGameplayPresentation({
    reset() {},
    direction(input) { return steps[input]; },
    draw({ ctx, width, height, scene }) {
      if (!scene.tiles || !scene.world) throw Error('This renderer needs the extended scene API');
      const assets = new Map(scene.tiles.map(tile => [tile.id, tile]));
      const scale = Math.min(width / scene.width, height / scene.height);
      function sprite(pixels, x, y) {
        if (!pixels?.length) return;
        for (let row = 0; row < pixels.length; row++) {
          for (let col = 0; col < pixels[row].length; col++) {
            const color = pixels[row][col];
            if (color === null) continue;
            ctx.fillStyle = color;
            ctx.fillRect((x + col / pixels[row].length) * scale,
              (y + row / pixels.length) * scale,
              scale / pixels[row].length, scale / pixels.length);
          }
        }
      }
      ctx.fillStyle = scene.ceiling; ctx.fillRect(0, 0, width, height);
      scene.cells.forEach((cell, index) => {
        const x = index % scene.width, y = Math.floor(index / scene.width);
        ctx.fillStyle = cell.color; ctx.fillRect(x * scale, y * scale, scale, scale);
        sprite(assets.get(cell.groundTileId)?.pixels, x, y);
        sprite(assets.get(cell.overlayTileId)?.pixels, x, y);
      });
      for (const entity of scene.entities) {
        if (entity.kind !== 'tile') sprite(entity.pixels, entity.x - 0.5, entity.y - 0.5);
      }
      sprite(scene.player.pixels, scene.player.x - 0.5, scene.player.y - 0.5);
    }
  });
}
</script>
```
