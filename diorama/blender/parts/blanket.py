"""Red plaid blanket draped over the chair's back-left corner.

Made with Blender's cloth simulation against the chair (deterministic: fixed start shape,
fixed settings, fixed frame count), then frozen into an ordinary mesh so it exports to glTF.
"""
from math import pi
import bmesh
import bpy
from mathutils import Vector

from lib import geo, scene as S
from lib.library import M

NX, NY = 40, 86
SIZE = (0.56, 1.20)
FRAMES = 60
COLLIDERS = ["CHAIR_Backrest", "CHAIR_Wing_L", "CHAIR_Wing_R", "CHAIR_Seat", "CHAIR_Bolster_L",
             "CHAIR_Bolster_R", "CHAIR_ArmPad_L", "CHAIR_LumbarPillow", "CHAIR_ArmPost_L",
             "CHAIR_BackPanel"]
# after the sim, any cloth vertex that ended up inside these is pushed back to their surface
PUSH_OUT = ["CHAIR_Wing_L", "CHAIR_Backrest", "CHAIR_BackPanel", "CHAIR_Bolster_L", "CHAIR_ArmPad_L"]


def _freeze(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.data = mesh
    bpy.data.meshes.remove(old)


def build(chair):
    bpy.context.view_layer.update()
    back = bpy.data.objects["CHAIR_Backrest"]
    corner = back.matrix_world @ Vector((-0.17, -0.22, 0.66 + 0.07))   # biased to the back
    rot_z = chair.matrix_world.to_euler().z

    blanket = geo.grid("CHAIR_Blanket", SIZE[0], SIZE[1], NX, NY, loc=corner, rot=(0, 0, rot_z),
                       collection="CHAIR", material=M("plaid"))
    # gentle initial sag so the cloth starts settled (avoids a flat-plane look)
    for v in blanket.data.vertices:
        v.co.z -= 0.02 * (v.co.x / SIZE[0]) ** 2

    added = []
    for o in [bpy.data.objects[n] for n in COLLIDERS]:
        col = o.modifiers.new("Collision", 'COLLISION')
        o.collision.thickness_outer = 0.005
        o.collision.cloth_friction = 15
        added.append(o)
    bpy.context.view_layer.update()   # register new colliders before the cloth is evaluated

    cloth = blanket.modifiers.new("Cloth", 'CLOTH')
    st = cloth.settings
    st.quality = 12
    st.mass = 0.25
    st.tension_stiffness = st.compression_stiffness = 12
    st.shear_stiffness = 6
    st.bending_stiffness = 0.15
    st.air_damping = 2.0
    cloth.collision_settings.distance_min = 0.004
    cloth.collision_settings.collision_quality = 6
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, FRAMES

    scene = bpy.context.scene
    for f in range(1, FRAMES + 1):
        scene.frame_set(f)
    _freeze(blanket)
    scene.frame_set(1)
    for o in added:
        for m in [m for m in o.modifiers if m.type == 'COLLISION']:
            o.modifiers.remove(m)
    # clean-up pass: push stray vertices out of the chair, then relax the crumples a little
    for name in PUSH_OUT:
        sw = blanket.modifiers.new("PushOut_" + name, 'SHRINKWRAP')
        sw.target = bpy.data.objects[name]
        sw.wrap_method = 'NEAREST_SURFACEPOINT'
        sw.wrap_mode = 'OUTSIDE'      # only vertices that ended up inside move
        sw.offset = 0.004
    sm = blanket.modifiers.new("Relax", 'SMOOTH')
    sm.factor, sm.iterations = 0.5, 3
    _freeze(blanket)

    # keep world position while parenting to the chair
    mw = blanket.matrix_world.copy()
    blanket.parent = chair
    blanket.matrix_parent_inverse = chair.matrix_world.inverted()
    blanket.matrix_world = mw
    sol = blanket.modifiers.new("Solidify", 'SOLIDIFY')
    sol.thickness = 0.004
    sol.offset = 0

    # fringe along both short edges, continuing the cloth direction
    verts = [blanket.matrix_world @ v.co for v in blanket.data.vertices]
    row = NX + 1
    edges = [(verts[:row], verts[row:2 * row]), (verts[-row:], verts[-2 * row:-row])]
    inv = chair.matrix_world.inverted()

    def fill(bm):
        for edge, inner in edges:
            for i in range(0, row):
                p, q = inv @ edge[i], inv @ inner[i]
                d = (p - q).normalized()
                end = p + d * 0.03 + Vector((0, 0, -0.012))
                geo.add_box(bm, (0.004, 0.002, (end - p).length), loc=(0, 0, 0))
                vs = bm.verts[-8:]
                quat = Vector((0, 0, 1)).rotation_difference((end - p).normalized())
                bmesh.ops.transform(bm, matrix=geo.mtx(p, quat.to_euler()), verts=vs)
    geo.merged("CHAIR_Blanket_Fringe", fill, collection="CHAIR", material=M("plaid_fringe"),
               parent=chair, uv="box", uv_scale=20)
    return blanket
