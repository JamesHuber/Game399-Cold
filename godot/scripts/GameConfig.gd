extends Node

const ACTIONS := {
	"move_forward": [KEY_W],
	"move_back": [KEY_S],
	"turn_left": [KEY_A],
	"turn_right": [KEY_D],
	"attack": [MOUSE_BUTTON_LEFT],
	"defend": [KEY_SPACE],
	"dodge": [KEY_SHIFT],
	"interact": [KEY_E],
	"reset_run": [KEY_R],
	"debug_toggle": [KEY_F3],
	"debug_collision": [KEY_F4],
	"debug_check_next": [KEY_F5],
	"debug_check_toggle": [KEY_F6],
}

func _ready() -> void:
	_ensure_input_map()


func _ensure_input_map() -> void:
	for action_name: String in ACTIONS.keys():
		if not InputMap.has_action(action_name):
			InputMap.add_action(action_name)
		for code in ACTIONS[action_name]:
			var event := _make_event(code)
			if event != null and not InputMap.action_has_event(action_name, event):
				InputMap.action_add_event(action_name, event)


func _make_event(code: int) -> InputEvent:
	if code in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
		var e_mouse := InputEventMouseButton.new()
		e_mouse.button_index = code
		return e_mouse

	var e_key := InputEventKey.new()
	e_key.physical_keycode = code
	return e_key
