# Tiny RPG Studio

Tiny RPG Studio is a browser-native RPG maker. Paint tiles, build rooms, drop NPCs/enemies/objects, and play instantly in the same page. It is intentionally small and constrained to spark creativity: build and share micro-stories in minutes as a single URL.

## Features
- Side-by-side Editor/Game tabs for instant iteration.
- Shareable games: the full game state is encoded in a single URL — no account required to play.
- Combat system with attack animations, enemy AI, and skill-based abilities.
- Editor tools for tiles, NPCs, enemies, objects, items, skills, variables, and worlds.
- Explore and play games created by the community.
- PICO-8 style bitmap font for authentic retro visuals.
- Lightweight runtime: fast load, no heavy framework dependencies.
- PWA-ready: installable as a native-like app with offline support.
- Desktop app build via Tauri.

## Requirements
- Node.js 18+ (recommended)
- npm

## Install
```bash
npm install
```

## Development
```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build
```bash
# Web
npm run build

# Desktop (requires Tauri)
npm run build:desktop
```

## Preview
```bash
npm run preview
```

## Tests
```bash
npm test
```

### E2E (Playwright)
```bash
npx playwright install
npm run test:e2e
```

## Project Structure
```
src/
  runtime/           Game engine, renderer, services, and domain logic
  editor/            Editor UI logic and services
  online/            Online multiplayer client and UI
  config/            Game and editor configuration schemas
  sdk/               Public SDK for embedding the runtime
  __tests__/         Vitest unit tests
partykit/
  src/party.ts       PartyKit server (room, player state, message routing)
public/
  styles.css         Global styles
index.html           Main entry (Vite)
vite.config.ts       Vite config
```

## Online Multiplayer Architecture

Online mode supports two players sharing a game world in real time. One player is the **host** (runs the simulation) and the other is the **guest** (receives state updates and relays inputs).

### Entry Point

Online mode is activated when the URL contains a GUID parameter (`?online-mode=<guid>` or `?modo-online=<guid>`). `main.ts` detects this and calls `OnlineModeApplication.boot()`, which shows a name prompt then connects to the PartyKit server.

### Server (`partykit/src/party.ts`)

A lightweight PartyKit room (`GameParty`) manages the session:

- Accepts up to 2 active players. First to join is **host**, second is **guest**.
- Stores each player's position, HP, equipment, and room (updated from `player-position` messages).
- Routes messages: `player-position` and `player-input` are broadcast to all; `full-state-snapshot` is forwarded only to the target connection.
- On disconnect: keeps player state for 10 seconds so a quick refresh restores the role seamlessly. If the host never returns, the oldest guest is promoted.
- On new game start (second player joins): broadcasts `game-start`. If a guest joins mid-session, sends `game-start` directly and asks the host for a `full-state-snapshot`.

### Client Responsibilities by Role

**Host**
| Class | Responsibility |
|---|---|
| `OnlineStateBroadcaster` | Diffs enemy/variable/object/item state every 50 ms and sends `world-state-diff` |
| `OnlineRoomTracker` | Tracks which rooms are occupied to activate/deactivate enemy AI |
| `OnlinePositionSender` | Broadcasts own position every 50 ms (or immediately after movement) |
| Game engine | Runs the full simulation: enemy AI, collision, pressure plates |

**Guest**
| Class | Responsibility |
|---|---|
| `OnlineStateSync` | Applies `world-state-diff` and `full-state-snapshot` to local game state; lerp-interpolates enemy positions |
| `OnlineInputRelay` | Forwards movement, attacks, and interactions to the host via `player-input` |
| `OnlinePositionSender` | Same as host — broadcasts own position |

Both roles share `OnlineClient` (PartySocket WebSocket wrapper with typed message dispatch) and `OnlineManager` (callback hub for game lifecycle events).

### State Synchronization

```
Host game loop
  └─ OnlineStateBroadcaster.tick() every 50 ms
       ├─ diff enemies, variables, objects, items
       ├─ skip if nothing changed          ← bandwidth optimization
       └─ send world-state-diff

Guest
  └─ receives world-state-diff
       └─ OnlineStateSync.applyDiff()
            ├─ update enemy positions (lerp toward target)
            └─ update variables / objects / items
```

On guest join, the host sends a `full-state-snapshot` so the guest starts with a consistent world state. Snapshots include enemies, variables, objects, and items — player positions are handled separately via `player-position`.

### Player Position Sync

`OnlinePositionSender` polls every 50 ms and sends `player-position` only when coordinates or room have changed (or when forced with `sendNow(true)`). The message carries position, facing direction, HP, and equipment so the other player's HUD stays in sync without a separate stats channel.

When a new player is detected in the `player-list` event, the **host immediately force-sends their position** so the newcomer sees them even if the host is standing still.

### Guest Input Flow

```
Guest presses key
  → GameEngine fires onOnlineMove / onOnlineAttack / onOnlineInteract
  → OnlineInputRelay sends player-input to server
  → Server broadcasts to host
  → Host processes the action (move, damage, interact)
  → Result propagates back as world-state-diff or player-took-damage
```

### Reconnection

If the WebSocket drops, PartySocket auto-reconnects. On reconnect the client re-sends `player-join` with the same `sessionToken` (stored in `sessionStorage`). The server matches it against the 10-second grace window and restores the role without triggering a new `game-start`.

### Key Constants

| Constant | Value |
|---|---|
| Max active players | 2 |
| Reconnection grace period | 10 s |
| Broadcaster / position sender tick | 50 ms |
| Enemy lerp speed | 22 % per frame |
| Enemy death animation | 1 000 ms |
| Max chat history | 30 messages |

## Contributing
- Keep changes small and focused.
- Add tests for new logic when possible.
- Run `npm test` before opening a PR.
