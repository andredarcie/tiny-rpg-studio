# Engine Architecture

This document describes the Tiny RPG Maker engine as an architecture diagram rather than a class inventory.

## Architecture Overview

```mermaid
flowchart TB
    User[Player / Creator]
    Browser[Browser Runtime]

    User --> Browser

    subgraph AppShell[Application Shell]
        Bootstrap[src/main.ts<br/>TinyRPGApplication]
        PublicApi[TinyRpgApi]
        Localization[TextResources]
    end

    subgraph EditorLayer[Editor Layer]
        EditorUI[Editor UI Controllers]
        EditorServices[Editor Services<br/>tiles, NPCs, enemies, objects, world, palette, history, sharing]
        EditorState[EditorState]
    end

    subgraph RuntimeLayer[Runtime Layer]
        Engine[GameEngine<br/>runtime orchestration]
        RuntimeServices[Runtime Services<br/>movement, interaction, combat, NPCs, tiles, dialog]
        Input[InputManager]
    end

    subgraph DomainLayer[Domain and State Layer]
        GameState[GameState]
        DomainManagers[Domain Managers<br/>player, world, enemies, objects, variables, skills, items, dialog]
        Definitions[Definitions and Entities<br/>tiles, enemies, NPCs, skills, items, sprites]
        Config[GameConfig]
    end

    subgraph AdapterLayer[Adapter Layer]
        Renderer[Renderer<br/>canvas renderer]
        RenderModules[Render Modules<br/>tiles, entities, HUD, overlays, dialogs, minimap, effects, transitions]
        ShareInfra[Share Infrastructure<br/>encoder, decoder, URL helpers]
    end

    subgraph Platform[Browser Platform]
        DOM[DOM Events / HTML UI]
        Canvas[Canvas]
        URL[Location / URL]
    end

    Bootstrap --> Engine
    Bootstrap --> EditorUI
    Bootstrap --> PublicApi
    Bootstrap --> ShareInfra
    Bootstrap --> Localization

    EditorUI --> EditorServices
    EditorServices --> EditorState
    EditorServices --> Engine
    EditorUI --> DOM

    PublicApi --> Engine

    Input --> DOM
    Engine --> Input
    Engine --> RuntimeServices
    Engine --> GameState
    Engine --> Renderer
    Engine --> Config

    RuntimeServices --> GameState
    RuntimeServices --> Renderer

    GameState --> DomainManagers
    GameState --> Definitions
    GameState --> Config

    Renderer --> RenderModules
    Renderer --> Canvas
    Renderer --> GameState

    ShareInfra --> URL
    ShareInfra --> GameState
```

## Layer Responsibilities

### Application shell

- `src/main.ts` composes the application.
- It wires the game runtime, editor, localization, and sharing entry points.
- It also exposes `TinyRpgApi` as a thin integration surface.

### Editor layer

- The editor is centered on `src/editor/EditorManager.ts`.
- Its job is authoring and inspection, not core gameplay logic.
- Editor services mutate game data through `GameEngine`, which keeps runtime behavior consistent between play mode and edit mode.

### Runtime layer

- `src/runtime/services/GameEngine.ts` is the orchestration boundary for live gameplay.
- It coordinates input, movement, combat, dialog, NPC behavior, enemy loops, and redraws.
- Runtime services contain gameplay workflows and call into state plus rendering.

### Domain and state layer

- `src/runtime/domain/GameState.ts` is the central state boundary.
- It owns the persistent game definition and the mutable runtime state.
- Specialized state managers partition responsibilities for player state, world state, enemies, objects, variables, skills, items, and dialog.

### Adapter layer

- `Renderer` is the visual adapter between engine state and the canvas.
- Share infrastructure is the serialization adapter between game data and URLs/export formats.
- These modules sit outside the core domain and translate state into platform-facing behavior.

## Architectural Reading

- The architecture is centered on `GameEngine` as the orchestrator and `GameState` as the source of truth.
- The editor is not a separate engine. It is a client of the runtime.
- Rendering and sharing are adapters around the domain, not the domain itself.
- Configuration and static definitions feed both runtime behavior and editor tooling.

## Main Runtime Flow

```mermaid
flowchart LR
    A[DOM input or editor action] --> B[GameEngine]
    B --> C[Runtime service]
    C --> D[GameState]
    D --> E[Renderer]
    E --> F[Canvas output]
```

## Why this is the architecture

- It shows subsystem boundaries instead of every concrete class.
- It makes the dependency direction explicit.
- It separates orchestration, domain state, adapters, and authoring tooling.
- It matches the current codebase structure in `src/main.ts`, `src/editor/`, `src/runtime/services/`, `src/runtime/domain/`, `src/runtime/adapters/`, and `src/runtime/infra/share/`.
