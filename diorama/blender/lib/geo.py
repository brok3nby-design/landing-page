"""Procedural mesh helpers.

Every helper builds real closed geometry with bmesh. Primitives put the object origin at the
BOTTOM CENTRE (so `loc` is the point where the object rests). Meshes get smooth shading with
sharp edges auto-marked above an angle, optional non-destructive bevel modifiers (hardened
normals) for softened edges, and UVs:

  uv="box"  world-scale box projection, 1 UV unit = 1/uv_scale metres (textures tile)
  uv="fit"  faces facing `fit_axis` are fitted 0..1 over their extent (decals, rugs, screens)
  uv="keep" whatever the generator produced (lathe / tube / plane parametric UVs)

`loc`/`rot` are in the parent's space when a parent is given.
"""
from math import cos, sin, pi, atan2
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from . import scene as S

_mesh_cache = {}
SHARP_ANGLE = 0.75  # radians (~43 deg): edges sharper than this render hard


# ------------------------------------------------------------------ UVs
def _uv_layer(bm):
    return bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")


def _uv_box(bm, scale=1.0, swap=False):
    uv = _uv_layer(bm)
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[ax]
        for loop in f.loops:
            co = loop.vert.co
            u, v = co[a] * scale, co[b] * scale
            loop[uv].uv = (v, u) if swap else (u, v)


def _uv_fit(bm, axis=2, flip_u=False):
    """Fit faces whose normal points mostly along +/-axis to 0..1 (others get tiny box UVs)."""
    uv = _uv_layer(bm)
    a, b = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[axis]
    cos_ = [v.co for v in bm.verts]
    amin, amax = min(c[a] for c in cos_), max(c[a] for c in cos_)
    bmin, bmax = min(c[b] for c in cos_), max(c[b] for c in cos_)
    da, db = max(amax - amin, 1e-6), max(bmax - bmin, 1e-6)
    for f in bm.faces:
        main = abs(f.normal[axis]) > 0.5
        for loop in f.loops:
            co = loop.vert.co
            u = (co[a] - amin) / da
            v = (co[b] - bmin) / db
            if flip_u:
                u = 1 - u
            loop[uv].uv = (u, v) if main else (min(max(u, 0.02), 0.98) * 0.02 + 0.01, 0.01)


def _mark_sharp(bm, angle=SHARP_ANGLE):
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0) < angle
        else:
            e.smooth = True


# ------------------------------------------------------------------ core
def _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on, scale=None):
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = rot
    if scale:
        obj.scale = scale
    if parent:
        obj.parent = parent
    S.coll(collection).objects.link(obj)
    if material is not None and not mesh.materials:
        for m in (material if isinstance(material, (list, tuple)) else [material]):
            mesh.materials.append(m)
    if bevel and bevel > 0:
        mod = obj.modifiers.new("Bevel", 'BEVEL')
        mod.width = bevel
        mod.segments = seg
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
    if rests_on:
        obj["rests_on"] = rests_on
    return obj


def _to_mesh(bm, name, smooth=True, uv="box", uv_scale=1.0, uv_swap=False, fit_axis=2,
             flip_u=False, sharp=SHARP_ANGLE, uv_region=None):
    bm.normal_update()
    if uv == "box":
        _uv_box(bm, uv_scale, uv_swap)
    elif uv == "fit":
        _uv_fit(bm, fit_axis, flip_u)
    if uv_region:
        u0, v0, u1, v1 = uv_region
        lay = _uv_layer(bm)
        for f in bm.faces:
            for loop in f.loops:
                u, v = loop[lay].uv
                loop[lay].uv = (u0 + u * (u1 - u0), v0 + v * (v1 - v0))
    if smooth:
        for f in bm.faces:
            f.smooth = True
        if sharp:
            _mark_sharp(bm, sharp)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def _cached(shared, build):
    if shared and shared in _mesh_cache:
        return _mesh_cache[shared]
    mesh = build()
    if shared:
        _mesh_cache[shared] = mesh
    return mesh


