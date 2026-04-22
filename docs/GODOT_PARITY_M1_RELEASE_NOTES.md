# godot-parity-m1

First Godot parity milestone for Cold Star migration.

## Highlights

- Godot-first runtime established under `godot/` with root documentation updated for cutover.
- Core loop parity implemented:
  - player tank movement + dodge
  - melee cone combat + block interactions
  - enemy AI (`troll` and `raider`) + projectile behavior
  - runestone charging, gate unlock, NPC interactions, and relic endpoint
- HUD parity includes HP/STA/MANA bars, objective/message/clue flow.
- Audio hooks integrated for core gameplay events with safe fallback when assets are missing.

## Quality and Debug Tooling

- Added in-game debug HUD and runtime counters:
  - `F3` toggle debug panel
  - `F4` debug wireframe
  - `F5`/`F6` checklist navigation and manual toggle
- Added parity checklist auto-signals across controls, combat, AI, puzzle, UI, and audio events.
- Player death now restarts the scene automatically using deferred reload for physics safety.

## Cutover and Governance

- Added handoff documentation in `docs/HANDOFF_GODOT.md`.
- Added web prototype maintenance-mode policy in `docs/WEB_PROTOTYPE_STATUS.md`.
- Web path remains as reference/validation only; new gameplay work is Godot-first.

## Known Gaps / Follow-up

- Audio balance and final mix pass still requires content-side verification.
- Milestone tag should be created after final review and commit.
