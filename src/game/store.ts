import { create } from 'zustand'
import {
  sfxGateLocked,
  sfxNodeCharge,
  sfxRelic,
  sfxUiSoft,
} from './audio'
import type { Vec2 } from './math'
import { clamp } from './math'

/** Horizontal reach of sword swing (cone extends to this radius; slash uses same value). */
export const MELEE_ATTACK_RANGE = 2.35 / 2

export type Enemy = {
  id: string
  pos: Vec2
  vel: Vec2
  hp: number
  kind: 'troll' | 'raider'
  hurtT: number
  shootCooldown: number
}

export type EnemyProjectile = {
  id: string
  pos: Vec2
  vel: Vec2
  life: number
}

export type Npc = {
  id: string
  pos: Vec2
  name: string
  lines: string[]
  lineIdx: number
}

export type Node = {
  id: string
  pos: Vec2
  charged: boolean
}

export type Gate = {
  id: string
  pos: Vec2
  open: boolean
}

/** Axis-aligned maze wall segment (XZ); matches CuboidCollider in Game.tsx. */
export type Barrier = {
  id: string
  x: number
  z: number
  halfX: number
  halfZ: number
}

export type Player = {
  pos: Vec2
  vel: Vec2
  facing: Vec2
  hp: number
  stamina: number
  meleeCooldown: number
  /** Brief window for sword swing animation (seconds). */
  swordSwingT: number
  zapHeat: number
  interactCooldown: number
  blocking: boolean
  dodgingT: number
}

export type World = {
  time: number
  player: Player
  enemies: Enemy[]
  enemyProjectiles: EnemyProjectile[]
  npcs: Npc[]
  nodes: Node[]
  gates: Gate[]
  barriers: Barrier[]
  message: string | null
  objective: string
  mysteryClue: string | null
  debugMode: boolean
}

const uid = () => Math.random().toString(16).slice(2)

type Rect = { minX: number; maxX: number; minY: number; maxY: number }

/** Static LOS rects besides maze barriers (none after removing fixed keep walls). */
const LOS_WALLS: Rect[] = []

function barrierFootprint(b: Barrier): Rect {
  return { minX: b.x - b.halfX, maxX: b.x + b.halfX, minY: b.z - b.halfZ, maxY: b.z + b.halfZ }
}

function inflateRect(r: Rect, pad: number): Rect {
  return { minX: r.minX - pad, maxX: r.maxX + pad, minY: r.minY - pad, maxY: r.maxY + pad }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY)
}

function rectIntersectionArea(a: Rect, b: Rect): number {
  const ix = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const iy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  if (ix <= 0 || iy <= 0) return 0
  return ix * iy
}

/** Keep first; drop any later barrier whose footprint intersects an already-kept one (volume overlap). */
function dedupeOverlappingBarriers(barriers: Barrier[]): Barrier[] {
  const kept: Barrier[] = []
  for (const b of barriers) {
    const fp = barrierFootprint(b)
    let overlap = false
    for (const k of kept) {
      if (rectIntersectionArea(fp, barrierFootprint(k)) > 1e-8) {
        overlap = true
        break
      }
    }
    if (!overlap) kept.push(b)
  }
  return kept
}

function filterBarriersAgainstRects(barriers: Barrier[], blockers: Rect[]): Barrier[] {
  return barriers.filter((b) => {
    const fp = barrierFootprint(b)
    return !blockers.some((r) => rectsOverlap(fp, r))
  })
}

function mergeBarrierAABBs(a: Barrier, b: Barrier): Barrier {
  const aL = a.x - a.halfX
  const aR = a.x + a.halfX
  const bL = b.x - b.halfX
  const bR = b.x + b.halfX
  const aB = a.z - a.halfZ
  const aT = a.z + a.halfZ
  const bB = b.z - b.halfZ
  const bT = b.z + b.halfZ
  const L = Math.min(aL, bL)
  const R = Math.max(aR, bR)
  const B = Math.min(aB, bB)
  const T = Math.max(aT, bT)
  return {
    id: 'maze-' + uid(),
    x: (L + R) * 0.5,
    z: (B + T) * 0.5,
    halfX: (R - L) * 0.5,
    halfZ: (T - B) * 0.5,
  }
}

