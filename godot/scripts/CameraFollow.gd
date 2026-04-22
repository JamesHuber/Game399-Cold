extends Node3D

@export var target_path: NodePath
@export var follow_distance: float = 6.5
@export var follow_height: float = 4.8
@export var follow_lerp: float = 0.12
@export var look_height: float = 0.9
@export var look_lerp: float = 0.18

@onready var _cam: Camera3D = $Camera3D
var _target: Node3D
var _look_at: Vector3 = Vector3.ZERO


func _ready() -> void:
	if target_path != NodePath():
		_target = get_node_or_null(target_path) as Node3D
	if _target:
		_look_at = _target.global_position + Vector3(0.0, look_height, 0.0)


func _process(delta: float) -> void:
	if not _target:
		return

	var dt: float = minf(delta, 0.05)
	var forward: Vector3 = -_target.global_transform.basis.z
	var desired: Vector3 = _target.global_position - forward * follow_distance
	desired.y = _target.global_position.y + follow_height

	global_position = global_position.lerp(desired, clampf(follow_lerp * (dt / 0.016), 0.0, 1.0))
	var look_target: Vector3 = _target.global_position + Vector3(0.0, look_height, 0.0)
	_look_at = _look_at.lerp(look_target, clampf(look_lerp * (dt / 0.016), 0.0, 1.0))
	_cam.look_at(_look_at)
