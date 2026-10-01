# Plugins

Import only trusted files. Executable plugins run in the editor page with its full
DOM, storage, network and JavaScript privileges. There is no sandbox. Parsing an
HTML file is inert; activation happens after installation and editor readiness.
Gameplay modules also run in standalone games and exported HTML, with the same
page privileges. Install only code you trust.

## Package format

```html
<script id="tiny-rpg-plugin" type="application/json">
{"id":"my-plugin","title":"My plugin","shortDescription":"Short summary",
 "fullDescription":"Full description","apiVersion":1}
</script>
<style data-tiny-rpg-plugin>
#tab-editor .my-plugin-control { color: gold; }
</style>
<script type="module" data-tiny-rpg-plugin>
export function activate({ editorRoot, api, onCleanup }) {
  const button = document.createElement('button');
  button.textContent = 'Redraw';
  const click = () => api.draw();
  onCleanup(() => button.remove());
  onCleanup(() => button.removeEventListener('click', click));
  button.addEventListener('click', click);
  editorRoot.prepend(button);
}
</script>
```

The manifest marker is required exactly once. Legacy packages default to the
`editor` capability. A gameplay package declares a version and
`"capabilities":["gameplay"]`; use `["editor","gameplay"]` for both entries.
Each declared capability requires its own self-contained inline module with no
`src`. Editor code uses `data-tiny-rpg-plugin`; gameplay code uses
`data-tiny-rpg-gameplay-plugin`. At most one marked style block is permitted.

```html
<script id="tiny-rpg-plugin" type="application/json">
{"id":"my-gameplay-plugin","title":"My gameplay plugin","shortDescription":"Example",
 "fullDescription":"Example","version":"1.0.0","capabilities":["gameplay"],"apiVersion":1}
</script>
<script type="module" data-tiny-rpg-gameplay-plugin>
export function activate({ apiVersion, getWorld, resizeWorld, onCleanup }) {
  if (apiVersion !== 1) throw Error('Unsupported gameplay API');
}
</script>
```

The gameplay context exposes `apiVersion`, `getWorld()`, `resizeWorld(rows, cols)`
and `onCleanup(callback)`. Dimensions must be whole numbers from 1 through 5.
An editor entry can await `api.resizeWorld(rows, cols, pluginId)` to offer controls;
the host records that plugin's ID and version as a project dependency. Gameplay
modules should use this context instead of engine internals. The host validates
required IDs and versions before loading a project and runs cleanup callbacks
when effects are replaced or removed.
Unrelated HTML and scripts are ignored. A manifest without `apiVersion` installs
an inert metadata preview. Unsupported versions and malformed packages fail
validation. `activate(context)` must be exported; it may return a promise.

`editorRoot` is `#tab-editor`. `api` is the existing `TinyRpgApi` bridge, whose
supported operations are declared in `src/runtime/infra/TinyRpgApi.ts` (for example
`getState`, `getTiles`, `setMapTile`, `draw`, and `renderAll`). Use the bridge rather
than engine internals.

Scope CSS to the editor. Register `onCleanup(callback)` before each mutation to
restore moved nodes, original classes, listeners, timers and plugin-owned UI.
Keep existing panel nodes and their mobile attributes. Cleanup runs in reverse
registration order on failure, replacement, removal and runtime destruction;
a throwing callback does not prevent the remaining cleanup or style removal.
The host cannot roll back unregistered side effects. Finish registering effects
before the activation promise resolves; cleanup callbacks are synchronous.

## Project settings

Editor plugins can call `registerSettings(render)` during activation. The host
passes `render` a new container in **Project → Plugins** and groups all calls from
one plugin under its installed manifest title. Plugins without registrations do
not get a group. Calls from a removed or replaced activation are rejected.
The tab provides placement only; it has no shared settings store. The plugin
owns its values, persistence, and application. Register listeners and other
effects with `onCleanup` so replacement, removal, failure, and shutdown restore
the editor.

