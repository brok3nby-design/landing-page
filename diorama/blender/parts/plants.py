"""Trailing pothos on the upper shelf (vines hang over the left edge) + a small upright plant.
Leaves are merged into two meshes (dark/light green) per plant -> few draw calls.
Seeded random numbers make the result identical on every rebuild."""
from math import pi, sin, cos, radians
import random
import bmesh
from mathutils import Vector, Matrix

from lib import geo, scene as S
from lib.library import M


def _pot(root, name, x, y, z, r, h, mat):
    prof = [(0, 0), (r * 0.82, 0), (r, h * 0.92), (r * 1.06, h * 0.92), (r * 1.06, h), (r - 0.004, h),
            (r * 0.8 - 0.004, 0.006), (0, 0.006)]
    pot = geo.lathe(name, prof, loc=(x, y, z), collection="PROPS", material=M(mat), parent=root,
                    segments=32, rests_on="SHELF_Upper")
    geo.cylinder(name + "_Soil", r * 0.97, 0.002, loc=(0, 0, h * 0.86), collection="PROPS",
                 material=M("soil"), parent=pot, verts=28, bevel=0)
    return pot


def _leaf_matrix(pos, direction, size, roll, droop):
    """Leaf lying along `direction` (from stem), tilted down by `droop`, rolled by `roll`."""
    d = Vector(direction).normalized()
    yaw = Vector((d.x, d.y, 0))
    yaw_a = (yaw.to_track_quat('Y', 'Z').to_euler().z) if yaw.length > 1e-4 else 0
    return (Matrix.Translation(pos) @ Matrix.Rotation(yaw_a, 4, 'Z') @ Matrix.Rotation(-droop, 4, 'X')
            @ Matrix.Rotation(roll, 4, 'Y') @ Matrix.Scale(size, 4))


def pothos(root, shelf_top, shelf_y, shelf_front, x_left):
    rng = random.Random(42)
    px, py = -0.62, shelf_y
    pot = _pot(root, "PROP_Pothos_Pot", px, py, shelf_top, 0.052, 0.085, "terracotta")
    rim = shelf_top + 0.08
    vines = []
    # hanging over the left end of the shelf, outside the hutch post
    for k, (ex, ey, ez) in enumerate([(x_left - 0.03, shelf_y - 0.05, 1.02), (x_left - 0.05, shelf_y + 0.04, 1.12),
                                      (x_left - 0.02, shelf_y - 0.10, 1.24), (x_left - 0.06, shelf_y - 0.01, 0.96)]):
        pts = [Vector((px - 0.02, py + rng.uniform(-0.02, 0.02), rim + 0.01)),
               Vector((x_left - 0.005, py + (ey - py) * 0.3, shelf_top + 0.02)),
               Vector((x_left - 0.02, py + (ey - py) * 0.6, shelf_top - 0.06)),
               Vector(((x_left + ex) / 2 - 0.01, (py + ey) / 2, (shelf_top + ez) / 2 - 0.05)),
               Vector((ex, ey, ez))]
        vines.append(pts)
    # two shorter vines over the front edge
    for ex, ez in ((-0.60, 1.36), (-0.53, 1.42)):
        pts = [Vector((px + 0.01, py - 0.02, rim)), Vector((ex, shelf_front + 0.01, shelf_top + 0.015)),
               Vector((ex - 0.01, shelf_front - 0.025, shelf_top - 0.05)), Vector((ex + 0.01, shelf_front - 0.03, ez))]
        vines.append(pts)

    leaves_dark, leaves_light = [], []
    for v_i, pts in enumerate(vines):
        geo.curve_tube(f"PROP_Pothos_Vine_{v_i}", pts, 0.0022, collection="PROPS", material=M("vine"),
                       parent=root, ring=5, steps=8)
        path = geo._catmull(pts, 8)
        for i in range(2, len(path) - 1, 2):
            p, q = path[i], path[i + 1]
            tangent = (q - p).normalized()
            side = 1 if (i // 2) % 2 else -1
            out = tangent.cross(Vector((0, 0, 1)))
            if out.length < 1e-3:
                out = Vector((1, 0, 0))
            direction = (out.normalized() * side + Vector((0, 0, -0.3)) - Vector((0, 0, 0))).normalized()
            size = rng.uniform(0.032, 0.048) * (0.8 + 0.4 * i / len(path))
            mtx = _leaf_matrix(p, direction, size, rng.uniform(-0.6, 0.6), rng.uniform(0.3, 1.1))
            (leaves_dark if rng.random() < 0.6 else leaves_light).append(mtx)
    # bushy crown on the pot
    for k in range(26):
        a = k * 2.399 + rng.uniform(-0.2, 0.2)
        rr = rng.uniform(0.01, 0.06)
        pos = Vector((px + cos(a) * rr, py + sin(a) * rr, rim + rng.uniform(0.01, 0.05)))
        direction = Vector((cos(a), sin(a), rng.uniform(0.2, 0.9)))
        mtx = _leaf_matrix(pos, direction, rng.uniform(0.032, 0.045), rng.uniform(-0.5, 0.5),
                           rng.uniform(-0.5, 0.4))
        (leaves_dark if k % 3 else leaves_light).append(mtx)

    for name, mats, mat in (("PROP_Pothos_Leaves", leaves_dark, "leaf"),
                            ("PROP_Pothos_LeavesLight", leaves_light, "leaf_light")):
        geo.merged(name, lambda bm, mats=mats: [geo.heart_leaf(bm, 1.0, m) for m in mats],
                   collection="PROPS", material=M(mat), parent=root, uv="box", uv_scale=30)
    return pot


def upright(root, x, y, shelf_top):
    rng = random.Random(7)
    pot = _pot(root, "PROP_Plant2_Pot", x, y, shelf_top, 0.04, 0.07, "pot_cream")
    rim = shelf_top + 0.065
    mats = []
    for k in range(18):
        a = k * 2.399
        h = rng.uniform(0.0, 0.05)
        stem_top = Vector((x + cos(a) * 0.02, y + sin(a) * 0.02, rim + h))
        geo_dir = Vector((cos(a), sin(a), 1.4))
        mats.append(_leaf_matrix(stem_top, geo_dir, rng.uniform(0.03, 0.045), rng.uniform(-0.4, 0.4),
                                 rng.uniform(-1.0, -0.4)))
    geo.merged("PROP_Plant2_Leaves", lambda bm: [geo.heart_leaf(bm, 1.0, m, fold=0.5) for m in mats],
               collection="PROPS", material=M("leaf"), parent=root, uv="box", uv_scale=30)
    return pot
