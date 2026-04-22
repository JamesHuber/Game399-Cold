extends Node3D

@onready var _objective_value: Label = $HUD/Margin/Panel/VBox/ObjectiveValue
@onready var _message_value: Label = $HUD/Margin/Panel/VBox/MessageValue
@onready var _clue_value: Label = $HUD/Margin/Panel/VBox/ClueValue
@onready var _rune_counter_value: Label = $HUD/Margin/Panel/VBox/RuneCounterValue
@onready var _hp_bar: ProgressBar = $HUD/Margin/Panel/VBox/Bars/HPBar
@onready var _sta_bar: ProgressBar = $HUD/Margin/Panel/VBox/Bars/STAbar
@onready var _gate: Node = $Gate
@onready var _music_player: AudioStreamPlayer = $Audio/MusicPlayer
@onready var _sfx_player: AudioStreamPlayer = $Audio/SFXPlayer
@onready var _ui_player: AudioStreamPlayer = $Audio/UIPlayer
@onready var _debug_panel: PanelContainer = $HUD/DebugMargin/DebugPanel
@onready var _debug_value: Label = $HUD/DebugMargin/DebugPanel/DebugVBox/DebugValue

var _objective: String = "Awaken the northern portcullis by charging all 3 runestones."
var _message: String = "W/S move · A/D turn · Mouse1 sword · E interact · Shift dodge · Space defend"
var _clue: String = ""
var _music_boot_attempted: bool = false
var _debug_enabled: bool = false
var _debug_collision_enabled: bool = false
var _debug_check_idx: int = 0
var _debug_checks: Array[String] = [
	"Controls: move/turn/defend/dodge/attack/interact/reset",
	"Combat: cooldowns + cone hit detection",
	"Combat: block stamina drain and projectile branches",
	"AI: LOS-aware raider + troll melee pressure",
	"Puzzle: 3 runestones -> gate unlock -> relic interaction",
	"UI: bars + objective/message/clue readability",
	"Audio: event hooks and mix balance sanity",
]
var _debug_check_pass: Array[bool] = [false, false, false, false, false, false, false]
var _control_seen: Dictionary = {}
var _sfx_seen: Dictionary = {}
var _combat_attack_seen: bool = false
var _combat_cone_hit_seen: bool = false
var _combat_block_seen: bool = false
var _combat_damage_seen: bool = false
var _combat_proj_wall_seen: bool = false
var _ai_raider_los_shot_seen: bool = false
var _ai_troll_pressure_seen: bool = false
var _puzzle_all_charged_seen: bool = false
var _puzzle_gate_open_seen: bool = false
var _puzzle_relic_seen: bool = false
var _ui_bars_seen: bool = false
var _ui_objective_seen: bool = false
var _ui_message_seen: bool = false
var _ui_clue_seen: bool = false
var _won: bool = false


func _ready() -> void:
	_load_audio()
	_seed_control_tracker()
	set_objective(_objective)
	set_message(_message)
	set_clue("")
	_update_rune_counter(0, get_tree().get_nodes_in_group("runestone").size())
	if _debug_panel != null:
		_debug_panel.visible = false
	if _music_player.stream != null:
		_music_player.play()
	call_deferred("_audio_probe")


func _physics_process(_delta: float) -> void:
	if _won:
		return
	if Input.is_action_just_pressed("reset_run"):
		note_control_action("reset_run")
		get_tree().reload_current_scene()
		return
	if Input.is_action_just_pressed("debug_toggle"):
		_debug_enabled = not _debug_enabled
		if _debug_panel != null:
			_debug_panel.visible = _debug_enabled
	if Input.is_action_just_pressed("debug_collision"):
		_toggle_collision_view()
	if Input.is_action_just_pressed("debug_check_next"):
		_debug_cycle_check()
	if Input.is_action_just_pressed("debug_check_toggle"):
		_debug_toggle_check_pass()
	_track_controls()

	_ensure_music_playing()
	var player: Node3D = _get_player()
	if player == null:
		return
	_update_bars(player)
	_update_debug(player)

	var runestone_total: int = 0
	var runestone_charged: int = 0
	var all_charged: bool = true
	for node: Node in get_tree().get_nodes_in_group("runestone"):
		runestone_total += 1
		if not bool(node.get("charged")):
			all_charged = false
		else:
			runestone_charged += 1
	_update_rune_counter(runestone_charged, runestone_total)

	if all_charged:
		_puzzle_all_charged_seen = true
		_auto_refresh_checkmarks()

	if all_charged and _gate != null and _gate.has_method("set_open"):
		if not bool(_gate.get("open")):
			_gate.call("set_open", true)
			note_gate_opened()
			play_sfx("gate_open")
			set_objective("Portcullis awakened. Interact (E) at the gate to recover the relic.")
			set_message("You hear iron mechanisms groan as the gate unlocks.")


