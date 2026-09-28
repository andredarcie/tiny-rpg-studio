# Editor plugins

Import only trusted files. Executable plugins run in the editor page with its full
DOM, storage, network and JavaScript privileges. There is no sandbox. Parsing an
HTML file is inert; activation happens after installation and editor readiness.

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

The manifest marker is required exactly once. Version 1 requires exactly one
marked inline module, with no `src`, and permits at most one marked style block.
Unrelated HTML and scripts are ignored. A manifest without `apiVersion` installs
an inert metadata preview. Unsupported versions and malformed packages fail
validation. `activate(context)` must be exported; it may return a promise.

`editorRoot` is `#tab-editor`. `api` is the existing `TinyRpgApi` bridge, whose
supported operations are declared in `src/runtime/infra/TinyRpgApi.ts` (for example
`getState`, `getTiles`, `setMapTile`, `draw`, and `renderAll`). There are no additional
game runtime hooks. Use the bridge rather than engine internals.

Scope CSS to the editor. Register `onCleanup(callback)` before each mutation to
restore moved nodes, original classes, listeners, timers and plugin-owned UI.
Keep existing panel nodes and their mobile attributes. Cleanup runs in reverse
registration order on failure, replacement, removal and runtime destruction;
a throwing callback does not prevent the remaining cleanup or style removal.
The host cannot roll back unregistered side effects. Finish registering effects
before the activation promise resolves; cleanup callbacks are synchronous.

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

Plugins activate only after the editor is constructed, including after reload.
Gameplay-only visits do not load plugins; online and exported boot paths do not
activate them. Plugin records are separate from game data and are not embedded in
shared links or exports.

## Try the example

1. Open Tiny RPG Studio and select **Editor**, then **Plugins**.
2. In **Search**, choose **Import** and select `examples/plugin-preview.html`.
3. Close the modal. Tiles are at the top of the right column and NPCs at the top
   of the left column. The entire World section and its mobile navigation button
   are hidden. No metrics toggle is added.
4. On a narrow screen, use the existing Tiles and NPCs navigation buttons.
5. Reload and reopen Editor: the same effects activate once again.
6. Open **Plugins ? Manage**, find **Example plugin**, and select **Remove**.
   The original panel positions and World section visibility return.