/**
 * Combine collinear adjacent slabs whose gap along the wall is ≤ `maxGap` (or slightly overlapping).
 * `maxGap` should be at least the natural gap between corner-cut slabs (~2*wt) so same-row segments merge.
 * Produces fewer, longer barriers (one physics body each in Game.tsx).
 */
function mergeCollinearBarrierEnds(barriers: Barrier[], maxGap: number): Barrier[] {
  const isHoriz = (b: Barrier) => b.halfX >= b.halfZ
  const horiz = barriers.filter(isHoriz)
  const vert = barriers.filter((b) => !isHoriz(b))

  const mergeLine = (list: Barrier[], horizontal: boolean): Barrier[] => {
    if (list.length === 0) return []
    const sorted = [...list].sort((a, b) => {
      if (horizontal) {
        const dz = a.z - b.z
        if (Math.abs(dz) > 1e-5) return dz
        return a.x - a.halfX - (b.x - b.halfX)
      }
      const dx = a.x - b.x
      if (Math.abs(dx) > 1e-5) return dx
      return a.z - a.halfZ - (b.z - b.halfZ)
    })
    const out: Barrier[] = []
    let cur = sorted[0]
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      let merge = false
      if (horizontal) {
        const sameRow =
          Math.abs(cur.z - next.z) < 1e-4 &&
          Math.abs(cur.halfZ - next.halfZ) < 1e-5 &&
          cur.halfX >= cur.halfZ &&
          next.halfX >= next.halfZ
        const gap = next.x - next.halfX - (cur.x + cur.halfX)
        merge = sameRow && gap <= maxGap && gap >= -1e-4
      } else {
        const sameCol =
          Math.abs(cur.x - next.x) < 1e-4 &&
          Math.abs(cur.halfX - next.halfX) < 1e-5 &&
          cur.halfZ > cur.halfX &&
          next.halfZ > next.halfX
        const gap = next.z - next.halfZ - (cur.z + cur.halfZ)
        merge = sameCol && gap <= maxGap && gap >= -1e-4
      }
      if (merge) cur = mergeBarrierAABBs(cur, next)
      else {
        out.push(cur)
        cur = next
      }
    }
    out.push(cur)
    return out
  }

  return [...mergeLine(horiz, true), ...mergeLine(vert, false)]
}

/**
 * Perfect maze on a 1×1 cell grid (−13…13). Walls are thin slabs on grid lines so cell interiors stay walkable.
 * Slabs are shortened by `wt` at corners so H/V segments meet without overlapping; any remaining overlap is removed by dedupe.
 */