def from_bm(name, bm, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
            parent=None, bevel=0, seg=2, rests_on=None, shared=None, scale=None, **uvkw):
    mesh = _cached(shared, lambda: _to_mesh(bm, shared or name, **uvkw))
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on, scale)


def instance(name, src, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, collection=None, scale=None,
             rests_on=None):
    """Linked duplicate of `src` (shares mesh + modifiers config)."""
    obj = bpy.data.objects.new(name, src.data)
    obj.location, obj.rotation_euler = loc, rot
    if scale:
        obj.scale = scale
    obj.parent = parent if parent is not None else src.parent
    for m in src.modifiers:
        if m.type == 'BEVEL':
            n = obj.modifiers.new(m.name, 'BEVEL')
            n.width, n.segments, n.limit_method, n.harden_normals = m.width, m.segments, m.limit_method, True
        elif m.type == 'SOLIDIFY':
            n = obj.modifiers.new(m.name, 'SOLIDIFY')
            n.thickness, n.offset = m.thickness, m.offset
    (S.coll(collection) if collection else src.users_collection[0]).objects.link(obj)
    if rests_on:
        obj["rests_on"] = rests_on
    return obj


# ------------------------------------------------------------------ primitives
def _cube_bm(dims):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((0, 0, dims[2] / 2)), verts=bm.verts)
    return bm


def box(name, dims, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
        parent=None, bevel=0.004, seg=3, rests_on=None, shared=None, uv="box", uv_scale=1.0,
        uv_swap=False, fit_axis=2, flip_u=False, uv_region=None):
    """Rounded box. `shared` = key to reuse (instance) one mesh across many objects."""
    mesh = _cached(shared, lambda: _to_mesh(_cube_bm(dims), shared or name, uv=uv, uv_scale=uv_scale,
                                            uv_swap=uv_swap, fit_axis=fit_axis, flip_u=flip_u,
                                            uv_region=uv_region))
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on)


def cylinder(name, r, h, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
             parent=None, r_top=None, verts=32, bevel=0.003, seg=2, rests_on=None, shared=None,
             uv="box", uv_scale=1.0):
    def build():
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                              radius1=r, radius2=r if r_top is None else r_top, depth=h,
                              matrix=Matrix.Translation((0, 0, h / 2)))
        return _to_mesh(bm, shared or name, uv=uv, uv_scale=uv_scale)
    mesh = _cached(shared, build)
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on)


