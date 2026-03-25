import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { CuboidCollider, Physics, RigidBody, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { bindInput, createInputState, isDown } from './input'
import { angleFromVec2, clamp, norm2 } from './math'
import { resumeAudio, sfxShoot, sfxSting, sfxZap } from './audio'
import { useGame } from './store'

type ColliderMeta = { type: 'enemy' | 'npc' | 'node' | 'gate'; id: string }
const ColliderMetaContext = createContext<React.MutableRefObject<Map<number, ColliderMeta>> | null>(null)

function Controls() {
  const input = useMemo(() => createInputState(), [])
  const fireLatch = useRef(false)
  const zapLatch = useRef(false)
  const dodgeLatch = useRef(false)
  const interactLatch = useRef(false)
  const blockLatch = useRef(false)

  const moveInput = useGame((s) => s.moveInput)
  const setFacing = useGame((s) => s.setFacing)
  const fireBullet = useGame((s) => s.fireBullet)
  const zap = useGame((s) => s.zap)
  const interactCooldown = useGame((s) => s.interactCooldown)
  const interactNpc = useGame((s) => s.interactNpc)
  const interactGate = useGame((s) => s.interactGate)
  const interactNothing = useGame((s) => s.interactNothing)
  const startDodge = useGame((s) => s.startDodge)
  const setBlocking = useGame((s) => s.setBlocking)

  const { rapier, world } = useRapier()
  const meta = useColliderMeta()

  useEffect(() => bindInput(window, input), [input])

  useFrame((_, dt) => {
    // tank controls:
    // - A/D rotates
    // - W forward, S backward
    const turn = (isDown(input, 'KeyD') ? 1 : 0) - (isDown(input, 'KeyA') ? 1 : 0)
    const throttle = (isDown(input, 'KeyW') ? 1 : 0) - (isDown(input, 'KeyS') ? 1 : 0)

    const state = useGame.getState()
    const f0 = state.player.facing
    const yaw = Math.atan2(f0.y, f0.x)
    const turnSpeed = 3.3 // rad/s
    const yaw2 = yaw + turn * turnSpeed * Math.min(0.05, dt)
    const facing = norm2({ x: Math.cos(yaw2), y: Math.sin(yaw2) })
    setFacing(facing)

    const moveDir = throttle === 0 ? { x: 0, y: 0 } : norm2({ x: facing.x * throttle, y: facing.y * throttle })
    moveInput(moveDir)

    // block
    const blockNow = isDown(input, 'Space')
    if (blockNow !== blockLatch.current) {
      blockLatch.current = blockNow
      setBlocking(blockNow)
    }

    // dodge
    const dodgeNow = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight')
    if (dodgeNow && !dodgeLatch.current) startDodge()
    dodgeLatch.current = dodgeNow

    // fire (left click)
    const leftDown = (input.mouse.buttons & 1) === 1
    if (leftDown && !fireLatch.current) {
      resumeAudio()
      fireBullet()
      sfxShoot()
    }
    fireLatch.current = leftDown

    // zap (right click)
    const rightDown = (input.mouse.buttons & 2) === 2
    if (rightDown && !zapLatch.current) {
      resumeAudio()
      zap()
      sfxZap()
    }
    zapLatch.current = rightDown

    // interact (E)
    const interactNow = isDown(input, 'KeyE')
    if (interactNow && !interactLatch.current) {
      resumeAudio()
      interactCooldown()

      const p = useGame.getState().player.pos
      const shape = new rapier.Ball(2.4)
      const pos = new rapier.Vector3(p.x, 0.2, p.y)
      let did = false

      world.intersectionsWithShape(
        pos,
        new rapier.Quaternion(0, 0, 0, 1),
        shape,
        (c: any) => {
          const m = meta.current.get(c.handle)
          if (!m) return true
          if (m.type === 'npc') {
            interactNpc(m.id)
            did = true
            return false
          }
          if (m.type === 'gate') {
            interactGate(m.id)
            did = true
            return false
          }
          return true
        },
      )

      if (!did) interactNothing()
    }
    interactLatch.current = interactNow
  })

  return null
}

function useColliderMeta() {
  const ctx = useContext(ColliderMetaContext)
  if (!ctx) throw new Error('Collider meta context missing')
  return ctx
}

function RegisterCollider({
  type,
  id,
  args,
  sensor,
}: {
  type: ColliderMeta['type']
  id: string
  args: [number, number, number]
  sensor?: boolean
}) {
  const colRef = useRef<any>(null)
  const meta = useColliderMeta()

  useEffect(() => {
    const handle = colRef.current?.handle
    if (typeof handle === 'number') meta.current.set(handle, { type, id })
    return () => {
      if (typeof handle === 'number') meta.current.delete(handle)
    }
  }, [id, meta, type])

  return <CuboidCollider ref={colRef} args={args} sensor={sensor} />
}

function CameraRig() {
  const player = useGame((s) => s.player)
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const lookRef = useRef(new THREE.Vector3())

  useFrame(() => {
    const cam = camRef.current
    if (!cam) return
    // third-person: behind + above the ship, offset based on facing
    const back = new THREE.Vector3(-player.facing.x, 0, -player.facing.y)
      .normalize()
      .multiplyScalar(6.5)
    const targetPos = new THREE.Vector3(player.pos.x, 4.8, player.pos.y).add(back)

    cam.position.lerp(targetPos, 0.12)
    lookRef.current.lerp(new THREE.Vector3(player.pos.x, 0.9, player.pos.y), 0.18)
    cam.lookAt(lookRef.current)
    cam.updateProjectionMatrix()
  })

  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      position={[0, 5, 8]}
      fov={55}
      near={0.1}
      far={100}
    />
  )
}

