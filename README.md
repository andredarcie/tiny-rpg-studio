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
  config/            Game and editor configuration schemas
  sdk/               Public SDK for embedding the runtime
  __tests__/         Vitest unit tests
public/
  styles.css         Global styles
index.html           Main entry (Vite)
vite.config.ts       Vite config
```

## Contributing
- Keep changes small and focused.
- Add tests for new logic when possible.
- Run `npm test` before opening a PR.
