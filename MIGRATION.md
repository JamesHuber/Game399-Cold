# Cold Star -> Godot Migration Plan

This plan migrates the current web prototype (`React + Three.js + Rapier + Zustand + Howler`) to a native Godot project while keeping gameplay parity first, then improving architecture.

## Goals

- Keep the current game feel and feature set during migration.
- Minimize downtime by migrating in phases with playable checkpoints.
- Use Godot-native systems for scene, physics, input, audio, and UI.
- Use MCP-assisted workflow for repetitive editor/task automation and validation.

## Non-Goals (for first migration pass)

- Major redesign of mechanics.
- Visual overhaul.
- Multiplayer/networking.
- Full content expansion.

## Current System Mapping (Source -> Target)

- `React components / R3F scene` -> `Godot scenes (.tscn) + nodes`.
- `Zustand world state` -> `GameState singleton (autoload)` + node-local state.
- `Rapier collisions/casts` -> `CharacterBody3D`, `Area3D`, `PhysicsDirectSpaceState3D` ray/shape queries.
- `Howler + procedural/audio files` -> `AudioStreamPlayer(3D/2D)` + buses + imported assets.
- `HUD (HTML/CSS)` -> `CanvasLayer + Control` UI.

## Phase 0 - Repo and Tooling Setup (1-2 days)

### Deliverables

- New Godot project folder in repo (e.g. `godot/`).
- Branch strategy for migration (`migration/godot` already created).
- Basic folder conventions:
  - `godot/scenes/`
  - `godot/scripts/`
  - `godot/assets/`
  - `godot/ui/`
  - `godot/audio/`

### Tasks

- Create Godot project (4.x).
- Configure project settings:
  - Input map actions matching current controls.
  - Physics layers/masks for player/enemy/projectile/world/interactables.
  - Audio buses (`Master`, `Music`, `SFX`, optional `UI`).
- Confirm MCP server connectivity and editor command round-trip.

### Exit Criteria

- Project opens cleanly.
- Empty boot scene runs.
- MCP can inspect and update project files as needed.

## Phase 1 - Core Play Loop Skeleton (2-4 days)

### Deliverables

- Playable graybox scene with:
  - Player movement (tank controls),
  - Camera rig (3rd person follow),
  - World bounds and basic obstacles.

### Tasks

- Implement `PlayerController.gd`:
  - `W/S` throttle, `A/D` turn.
  - Velocity smoothing to match current feel.
- Implement `CameraRig.gd`:
  - Follow and look-at interpolation.
- Build temporary world geometry and collision.

### Exit Criteria

- Movement/camera feel roughly matches current prototype.
- Stable 60 FPS on test machine.

## Phase 2 - Combat and Defensive Systems (3-5 days)

### Deliverables

- Sword attack cone logic with cooldown.
- White slash indicator in front of player.
- Shield defend state and dodge behavior.
- Block-vs-hit interactions.

### Tasks

- Port attack constants and logic:
  - Range, cone half-angle, cooldown.
- Ensure attack/defend mutual exclusion (already desired behavior).
- Implement projectile collision branches:
  - wall impact,
  - blocked,
  - player damage.
- Add VFX placeholders for swing and impacts.

### Exit Criteria

- Same combat outcomes as web version for scripted test cases.
- No simultaneous attack+defend exploit.

## Phase 3 - AI, Projectiles, and Physics Interactions (3-5 days)

### Deliverables

- Enemy types (`troll`, `raider`) with parity behavior:
  - chase logic,
  - LOS checks,
  - ranged shooting cadence.
- Enemy projectiles with lifetime and hit handling.

### Tasks

- Port AI tick logic into Godot process/physics loop.
- Replace Rapier casts with Godot ray/shape queries.
- Add enemy hurt/death transitions.

### Exit Criteria

- Enemy behavior parity in arena tests.
- Projectile interactions match expected damage/block rules.

## Phase 4 - Puzzle, Gate, and Narrative Interactions (2-4 days)

### Deliverables

- Runestones, charging logic, gate open state.
- NPC interaction cycling and message updates.
- Objective + clue flow to prototype endpoint.

### Tasks

- Port node charging with proximity checks while zapping.
- Implement gate unlock condition and interaction branching.
- Build interaction manager (focus, prompt, activate).

### Exit Criteria

- Full objective loop completes end-to-end in Godot.

## Phase 5 - UI and Audio Parity (2-4 days)

### Deliverables

- HUD parity: HP/STA/MANA bars, objective, message, clue, debug/reset controls.
- Integrated audio assets and bus mixing.

### Tasks

- Rebuild HUD in `CanvasLayer + Control`.
- Import `public/audio/*` equivalents into Godot project.
- Map each event trigger to SFX/music playback.
- Ensure attribution text is visible in project docs/credits menu.

### Exit Criteria

- Audio/UI behavior equivalent to current branch.

## Phase 6 - Save/Debug/Quality Pass (2-3 days)

### Deliverables

- Debug toggles, basic profiling instrumentation.
- Regression checklist and migration report.

### Tasks

- Add developer debug panel (collision, AI state, perf counters).
- Run functional parity checklist:
  - movement/combat/AI/puzzle/UI/audio.
- Fix high-impact regressions.

### Exit Criteria

- "Feature complete parity" sign-off for prototype scope.

## Phase 7 - Cutover and Cleanup (1-2 days)

### Deliverables

- Migration handoff docs.
- Optional deprecation plan for web prototype.

### Tasks

- Decide whether to keep web prototype in maintenance mode.
- Update README with Godot run instructions.
- Tag migration milestone.

### Exit Criteria

- Team can build/run/debug only from Godot path.

## MCP-Assisted Workflow

Use MCP as force multiplier, not source of truth:

- Fast codegen for boilerplate scene/script scaffolding.
- Batch refactors and naming normalization.
- Automated checklist generation from parity matrix.
- Keep all behavioral decisions validated by playtests.

## Parity Checklist (High Priority)

- Controls: movement/turn/block/dodge/sword/zap/interact/reset.
- Combat: cooldowns, cone hit detection, block stamina drain, death reset.
- AI: LOS-aware ranged enemy and melee pressure.
- Puzzle: 3 runestones -> gate opens -> relic interaction flow.
- UI: same informational hierarchy and readability.
- Audio: all migrated event hooks and volume balance.

## Risks and Mitigations

- **Physics feel mismatch** -> tune with fixed test scenarios and recorded metrics.
- **Input/camera feel drift** -> compare side-by-side clips and adjust interpolation constants.
- **Audio timing regressions** -> event-driven playback tests and bus limiter checks.
- **Scope creep** -> freeze mechanics until parity is complete.

## Suggested Timeline

- Conservative: **3-5 weeks** (solo, part-time).
- Aggressive: **10-15 focused days** for parity-only migration.

## Definition of Done

Migration is complete when:

- Godot build reproduces the full prototype loop with acceptable feel parity.
- All critical gameplay/audio/UI hooks are implemented and verified.
- Project docs and run instructions are updated for Godot-first development.

