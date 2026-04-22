extends CharacterBody3D

@export var move_speed: float = 6.0
@export var dodge_speed: float = 10.0
@export var turn_speed: float = 3.3
@export var accel: float = 40.0
@export var damping: float = 18.0
@export var dodge_duration: float = 0.22

var _dodge_t: float = 0.0
var _melee_cooldown_t: float = 0.0
var _swing_t: float = 0.0
var _blocking: bool = false
var _dead: bool = false
var _hp: float = 100.0
var _stamina: float = 100.0

const MELEE_RANGE: float = 1.175
const MELEE_HALF_RAD: float = deg_to_rad(52.0)
const MELEE_SWING_DURATION: float = 0.22
const MELEE_COOLDOWN: float = 0.38

@onready var _shield_mesh: MeshInstance3D = $ShieldMesh
@onready var _slash_mesh: MeshInstance3D = $SlashMesh


func _physics_process(delta: float) -> void:
	var dt: float = minf(delta, 0.05)
	var main := get_tree().current_scene as Node
	if _dead:
		_blocking = false
		_shield_mesh.visible = false
		_slash_mesh.visible = false
		velocity = Vector3.ZERO
		move_and_slide()
		return
	_melee_cooldown_t = maxf(0.0, _melee_cooldown_t - dt)
	_swing_t = maxf(0.0, _swing_t - dt)
	_stamina = clampf(_stamina + dt * 18.0, 0.0, 100.0)

	var turn_input: float = Input.get_action_strength("turn_right") - Input.get_action_strength("turn_left")
	if absf(turn_input) > 0.0001:
		rotation.y -= turn_input * turn_speed * dt
		if main != null and main.has_method("note_control_action"):
			main.call("note_control_action", "turn_right" if turn_input > 0.0 else "turn_left")

	var throttle: float = Input.get_action_strength("move_forward") - Input.get_action_strength("move_back")
	var forward: Vector3 = -global_transform.basis.z
	var desired: Vector3 = Vector3.ZERO
	if absf(throttle) > 0.0001:
		desired = forward.normalized() * throttle
		if main != null and main.has_method("note_control_action"):
			main.call("note_control_action", "move_forward" if throttle > 0.0 else "move_back")

	# Defend and attack are mutually exclusive. Holding defend prevents attacks.
	_blocking = Input.is_action_pressed("defend")
	_shield_mesh.visible = _blocking
	if _blocking and main != null and main.has_method("note_control_action"):
		main.call("note_control_action", "defend")
	if Input.is_action_just_pressed("attack") and not _blocking:
		if main != null and main.has_method("note_control_action"):
			main.call("note_control_action", "attack")
		_try_melee_attack()
	if Input.is_action_just_pressed("interact"):
		if main != null and main.has_method("note_control_action"):
			main.call("note_control_action", "interact")
		_try_interact()

	if Input.is_action_just_pressed("dodge") and _dodge_t <= 0.0:
		_dodge_t = dodge_duration
		if main != null and main.has_method("note_control_action"):
			main.call("note_control_action", "dodge")
		if main != null and main.has_method("play_sfx"):
			main.call("play_sfx", "dodge")

	_dodge_t = maxf(0.0, _dodge_t - dt)
	var speed: float = dodge_speed if _dodge_t > 0.0 else move_speed
	var target: Vector3 = desired * speed

	velocity.x = lerpf(velocity.x, target.x, clampf(accel * dt, 0.0, 1.0))
	velocity.z = lerpf(velocity.z, target.z, clampf(accel * dt, 0.0, 1.0))
	velocity.y = 0.0

	# Extra damping keeps tank movement responsive but not slippery.
	if desired == Vector3.ZERO:
		var damp_t: float = clampf(damping * dt, 0.0, 1.0)
		velocity.x = lerpf(velocity.x, 0.0, damp_t)
		velocity.z = lerpf(velocity.z, 0.0, damp_t)

	_update_slash_visual()
	move_and_slide()


func _ready() -> void:
	# We are using a top-level prototype without gravity/jumping yet.
	# Floating mode guarantees horizontal movement even when not floor-snapped.
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	add_to_group("player")
	_slash_mesh.mesh = _build_slash_mesh(0.16, MELEE_RANGE, 36)
	_slash_mesh.visible = false
	_shield_mesh.visible = false


func _try_melee_attack() -> void:
	if _dead:
		return
	if _melee_cooldown_t > 0.0:
		return

	_melee_cooldown_t = MELEE_COOLDOWN
	_swing_t = MELEE_SWING_DURATION
	var did_hit: bool = false
	var main := get_tree().current_scene as Node
	if main != null and main.has_method("note_melee_attempt"):
		main.call("note_melee_attempt")

	var forward: Vector3 = (-global_transform.basis.z).normalized()
	var cos_half: float = cos(MELEE_HALF_RAD)
	var space_state: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state

	for node: Node in get_tree().get_nodes_in_group("enemy"):
		var enemy: Node3D = node as Node3D
		if enemy == null:
			continue
		var to_enemy: Vector3 = enemy.global_position - global_position
		to_enemy.y = 0.0
		var dist: float = to_enemy.length()
		if dist < 0.001 or dist > MELEE_RANGE:
			continue
		var dir: Vector3 = to_enemy / dist
		if forward.dot(dir) < cos_half:
			continue

		# LOS guard via raycast to keep parity with original cone + visibility check.
		var q: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 0.8, enemy.global_position + Vector3.UP * 0.8)
		q.exclude = [self]
		var hit: Dictionary = space_state.intersect_ray(q)
		if not hit.is_empty() and hit.get("collider") != enemy:
			continue

		if enemy.has_method("receive_hit"):
			enemy.call("receive_hit")
			did_hit = true
			if main != null and main.has_method("note_melee_hit"):
				main.call("note_melee_hit")

	if main != null and main.has_method("play_sfx"):
		main.call("play_sfx", "sword_swing")
		if did_hit:
			main.call("play_sfx", "sword_hit")