```js
export function activate({ registerSettings, onCleanup }) {
  registerSettings(container => {
    const label = document.createElement('label');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    label.append(toggle, ' Show guides');
    container.append(label);
    const update = () => { /* Apply this plugin's setting. */ };
    toggle.addEventListener('change', update);
    onCleanup(() => toggle.removeEventListener('change', update));
  });
}
```

Modules are loaded using native Blob module imports. Blob URLs are revoked after
loading, including failures. Use self-contained modules; relative imports cannot
resolve relative to the imported HTML file. Lifecycle operations run serially in
installation order. An activation promise must settle for subsequent operations
to proceed. Plugin failures are isolated and shown in Manage separately from
import/storage errors. Failed activations are retried on reload or replacement.

## Persistence and scope

Packages are local to this browser under `tiny-rpg-plugins-v1`, as an array of
`{id,title,shortDescription,fullDescription,payload?:{apiVersion:1,javascript,css?}}`.
Old metadata records remain supported; old arbitrary `source` fields never execute.
Malformed stored payloads become inert metadata with a validation error; valid
records still load. Identical imports do nothing. Reimporting the same ID upgrades
a preview or replaces the executable package after cleaning up the previous one.
Storage failures leave installed records and effects unchanged. Remove deletes
the local record and cleans up effects.

Editor entries activate only after the editor is constructed, including after
reload. Gameplay entries activate for projects that declare them as dependencies,
including in standalone HTML exports. Installed package records remain local to
the browser; standalone exports bundle the required gameplay packages. Shared
links do not carry gameplay plugins.

## Try the example

1. Open Tiny RPG Studio and select **Editor**, then **Plugins**.
2. In **Search**, choose **Import** and select `examples/plugin-preview.html`.
3. Close the modal. Tiles are at the top of the right column and NPCs at the top
   of the left column. In **Project → Plugins**, **Flip** starts checked. Uncheck
   it to return Tiles and NPCs to their original positions; check it to move
   them again. The choice resets to checked on reload. The entire World section
   and its mobile navigation button are hidden.
4. On a narrow screen, use the existing Tiles and NPCs navigation buttons.
5. Reload and reopen Editor: the same effects activate once again.
6. Open **Plugins → Manage**, find **Example plugin**, and select **Remove**.
   The original panel positions and World section visibility return.

## Maps+

Search for **Maps+** in Plugins and install it, or import `examples/maps-plus.html`
through **Editor → Plugins → Import**. Its World
panel and **Project → Plugins → Maps+** controls stay in sync. Select rows and columns
independently, each from 1 to 5. Choose
**Apply size** to resize the project. For example, 3 rows and 5 columns produce
15 rooms; 4 rows and 3 columns produce 12. Existing rooms retain their row and
column when the width changes. Save locally or export HTML to preserve the full
world and the Maps+ gameplay dependency. Shared URLs cannot carry these projects.
Removing Maps+ returns the project to 3×3 and saves a local snapshot of the larger
world first, including content in rooms that no longer fit. Reinstall Maps+ to load
that snapshot from project history.
If you installed Maps+ 1.0.0 or 1.0.1, choose **Update** in Plugins to get the
Project Plugins controls.


## Publishing to the built-in catalog

The app serves `public/plugins/catalog.json` with this schema:

```json
{
  "schemaVersion": 1,
  "plugins": [{
    "id": "example-plugin",
    "title": "Example plugin",
    "shortDescription": "Swap Tiles and NPCs to the top and hide World.",
    "fullDescription": "Describe the plugin's behavior and effects here.",
    "capabilities": ["editor"],
    "version": "1.0.0",
    "file": "example-plugin/1.0.0/plugin.html"
  }]
}
```

All six required entry fields must be nonempty strings and IDs must be unique. Optional `capabilities` declares `editor`, `gameplay`, or both and must match the package manifest; omitted capabilities display as editor only. `file` is relative to the catalog directory; use plain path segments without traversal, URL schemes, percent escapes, queries, or fragments. Packages must contain a matching manifest ID and a valid API version 1 executable block.