function buildMazeBarriers(): Barrier[] {
  const cw = 1
  const R = 26
  const C = 26
  const ox = -13
  const oz = -13
  /**
   * Half-thickness of each wall slab. Inner-face clearance across a 1-unit cell with two parallel walls = 1 - 2*wt.
   * Player collision is Ball(radius 0.45) → needs ≥0.9 m; wt=0.06 gave 0.88 m (too tight).
   */
  const wt = 0.019
  /** Run length along an edge between corner cuts (fits inside the 1×1 cell grid). */
  const halfAlong = 0.5 - wt

  const h: boolean[][] = []
  const v: boolean[][] = []
  for (let r = 0; r < R - 1; r++) {
    h[r] = []
    for (let c = 0; c < C; c++) h[r][c] = true
  }
  for (let r = 0; r < R; r++) {
    v[r] = []
    for (let c = 0; c < C - 1; c++) v[r][c] = true
  }

  const visited: boolean[][] = Array.from({ length: R }, () => Array(C).fill(false))
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const

  function shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  function dfs(r: number, c: number) {
    visited[r][c] = true
    const order = [...dirs]
    shuffle(order)
    for (const [dr, dc] of order) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue
      if (visited[nr][nc]) continue
      if (dr === 1) h[r][c] = false
      else if (dr === -1) h[r - 1][c] = false
      else if (dc === 1) v[r][c] = false
      else if (dc === -1) v[r][c - 1] = false
      dfs(nr, nc)
    }
  }
  dfs(0, 0)

  const midC = Math.floor(C / 2)
  const midR = Math.floor(R / 2)
  const southBorder = Array<boolean>(C).fill(true)
  const northBorder = Array<boolean>(C).fill(true)
  const westBorder = Array<boolean>(R).fill(true)
  const eastBorder = Array<boolean>(R).fill(true)
  southBorder[midC] = false
  northBorder[midC] = false
  westBorder[midR] = false
  eastBorder[midR] = false

  const out: Barrier[] = []
  const pushH = (x: number, z: number) => {
    out.push({ id: 'maze-' + uid(), x, z, halfX: halfAlong, halfZ: wt })
  }
  const pushV = (x: number, z: number) => {
    out.push({ id: 'maze-' + uid(), x, z, halfX: wt, halfZ: halfAlong })
  }

  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C; c++) {
      if (h[r][c]) pushH(ox + (c + 0.5) * cw, oz + (r + 1) * cw)
    }
  }
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C - 1; c++) {
      if (v[r][c]) pushV(ox + (c + 1) * cw, oz + (r + 0.5) * cw)
    }
  }
  for (let c = 0; c < C; c++) {
    if (southBorder[c]) pushH(ox + (c + 0.5) * cw, oz - 0.5 * cw)
    if (northBorder[c]) pushH(ox + (c + 0.5) * cw, oz + R * cw + 0.5 * cw)
  }
  for (let r = 0; r < R; r++) {
    if (westBorder[r]) pushV(ox - 0.5 * cw, oz + (r + 0.5) * cw)
    if (eastBorder[r]) pushV(ox + C * cw + 0.5 * cw, oz + (r + 0.5) * cw)
  }

  const staticBlock = LOS_WALLS.map((r) => inflateRect(r, 0.12))
  const clearZones: Rect[] = [
    inflateRect({ minX: -2.6, maxX: 2.6, minY: -2.6, maxY: 2.6 }, 0),
    inflateRect({ minX: 2 - 1.1, maxX: 2 + 1.1, minY: -5 - 1.1, maxY: -5 + 1.1 }, 0),
    inflateRect({ minX: -6 - 1.1, maxX: -6 + 1.1, minY: 4 - 1.1, maxY: 4 + 1.1 }, 0),
    inflateRect({ minX: -1.2, maxX: 1.2, minY: 6 - 1.2, maxY: 6 + 1.2 }, 0),
    inflateRect({ minX: 2 - 1.2, maxX: 2 + 1.2, minY: 8 - 1.2, maxY: 8 + 1.2 }, 0),
    inflateRect({ minX: -2 - 1.2, maxX: -2 + 1.2, minY: 8 - 1.2, maxY: 8 + 1.2 }, 0),
    inflateRect({ minX: -1.4, maxX: 1.4, minY: 11 - 1.6, maxY: 11 + 1.6 }, 0),
    inflateRect({ minX: 5 - 1.5, maxX: 5 + 1.5, minY: 2 - 1.5, maxY: 2 + 1.5 }, 0),
    inflateRect({ minX: 8 - 1.5, maxX: 8 + 1.5, minY: -4 - 1.5, maxY: -4 + 1.5 }, 0),
  ]

  let merged = dedupeOverlappingBarriers(out)
  merged = filterBarriersAgainstRects(merged, staticBlock)
  merged = filterBarriersAgainstRects(merged, clearZones)
  merged = dedupeOverlappingBarriers(merged)
  // Merge endpoints within 0.01, and adjacent grid slabs (gap ≈ 2*wt from corner cuts).
  merged = mergeCollinearBarrierEnds(merged, Math.max(0.01, 2 * wt + 0.002))
  return merged
}

function segmentIntersectsRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  const dx = bx - ax
  const dy = by - ay
  let t0 = 0
  let t1 = 1

  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-8) return q >= 0
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
    return true
  }

  if (!clip(-dx, ax - r.minX)) return false
  if (!clip(dx, r.maxX - ax)) return false
  if (!clip(-dy, ay - r.minY)) return false
  if (!clip(dy, r.maxY - ay)) return false
  return t0 <= t1
}