function FogAndLights() {
  const { scene } = useThree()

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#140f0d', 0.07)
    return () => {
      scene.fog = null
    }
  }, [scene])

  return (
    <>
      <ambientLight intensity={0.22} color="#8f7b68" />
      <directionalLight position={[4, 9, 2]} intensity={1.0} color="#c6a77d" />
      <directionalLight position={[-6, 6, -4]} intensity={0.5} color="#4a3b31" />
    </>
  )
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80, 1, 1]} />
      <meshStandardMaterial color="#2a2018" roughness={1} metalness={0} />
    </mesh>
  )
}

function PlayerShip() {
  const player = useGame((s) => s.player)
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.position.set(player.pos.x, 0.22, player.pos.y)
    const yaw = angleFromVec2(player.facing)
    g.rotation.y = -yaw
  })

  return (
    <group ref={ref}>
      {/* Helmet */}
      <mesh position={[0, 0.34, 0]} castShadow>
        <sphereGeometry args={[0.16, 18, 16]} />
        <meshStandardMaterial color="#9b978a" roughness={0.72} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.32, 0.1]} castShadow>
        <boxGeometry args={[0.12, 0.09, 0.05]} />
        <meshStandardMaterial color="#6f6a5d" roughness={0.78} metalness={0.3} />
      </mesh>

      {/* Torso armor */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[0.3, 0.34, 0.2]} />
        <meshStandardMaterial color="#7b7566" roughness={0.8} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.03, 0]} castShadow>
        <boxGeometry args={[0.24, 0.12, 0.16]} />
        <meshStandardMaterial color="#6a6457" roughness={0.88} metalness={0.15} />
      </mesh>

      {/* Shoulders */}
      <mesh position={[0.2, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#8d8777" roughness={0.76} metalness={0.26} />
      </mesh>
      <mesh position={[-0.2, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#8d8777" roughness={0.76} metalness={0.26} />
      </mesh>

      {/* Shield (left arm) */}
      <mesh position={[-0.28, 0.1, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.04, 16]} />
        <meshStandardMaterial color={player.blocking ? '#c9a45a' : '#4f4338'} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Sword (right arm) */}
      <mesh position={[0.28, 0.06, 0.02]} rotation={[0, 0, -0.22]} castShadow>
        <boxGeometry args={[0.04, 0.22, 0.03]} />
        <meshStandardMaterial color="#918b7c" roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0.28, -0.08, 0.02]} rotation={[0, 0, -0.22]} castShadow>
        <boxGeometry args={[0.02, 0.28, 0.02]} />
        <meshStandardMaterial color="#a9a291" roughness={0.45} metalness={0.58} />
      </mesh>

      {/* Cloak accent */}
      <mesh position={[0, 0.08, -0.12]} castShadow>
        <boxGeometry args={[0.2, 0.26, 0.04]} />
        <meshStandardMaterial color="#5a2f24" roughness={1} metalness={0} />
      </mesh>

      {player.dodgingT > 0 ? (
        <mesh position={[0, 0.18, 0]}>
          <ringGeometry args={[0.35, 0.48, 16]} />
          <meshBasicMaterial color="#d6b56f" transparent opacity={0.6} />
        </mesh>
      ) : null}
    </group>
  )
}