To publish, review the HTML and all JavaScript/CSS as trusted editor-page code. Check activation, cleanup, layout restoration, persistence, and failure behavior. Add the HTML at a new versioned path and add or update its catalog entry. Published version paths are immutable: publish a new directory for each release. Keep the example's published copy identical to `examples/plugin-preview.html`; fixture tests enforce this and matching metadata. Deploy the app normally: Vite copies `public/plugins/` to `docs/plugins/`, including on subdirectory deployments.

Opening Search loads only metadata and shows up to 10 available plugins alphabetically. An empty query restores this list. Queries of at least three characters search locally after 800 ms without typing. The catalog is HTTP-revalidated once per page session; reload to discover catalog changes. Failed searches can retry by editing the query. Packages download only after clicking Install. Download/validation failures can retry with Install. Closing the modal, changing query or mode, or importing locally cancels a pending installation. Catalog and package files are excluded from service-worker precaching.

Installed packages retain their saved bytes in local storage and work without the catalog server. There are no automatic updates: remove and reinstall to get a newer published version, or replace it through local HTML import. Gameplay dependencies are stored in project data and bundled in standalone HTML exports. Share URLs are unavailable while gameplay plugins are installed because the URL codec supports only the legacy nine-room format.

Validate browser behavior with `npx playwright test tests/e2e/plugins.spec.ts`. After `npm run build`, run `npx playwright test -c playwright.plugins.config.ts` to exercise the real production files under `/studio/`.

## Custom Themes

Search for **Custom Themes** in Plugins and install it, or import
`public/plugins/custom-themes/1.0.0/plugin.html`. The top-left **Theme** button
opens a compact menu with Default, Darker (pitch black), Dracula (black and red),
Powershell (blue), Light (white), Forest (green), and Sepia (warm parchment).
The plugin saves your selection in localStorage under
`tiny-rpg-custom-themes-theme-v1` and restores it on startup. Missing or invalid
saved values use Default. If browser storage is unavailable, theme selection
still works for the current session. Removing the plugin keeps the preference
for a future reinstall.
Use arrow keys, Home/End, and Enter/Space to choose a theme, or Escape to close.
Themes affect the Editor tab, preserve game artwork, and restore the original
appearance when the plugin is removed.

## Minimalist UI

Import `examples/minimalist-ui.html` or search for **Minimalist UI** in Plugins and install it. It hides catalog text for NPCs, objects, and enemies, hides World, and simplifies the shared pixel-art editor. Sprite-edit icons and object configuration remain available. With the header hidden, use Escape, the backdrop, or Save to close the pixel-art editor. Removing the plugin restores the original interface.

Minimalist UI 1.0.2 hides enemy XP and starts Project collapsed with Information selected. Project tab labels remain unchanged. Existing installations keep their saved version: import the updated HTML to replace it, or reload the app and remove/reinstall from the catalog.

### Versions and catalog updates

An optional nonempty `version` string in a plugin manifest is preserved on import,
installation, replacement, and browser reload. Existing versionless records remain
loadable. Catalog downloads use the advertised catalog version: versionless
manifests inherit it, while conflicting explicit manifest versions are rejected.

Search and Manage offer Update when the catalog has a newer numeric
`major.minor.patch` version (for example, `1.0.10` follows `1.0.2`). Missing or
unsupported installed versions are unknown and can be explicitly updated to a
supported catalog version. Unsupported catalog versions do not offer updates;
known equal or newer installed versions are never downgraded. Manage checks the
full catalog independently of Search and its ten default results.

Updates download and validate before atomically saving one replacement record.
Download, validation, or storage failure leaves the old installation and effects
intact for retry. After persistence, the runtime cleans old effects and styles
before activating the replacement, even when only its version changes. Activation
errors are reported separately; the new saved package remains installed. Closing
the modal, changing tabs or queries, or leaving Editor cancels pending downloads.
