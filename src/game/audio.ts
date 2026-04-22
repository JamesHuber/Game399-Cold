import { Howl, Howler } from 'howler'

Howler.volume(1)

let music: Howl | null = null

/** Lazy Howl instances — avoids Web Audio init during module load (can break React mount). */
const cache = new Map<string, Howl>()

function sfxHowl(file: string, volume: number) {
  const key = `${file}:${volume}`
  let h = cache.get(key)
  if (!h) {
    h = new Howl({ src: [`/audio/sfx/${file}`], volume, preload: true })
    cache.set(key, h)
  }
  return h
}

function ensureMusic() {
  if (music) return
  music = new Howl({
    src: ['/audio/music/exploration.mp3'],
    loop: true,
    volume: 0.22,
    html5: true,
  })
}

/** Unlock audio context and start exploration music (call after user gesture). */
export function resumeAudio() {
  const ctx = Howler.ctx
  if (ctx && ctx.state !== 'running') void ctx.resume()
  ensureMusic()
  if (music && !music.playing()) music.play()
}

export { Howler }

export function sfxSwordSwing() {
  sfxHowl('sword_swing.ogg', 0.55).play()
}

export function sfxSwordHit() {
  sfxHowl('sword_hit.ogg', 0.65).play()
}

export function sfxZap() {
  sfxHowl('zap.ogg', 0.45).play()
}

export function sfxSting() {
  sfxHowl('sting.ogg', 0.5).play()
}

export function sfxDodge() {
  sfxHowl('dodge.ogg', 0.5).play()
}

export function sfxBlock() {
  sfxHowl('block.ogg', 0.55).play()
}

export function sfxProjWall() {
  sfxHowl('proj_wall.ogg', 0.35).play()
}

export function sfxEnemyShoot() {
  sfxHowl('enemy_shoot.ogg', 0.4).play()
}

export function sfxHurt() {
  sfxHowl('hurt.ogg', 0.45).play()
}

export function sfxDeath() {
  sfxHowl('death.ogg', 0.55).play()
}

export function sfxNodeCharge() {
  sfxHowl('node_charge.ogg', 0.5).play()
}

export function sfxUiSoft() {
  sfxHowl('ui_soft.ogg', 0.4).play()
}

export function sfxGateLocked() {
  sfxHowl('gate_locked.ogg', 0.45).play()
}

export function sfxRelic() {
  sfxHowl('relic.ogg', 0.55).play()
}

export function sfxGateOpen() {
  sfxHowl('gate_open.ogg', 0.45).play()
}
