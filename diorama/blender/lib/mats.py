"""Materials: Principled BSDF + optional image textures only (maps 1:1 onto glTF PBR).

Supported inputs: base colour (flat or image), roughness, metallic, emission (flat or image),
transmission (glass, exported as KHR_materials_transmission), alpha.
"""
import bpy

_cache = {}
TEX = {}        # name -> bpy image, filled by build.py from textures.generate_all()


def _nodes(owner):
    if owner.node_tree is None:
        try:
            owner.use_nodes = True
        except Exception:
            pass
    return owner.node_tree


def _img_node(nt, tex, x, closest=False):
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = TEX[tex] if isinstance(tex, str) else tex
    node.location = (x, 300)
    if closest:
        node.interpolation = 'Closest'
    return node


def mat(name, color=(0.5, 0.5, 0.5), rough=0.6, metal=0.0, emit=None, strength=0.0, tex=None,
        emit_tex=None, transmission=0.0, ior=1.45, alpha=1.0, closest=False, tint=None):
    if name in _cache:
        return _cache[name]
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if tex:
        img = _img_node(nt, tex, -400, closest)
        if tint:   # multiply texture by a colour (glTF exports this as baseColorFactor)
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs[0].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1.0)
            nt.links.new(img.outputs["Color"], mix.inputs[6])
            nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        else:
            nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    if emit_tex:
        img = _img_node(nt, emit_tex, -400, closest)
        nt.links.new(img.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = strength
    elif emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
        bsdf.inputs["IOR"].default_value = ior
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    m.diffuse_color = (*color, 1.0)
    _cache[name] = m
    return m


def reset_cache():
    _cache.clear()


def world(color):
    w = bpy.data.worlds.new("World_Charcoal")
    nt = _nodes(w)
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    bpy.context.scene.world = w
    return w
