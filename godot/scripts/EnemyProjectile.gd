extends Area3D

@export var velocity: Vector3 = Vector3.ZERO
@export var life: float = 1.4
@export var damage: float = 8.0
@export var block_stamina_cost: float = 12.0


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	var dt: float = minf(delta, 0.05)
	life -= dt
	if life <= 0.0:
		queue_free()
		return
	global_position += velocity * dt


func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		if body.has_method("receive_projectile_hit"):
			body.call("receive_projectile_hit", damage, block_stamina_cost)
		queue_free()
		return

	var cobj := body as CollisionObject3D
	if cobj != null and (cobj.collision_layer & 1) != 0:
		var main := get_tree().current_scene as Node
		if main != null and main.has_method("note_projectile_wall_impact"):
			main.call("note_projectile_wall_impact")
		if main != null and main.has_method("play_sfx"):
			main.call("play_sfx", "proj_wall")
		queue_free()
