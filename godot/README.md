# Godot Migration Bootstrap (Phase 0)

This folder contains the initial Godot project scaffold for Cold Star migration.

## Included

- `project.godot` with:
  - boot scene (`res://scenes/Main.tscn`)
  - autoload startup config (`GameConfig`)
  - audio bus layout
  - baseline physics layer names
- `default_bus_layout.tres` with buses:
  - `Master`, `Music`, `SFX`, `UI`
- `scripts/GameConfig.gd`:
  - seeds input actions for parity with web prototype controls
- `scenes/Main.tscn`:
  - minimal boot scene with light/camera/ground collider

## Input Actions Seeded

- `move_forward` (`W`)
- `move_back` (`S`)
- `turn_left` (`A`)
- `turn_right` (`D`)
- `attack` (`Mouse Left`)
- `zap` (`Mouse Right`)
- `defend` (`Space`)
- `dodge` (`Shift`)
- `interact` (`E`)
- `reset_run` (`R`)

## Open and Run

1. Open Godot 4.x.
2. Import/open this folder as a project:
   - `.../Cold Star/godot/project.godot`
3. Run project.

You should get a clean boot into the placeholder scene.

## Phase 1 Status

Completed scaffold:

- `scripts/PlayerController.gd`
  - Tank controls (`W/S` move, `A/D` turn)
  - Accel + damping
  - Basic dodge burst (`Shift`)
- `scripts/CameraFollow.gd`
  - 3rd-person follow offset behind player
  - Smoothed follow + look-at interpolation
- `scenes/Main.tscn`
  - `CharacterBody3D` player
  - Graybox arena floor + 4 wall colliders
  - Directional light + active camera rig

## Phase 2 Status

Implemented in `Main.tscn` + scripts:

- `scripts/PlayerController.gd`
  - Sword cone attack with cooldown and LOS checks
  - Defend state (`Space`) with hard attack lockout while blocking
  - Timed white slash indicator mesh in front of player
  - Shield visibility toggled only while defending
- `scripts/EnemyDummy.gd`
  - Enemy test dummies in group `enemy`
  - Hurt flash callback (`receive_hit`) for attack feedback
- `scenes/Main.tscn`
  - Added shield/slash meshes to player
  - Added two enemy dummies for cone-hit validation

## Phase 3 Status

Implemented:

- `scripts/EnemyAI.gd`
  - Enemy movement + role behavior:
    - `troll` melee pressure
    - `raider` ranged spacing + line-of-sight checks
  - Attack reaction and death removal
- `scenes/EnemyProjectile.tscn` + `scripts/EnemyProjectile.gd`
  - Projectile spawn, velocity, lifetime, player/world hit handling
- `scripts/PlayerController.gd`
  - Added player group registration and projectile-hit handling
  - Defend branch now blocks projectile damage (stamina cost)
- `scenes/Main.tscn`
  - Replaced static dummies with behavior-driven enemies
  - Added `Projectiles` holder node for runtime projectile instances

## Phase 4 Status

Implemented:

- `scripts/MainController.gd`
  - Objective/message/clue state
  - Runestone charging when player uses zap in range
  - Gate unlock trigger once all runestones are charged
- `scripts/Runestone.gd`
  - Charge state + visual updates
- `scripts/Gate.gd`
  - Locked/open interaction behavior and end-of-prototype relic messaging
- `scripts/Npc.gd`
  - NPC dialogue cycling on interact
- `scripts/PlayerController.gd`
  - Added interact action routing to nearest interactable
- `scenes/Main.tscn`
  - Added runestones, gate, NPCs, and a simple HUD for objective/message/clue text

## Phase 5 Status

Implemented:

- `scripts/MainController.gd`
  - Added HUD bar updates (`HP`, `STA`, `MANA`) driven from player state
  - Added `play_sfx(name)` and optional audio stream loading from `res://audio/`
  - Added optional music start on boot when `res://audio/music/exploration.mp3` exists
- `scripts/PlayerController.gd`
  - Added zap meter (`_zap_heat`) and HUD getters (`get_hp_norm`, `get_stamina_norm`, `get_mana_norm`)
  - Added SFX event calls for sword swing/hit, dodge, block, hurt, interact miss, zap
- `scripts/EnemyAI.gd` and `scripts/EnemyProjectile.gd`
  - Added SFX hooks for enemy shot and projectile wall impact
- `scripts/Gate.gd` and `scripts/Npc.gd`
  - Added gate/NPC interaction SFX hooks
- `scenes/Main.tscn`
  - Added HUD progress bars (`HPBar`, `STAbar`, `MANABar`)
  - Added audio players on buses (`MusicPlayer`, `SFXPlayer`, `UIPlayer`)

### Audio file placement

To enable playback, place files under:

- `godot/audio/music/exploration.mp3`
- `godot/audio/sfx/*.ogg` (e.g. `zap.ogg`, `sword_swing.ogg`, `sword_hit.ogg`, `block.ogg`, etc.)

If files are missing, gameplay continues silently (safe fallback).

## Phase 6 Status

- Added debug panel/toggles and runtime perf counters:
  - `F3` toggle debug HUD
  - `F4` toggle wireframe collision view
  - `F5` cycle parity checklist selection
  - `F6` toggle selected checklist item pass/fail
  - `R` reload current scene for fast parity reruns
  - Checklist now auto-updates from gameplay signals (combat, AI, puzzle, UI, and audio hooks)
- Added death handling:
  - Player death triggers run restart automatically
  - Scene reload uses deferred call for physics-safe reset

## Phase 7 Start (Cutover and Cleanup)

Started:

- Root `README.md` updated for Godot-first run instructions.
- Added handoff document: `docs/HANDOFF_GODOT.md`.
- Added web prototype maintenance policy: `docs/WEB_PROTOTYPE_STATUS.md`.

Remaining:

- Tag migration milestone when current baseline is approved.
