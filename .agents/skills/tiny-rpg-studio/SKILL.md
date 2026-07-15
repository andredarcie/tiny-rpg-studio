# Tiny RPG Studio Project Skill

Use this skill when working in the Tiny RPG Studio repository.

## Project Context

Tiny RPG Studio is a web-based game engine and editor for making tiny top-down RPG adventures in a 3x3 world. It focuses on small, shareable games built in the browser.

Core authoring features include:

- Tile placement.
- Sprite, NPC, enemy, object, and interactable placement.
- Dialogs and player choices.
- Variables and conditional logic.
- Items and skills.
- Background music.
- Exporting created games.
- Shareable URLs that encode the entire game as compressed base64 text in the URL.

## Development Rules

- Always try the simplest solution before introducing a complicated one.
- Change the fewest files that reasonably solve the bug or feature request.
- Follow existing project architecture and local patterns before adding new abstractions.
- Add tests for new features and for bug fixes with meaningful behavior risk.
- Keep changes focused; avoid unrelated refactors.
- Avoid them, but when needed, code comments must be in English.
- Do not commit or push unless the user explicitly asks.

## Devlog Policy

For a major new feature or a large bug fix, add an entry to `src/editor/manager/devlogData.ts`.

Small bug fixes do not need devlog entries.

## Required Checks

A task is only finished when all required checks pass perfectly:

```bash
npx tsc --noEmit
npm run test:run
npm run lint
```

If any required check cannot be run, do not report the task as fully complete. State exactly which check was not run and why.

## Implementation Guidance

- Runtime/domain logic should stay in `src/runtime/` and respect its existing boundaries.
- Editor behavior should stay in `src/editor/` and use the established editor services/modules.
- The editor should communicate with the runtime through the existing API bridge instead of reaching into engine internals.
- URL sharing and compressed game data belong in the existing `src/runtime/infra/share/` pipeline.
- Prefer project config constants over hard-coded values when behavior must stay consistent across editor and runtime.
