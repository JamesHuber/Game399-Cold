import * as THREE from 'three'

export type Vec2 = { x: number; y: number }

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function len2(v: Vec2) {
  return Math.hypot(v.x, v.y)
}

export function norm2(v: Vec2): Vec2 {
  const l = len2(v)
  if (l <= 1e-8) return { x: 0, y: 0 }
  return { x: v.x / l, y: v.y / l }
}

export function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function mul2(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s }
}

export function dot2(a: Vec2, b: Vec2) {
  return a.x * b.x + a.y * b.y
}

export function angleFromVec2(v: Vec2) {
  return Math.atan2(v.y, v.x)
}

export function vec2ToXZ(v: Vec2) {
  return new THREE.Vector3(v.x, 0, v.y)
}