function hasLineOfSight(from: Vec2, to: Vec2, barriers: Barrier[]) {
  const dynamic = barriers.map(barrierFootprint)
  const all = [...LOS_WALLS, ...dynamic]
  return !all.some((w) => segmentIntersectsRect(from.x, from.y, to.x, to.y, w))
}

export type GameActions = {
  reset(): void
  tick(dt: number): void
  setMessage(msg: string | null): void
  /** `null` = on cooldown; `true` / `false` = swung and hit an enemy or not. */
  swordAttack(): boolean | null
  zap(): void
  interactCooldown(): void
  interactNpc(npcId: string): void
  interactGate(gateId: string): void
  interactNothing(): void
  setBlocking(v: boolean): void
  /** `true` if dodge actually started. */
  startDodge(): boolean
  moveInput(dir: Vec2): void
  setFacing(dir: Vec2): void
  applyEnemyHit(enemyId: string, damage: number): void
  applyPlayerDamage(damage: number): void
  consumeEnemyProjectiles(projectileIds: string[]): void
  setNodeCharged(nodeId: string, charged: boolean): void
  setGateOpen(gateId: string, open: boolean): void
  setObjective(objective: string): void
  setPlayerPos(pos: Vec2): void
  setEnemyPos(enemyId: string, pos: Vec2): void
  toggleDebugMode(): void
}

const initialWorld = (): World => ({
  time: 0,
  player: {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    facing: { x: 1, y: 0 },
    hp: 100,
    stamina: 100,
    meleeCooldown: 0,
    swordSwingT: 0,
    zapHeat: 0,
    interactCooldown: 0,
    blocking: false,
    dodgingT: 0,
  },
  enemies: [
    {
      id: 'e-' + uid(),
      pos: { x: 5, y: 2 },
      vel: { x: 0, y: 0 },
      hp: 30,
      kind: 'troll',
      hurtT: 0,
      shootCooldown: 0,
    },
    {
      id: 'e-' + uid(),
      pos: { x: 8, y: -4 },
      vel: { x: 0, y: 0 },
      hp: 30,
      kind: 'raider',
      hurtT: 0,
      shootCooldown: 0.9,
    },
  ],
  enemyProjectiles: [],
  npcs: [
    {
      id: 'npc-captain',
      pos: { x: 2, y: -5 },
      name: 'Captain Rowan',
      lines: [
        'You are late, sellsword. The mire stinks of troll blood tonight.',
        'The north portcullis is warded by three runestones. Fill them with stormcraft and it will rise.',
        'Keep your shield up. Trolls rush when they smell fear.',
      ],
      lineIdx: 0,
    },
  ],
  nodes: [
    { id: 'n1', pos: { x: 0, y: 6 }, charged: false },
    { id: 'n2', pos: { x: 2, y: 8 }, charged: false },
    { id: 'n3', pos: { x: -2, y: 8 }, charged: false },
  ],
  gates: [{ id: 'gate-1', pos: { x: 0, y: 11 }, open: false }],
  message: 'W/S forward/back · A/D turn · Left click sword · Right click stormcraft · E interact · Shift dodge · Space guard',
  objective: 'Awaken the northern portcullis by charging all 3 runestones.',
  mysteryClue: null,
  debugMode: false,
  barriers: buildMazeBarriers(),
})