function Bullets() {
  const bullets = useGame((s) => s.bullets)
  return (
    <group>
      {bullets.map((b) => (
        <group key={b.id} position={[b.pos.x, 0.2, b.pos.y]} rotation={[0, -Math.atan2(b.vel.y, b.vel.x), 0]}>
          <mesh position={[0, 0, 0.08]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color="#7b5e3f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.028, 0.08, 10]} />
            <meshStandardMaterial color="#8d8b86" roughness={0.55} metalness={0.35} />
          </mesh>
          <mesh position={[0, 0.03, -0.03]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.012, 0.05, 0.001]} />
            <meshStandardMaterial color="#d8d2c2" roughness={1} />
          </mesh>
          <mesh position={[0, -0.03, -0.03]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.012, 0.05, 0.001]} />
            <meshStandardMaterial color="#d8d2c2" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function EnemyProjectiles() {
  const enemyProjectiles = useGame((s) => s.enemyProjectiles)
  return (
    <group>
      {enemyProjectiles.map((b) => (
        <mesh key={b.id} position={[b.pos.x, 0.24, b.pos.y]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#c98266" />
        </mesh>
      ))}
    </group>
  )
}

function Enemies() {
  const enemies = useGame((s) => s.enemies)
  return (
    <group>
      {enemies.map((e) => (
        <mesh key={e.id} position={[e.pos.x, 0.22, e.pos.y]}>
          <capsuleGeometry args={[0.25, 0.35, 4, 8]} />
          <meshStandardMaterial
            color={e.hurtT > 0 ? '#c98266' : e.kind === 'raider' ? '#7c4b3b' : '#6a7a4d'}
            emissive={e.hurtT > 0 ? '#2a0700' : '#000000'}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  )
}

function NPCs() {
  const npcs = useGame((s) => s.npcs)
  return (
    <group>
      {npcs.map((n) => (
        <group key={n.id} position={[n.pos.x, 0.2, n.pos.y]}>
          <mesh>
            <cylinderGeometry args={[0.25, 0.25, 0.55, 8]} />
            <meshStandardMaterial color="#7b6a58" roughness={1} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#bda68b" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Puzzle() {
  const nodes = useGame((s) => s.nodes)
  const gates = useGame((s) => s.gates)
  const player = useGame((s) => s.player)

  const zapRadius = clamp((player.zapHeat / 1) * 2.2, 0, 2.2)

  return (
    <group>
      {nodes.map((n) => (
        <group key={n.id} position={[n.pos.x, 0.18, n.pos.y]}>
          <mesh>
            <octahedronGeometry args={[0.28, 1]} />
            <meshStandardMaterial
              color={n.charged ? '#d6b56f' : '#5a4736'}
              emissive={n.charged ? '#3a2408' : '#000000'}
              roughness={0.75}
            />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <ringGeometry args={[0.32, 0.36, 16]} />
            <meshBasicMaterial color={n.charged ? '#f4d28a' : '#7b6a58'} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      {gates.map((g) => (
        <group key={g.id} position={[g.pos.x, 0.22, g.pos.y]}>
          <mesh>
            <boxGeometry args={[2.2, 1.2, 0.35]} />
            <meshStandardMaterial
              color={g.open ? '#3a2a1a' : '#211810'}
              emissive={g.open ? '#2c1d0c' : '#000000'}
              roughness={0.9}
            />
          </mesh>
          <mesh position={[0, 0.0, 0.22]}>
            <boxGeometry args={[1.8, 0.9, 0.05]} />
            <meshBasicMaterial color={g.open ? '#e2b86c' : '#2a2018'} transparent opacity={g.open ? 0.7 : 0.25} />
          </mesh>
        </group>
      ))}

      {/* electricity hint ring */}
      {player.zapHeat > 0.05 ? (
        <mesh position={[player.pos.x, 0.05, player.pos.y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(0.1, zapRadius - 0.05), zapRadius, 24]} />
          <meshBasicMaterial color="#e2b86c" transparent opacity={0.12} />
        </mesh>
      ) : null}
    </group>
  )
}

function PostFX() {
  return (
    <EffectComposer>
      <Noise opacity={0.08} />
      <Vignette eskil={false} offset={0.35} darkness={0.65} />
    </EffectComposer>
  )
}

function WorldStep() {
  const tick = useGame((s) => s.tick)
  const gates = useGame((s) => s.gates)
  const reset = useGame((s) => s.reset)
  const setPlayerPos = useGame((s) => s.setPlayerPos)
  const setEnemyPos = useGame((s) => s.setEnemyPos)
  const applyEnemyHit = useGame((s) => s.applyEnemyHit)
  const applyPlayerDamage = useGame((s) => s.applyPlayerDamage)
  const consumeBullets = useGame((s) => s.consumeBullets)
  const consumeEnemyProjectiles = useGame((s) => s.consumeEnemyProjectiles)
  const setNodeCharged = useGame((s) => s.setNodeCharged)
  const setGateOpen = useGame((s) => s.setGateOpen)
  const setObjective = useGame((s) => s.setObjective)

  const { rapier, world } = useRapier()
  const meta = useColliderMeta()

  const prevOpen = useRef(false)
  const prevBulletPos = useRef(new Map<string, { x: number; y: number }>())
  const deathLatch = useRef(false)

  useFrame((_, dt) => {
    const clampedDt = Math.min(0.05, dt)
    const stateBefore = useGame.getState()
    prevBulletPos.current.clear()
    for (const b of stateBefore.bullets) prevBulletPos.current.set(b.id, { ...b.pos })

    tick(clampedDt)

    const state = useGame.getState()

    // Auto-restart when player dies.
    if (state.player.hp <= 0) {
      if (!deathLatch.current) {
        deathLatch.current = true
        reset()
      }
      return
    } else {
      deathLatch.current = false
    }

    // Player collision: cast a sphere and slide along obstacles.
    // We keep NPC/node/gate colliders as sensors, so only solid colliders block movement.
    const p0 = stateBefore.player.pos
    const p1 = state.player.pos
    let dxp = p1.x - p0.x
    let dzp = p1.y - p0.y
    let px = p0.x
    let pz = p0.y

    const radius = 0.45
    const quatId = new rapier.Quaternion(0, 0, 0, 1)

    // Two-pass slide: try full move, then slide remaining.
    for (let pass = 0; pass < 2; pass++) {
      const len = Math.hypot(dxp, dzp)
      if (len < 1e-5) break

      const dirx = dxp / len
      const dirz = dzp / len
      const shape = new rapier.Ball(radius)
      const shapePos = new rapier.Vector3(px, 0.22, pz)
      const shapeVel = new rapier.Vector3(dirx * len, 0, dirz * len)

      const hit = world.castShape(
        shapePos,
        quatId,
        shapeVel,
        shape,
        0.02, // target distance
        1.0, // maxToi
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        (c: any) => !meta.current.get(c.handle),
      )

      if (!hit) {
        px += dxp
        pz += dzp
        dxp = 0
        dzp = 0
        break
      }

      // Move up to the hit.
      const travel = Math.max(0, hit.time_of_impact * len - 0.02)
      px += dirx * travel
      pz += dirz * travel

      // Slide: remove the component of remaining motion into the hit normal.
      const rem = len - travel
      const nx = hit.normal1.x
      const nz = hit.normal1.z
      const dot = dirx * nx + dirz * nz
      const sx = dirx - nx * dot
      const sz = dirz - nz * dot
      dxp = sx * rem
      dzp = sz * rem
    }

    // Apply resolved position back to the store (keeps visuals + camera consistent).
    if (Math.abs(px - p1.x) + Math.abs(pz - p1.y) > 1e-4) {
      setPlayerPos({ x: px, y: pz })
    }

    // Bullet -> enemy hits (Rapier raycast).
    const bulletsToConsume: string[] = []
    for (const b of state.bullets) {
      const prev = prevBulletPos.current.get(b.id) ?? { x: b.pos.x - b.vel.x * clampedDt, y: b.pos.y - b.vel.y * clampedDt }
      const dx = b.pos.x - prev.x
      const dy = b.pos.y - prev.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-5) continue

      const ray = new rapier.Ray(new rapier.Vector3(prev.x, 0.22, prev.y), new rapier.Vector3(dx / len, 0, dy / len))
      const hit = world.castRay(ray, len, true, undefined, undefined, undefined, undefined, (c: any) => {
        const m = meta.current.get(c.handle)
        // Bullets should collide with enemies and solid world walls.
        // World-wall colliders are not registered in meta.
        return !m || m.type === 'enemy'
      })

      if (hit) {
        const m = meta.current.get(hit.collider.handle)
        if (m?.type === 'enemy') {
          applyEnemyHit(m.id, 10)
        }
        // Delete bullet on enemy OR wall hit.
        bulletsToConsume.push(b.id)
      }
    }
    consumeBullets(bulletsToConsume)

    // Enemy projectile collisions (player or wall).
    const enemyProjToConsume: string[] = []
    for (const ep of state.enemyProjectiles) {
      const prev = { x: ep.pos.x - ep.vel.x * clampedDt, y: ep.pos.y - ep.vel.y * clampedDt }
      const dx = ep.pos.x - prev.x
      const dy = ep.pos.y - prev.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-5) continue

      const ray = new rapier.Ray(new rapier.Vector3(prev.x, 0.22, prev.y), new rapier.Vector3(dx / len, 0, dy / len))
      const wallHit = world.castRay(ray, len, true, undefined, undefined, undefined, undefined, (c: any) => {
        const m = meta.current.get(c.handle)
        return !m
      })
      if (wallHit) {
        enemyProjToConsume.push(ep.id)
        continue
      }

      const ppos = useGame.getState().player.pos
      const toPlayer = Math.hypot(ep.pos.x - ppos.x, ep.pos.y - ppos.y)
      if (toPlayer < 0.65) {
        applyPlayerDamage(12)
        enemyProjToConsume.push(ep.id)
      }
    }
    consumeEnemyProjectiles(enemyProjToConsume)

    // Enemy contact damage (Rapier intersection).
    const p = state.player
    const contactShape = new rapier.Ball(0.9)
    const contactPos = new rapier.Vector3(p.pos.x, 0.22, p.pos.y)
    let touchingEnemies = 0
    world.intersectionsWithShape(
      contactPos,
      new rapier.Quaternion(0, 0, 0, 1),
      contactShape,
      (c: any) => {
        const m = meta.current.get(c.handle)
        if (m?.type === 'enemy') {
          touchingEnemies++
          return true
        }
        return true
      },
    )
    if (touchingEnemies > 0) {
      const blocked = p.blocking && p.stamina > 0 && p.dodgingT <= 0
      if (!blocked && p.dodgingT <= 0) {
        applyPlayerDamage(clampedDt * 20 * touchingEnemies)
      }
      // stamina drain remains handled in store via its own regen; we keep blocking effect "feel" by not draining here.
    }

    // Enemy collision: keep enemies from walking through solid walls.
    for (const e of useGame.getState().enemies) {
      const prevEnemy = stateBefore.enemies.find((x) => x.id === e.id)
      if (!prevEnemy) continue

      let dx = e.pos.x - prevEnemy.pos.x
      let dz = e.pos.y - prevEnemy.pos.y
      let ex = prevEnemy.pos.x
      let ez = prevEnemy.pos.y
      const enemyRadius = 0.38
      const quatIdEnemy = new rapier.Quaternion(0, 0, 0, 1)

      for (let pass = 0; pass < 2; pass++) {
        const len = Math.hypot(dx, dz)
        if (len < 1e-5) break
        const dirx = dx / len
        const dirz = dz / len

        const shape = new rapier.Ball(enemyRadius)
        const shapePos = new rapier.Vector3(ex, 0.22, ez)
        const shapeVel = new rapier.Vector3(dirx * len, 0, dirz * len)
        const hit = world.castShape(
          shapePos,
          quatIdEnemy,
          shapeVel,
          shape,
          0.02,
          1.0,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          (c: any) => !meta.current.get(c.handle),
        )

        if (!hit) {
          ex += dx
          ez += dz
          dx = 0
          dz = 0
          break
        }

        const travel = Math.max(0, hit.time_of_impact * len - 0.02)
        ex += dirx * travel
        ez += dirz * travel
        const rem = len - travel
        const nx = hit.normal1.x
        const nz = hit.normal1.z
        const dot = dirx * nx + dirz * nz
        const sx = dirx - nx * dot
        const sz = dirz - nz * dot
        dx = sx * rem
        dz = sz * rem
      }

      if (Math.abs(ex - e.pos.x) + Math.abs(ez - e.pos.y) > 1e-4) {
        setEnemyPos(e.id, { x: ex, y: ez })
      }
    }

    // Electricity puzzle: charge nodes when within range and zapping.
    if (p.zapHeat > 0.15) {
      const zapShape = new rapier.Ball(2.2)
      const zapPos = new rapier.Vector3(p.pos.x, 0.22, p.pos.y)
      world.intersectionsWithShape(
        zapPos,
        new rapier.Quaternion(0, 0, 0, 1),
        zapShape,
        (c: any) => {
          const m = meta.current.get(c.handle)
          if (m?.type === 'node') setNodeCharged(m.id, true)
          return true
        },
      )
    }

    const allCharged = useGame.getState().nodes.every((n) => n.charged)
    if (allCharged) {
      for (const g of useGame.getState().gates) {
        if (!g.open) setGateOpen(g.id, true)
      }
      setObjective('Portcullis awakened. Interact (E) at the gate to recover the relic.')
    }
  })

  useEffect(() => {
    const open = gates.some((g) => g.open)
    if (open && !prevOpen.current) {
      resumeAudio()
      sfxSting()
      prevOpen.current = true
    }
  }, [gates])

  return null
}

export function Game() {
  const meta = useRef<Map<number, ColliderMeta>>(new Map())
  const debugMode = useGame((s) => s.debugMode)
  return (
    <main className="app">
      <div className="viewport">
        <Canvas dpr={[1, 1.5]} gl={{ antialias: false }}>
          <color attach="background" args={['#160f0c']} />
          <FogAndLights />
          <CameraRig />
          <ColliderMetaContext.Provider value={meta}>
            <Physics gravity={[0, 0, 0]} timeStep="vary" colliders={false} debug={debugMode}>
              <PhysicsBodies />
              <WorldStep />
              <Controls />
            </Physics>
          </ColliderMetaContext.Provider>
          <Ground />
          <PlayerShip />
          <Bullets />
          <EnemyProjectiles />
          <Enemies />
          <NPCs />
          <Puzzle />
          <Environment preset="sunset" />
          <PostFX />
        </Canvas>
      </div>
      <HUD />
    </main>
  )
}

function PhysicsBodies() {
  const enemies = useGame((s) => s.enemies)
  const npcs = useGame((s) => s.npcs)
  const nodes = useGame((s) => s.nodes)
  const gates = useGame((s) => s.gates)

  // Enemies are kinematic and follow store positions.
  return (
    <>
      {enemies.map((e) => (
        <KinematicBox key={e.id} type="enemy" id={e.id} x={e.pos.x} z={e.pos.y} half={[0.35, 0.25, 0.35]} />
      ))}
      {npcs.map((n) => (
        <RigidBody key={n.id} type="fixed" position={[n.pos.x, 0.22, n.pos.y]} colliders={false}>
          <RegisterCollider type="npc" id={n.id} args={[0.6, 0.6, 0.6]} sensor />
        </RigidBody>
      ))}
      {nodes.map((n) => (
        <RigidBody key={n.id} type="fixed" position={[n.pos.x, 0.22, n.pos.y]} colliders={false}>
          <RegisterCollider type="node" id={n.id} args={[0.45, 0.45, 0.45]} sensor />
        </RigidBody>
      ))}
      {gates.map((g) => (
        <RigidBody key={g.id} type="fixed" position={[g.pos.x, 0.6, g.pos.y]} colliders={false}>
          <RegisterCollider type="gate" id={g.id} args={[1.2, 0.9, 0.5]} sensor />
        </RigidBody>
      ))}

      {/* World bounds */}
      <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
        <CuboidCollider args={[14.5, 2, 0.5]} position={[0, 0.2, 14.5]} />
        <CuboidCollider args={[14.5, 2, 0.5]} position={[0, 0.2, -14.5]} />
        <CuboidCollider args={[0.5, 2, 14.5]} position={[14.5, 0.2, 0]} />
        <CuboidCollider args={[0.5, 2, 14.5]} position={[-14.5, 0.2, 0]} />
      </RigidBody>

      {/* Inner keep walls */}
      <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
        <group position={[0, 0.8, 4.8]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[8.5, 1.6, 0.7]} />
            <meshStandardMaterial color="#5a4638" roughness={1} />
          </mesh>
          <CuboidCollider args={[4.25, 0.8, 0.35]} />
        </group>

        <group position={[-5.2, 0.8, -1.2]} rotation={[0, Math.PI * 0.5, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[6.2, 1.6, 0.7]} />
            <meshStandardMaterial color="#544235" roughness={1} />
          </mesh>
          <CuboidCollider args={[3.1, 0.8, 0.35]} />
        </group>

        <group position={[5.4, 0.8, -3.2]} rotation={[0, Math.PI * 0.5, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[7.2, 1.6, 0.7]} />
            <meshStandardMaterial color="#4d3d31" roughness={1} />
          </mesh>
          <CuboidCollider args={[3.6, 0.8, 0.35]} />
        </group>

        <group position={[0.8, 0.8, -7.0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[6.2, 1.6, 0.7]} />
            <meshStandardMaterial color="#5a4638" roughness={1} />
          </mesh>
          <CuboidCollider args={[3.1, 0.8, 0.35]} />
        </group>
      </RigidBody>

    </>
  )
}

function KinematicBox({
  type,
  id,
  x,
  z,
  half,
}: {
  type: ColliderMeta['type']
  id: string
  x: number
  z: number
  half: [number, number, number]
}) {
  const rb = useRef<any>(null)

  useFrame(() => {
    rb.current?.setNextKinematicTranslation({ x, y: 0.22, z })
  })

  return (
    <RigidBody ref={rb} type="kinematicPosition" position={[x, 0.22, z]} colliders={false}>
      <RegisterCollider type={type} id={id} args={half} />
    </RigidBody>
  )
}

function HUD() {
  const player = useGame((s) => s.player)
  const message = useGame((s) => s.message)
  const objective = useGame((s) => s.objective)
  const clue = useGame((s) => s.mysteryClue)
  const reset = useGame((s) => s.reset)
  const debugMode = useGame((s) => s.debugMode)
  const toggleDebugMode = useGame((s) => s.toggleDebugMode)

  return (
    <div className="hud">
      <div className="hud__top">
        <div>
          <div className="hud__title">Cold Star: Iron March</div>
          <div className="hud__subtitle">Prototype region: Blackfen Keep</div>
        </div>
        <div className="hud__actions">
          <button
            className="hud__btn"
            onClick={() => {
              toggleDebugMode()
            }}
          >
            {debugMode ? 'Exit Debug' : 'Debug Mode'}
          </button>
          <button
            className="hud__btn"
            onClick={() => {
              resumeAudio()
              reset()
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="hud__bars">
        <Bar label="HP" value={player.hp / 100} color="#94a3b8" />
        <Bar label="STA" value={player.stamina / 100} color="#c084fc" />
        <Bar label="MANA" value={player.zapHeat} color="#e2b86c" />
      </div>

      <div className="hud__objective">
        <div className="hud__label">Objective</div>
        <div className="hud__text">{objective}</div>
      </div>

      {clue ? (
        <div className="hud__objective">
          <div className="hud__label">Clue</div>
          <div className="hud__text">{clue}</div>
        </div>
      ) : null}

      <div className="hud__message">{message ?? ''}</div>
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const v = clamp(value, 0, 1)
  return (
    <div className="bar">
      <div className="bar__label">{label}</div>
      <div className="bar__track">
        <div className="bar__fill" style={{ width: `${(v * 100).toFixed(0)}%`, background: color }} />
      </div>
    </div>
  )
}

