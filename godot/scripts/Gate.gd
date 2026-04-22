extends StaticBody3D

@export var open: bool = false

@onready var _mesh: MeshInstance3D = $MeshInstance3D
@onready var _field_mesh: MeshInstance3D = $GateField


func _ready() -> void:
	add_to_group("interactable")
	_refresh_visual()


func interact(_player: Node) -> void:
	var main := get_tree().current_scene as Node
	if main == null:
		return
	if not open:
		if main.has_method("set_message"):
			main.call("set_message", "The portcullis is sealed. The runestones still sleep.")
		if main.has_method("play_sfx"):
			main.call("play_sfx", "gate_locked")
		return

	if main.has_method("set_clue"):
		main.call("set_clue", "An iron reliquary hums in your gauntlet. Its sigil points east.")
	if main.has_method("note_relic_recovered"):
		main.call("note_relic_recovered")
	if main.has_method("play_sfx"):
		main.call("play_sfx", "relic")
	if main.has_method("trigger_win"):
		main.call("trigger_win")


func set_open(v: bool) -> void:
	if open == v:
		return
	open = v
	_refresh_visual()


func _refresh_visual() -> void:
	var m: BaseMaterial3D = _mesh.get_active_material(0) as BaseMaterial3D
	if m == null:
		return
	if open:
		m.albedo_color = Color(0.88, 0.76, 0.18, 1.0)
		m.emission_enabled = true
		m.emission = Color(0.34, 0.25, 0.05, 1.0)
		if _field_mesh != null:
			_field_mesh.visible = false
	else:
		m.albedo_color = Color(0.12, 0.09, 0.06, 1.0)
		m.emission_enabled = false
		if _field_mesh != null:
			_field_mesh.visible = true
