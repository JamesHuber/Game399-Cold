export type InputState = {
  keysDown: Set<string>
  pointerLocked: boolean
  mouse: { x: number; y: number; dx: number; dy: number; buttons: number }
}

export function createInputState(): InputState {
  return {
    keysDown: new Set(),
    pointerLocked: false,
    mouse: { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 },
  }
}

export function bindInput(target: Window, state: InputState) {
  const onKeyDown = (e: KeyboardEvent) => {
    state.keysDown.add(e.code)
  }
  const onKeyUp = (e: KeyboardEvent) => {
    state.keysDown.delete(e.code)
  }
  const onMouseMove = (e: MouseEvent) => {
    state.mouse.x = e.clientX
    state.mouse.y = e.clientY
    state.mouse.dx += e.movementX
    state.mouse.dy += e.movementY
  }
  const onMouseDown = (e: MouseEvent) => {
    state.mouse.buttons = e.buttons
  }
  const onMouseUp = (e: MouseEvent) => {
    state.mouse.buttons = e.buttons
  }
  const onBlur = () => {
    state.keysDown.clear()
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('mousemove', onMouseMove)
  target.addEventListener('mousedown', onMouseDown)
  target.addEventListener('mouseup', onMouseUp)
  target.addEventListener('blur', onBlur)

  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('mousemove', onMouseMove)
    target.removeEventListener('mousedown', onMouseDown)
    target.removeEventListener('mouseup', onMouseUp)
    target.removeEventListener('blur', onBlur)
  }
}

export function consumeMouseDeltas(state: InputState) {
  const dx = state.mouse.dx
  const dy = state.mouse.dy
  state.mouse.dx = 0
  state.mouse.dy = 0
  return { dx, dy }
}

export function isDown(state: InputState, code: string) {
  return state.keysDown.has(code)
}

