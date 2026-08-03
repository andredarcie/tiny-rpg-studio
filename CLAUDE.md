# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory checks before finishing

A large task or anything going to production is **only complete when TypeScript, tests, and lint all pass**. Run these and confirm they are green before reporting a task done or shipping to prod:

```bash
npx tsc --noEmit     # type check (no emit)
npm run test:run     # full Vitest suite (CI mode, non-watch)
npm run lint         # ESLint, fails on ANY warning (--max-warnings=0)
```

If any of these cannot be run, do not describe the task as complete — say which check is missing. (See also `AGENTS.md`, which states the same rule.)

Two project rules that the linter does not fully catch:
- **All code comments must be in English.** Never write comments in Portuguese, even though discussion may happen in Portuguese.
- **Never commit or push for the user unless explicitly asked.** A question like "está tudo certo?" means *verify only*, not commit.

## Commands

```bash
npm run dev            # Vite dev server (usually http://localhost:5173)
npm run build          # generate bitmap font + export build + web build
npm run build:check    # tsc --noEmit then full build (use before a prod build)
npm run build:sdk      # build the publishable SDK bundle + d.ts
npm run build:desktop  # web build + Tauri desktop app
npm run preview        # preview the production build

npm test               # Vitest in watch mode
npm run test:run       # Vitest once (CI)
npm run test:coverage  # Vitest with coverage
npm run test:e2e       # Playwright E2E (run `npx playwright install` first)

npm run lint           # ESLint (zero-warning policy)
```

Run a single unit test:
```bash
npx vitest run src/__tests__/editor/DevlogModal.test.ts   # one file
npx vitest run -t "shows the badge when there are unseen updates"  # by test name
```

ESLint is configured for strict type safety (`eslint.config.js`): `no-explicit-any`, the `no-unsafe-*` family, `no-floating-promises`, `consistent-type-imports`, and `no-non-null-assertion` are all enforced. Because `--max-warnings=0`, even warning-level rules (like `no-non-null-assertion`) fail CI. Prefer `instanceof` narrowing or an `as SomeType` cast over the `!` operator.

## Architecture

Tiny RPG Studio is a **browser-native RPG maker**: an Editor tab and a Game tab share one page so you can build and instantly play. The entire game is encoded into a single shareable URL — no backend account is required to play.

### Entry point and app wiring

`src/main.ts` (`TinyRPGApplication.boot`) is the composition root for the page. It:
- Detects **online mode** from the URL (`?online-mode=<guid>` / `?modo-online=<guid>`) and, if present, hands off to `OnlineModeApplication.boot` instead of the normal flow.
- Otherwise wires the tab switcher, constructs a single `GameEngine`, optionally an `EditorManager`, and the modal UIs (Explore, Devlog, Export).
- Loads a shared game from the URL via `ShareUtils.extractGameDataFromLocation`.
- Installs a global **`TinyRpgApi`** bridge (`setTinyRpgApi`) — the thin, typed contract the editor uses to drive the runtime (export/import game data, set tiles, draw, reset, etc.). This is the seam between the editor and the engine; prefer extending `TinyRpgApi` over reaching into engine internals.

### Runtime (`src/runtime/`) — layered

The runtime follows a hexagonal-ish layering. Respect these boundaries when adding code:

- **`domain/`** — pure game state and data definitions, no I/O. `GameState` (`domain/GameState.ts`) is the heart: it holds the persistent `game` definition and the live `state`, and delegates to focused `State*Manager` classes (world, variable, object, enemy, skill, player, dialog, item) plus read facades (`GameStateWorldFacade`, `GameStateDataFacade`). `domain/definitions/` holds tile/skill/item/enemy catalogs and sprites.
- **`services/`** — the engine subsystems. `GameEngine` (`services/GameEngine.ts`) is the runtime composition root that instantiates and connects everything: `TileManager`, `NPCManager`, `Renderer`, `DialogManager`, `InteractionManager`, `EnemyManager`, `MovementManager`, combat (`engine/CombatManager`, `engine/CombatStateMachine`, `CombatStunManager`), `OnlineCoordinator`, and `BackgroundMusicEngine`. Subsystems receive callbacks from `GameEngine` rather than referencing each other directly.
- **`adapters/`** — I/O boundaries. `Renderer` (`adapters/Renderer.ts`) plus the many `adapters/renderer/Renderer*` modules drive the canvas (tiles, entities, HUD, combat animation, particles, bitmap font, transitions). `InputManager` and `TextResources` (i18n) also live here.
- **`infra/`** — serialization and external services. `infra/share/` is the **URL-share pipeline**: `ShareEncoder`/`ShareDecoder`/`ShareUtils` plus per-concern codecs (matrix, position, text, variable) compress the full `GameState` into the URL. `FirebaseShareTracker` records share events to Firestore (write-only — nothing reads them back). The Explore listing is **not** live: `ExploreModal` fetches the curated static `public/jam-games.json`, so adding a community game needs a commit.

### Combat

Combat flow is governed by a 7-state machine (`CombatStateMachine`) integrated into `CombatManager`: IDLE, PLAYER_WINDUP, PLAYER_ATTACKING, ENEMY_WINDUP, ENEMY_ATTACKING, ENEMY_DEATH, PLAYER_DEATH. Player and enemy attacks are intentionally symmetric (same telegraph, duration, and distance driven by `GameConfig.combat`). Damage is applied only after the wind-up animation completes and after a melee-range re-check, so the player can escape mid-animation. Death is a timed animation (rotate → fade/float), not an instant removal.

### Editor (`src/editor/`)

`EditorManager` orchestrates the editing UI through many single-responsibility `Editor*Service` / `Editor*` modules (tiles, NPCs, enemies, objects, palette, world, history/undo, share, project save) and per-entity edit modals. Renderers under `editor/modules/renderers/` draw editor panels. The editor never mutates engine state directly — it goes through the `TinyRpgApi` bridge.

### Online multiplayer

Two players share a world: one **host** runs the full simulation; the **guest** relays inputs and applies state diffs. The server is a PartyKit room (`partykit/src/party.ts`, max 2 players, 10s reconnect grace). On the client, `OnlineCoordinator` (engine side) and the `src/online/` classes (broadcaster, state sync, input relay, position sender) implement the role split. See the detailed protocol section in `README.md` before touching multiplayer.

### SDK (`src/sdk/`)

A separate, publishable builder API (npm package `tiny-rpg-studio-sdk`). `TinyRPGBuilder` (exported as `TinyRPG`) and `RoomBuilder` let users construct games programmatically and produce a share payload. Built independently with `npm run build:sdk` (`vite.sdk.config.ts` + `tsconfig.sdk.json`); only `dist/sdk/**` is published (see `package.json` `files`/`exports`).

### Config (`src/config/`)

`GameConfig` and `EditorConfig` centralize tunable constants (world size, combat timing, etc.), each paired with a `*Schema` validator. Prefer reading constants from these configs over hard-coding values so behavior stays consistent across systems.