def sphere(name, r, loc=(0, 0, 0), collection="PROPS", material=None, scale=(1, 1, 1),
           parent=None, segs=24, rests_on=None, shared=None, rot=(0, 0, 0)):
    """UV sphere with origin at its bottom."""
    def build():
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(segs // 2, 4), radius=r)
        bmesh.ops.translate(bm, vec=Vector((0, 0, r)), verts=bm.verts)
        return _to_mesh(bm, shared or name, uv="box", uv_scale=8, sharp=None)
    mesh = _cached(shared, build)
    return _finish(name, mesh, collection, material, loc, rot, parent, 0, 0, rests_on, scale)


def polyhedron(name, kind, size, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
               parent=None, rests_on=None, shared=None, bevel=0.0015):
    """Gaming dice shapes: 'd20' icosahedron, 'd8' octahedron. Origin at the bottom."""
    def build():
        bm = bmesh.new()
        if kind == "d20":
            bmesh.ops.create_icosphere(bm, subdivisions=0, radius=size)
        else:  # d8
            vs = [bm.verts.new(v) for v in ((size, 0, 0), (-size, 0, 0), (0, size, 0),
                                             (0, -size, 0), (0, 0, size), (0, 0, -size))]
            for a in (0, 1):
                for b in (2, 3):
                    for c in (4, 5):
                        bm.faces.new((vs[a], vs[b], vs[c]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # rest on a face: rotate so one face normal points down
        bm.normal_update()
        bm.faces.ensure_lookup_table()
        f = bm.faces[0]
        q = f.normal.rotation_difference(Vector((0, 0, -1)))
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=q.to_matrix(), verts=bm.verts)
        zmin = min(v.co.z for v in bm.verts)
        bmesh.ops.translate(bm, vec=Vector((0, 0, -zmin)), verts=bm.verts)
        return _to_mesh(bm, shared or name, uv="box", uv_scale=20)
    mesh = _cached(shared, build)
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, 2, rests_on)


def prism(name, outline, height, loc=(0, 0, 0), collection="BASE", material=None,
          parent=None, bevel=0.01, seg=3, rests_on=None, holes=None, uv_scale=1.0, rot=(0, 0, 0)):
    """Extrude a 2D CCW outline [(x, y), ...] upward by `height`.
    `holes` = one inner CW-agnostic outline with the same vertex count -> a ring/frame."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, 0)) for x, y in outline]
    top = [bm.verts.new((x, y, height)) for x, y in outline]
    n = len(outline)
    if holes:
        ibot = [bm.verts.new((x, y, 0)) for x, y in holes]
        itop = [bm.verts.new((x, y, height)) for x, y in holes]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bot[i], bot[j], top[j], top[i]))          # outer wall
            bm.faces.new((itop[i], itop[j], ibot[j], ibot[i]))      # inner wall
            bm.faces.new((top[i], top[j], itop[j], itop[i]))        # top ring
            bm.faces.new((ibot[i], ibot[j], bot[j], bot[i]))        # bottom ring
    else:
        bm.faces.new(list(reversed(bot)))
        bm.faces.new(top)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = _to_mesh(bm, name, uv="box", uv_scale=uv_scale)
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on)


def lathe(name, profile, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
          parent=None, segments=32, rests_on=None, shared=None, scale=None, sharp=SHARP_ANGLE,
          bevel=0, seg=2, loop=None):
    """Revolve a profile [(radius, z), ...] around Z. Points with radius 0 close the shape.
    A profile that starts AND ends off-axis is treated as a closed loop (shells, rings, pads).
    UV: u = angle / 2pi (u=0 on +X, counter-clockwise), v = normalised profile length."""
    def build():
        bm = bmesh.new()
        uv = _uv_layer(bm)
        is_loop = loop if loop is not None else (profile[0][0] > 1e-7 and profile[-1][0] > 1e-7)
        prof = list(profile) + ([profile[0]] if is_loop else [])
        lens = [0.0]
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
            lens.append(lens[-1] + ((r1 - r0) ** 2 + (z1 - z0) ** 2) ** 0.5)
        total = lens[-1] or 1.0
        rings = []
        for r, z in profile:
            if r < 1e-7:
                rings.append([bm.verts.new((0, 0, z))])
            else:
                rings.append([bm.verts.new((cos(2 * pi * k / segments) * r,
                                            sin(2 * pi * k / segments) * r, z))
                              for k in range(segments)])
        if is_loop:
            rings.append(rings[0])
        for i in range(len(rings) - 1):
            ra, rb = rings[i], rings[i + 1]
            va, vb = lens[i] / total, lens[i + 1] / total
            for k in range(segments):
                k1 = (k + 1) % segments
                ua, ub = k / segments, (k + 1) / segments
                if len(ra) == 1 and len(rb) == 1:
                    continue
                if len(ra) == 1:
                    f = bm.faces.new((ra[0], rb[k], rb[k1]))
                    uvs = [((ua + ub) / 2, va), (ua, vb), (ub, vb)]
                elif len(rb) == 1:
                    f = bm.faces.new((ra[k], ra[k1], rb[0]))
                    uvs = [(ua, va), (ub, va), ((ua + ub) / 2, vb)]
                else:
                    f = bm.faces.new((ra[k], ra[k1], rb[k1], rb[k]))
                    uvs = [(ua, va), (ub, va), (ub, vb), (ua, vb)]
                for lp, t in zip(f.loops, uvs):
                    lp[uv].uv = t
        # cap open ends (profile not starting/ending on the axis)
        if not is_loop and len(rings[0]) > 1:
            bm.faces.new(list(reversed(rings[0])))
        if not is_loop and len(rings[-1]) > 1:
            bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return _to_mesh(bm, shared or name, uv="keep", sharp=sharp)
    mesh = _cached(shared, build)
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on, scale)


def _catmull(points, steps):
    pts = [Vector(p) for p in points]
    if len(pts) < 3:
        return [pts[0].lerp(pts[-1], t / steps) for t in range(steps + 1)]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for s in range(steps):
            t = s / steps
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    out.append(pts[-1])
    return out


def curve_tube(name, points, radius, loc=(0, 0, 0), collection="PROPS", material=None,
               rot=(0, 0, 0), parent=None, ring=8, steps=6, taper=None, caps=True, shared=None,
               flatten=1.0):
    """Smooth tube through `points` (Catmull-Rom). `taper(t)` scales the radius along t in 0..1.
    `flatten` < 1 squashes the cross-section along the binormal (flat logos, headbands)."""
    def build():
        path = _catmull(points, steps)
        bm = bmesh.new()
        uv = _uv_layer(bm)
        n = len(path)
        # parallel-transport frame
        t0 = (path[1] - path[0]).normalized()
        ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
        nrm = t0.cross(ref).normalized()
        rings, prev_t = [], t0
        length = [0.0]
        for i in range(1, n):
            length.append(length[-1] + (path[i] - path[i - 1]).length)
        for i, p in enumerate(path):
            t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
            axis = prev_t.cross(t)
            if axis.length > 1e-8:
                ang = prev_t.angle(t)
                nrm = Matrix.Rotation(ang, 3, axis.normalized()) @ nrm
            prev_t = t
            bin_ = t.cross(nrm).normalized()
            r = radius * (taper(i / (n - 1)) if taper else 1.0)
            rings.append([bm.verts.new(p + (nrm * cos(a) + bin_ * sin(a) * flatten) * r)
                          for a in (2 * pi * k / ring for k in range(ring))])
        total = length[-1] or 1
        for i in range(n - 1):
            for k in range(ring):
                k1 = (k + 1) % ring
                f = bm.faces.new((rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]))
                for loop, t in zip(f.loops, [(k / ring, length[i] / total), ((k + 1) / ring, length[i] / total),
                                             ((k + 1) / ring, length[i + 1] / total), (k / ring, length[i + 1] / total)]):
                    loop[uv].uv = t
        if caps:
            bm.faces.new(list(reversed(rings[0])))
            bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return _to_mesh(bm, shared or name, uv="keep", sharp=None)
    mesh = _cached(shared, build)
    return _finish(name, mesh, collection, material, loc, rot, parent, 0, 0, None)


def grid(name, w, d, nx, ny, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
         parent=None, deform=None, thickness=0.0, shared=None):
    """Subdivided plane in XY centred on origin, UV 0..1. `deform(x, y) -> (x, y, z)` shapes it
    (u, v are given in metres from the centre). Optional solidify thickness."""
    def build():
        bm = bmesh.new()
        uv = _uv_layer(bm)
        verts = []
        for j in range(ny + 1):
            row = []
            for i in range(nx + 1):
                x, y = (i / nx - 0.5) * w, (j / ny - 0.5) * d
                co = deform(x, y) if deform else (x, y, 0)
                row.append(bm.verts.new(co))
            verts.append(row)
        for j in range(ny):
            for i in range(nx):
                f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
                for loop, t in zip(f.loops, [(i / nx, j / ny), ((i + 1) / nx, j / ny),
                                             ((i + 1) / nx, (j + 1) / ny), (i / nx, (j + 1) / ny)]):
                    loop[uv].uv = t
        return _to_mesh(bm, shared or name, uv="keep", sharp=None)
    mesh = _cached(shared, build)
    obj = _finish(name, mesh, collection, material, loc, rot, parent, 0, 0, None)
    if thickness:
        sol = obj.modifiers.new("Solidify", 'SOLIDIFY')
        sol.thickness = thickness
        sol.offset = 0
    return obj


def chamfered_rect(w, d, c):
    """CCW outline of a rectangle with 45-degree chamfered corners."""
    x, y = w / 2, d / 2
    return [(-x + c, -y), (x - c, -y), (x, -y + c), (x, y - c),
            (x - c, y), (-x + c, y), (-x, y - c), (-x, -y + c)]


def rounded_rect(w, d, r, n=4):
    """CCW outline of a rounded rectangle (n points per corner)."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, -d / 2 + r, -pi / 2), (w / 2 - r, d / 2 - r, 0),
                       (-w / 2 + r, d / 2 - r, pi / 2), (-w / 2 + r, -d / 2 + r, pi)):
        for k in range(n + 1):
            a = a0 + (pi / 2) * k / n
            pts.append((cx + cos(a) * r, cy + sin(a) * r))
    return pts


