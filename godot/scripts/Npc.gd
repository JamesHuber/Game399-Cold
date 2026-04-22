extends StaticBody3D

@export var npc_name: String = "NPC"
@export var lines: PackedStringArray = PackedStringArray()

var _line_idx: int = 0


func _ready() -> void:
	add_to_group("interactable")


func interact(_player: Node) -> void:
	if lines.is_empty():
		return
	var text: String = "%s: %s" % [npc_name, lines[_line_idx]]
	_line_idx = (_line_idx + 1) % lines.size()
	var main := get_tree().current_scene as Node
	if main != null and main.has_method("set_message"):
		main.call("set_message", text)
	if main != null and main.has_method("play_sfx"):
		main.call("play_sfx", "ui_soft")
