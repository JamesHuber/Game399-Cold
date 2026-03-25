import { create } from 'zustand'
import type { Vec2 } from './math'
import { clamp } from './math'

export type Enemy = {
  id: string
  pos: Vec2
  vel: Vec2
  hp: number
  kind: 'troll' | 'raider'
  hurtT: number
  shootCooldown: number
}

export type Bullet = {
  id: string
  pos: Vec2
  vel: Vec2
  life: number
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

export type Player = {
  pos: Vec2
  vel: Vec2
  facing: Vec2
  hp: number
  stamina: number
  gunCooldown: number
  zapHeat: number
  interactCooldown: number
  blocking: boolean
  dodgingT: number
}

export type World = {
  time: number
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  enemyProjectiles: EnemyProjectile[]
  npcs: Npc[]
  nodes: Node[]
  gates: Gate[]
  message: string | null
  objective: string
  mysteryClue: string | null
  debugMode: boolean
}

const uid = () => Math.random().toString(16).slice(2)

type Rect = { minX: number; maxX: number; minY: number; maxY: number }

// Must match the inner wall colliders defined in Game.tsx.
const LOS_WALLS: Rect[] = [
  { minX: 0 - 4.25, maxX: 0 + 4.25, minY: 4.8 - 0.35, maxY: 4.8 + 0.35 },
  { minX: -5.2 - 0.35, maxX: -5.2 + 0.35, minY: -1.2 - 3.1, maxY: -1.2 + 3.1 },
  { minX: 5.4 - 0.35, maxX: 5.4 + 0.35, minY: -3.2 - 3.6, maxY: -3.2 + 3.6 },
  { minX: 0.8 - 3.1, maxX: 0.8 + 3.1, minY: -7.0 - 0.35, maxY: -7.0 + 0.35 },
]

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

function hasLineOfSight(from: Vec2, to: Vec2) {
  return !LOS_WALLS.some((w) => segmentIntersectsRect(from.x, from.y, to.x, to.y, w))
}

export type GameActions = {
  reset(): void
  tick(dt: number): void
  setMessage(msg: string | null): void
  fireBullet(): void
  zap(): void
  interactCooldown(): void
  interactNpc(npcId: string): void
  interactGate(gateId: string): void
  interactNothing(): void
  setBlocking(v: boolean): void
  startDodge(): void
  moveInput(dir: Vec2): void
  setFacing(dir: Vec2): void
  applyEnemyHit(enemyId: string, damage: number): void
  applyPlayerDamage(damage: number): void
  consumeBullets(bulletIds: string[]): void
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
    gunCooldown: 0,
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
      pos: { x: -4, y: -2 },
      vel: { x: 0, y: 0 },
      hp: 30,
      kind: 'raider',
      hurtT: 0,
      shootCooldown: 0.9,
    },
  ],
  bullets: [],
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
    {
      id: 'npc-abbot',
      pos: { x: -6, y: 4 },
      name: 'Abbot Mirek',
      lines: [
        'The Black Comet omen was carved here centuries ago.',
        'Bring me the relic beyond the gate and we may yet save this keep.',
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
  message: 'W/S forward/back · A/D turn · Left click crossbow bolt · Right click stormcraft · E interact · Shift dodge · Space guard',
  objective: 'Awaken the northern portcullis by charging all 3 runestones.',
  mysteryClue: null,
  debugMode: false,
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
    set((s) => {
      if (s.player.stamina < 20 || s.player.dodgingT > 0) return s
      return {
        player: {
          ...s.player,
          stamina: s.player.stamina - 20,
          dodgingT: 0.22,
        },
      }
    })
  },

  fireBullet() {
    const s = get()
    if (s.player.gunCooldown > 0) return
    const f = s.player.facing
    const speed = 18
    const muzzleOffset = 0.38
    set((prev) => ({
      bullets: [
        ...prev.bullets,
        {
          id: 'b-' + uid(),
          pos: {
            x: prev.player.pos.x + f.x * muzzleOffset,
            y: prev.player.pos.y + f.y * muzzleOffset,
          },
          vel: { x: f.x * speed, y: f.y * speed },
          life: 1.0,
        },
      ],
      player: { ...prev.player, gunCooldown: 0.12 },
    }))
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
      return active ? { npcs, message: `${active.name}: ${active.lines[active.lineIdx]}` } : prev
    })
  },

  interactGate(gateId) {
    const g = get().gates.find((x) => x.id === gateId)
    if (!g?.open) {
      set({ message: 'The portcullis is sealed. The runestones still sleep.' })
      return
    }
    set({ mysteryClue: 'An iron reliquary hums in your gauntlet. Its sigil points east.' })
    set({ message: 'You recovered the relic. (Prototype end - next region coming.)' })
  },

  interactNothing() {
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

  consumeBullets(bulletIds) {
    if (bulletIds.length === 0) return
    const kill = new Set(bulletIds)
    set((s) => ({ bullets: s.bullets.filter((b) => !kill.has(b.id)) }))
  },

  consumeEnemyProjectiles(projectileIds) {
    if (projectileIds.length === 0) return
    const kill = new Set(projectileIds)
    set((s) => ({ enemyProjectiles: s.enemyProjectiles.filter((b) => !kill.has(b.id)) }))
  },

  setNodeCharged(nodeId, charged) {
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, charged } : n)) }))
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
      player.gunCooldown = Math.max(0, player.gunCooldown - dt)
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

      // Bullets
      const bullets = s.bullets
        .map((b) => ({
          ...b,
          life: b.life - dt,
          pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
        }))
        .filter((b) => b.life > 0)

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
          const seesPlayer = inSightRange && hasLineOfSight(e.pos, player.pos)

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
        bullets,
        enemyProjectiles,
        enemies,
      }
    })
  },
}))

