"""Simple Principled BSDF materials (web/glTF compatible)."""
import bpy

_cache = {}


def _nodes(owner):
    if owner.node_tree is None:
        try:
            owner.use_nodes = True
        except Exception:
            pass
    return owner.node_tree


def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    if name in _cache:
        return _cache[name]
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    m.diffuse_color = (*color, 1.0)   # viewport colour
    _cache[name] = m
    return m


def world(color):
    w = bpy.data.worlds.new("World_Charcoal")
    nt = _nodes(w)
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    bpy.context.scene.world = w
    return w
