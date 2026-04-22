extends StaticBody3D

@onready var _mesh: MeshInstance3D = $MeshInstance3D
var _hurt_t: float = 0.0


func _ready() -> void:
	add_to_group("enemy")


func _process(delta: float) -> void:
	_hurt_t = maxf(0.0, _hurt_t - minf(delta, 0.05))
	var flash: float = 1.0 if _hurt_t > 0.0 else 0.0
	var m: BaseMaterial3D = _mesh.get_active_material(0) as BaseMaterial3D
	if m != null:
		m.albedo_color = Color(0.42 + 0.45 * flash, 0.58 - 0.2 * flash, 0.33 - 0.18 * flash, 1.0)


func receive_hit() -> void:
	_hurt_t = 0.12
