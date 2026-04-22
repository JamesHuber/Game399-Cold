# Cold Star Godot Handoff (Phase 7)

This document records migration cutover decisions and the expected day-to-day workflow now that the Godot path is the primary runtime.

## Cutover Decision

- Primary runtime: `godot/`
- Primary gameplay scripts: `godot/scripts/`
- Primary scene: `godot/scenes/Main.tscn`
- Debug and parity verification: in-game debug panel (`F3`) and checklist flow (`F5` / `F6`)

## What Is Considered Done

- Core gameplay loop migrated with parity goals across movement, combat, AI, puzzle, UI, and audio hooks.
- Phase 6 quality pass tools are in place:
  - Runtime perf counters
  - Debug toggles
  - Manual + auto parity checklist signals
  - Fast reset/death restart loop

## Active Development Workflow

1. Open `godot/project.godot` in Godot 4.x.
2. Run and validate gameplay changes in `Main.tscn`.
3. Use debug panel to verify parity signals while testing.
4. Keep migration notes in `godot/README.md` current as behavior changes.

## Ownership and Scope Guidance

- New gameplay features should be implemented in Godot first.
- Web prototype changes should be limited to:
  - critical fixes,
  - reference behavior capture,
  - migration validation support.
- Avoid feature divergence between Godot and web paths.

## Remaining Phase 7 Task

- Tag a migration milestone once the current state is accepted.
  - Suggested tag name: `godot-parity-m1`
  - Include short release notes summarizing parity and known gaps.
