---
name: plugin-creator
description: Create Tiny RPG Studio plugins as standalone HTML packages or official catalog entries. Use for requests to create or change a plugin in this repository.
---

# Plugin Creator

Read the `tiny-rpg-studio` skill before editing. Inspect the relevant editor/runtime code and a package with similar behavior. Follow the existing plugin API.

## Establish the kind of plugin

The user must specify **standalone** or **official**. If the request does not say which, ask and wait for an answer before creating or changing plugin files. Resolve other routine choices from the request and repository.

- **Standalone:** Deliver exactly one self-contained `.html` file containing the complete plugin behavior. Do not add it to `public/plugins/catalog.json`, create support files, or leave test files in the final change. Import it through Editor > Plugins > Import. Do not write permanent tests. If a temporary test is needed to check behavior, remove it before finishing.
- **Official:** Put the HTML package at `public/plugins/<id>/<version>/plugin.html` and add or update its entry in `public/plugins/catalog.json`. The catalog entry makes it appear in the engine's Plugins list. Published version paths are immutable; use a new version directory for an update. Tests may be kept when they exercise observable behavior. Do not write literal tests that merely validate strings or copied metadata, such as a catalog `fullDescription` value.

## Classify the behavior

- An **editor** change affects only the authoring UI or editor behavior. Declare `"capabilities":["editor"]` (or omit capabilities for a legacy editor-only package) and provide one editor module.
- A **gameplay** change changes the final game's behavior or output. Declare `"capabilities":["gameplay"]`, or `["editor","gameplay"]` when the package also changes the editor. Provide one self-contained inline module for each declared capability. Gameplay packages require a nonempty version. Do not label a gameplay change as editor-only to preserve URL sharing.
- Installing a gameplay-capable package must disable `btn-generate-url` immediately, even when the current project has no dependency on that plugin. The engine's `EditorShareService` does this based on the installed package's `gameplay` capability. Verify it stays disabled after reload and is enabled again after the last gameplay package is removed. Keep this invariant if related engine code changes.

## Package contract

Use exactly one `script#tiny-rpg-plugin[type="application/json"]` manifest with `id`, `title`, `shortDescription`, `fullDescription`, and `apiVersion: 1`. Include `version` for gameplay packages and official releases. Use one inline `<script type="module" data-tiny-rpg-plugin>` for the editor capability and/or one inline `<script type="module" data-tiny-rpg-gameplay-plugin>` for gameplay. Each module exports `activate(context)`. At most one `<style data-tiny-rpg-plugin>` block is allowed. Keep all JavaScript and CSS inside the HTML package; module imports and external script `src` cannot be used.

Editor `activate` receives `{ editorRoot, api, onCleanup }` and may receive `ui`. Check for `ui` before using it. Scope DOM changes to the intended editor UI. Scope CSS selectors to the affected editor elements; prefer `#tab-editor`, but editor chrome outside it can be targeted when the requested behavior requires it. Avoid affecting the game or unrelated screens. Use the `TinyRpgApi` bridge for supported game operations. Register cleanup for inserted or moved nodes, listeners, timers, and altered state so removal, replacement, and failure restore the UI.

Gameplay `activate` receives `{ apiVersion, getWorld, resizeWorld, onCleanup }`. The gameplay host runs this module when loading a project that declares the matching plugin ID and version as a dependency. Installing the package alone does not activate its gameplay module. Use the supported gameplay context and register cleanup for its effects. A supported editor action such as `api.resizeWorld(rows, cols, pluginId)` records a project dependency. Verify that projects requiring the package work in standalone game exports. Consult `src/editor/manager/PluginManager.ts`, `src/editor/manager/PluginRuntime.ts`, `src/runtime/infra/GameplayPluginHost.ts`, `src/main.ts`, and `AGENTS.md` for current details.

## Implement and verify

1. Build the smallest package that satisfies the request. For an official plugin, make catalog metadata and package ID, version, and capabilities agree; use a file path relative to `public/plugins/`.
2. Check import or catalog installation, activation, removal cleanup, replacement/reload, and the requested editor or gameplay behavior in a browser where practical. For gameplay packages, also check exported HTML and the Generate URL button invariant.
3. For official plugins, write tests only for meaningful behavior or regression risk. Prefer assertions on user-visible state, interactions, persistence, cleanup, and exports. Avoid tests of literal strings, catalog descriptions, or source text.
4. Run the repository's required checks before claiming completion: `npx tsc --noEmit`, `npm run test:run`, `npm run lint`, and `npm run build:export`. Remove any temporary standalone tests and confirm the final standalone artifact is only its HTML file. If a check cannot run or fails, report that clearly; do not call the task complete.

In the final response, link the delivered HTML file. For official plugins, also mention the catalog entry and meaningful verification results.