func set_objective(text: String) -> void:
	_objective = text
	if _objective_value != null:
		_objective_value.text = _objective
	_ui_objective_seen = _objective.strip_edges() != ""
	_auto_refresh_checkmarks()


func set_message(text: String) -> void:
	_message = text
	if _message_value != null:
		_message_value.text = _message
	_ui_message_seen = _message.strip_edges() != ""
	_auto_refresh_checkmarks()
	if _ui_player != null and _ui_player.stream != null:
		_ui_player.play()


func set_clue(text: String) -> void:
	_clue = text
	if _clue_value != null:
		_clue_value.text = _clue
	_ui_clue_seen = _clue.strip_edges() != ""
	_auto_refresh_checkmarks()


func _update_rune_counter(charged: int, total: int) -> void:
	if _rune_counter_value != null:
		_rune_counter_value.text = "Runes: %d/%d" % [charged, total]


func trigger_win() -> void:
	if _won:
		return
	_won = true
	note_relic_recovered()
	if _music_player != null:
		_music_player.stop()

	var overlay_layer := CanvasLayer.new()
	overlay_layer.layer = 100
	overlay_layer.process_mode = Node.PROCESS_MODE_WHEN_PAUSED
	add_child(overlay_layer)

	var black := ColorRect.new()
	black.anchor_left = 0.0
	black.anchor_top = 0.0
	black.anchor_right = 1.0
	black.anchor_bottom = 1.0
	black.offset_left = 0.0
	black.offset_top = 0.0
	black.offset_right = 0.0
	black.offset_bottom = 0.0
	black.color = Color(0.0, 0.0, 0.0, 1.0)
	overlay_layer.add_child(black)

	var win_label := Label.new()
	win_label.anchor_left = 0.5
	win_label.anchor_top = 0.5
	win_label.anchor_right = 0.5
	win_label.anchor_bottom = 0.5
	win_label.offset_left = -180.0
	win_label.offset_top = -24.0
	win_label.offset_right = 180.0
	win_label.offset_bottom = 24.0
	win_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	win_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	win_label.text = "You Win!"
	win_label.add_theme_font_size_override("font_size", 56)
	win_label.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 1.0))
	overlay_layer.add_child(win_label)

	get_tree().paused = true


func _get_player() -> Node3D:
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	if players.is_empty():
		return null
	return players[0] as Node3D


func _update_bars(player: Node3D) -> void:
	var touched: bool = false
	if player.has_method("get_hp_norm"):
		_hp_bar.value = float(player.call("get_hp_norm")) * 100.0
		touched = true
	if player.has_method("get_stamina_norm"):
		_sta_bar.value = float(player.call("get_stamina_norm")) * 100.0
		touched = true
	if touched:
		_ui_bars_seen = true
		_auto_refresh_checkmarks()


func _load_audio() -> void:
	# Optional runtime audio load: if files are missing or not imported yet, gameplay continues silently.
	var music_path: String = "res://audio/music/exploration.mp3"
	var ui_path: String = "res://audio/sfx/ui_soft.ogg"
	var music_res: Resource = ResourceLoader.load(music_path)
	var ui_res: Resource = ResourceLoader.load(ui_path)
	if music_res is AudioStream:
		_music_player.stream = music_res as AudioStream
	else:
		push_warning("Audio load failed: " + music_path)
	if ui_res is AudioStream:
		_ui_player.stream = ui_res as AudioStream
	else:
		push_warning("Audio load failed: " + ui_path)


