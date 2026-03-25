let ctx: AudioContext | null = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

export function resumeAudio() {
  const c = getCtx()
  if (c.state !== 'running') void c.resume()
}

function envGain(c: AudioContext, t0: number, a: number, d: number, s: number, r: number) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(1.0, t0 + a)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, s), t0 + a + d)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r)
  return g
}

export function sfxShoot() {
  const c = getCtx()
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(320, t0)
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.06)

  const g = envGain(c, t0, 0.002, 0.03, 0.2, 0.08)
  g.gain.setValueAtTime(0.12, t0)

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(1400, t0)

  osc.connect(lp)
  lp.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + 0.12)
}

export function sfxZap() {
  const c = getCtx()
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90, t0)
  osc.frequency.exponentialRampToValueAtTime(260, t0 + 0.08)

  const g = envGain(c, t0, 0.005, 0.04, 0.15, 0.12)
  g.gain.setValueAtTime(0.08, t0)

  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(420, t0)

  osc.connect(hp)
  hp.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + 0.18)
}

export function sfxSting() {
  const c = getCtx()
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, t0)
  osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.12)

  const g = envGain(c, t0, 0.002, 0.05, 0.4, 0.35)
  g.gain.setValueAtTime(0.12, t0)

  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(700, t0)
  bp.Q.setValueAtTime(3.5, t0)

  osc.connect(bp)
  bp.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + 0.5)
}