export const useGame = create<World & GameActions>((set, get) => ({
  ...initialWorld(),

  reset() {
    set(initialWorld())
  },

  setMessage(msg) {
    set({ message: msg })
  },

  moveInput(dir) {
    set((s) => {
      const speed = s.player.dodgingT > 0 ? 10 : 6
      const accel = 40
      const targetVel = { x: dir.x * speed, y: dir.y * speed }
      const vx = s.player.vel.x + (targetVel.x - s.player.vel.x) * clamp(accel * 0.016, 0, 1)
      const vy = s.player.vel.y + (targetVel.y - s.player.vel.y) * clamp(accel * 0.016, 0, 1)
      return { player: { ...s.player, vel: { x: vx, y: vy } } }
    })
  },

  setFacing(dir) {
    set((s) => ({ player: { ...s.player, facing: dir } }))
  },

  setBlocking(v) {
    set((s) => ({ player: { ...s.player, blocking: v } }))
  },

  startDodge() {
    const s = get()
    if (s.player.stamina < 20 || s.player.dodgingT > 0) return false
    set({
      player: {
        ...s.player,
        stamina: s.player.stamina - 20,
        dodgingT: 0.22,
      },
    })
    return true
  },

  swordAttack() {
    const s = get()
    if (s.player.meleeCooldown > 0 || s.player.blocking) return null
    const p = s.player.pos
    const f = s.player.facing
    const br = s.barriers
    const range = MELEE_ATTACK_RANGE
    const cosHalf = Math.cos((52 * Math.PI) / 180)
    const hit = new Set<string>()
    for (const e of s.enemies) {
      const dx = e.pos.x - p.x
      const dy = e.pos.y - p.y
      const d = Math.hypot(dx, dy)
      if (d > range || d < 1e-5) continue
      const dirx = dx / d
      const diry = dy / d
      if (f.x * dirx + f.y * diry < cosHalf) continue
      if (!hasLineOfSight(p, e.pos, br)) continue
      hit.add(e.id)
    }
    const hitEnemy = hit.size > 0
    set((prev) => {
      const enemies = prev.enemies
        .map((e) => (hit.has(e.id) ? { ...e, hp: e.hp - 10, hurtT: 0.12 } : e))
        .filter((e) => e.hp > 0)
      return {
        player: {
          ...prev.player,
          meleeCooldown: 0.38,
          swordSwingT: 0.22,
        },
        enemies,
      }
    })
    return hitEnemy
  },

  zap() {
    const s = get()
    if (s.player.zapHeat >= 1) return
    set((prev) => ({ player: { ...prev.player, zapHeat: Math.min(1, prev.player.zapHeat + 0.25) } }))
  },

  interactCooldown() {
    set((s) => {
      if (s.player.interactCooldown > 0) return s
      return { player: { ...s.player, interactCooldown: 0.25 } }
    })
  },

  interactNpc(npcId) {
    set((prev) => {
      const npcs = prev.npcs.map((n) =>
        n.id === npcId ? { ...n, lineIdx: (n.lineIdx + 1) % n.lines.length } : n,
      )
      const active = npcs.find((n) => n.id === npcId)
      if (active) sfxUiSoft()
      return active ? { npcs, message: `${active.name}: ${active.lines[active.lineIdx]}` } : prev
    })
  },

  interactGate(gateId) {
    const g = get().gates.find((x) => x.id === gateId)
    if (!g?.open) {
      sfxGateLocked()
      set({ message: 'The portcullis is sealed. The runestones still sleep.' })
      return
    }
    sfxRelic()
    set({ mysteryClue: 'An iron reliquary hums in your gauntlet. Its sigil points east.' })
    set({ message: 'You recovered the relic. (Prototype end - next region coming.)' })
  },

  interactNothing() {
    sfxUiSoft()
    set({ message: 'Nothing to interact with.' })
  },

  applyEnemyHit(enemyId, damage) {
    set((s) => ({
      enemies: s.enemies
        .map((e) => (e.id === enemyId ? { ...e, hp: e.hp - damage, hurtT: 0.12 } : e))
        .filter((e) => e.hp > 0),
    }))
  },

  applyPlayerDamage(damage) {
    set((s) => ({ player: { ...s.player, hp: Math.max(0, s.player.hp - damage) } }))
  },

  consumeEnemyProjectiles(projectileIds) {
    if (projectileIds.length === 0) return
    const kill = new Set(projectileIds)
    set((s) => ({ enemyProjectiles: s.enemyProjectiles.filter((b) => !kill.has(b.id)) }))
  },

  setNodeCharged(nodeId, charged) {
    set((s) => {
      const before = s.nodes.find((n) => n.id === nodeId)
      if (charged && before && !before.charged) sfxNodeCharge()
      return { nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, charged } : n)) }
    })
  },

  setGateOpen(gateId, open) {
    set((s) => ({ gates: s.gates.map((g) => (g.id === gateId ? { ...g, open } : g)) }))
  },

  setObjective(objective) {
    set({ objective })
  },

  setPlayerPos(pos) {
    set((s) => ({ player: { ...s.player, pos } }))
  },

  setEnemyPos(enemyId, pos) {
    set((s) => ({
      enemies: s.enemies.map((e) => (e.id === enemyId ? { ...e, pos } : e)),
    }))
  },

  toggleDebugMode() {
    set((s) => ({ debugMode: !s.debugMode }))
  },

  tick(dt) {
    set((s) => {
      const t = s.time + dt
      const player = { ...s.player }

      // Cooldowns / resources
      player.meleeCooldown = Math.max(0, player.meleeCooldown - dt)
      player.swordSwingT = Math.max(0, player.swordSwingT - dt)
      player.zapHeat = Math.max(0, player.zapHeat - dt * 0.35)
      player.interactCooldown = Math.max(0, player.interactCooldown - dt)
      player.dodgingT = Math.max(0, player.dodgingT - dt)
      player.stamina = clamp(player.stamina + dt * 18, 0, 100)

      // Integrate player
      player.pos = {
        x: player.pos.x + player.vel.x * dt,
        y: player.pos.y + player.vel.y * dt,
      }

      // Soft world bounds
      const bound = 14
      player.pos.x = clamp(player.pos.x, -bound, bound)
      player.pos.y = clamp(player.pos.y, -bound, bound)

      // Enemies
      const spawnedEnemyProjectiles: EnemyProjectile[] = []
      const enemies = s.enemies.map((e) => {
        const dx = player.pos.x - e.pos.x
        const dy = player.pos.y - e.pos.y
        const d = Math.hypot(dx, dy)
        let vx = 0
        let vy = 0
        let shootCooldown = Math.max(0, e.shootCooldown - dt)

        if (e.kind === 'raider') {
          const inSightRange = d < 12
          const seesPlayer = inSightRange && hasLineOfSight(e.pos, player.pos, s.barriers)

          if (seesPlayer && d > 8) {
            const spd = 2.4
            vx = d > 1e-3 ? (dx / d) * spd : 0
            vy = d > 1e-3 ? (dy / d) * spd : 0
          } else if (seesPlayer && d < 5.5) {
            const spd = 2.0
            vx = d > 1e-3 ? (-dx / d) * spd : 0
            vy = d > 1e-3 ? (-dy / d) * spd : 0
          } else if (!seesPlayer) {
            // If LOS is blocked, path by pressure like melee enemies until LOS is regained.
            const aggro = d < 10 ? 1 : 0.2
            const spd = 2.6 * aggro
            vx = d > 1e-3 ? (dx / d) * spd : 0
            vy = d > 1e-3 ? (dy / d) * spd : 0
          }

          if (seesPlayer && shootCooldown <= 0 && d > 1e-3) {
            const dirx = dx / d
            const diry = dy / d
            const speed = 11
            spawnedEnemyProjectiles.push({
              id: 'ep-' + uid(),
              pos: { x: e.pos.x, y: e.pos.y },
              vel: { x: dirx * speed, y: diry * speed },
              life: 1.4,
            })
            shootCooldown = 1.25
          }
        } else {
          const aggro = d < 10 ? 1 : 0.2
          const spd = 2.6 * aggro
          vx = d > 1e-3 ? (dx / d) * spd : 0
          vy = d > 1e-3 ? (dy / d) * spd : 0
        }
        return {
          ...e,
          hurtT: Math.max(0, e.hurtT - dt),
          shootCooldown,
          vel: { x: vx, y: vy },
          pos: { x: e.pos.x + vx * dt, y: e.pos.y + vy * dt },
        }
      })

      const enemyProjectiles = [...s.enemyProjectiles, ...spawnedEnemyProjectiles]
        .map((b) => ({
          ...b,
          life: b.life - dt,
          pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
        }))
        .filter((b) => b.life > 0)

      return {
        time: t,
        player,
        enemyProjectiles,
        enemies,
      }
    })
  },
}))

