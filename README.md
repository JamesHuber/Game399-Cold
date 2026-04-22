# Cold Star

Godot-first game project for the Cold Star migration.

## Primary Runtime (Godot)

Use the Godot project under `godot/` as the source of truth for gameplay development.

### Open and run

1. Open Godot 4.x.
2. Import project file: `godot/project.godot`.
3. Run the default scene.

See `godot/README.md` for current phase status, controls, and debug tooling.

## Controls (Current Prototype)

- Movement: `W/S`
- Turn: `A/D`
- Sword: `Mouse Left`
- Zap: `Mouse Right`
- Defend: `Space`
- Dodge: `Shift`
- Interact: `E`
- Reset run: `R`
- Debug HUD: `F3`
- Debug wireframe: `F4`
- Debug checklist next/toggle: `F5` / `F6`

## Project Status

- Migration plan and phase breakdown: `MIGRATION.md`
- Godot bootstrap + implementation status: `godot/README.md`
- Phase 7 handoff notes: `docs/HANDOFF_GODOT.md`
- Web prototype maintenance/deprecation policy: `docs/WEB_PROTOTYPE_STATUS.md`

## Web Prototype

The legacy web prototype remains in the repository as a reference implementation and fallback testbed.

It is not the primary runtime for new feature work. For current maintenance expectations, see `docs/WEB_PROTOTYPE_STATUS.md`.
