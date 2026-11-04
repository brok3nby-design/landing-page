"""Procedural mesh helpers.

Every helper builds real closed geometry with bmesh, puts the object origin at the
BOTTOM CENTRE (so `loc` is the point where the object rests), adds a non-destructive
bevel modifier for softened edges, smooth shading with hardened normals, and UVs.
`loc`/`rot` are in the parent's space when a parent is given.
"""
from math import cos, sin, pi
import bmesh
import bpy
from mathutils import Matrix, Vector

from . import scene as S

_mesh_cache = {}


# ------------------------------------------------------------------ core
def _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on):
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = rot
    if parent:
        obj.parent = parent
    S.coll(collection).objects.link(obj)
    if material and not mesh.materials:
        mesh.materials.append(material)
    if bevel and bevel > 0:
        mod = obj.modifiers.new("Bevel", 'BEVEL')
        mod.width = bevel
        mod.segments = seg
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
    if rests_on:
        obj["rests_on"] = rests_on
    return obj


def _to_mesh(bm, name, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
    return mesh


def _cube_bm(dims, uv=True):
    bm = bmesh.new()
    if uv:
        bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_cube(bm, size=1.0, calc_uvs=uv)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((0, 0, dims[2] / 2)), verts=bm.verts)
    return bm


# ------------------------------------------------------------------ primitives
def box(name, dims, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
        parent=None, bevel=0.004, seg=3, rests_on=None, shared=None):
    """Rounded box. `shared` = key to reuse (instance) one mesh across many objects."""
    if shared and shared in _mesh_cache:
        mesh = _mesh_cache[shared]
    else:
        mesh = _to_mesh(_cube_bm(dims), shared or name)
        if shared:
            _mesh_cache[shared] = mesh
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on)


def cylinder(name, r, h, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
             parent=None, r_top=None, verts=32, bevel=0.003, seg=2, rests_on=None, shared=None):
    if shared and shared in _mesh_cache:
        mesh = _mesh_cache[shared]
    else:
        bm = bmesh.new()
        bm.loops.layers.uv.new("UVMap")
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                              radius1=r, radius2=r if r_top is None else r_top, depth=h,
                              matrix=Matrix.Translation((0, 0, h / 2)), calc_uvs=True)
        mesh = _to_mesh(bm, shared or name)
        if shared:
            _mesh_cache[shared] = mesh
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on)


def sphere(name, r, loc=(0, 0, 0), collection="PROPS", material=None, scale=(1, 1, 1),
           parent=None, segs=24, rests_on=None, shared=None, ico=False):
    """Sphere with origin at its bottom."""
    if shared and shared in _mesh_cache:
        mesh = _mesh_cache[shared]
    else:
        bm = bmesh.new()
        bm.loops.layers.uv.new("UVMap")
        if ico:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, calc_uvs=True)
        else:
            bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=r,
                                      calc_uvs=True)
        bmesh.ops.translate(bm, vec=Vector((0, 0, r)), verts=bm.verts)
        mesh = _to_mesh(bm, shared or name, smooth=not ico)
        if shared:
            _mesh_cache[shared] = mesh
    obj = _finish(name, mesh, collection, material, loc, (0, 0, 0), parent, 0, 0, rests_on)
    obj.scale = scale
    return obj


def prism(name, outline, height, loc=(0, 0, 0), collection="BASE", material=None,
          parent=None, bevel=0.01, seg=3, rests_on=None):
    """Extrude a 2D CCW outline [(x, y), ...] upward by `height`."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    bot = [bm.verts.new((x, y, 0)) for x, y in outline]
    top = [bm.verts.new((x, y, height)) for x, y in outline]
    faces = [bm.faces.new(list(reversed(bot))), bm.faces.new(top)]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((bot[i], bot[j], top[j], top[i])))
    # planar UVs top/bottom, unrolled perimeter on the sides
    perim = 0.0
    for f in faces:
        for loop in f.loops:
            co = loop.vert.co
            if abs(f.normal.z) > 0.5:
                loop[uv].uv = (co.x, co.y)
            else:
                loop[uv].uv = (co.x + co.y, co.z)
    bm.normal_update()
    mesh = _to_mesh(bm, name)
    return _finish(name, mesh, collection, material, loc, (0, 0, 0), parent, bevel, seg, rests_on)


def arc_tube(name, radius, tube_r, angle, loc=(0, 0, 0), collection="PROPS", material=None,
             rot=(0, 0, 0), parent=None, steps=24, ring=12):
    """Partial torus in the XZ plane (e.g. a headphone band); centred on its circle centre."""
    bm = bmesh.new()
    rings = []
    for s in range(steps + 1):
        a = -angle / 2 + angle * s / steps + pi / 2
        c = Vector((cos(a) * radius, 0, sin(a) * radius))
        tangent = Vector((-sin(a), 0, cos(a)))
        normal = c.normalized()
        binormal = tangent.cross(normal)
        rings.append([bm.verts.new(c + (normal * cos(t) + binormal * sin(t)) * tube_r)
                      for t in (2 * pi * k / ring for k in range(ring))])
    for a, b in zip(rings, rings[1:]):
        for k in range(ring):
            bm.faces.new((a[k], a[(k + 1) % ring], b[(k + 1) % ring], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = _to_mesh(bm, name)
    return _finish(name, mesh, collection, material, loc, rot, parent, 0, 0, None)


def chamfered_rect(w, d, c):
    """CCW outline of a rectangle with 45-degree chamfered corners."""
    x, y = w / 2, d / 2
    return [(-x + c, -y), (x - c, -y), (x, -y + c), (x, y - c),
            (x - c, y), (-x + c, y), (-x, y - c), (-x, -y + c)]