func play_sfx(name: String) -> void:
	var path: String = "res://audio/sfx/%s.ogg" % name
	var res: Resource = ResourceLoader.load(path)
	if not (res is AudioStream):
		push_warning("SFX load failed: " + path)
		return
	_sfx_seen[name] = true
	_sfx_player.stream = res as AudioStream
	_sfx_player.play()
	_auto_refresh_checkmarks()


func _ensure_music_playing() -> void:
	if _music_player.playing:
		return
	if _music_player.stream == null:
		# Retry in case import finished after scene boot.
		if not _music_boot_attempted or Engine.get_process_frames() % 30 == 0:
			_music_boot_attempted = true
			_load_audio()
		return
	_music_player.play()


func _audio_probe() -> void:
	# 1) Generate an in-memory tone (no file import required).
	# If this is silent too, the issue is output/device path, not resources.
	_play_generated_tone()
	# 2) Then attempt a normal UI sound file probe.
	if _ui_player.stream != null:
		_ui_player.play()
	else:
		play_sfx("ui_soft")


func _play_generated_tone() -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = 44100.0
	gen.buffer_length = 0.25
	_sfx_player.stream = gen
	_sfx_player.play()
	var pb: AudioStreamGeneratorPlayback = _sfx_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if pb == null:
		push_warning("Audio probe: generator playback unavailable.")
		return
	var frames: int = int(gen.mix_rate * 0.20)
	for i: int in range(frames):
		var t: float = float(i) / gen.mix_rate
		var s: float = sin(TAU * 660.0 * t) * 0.28
		pb.push_frame(Vector2(s, s))