# ------------------------------------------------------------------ merged meshes
# Many small repeated parts (keycaps, fringe strands, leaves) are merged into ONE mesh:
# one draw call in the browser instead of hundreds of objects.
def mtx(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return Matrix.LocRotScale(Vector(loc), Euler(rot).to_quaternion(), Vector(scale))


def add_box(bm, dims, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Add a box (origin bottom-centre) into an existing bmesh."""
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=Vector(dims), verts=verts)
    bmesh.ops.translate(bm, vec=Vector((0, 0, dims[2] / 2)), verts=verts)
    bmesh.ops.transform(bm, matrix=mtx(loc, rot), verts=verts)
    return verts


def add_cyl(bm, r, h, loc=(0, 0, 0), rot=(0, 0, 0), verts=12, r_top=None):
    v = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r,
                              radius2=r if r_top is None else r_top, depth=h,
                              matrix=Matrix.Translation((0, 0, h / 2)))["verts"]
    bmesh.ops.transform(bm, matrix=mtx(loc, rot), verts=v)
    return v


def add_open_box(bm, dims, wall, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Open-top container (bottom + 4 walls)."""
    w, d, h = dims
    m = mtx(loc, rot)
    parts = [((w, d, wall), (0, 0, 0)),
             ((w, wall, h), (0, -d / 2 + wall / 2, 0)), ((w, wall, h), (0, d / 2 - wall / 2, 0)),
             ((wall, d - 2 * wall, h), (-w / 2 + wall / 2, 0, 0)), ((wall, d - 2 * wall, h), (w / 2 - wall / 2, 0, 0))]
    for dm, lc in parts:
        vs = add_box(bm, dm, lc)
        bmesh.ops.transform(bm, matrix=m, verts=vs)


def heart_leaf(bm, size, matrix, fold=0.35, n=14):
    """Heart-shaped leaf (pothos), lying in XY pointing +Y, folded along the midrib."""
    pts = []
    for k in range(n + 1):
        t = k / n                       # 0 = tip, 1 = notch
        a = pi * t
        x = sin(a) * (0.55 + 0.25 * sin(a)) * size
        y = (1 - t) * size * 1.0 - 0.15 * size * sin(a * 2)
        pts.append((x, y))
    outline = pts + [(-x, y) for x, y in reversed(pts[1:-1])]
    centre = bm.verts.new((0, size * 0.35, 0))
    vs = [bm.verts.new((x, y, abs(x) * fold)) for x, y in outline]
    for i in range(len(vs)):
        bm.faces.new((centre, vs[i], vs[(i + 1) % len(vs)]))
    stem = bm.verts.new((0, -size * 0.05, 0))
    bmesh.ops.transform(bm, matrix=matrix, verts=vs + [centre, stem])
    return vs


def merged(name, fill, loc=(0, 0, 0), collection="PROPS", material=None, rot=(0, 0, 0),
           parent=None, bevel=0, seg=2, rests_on=None, shared=None, **uvkw):
    """Build one object from many parts: `fill(bm)` adds geometry."""
    def build():
        bm = bmesh.new()
        fill(bm)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return _to_mesh(bm, shared or name, **uvkw)
    mesh = _cached(shared, build)
    return _finish(name, mesh, collection, material, loc, rot, parent, bevel, seg, rests_on)