func _update_slash_visual() -> void:
	if _swing_t <= 0.0:
		_slash_mesh.visible = false
		return

	_slash_mesh.visible = true
	var alpha: float = clampf((_swing_t / MELEE_SWING_DURATION) * 0.72, 0.08, 0.72)
	var m: BaseMaterial3D = _slash_mesh.get_active_material(0) as BaseMaterial3D
	if m != null:
		m.albedo_color = Color(1.0, 1.0, 1.0, alpha)


func _build_slash_mesh(inner_r: float, outer_r: float, segments: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_color(Color(1.0, 1.0, 1.0, 0.55))

	for i: int in range(segments):
		var t0: float = -MELEE_HALF_RAD + (float(i) / float(segments)) * (MELEE_HALF_RAD * 2.0)
		var t1: float = -MELEE_HALF_RAD + (float(i + 1) / float(segments)) * (MELEE_HALF_RAD * 2.0)
		# Godot forward is local -Z, so center wedge on -Z.
		var in0 := Vector3(sin(t0) * inner_r, 0.0, -cos(t0) * inner_r)
		var out0 := Vector3(sin(t0) * outer_r, 0.0, -cos(t0) * outer_r)
		var in1 := Vector3(sin(t1) * inner_r, 0.0, -cos(t1) * inner_r)
		var out1 := Vector3(sin(t1) * outer_r, 0.0, -cos(t1) * outer_r)

		st.add_vertex(in0)
		st.add_vertex(out0)
		st.add_vertex(out1)
		st.add_vertex(in0)
		st.add_vertex(out1)
		st.add_vertex(in1)

	st.generate_normals()
	return st.commit()


func is_blocking() -> bool:
	return _blocking and _stamina > 0.0 and _dodge_t <= 0.0


func receive_projectile_hit(damage: float, block_stamina_cost: float) -> void:
	if _dead:
		return
	var main := get_tree().current_scene as Node
	if is_blocking():
		_stamina = maxf(0.0, _stamina - block_stamina_cost)
		if main != null and main.has_method("note_projectile_block"):
			main.call("note_projectile_block")
		if main != null and main.has_method("play_sfx"):
			main.call("play_sfx", "block")
		return
	_hp = maxf(0.0, _hp - damage)
	if main != null and main.has_method("note_projectile_damage"):
		main.call("note_projectile_damage")
	if main != null and main.has_method("play_sfx"):
		main.call("play_sfx", "hurt")
	if _hp <= 0.0:
		_die()


func receive_melee_hit(damage: float, block_stamina_cost: float) -> void:
	if _dead:
		return
	var main := get_tree().current_scene as Node
	if is_blocking():
		_stamina = maxf(0.0, _stamina - block_stamina_cost)
		if main != null and main.has_method("note_projectile_block"):
			main.call("note_projectile_block")
		if main != null and main.has_method("play_sfx"):
			main.call("play_sfx", "block")
		return
	_hp = maxf(0.0, _hp - damage)
	if main != null and main.has_method("note_projectile_damage"):
		main.call("note_projectile_damage")
	if main != null and main.has_method("play_sfx"):
		main.call("play_sfx", "hurt")
	if _hp <= 0.0:
		_die()


func _try_interact() -> void:
	if _dead:
		return
	var nearest: Node3D = null
	var nearest_dist: float = 2.4
	for node: Node in get_tree().get_nodes_in_group("interactable"):
		var it: Node3D = node as Node3D
		if it == null:
			continue
		var d: float = (it.global_position - global_position).length()
		if d < nearest_dist:
			nearest_dist = d
			nearest = it

	if nearest != null and nearest.has_method("interact"):
		nearest.call("interact", self)
		return

	var main := get_tree().current_scene as Node
	if main != null and main.has_method("set_message"):
		main.call("set_message", "Nothing to interact with.")
	if main != null and main.has_method("play_sfx"):
		main.call("play_sfx", "ui_soft")


func get_hp_norm() -> float:
	return clampf(_hp / 100.0, 0.0, 1.0)


func gain_health(amount: float) -> void:
	if _dead:
		return
	if amount <= 0.0:
		return
	_hp += amount


func get_stamina_norm() -> float:
	return clampf(_stamina / 100.0, 0.0, 1.0)


func is_dead() -> bool:
	return _dead


func _die() -> void:
	if _dead:
		return
	_dead = true
	_hp = 0.0
	_blocking = false
	_shield_mesh.visible = false
	_slash_mesh.visible = false
	velocity = Vector3.ZERO
	var main := get_tree().current_scene as Node
	if main != null and main.has_method("set_objective"):
		main.call("set_objective", "You were slain. Restarting...")
	if main != null and main.has_method("set_message"):
		main.call("set_message", "Run reset triggered.")
	get_tree().call_deferred("reload_current_scene")