func _update_debug(player: Node3D) -> void:
	if not _debug_enabled or _debug_value == null:
		return
	var fps: int = Engine.get_frames_per_second()
	var proc_ms: float = float(Performance.get_monitor(Performance.TIME_PROCESS)) * 1000.0
	var phys_ms: float = float(Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0
	var mem_mb: float = float(Performance.get_monitor(Performance.MEMORY_STATIC)) / (1024.0 * 1024.0)
	var enemy_count: int = get_tree().get_nodes_in_group("enemy").size()
	var proj_count: int = 0
	var proj_holder: Node = get_node_or_null("Projectiles")
	if proj_holder != null:
		proj_count = proj_holder.get_child_count()
	var runestone_total: int = 0
	var runestone_charged: int = 0
	for node: Node in get_tree().get_nodes_in_group("runestone"):
		runestone_total += 1
		if bool(node.get("charged")):
			runestone_charged += 1
	var hp_pct: int = int(roundf(float(player.call("get_hp_norm")) * 100.0)) if player.has_method("get_hp_norm") else -1
	var sta_pct: int = int(roundf(float(player.call("get_stamina_norm")) * 100.0)) if player.has_method("get_stamina_norm") else -1
	var block_state: bool = bool(player.call("is_blocking")) if player.has_method("is_blocking") else false
	var dead_state: bool = bool(player.call("is_dead")) if player.has_method("is_dead") else false
	var pos: Vector3 = player.global_position
	var passed_count: int = 0
	for ok: bool in _debug_check_pass:
		if ok:
			passed_count += 1
	var debug_text: String = "FPS: %d\nProcess: %.2f ms | Physics: %.2f ms\nMemory: %.1f MB\nEnemies: %d | Projectiles: %d\nRunestones: %d/%d\nPlayer: HP %d%% STA %d%%\nBlocking: %s | Dead: %s\nPos: (%.2f, %.2f, %.2f)\nCollision debug (F4): %s\nReset run: R\nChecklist: %d/%d passed (F5 next, F6 toggle)\n" % [
		fps,
		proc_ms,
		phys_ms,
		mem_mb,
		enemy_count,
		proj_count,
		runestone_charged,
		runestone_total,
		hp_pct,
		sta_pct,
		"yes" if block_state else "no",
		"yes" if dead_state else "no",
		pos.x,
		pos.y,
		pos.z,
		"on" if _debug_collision_enabled else "off",
		passed_count,
		_debug_checks.size(),
	]
	for i: int in range(_debug_checks.size()):
		var pointer: String = ">" if i == _debug_check_idx else " "
		var mark: String = "[x]" if _debug_check_pass[i] else "[ ]"
		debug_text += "%s %s %s\n" % [pointer, mark, _debug_checks[i]]
	_debug_value.text = debug_text


func _toggle_collision_view() -> void:
	_debug_collision_enabled = not _debug_collision_enabled
	get_viewport().debug_draw = (
		Viewport.DEBUG_DRAW_WIREFRAME if _debug_collision_enabled else Viewport.DEBUG_DRAW_DISABLED
	)


func _debug_cycle_check() -> void:
	if _debug_checks.is_empty():
		return
	_debug_check_idx = (_debug_check_idx + 1) % _debug_checks.size()


func _debug_toggle_check_pass() -> void:
	if _debug_checks.is_empty():
		return
	if _debug_check_idx < 0 or _debug_check_idx >= _debug_check_pass.size():
		return
	_debug_check_pass[_debug_check_idx] = not _debug_check_pass[_debug_check_idx]


func note_control_action(action_name: String) -> void:
	if not _control_seen.has(action_name):
		return
	_control_seen[action_name] = true
	_auto_refresh_checkmarks()


func note_melee_attempt() -> void:
	_combat_attack_seen = true
	_auto_refresh_checkmarks()


func note_melee_hit() -> void:
	_combat_cone_hit_seen = true
	_auto_refresh_checkmarks()


func note_projectile_block() -> void:
	_combat_block_seen = true
	_auto_refresh_checkmarks()


func note_projectile_damage() -> void:
	_combat_damage_seen = true
	_auto_refresh_checkmarks()


func note_projectile_wall_impact() -> void:
	_combat_proj_wall_seen = true
	_auto_refresh_checkmarks()


func note_ai_raider_los_shot() -> void:
	_ai_raider_los_shot_seen = true
	_auto_refresh_checkmarks()


func note_ai_troll_pressure() -> void:
	_ai_troll_pressure_seen = true
	_auto_refresh_checkmarks()


func note_gate_opened() -> void:
	_puzzle_gate_open_seen = true
	_auto_refresh_checkmarks()


func note_relic_recovered() -> void:
	_puzzle_relic_seen = true
	_auto_refresh_checkmarks()


func _seed_control_tracker() -> void:
	_control_seen = {
		"move_forward": false,
		"move_back": false,
		"turn_left": false,
		"turn_right": false,
		"defend": false,
		"dodge": false,
		"attack": false,
		"interact": false,
		"reset_run": false,
	}


func _track_controls() -> void:
	for action_name: String in _control_seen.keys():
		if Input.is_action_just_pressed(action_name):
			_control_seen[action_name] = true
	_auto_refresh_checkmarks()


func _auto_refresh_checkmarks() -> void:
	var all_controls_seen: bool = true
	for action_name: String in _control_seen.keys():
		if not bool(_control_seen[action_name]):
			all_controls_seen = false
			break
	_debug_check_pass[0] = all_controls_seen
	_debug_check_pass[1] = _combat_attack_seen and _combat_cone_hit_seen
	_debug_check_pass[2] = _combat_block_seen and _combat_damage_seen and _combat_proj_wall_seen
	_debug_check_pass[3] = _ai_raider_los_shot_seen and _ai_troll_pressure_seen
	_debug_check_pass[4] = _puzzle_all_charged_seen and _puzzle_gate_open_seen and _puzzle_relic_seen
	_debug_check_pass[5] = _ui_bars_seen and _ui_objective_seen and _ui_message_seen and _ui_clue_seen
	# Consider audio validated after distinct event hooks are observed.
	_debug_check_pass[6] = _sfx_seen.size() >= 5
