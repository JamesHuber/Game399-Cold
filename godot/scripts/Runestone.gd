extends StaticBody3D

@export var charged: bool = false

@onready var _mesh: MeshInstance3D = $MeshInstance3D


func _ready() -> void:
	add_to_group("runestone")
	add_to_group("interactable")
	# Each runestone needs its own material instance so color changes stay local.
	var base_mat: Material = _mesh.material_override
	if base_mat != null:
		_mesh.material_override = base_mat.duplicate()
	_refresh_visual()


func set_charged(v: bool) -> void:
	if charged == v:
		return
	charged = v
	_refresh_visual()


func interact(_player: Node) -> void:
	var main := get_tree().current_scene as Node
	if charged:
		if main != null and main.has_method("set_message"):
			main.call("set_message", "This runestone is already charged.")
		if main != null and main.has_method("play_sfx"):
			main.call("play_sfx", "ui_soft")
		return
	set_charged(true)
	if main != null and main.has_method("set_message"):
		main.call("set_message", "Runestone charged.")
	if main != null and main.has_method("play_sfx"):
		main.call("play_sfx", "node_charge")


func _refresh_visual() -> void:
	var m: BaseMaterial3D = _mesh.get_active_material(0) as BaseMaterial3D
	if m == null:
		return
	if charged:
		m.albedo_color = Color(0.84, 0.71, 0.44, 1.0)
		m.emission_enabled = true
		m.emission = Color(0.18, 0.12, 0.05, 1.0)
	else:
		m.albedo_color = Color(0.36, 0.30, 0.24, 1.0)
		m.emission_enabled = false
