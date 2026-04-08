# Cold Star — Audio plan

This document describes the intended audio design for **Cold Star: Iron March** (Blackfen Keep prototype), how it maps to code, and how to extend it. It is the single reference for music, SFX, foley, and integration.

---

## Stack

- **Howler.js** — shared Web Audio context, master gain, `Howl` for file-based loops and one-shots.
- **Procedural SFX** (`src/game/audio.ts`) — oscillators routed to `Howler.masterGain` so volume/mute stay consistent with sampled audio.
- **Static files** — place royalty-free assets under `public/audio/` (e.g. `public/audio/music/`, `public/audio/sfx/`) and reference them as `/audio/...` in `Howl` `src` arrays.

---

## Licensing & sourcing

Prefer assets that allow commercial use without ambiguity:

- **CC0** (e.g. [Kenney](https://kenney.nl/assets) packs such as RPG Audio — zip link on each asset page).
- **Mixkit**, **Pixabay** — check each asset’s license page before shipping.
- Keep a **`LICENSE` or `CREDITS.txt`** next to downloaded packs noting pack name, author, and license.

Do not commit unclearly licensed files.

---

## Current implementation (code)

| Trigger | Sound | Location |
|--------|--------|----------|
| Left click sword | `sfxSword()` procedural | `Game.tsx` `Controls` |
| Right click stormcraft | `sfxZap()` procedural | `Game.tsx` `Controls` |
| All runestones charged → gates open | `sfxSting()` procedural | `Game.tsx` `WorldStep` (`gates` effect) |
| User gesture / unlock | `resumeAudio()` | Inputs, HUD reset |

---

## Desired audio (roadmap)

### Music & beds

- **Exploration / tension loop** — sparse, cold; plays during normal play.
- **Combat layer (optional)** — crossfade when enemies have LOS or projectiles are active.
- **Puzzle payoff** — reinforce gate-open moment (alongside or replacing part of `sfxSting`).
- **Victory / relic** — short cue when the gate interaction succeeds (prototype end).

### Combat & player

- **Sword** — separate **swing** vs **hit** (only hit when `swordAttack()` damages an enemy — see `store.ts`).
- **Block** — raise on Space; **clang / absorb** when a projectile is blocked (`WorldStep`).
- **Dodge** — whoosh on `startDodge()` (`store.ts`).
- **Movement** — subtle loop scaled by speed (optional).

### Stormcraft & puzzle

- **Charge** — electric layer while `zapHeat` is building (loop or throttled one-shots).
- **Runestone** — distinct **per-node charge** when `setNodeCharged` becomes true.
- **Ambient node hum** (optional) — near uncharged nodes in zap range.

### Enemies

- **Raider cast** — when a projectile spawns in `tick` (`store.ts`).
- **Projectile** — wall hit vs player hit vs blocked (different cues).
- **Troll / raider** — hurt grunt (`hurtT`), death on removal.
- **Footsteps / idle** (optional) — low rate while moving.

### Player damage & failure

- **Hurt** — `applyPlayerDamage` and contact damage (`WorldStep`).
- **Death** — before `reset()` when `hp <= 0`.

### Interaction & UI

- **NPC line** — `interactNpc` (message advance).
- **Nothing to interact** — `interactNothing`.
- **Gate sealed** — `interactGate` when gate not open.
- **Relic / success** — open gate interaction success.
- **Objective update** — optional small UI tick on `setObjective`.
- **Reset** — HUD `reset` button.

---

## File layout (recommended)

```
public/audio/
  music/
    exploration.ogg    # loop
  sfx/
    sword_swing.ogg
    sword_hit.ogg
    ...
  CREDITS.txt          # sources and licenses
```

Load with Howler: `new Howl({ src: ['/audio/sfx/sword_hit.ogg'], volume: 0.6 })`.

---

## Code hooks (where to call audio)

| Event | Primary hook |
|-------|----------------|
| Swing vs hit | `swordAttack` in `store.ts` |
| Block / parry | Projectile branch in `Game.tsx` `WorldStep` |
| Dodge | `startDodge` in `store.ts` |
| Zap / nodes / gates | `zap`, `setNodeCharged`, gate `useEffect` in `WorldStep`, `interactGate` |
| Enemy shots / hurt / death | `tick` in `store.ts` |
| Projectile impacts | `WorldStep` enemy projectile loop |
| Player hurt / death | `applyPlayerDamage`, HP check in `WorldStep` |
| NPC / interact | `interactNpc`, `interactNothing`, sealed gate in `interactGate` |

---

## Mixing

- Use separate **music** vs **SFX** `Howl` groups or volume multipliers so settings can mute music independently later.
- Keep procedural and sampled SFX on the same master path (`Howler.masterGain` for procedural; Howler’s built-in chain for `Howl`).

---

## Changelog

- *Initial plan — procedural sword, zap, sting; Howler context shared.*
