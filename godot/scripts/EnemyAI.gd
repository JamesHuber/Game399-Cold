extends CharacterBody3D

@export_enum("troll", "raider") var kind: String = "troll"
@export var hp: float = 30.0
@export var aggro_radius: float = 10.0

var shoot_cooldown: float = 0.0
var melee_cooldown: float = 0.0
var hurt_t: float = 0.0

const SPEED_TROLL: float = 2.6
const SPEED_RAIDER_CHASE: float = 2.4
const SPEED_RAIDER_RETREAT: float = 2.0
const MELEE_DAMAGE: float = 9.0
const MELEE_BLOCK_STAMINA_COST: float = 16.0
const MELEE_COOLDOWN: float = 0.9
const PROJECTILE_SCENE: PackedScene = preload("res://scenes/EnemyProjectile.tscn")

@onready var _mesh: MeshInstance3D = $MeshInstance3D


func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	add_to_group("enemy")


func _physics_process(delta: float) -> void:
	var dt: float = minf(delta, 0.05)
	shoot_cooldown = maxf(0.0, shoot_cooldown - dt)
	melee_cooldown = maxf(0.0, melee_cooldown - dt)
	hurt_t = maxf(0.0, hurt_t - dt)
	_update_color()

	var player: Node3D = _get_player()
	if player == null:
		velocity = Vector3.ZERO
		move_and_slide()
		return

	var to_player: Vector3 = player.global_position - global_position
	to_player.y = 0.0
	var dist: float = to_player.length()
	var dir: Vector3 = to_player.normalized() if dist > 0.001 else Vector3.ZERO
	var sees: bool = _has_line_of_sight(player.global_position)
	var in_aggro_range: bool = dist <= aggro_radius

	var target_vel: Vector3 = Vector3.ZERO
	if not in_aggro_range:
		target_vel = Vector3.ZERO
	elif kind == "raider":
		if sees and dist > 8.0:
			target_vel = dir * SPEED_RAIDER_CHASE
		elif sees and dist < 5.5:
			target_vel = -dir * SPEED_RAIDER_RETREAT
		elif not sees:
			target_vel = dir * SPEED_TROLL

		if sees and shoot_cooldown <= 0.0 and dist > 0.001:
			_fire_projectile(dir)
			var main := get_tree().current_scene as Node
			if main != null and main.has_method("note_ai_raider_los_shot"):
				main.call("note_ai_raider_los_shot")
			if main != null and main.has_method("play_sfx"):
				main.call("play_sfx", "enemy_shoot")
			shoot_cooldown = 1.25
	else:
		var aggro: float = 1.0 if dist < aggro_radius else 0.2
		target_vel = dir * SPEED_TROLL * aggro
		if aggro >= 1.0:
			var main := get_tree().current_scene as Node
			if main != null and main.has_method("note_ai_troll_pressure"):
				main.call("note_ai_troll_pressure")

	velocity.x = target_vel.x
	velocity.z = target_vel.z
	velocity.y = 0.0
	move_and_slide()
	if kind == "troll" and in_aggro_range:
		_try_melee_collision_hit()


func receive_hit() -> void:
	hp -= 10.0
	hurt_t = 0.12
	if hp <= 0.0:
		var player: Node = _get_player()
		if player != null and player.has_method("gain_health"):
			player.call("gain_health", 4.0)
		queue_free()


func _get_player() -> Node3D:
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	if players.is_empty():
		return null
	return players[0] as Node3D


func _has_line_of_sight(target_pos: Vector3) -> bool:
	var space_state: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var q: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 0.8, target_pos + Vector3.UP * 0.8)
	q.exclude = [self]
	var hit: Dictionary = space_state.intersect_ray(q)
	if hit.is_empty():
		return true
	var c: Object = hit.get("collider")
	return c != null and c.is_in_group("player")


func _fire_projectile(dir: Vector3) -> void:
	var root: Node = get_tree().current_scene
	if root == null:
		return
	var holder: Node3D = root.get_node_or_null("Projectiles") as Node3D
	if holder == null:
		return

	var proj: Area3D = PROJECTILE_SCENE.instantiate() as Area3D
	if proj == null:
		return
	holder.add_child(proj)
	proj.global_position = global_position + Vector3.UP * 0.24
	proj.set("velocity", dir * 11.0)


func _update_color() -> void:
	var flash: float = 1.0 if hurt_t > 0.0 else 0.0
	var m: BaseMaterial3D = _mesh.get_active_material(0) as BaseMaterial3D
	if m == null:
		return
	if kind == "raider":
		m.albedo_color = Color(0.49 + 0.3 * flash, 0.29 - 0.1 * flash, 0.23 - 0.08 * flash, 1.0)
	else:
		m.albedo_color = Color(0.42 + 0.45 * flash, 0.58 - 0.2 * flash, 0.33 - 0.18 * flash, 1.0)


func _try_melee_collision_hit() -> void:
	if melee_cooldown > 0.0:
		return
	var count: int = get_slide_collision_count()
	if count <= 0:
		return
	for i: int in range(count):
		var col: KinematicCollision3D = get_slide_collision(i)
		if col == null:
			continue
		var target: Node = col.get_collider() as Node
		if target == null or not target.is_in_group("player"):
			continue
		if target.has_method("receive_melee_hit"):
			target.call("receive_melee_hit", MELEE_DAMAGE, MELEE_BLOCK_STAMINA_COST)
			melee_cooldown = MELEE_COOLDOWN
			return


