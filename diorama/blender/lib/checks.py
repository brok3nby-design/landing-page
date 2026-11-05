"""Automated sanity checks: resting contacts, collisions between major parts, counts, size."""
import bpy
from mathutils import Vector

TOL = 0.003   # 3 mm


def _bbox(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def _overlap(a, b, shrink=0.002):
    (alo, ahi), (blo, bhi) = a, b
    return all(alo[i] + shrink < bhi[i] and blo[i] + shrink < ahi[i] for i in range(3))


# Major part groups that must never interpenetrate (by object-name prefix).
COLLISION_GROUPS = {
    "chair": "CHAIR_",
    "desk_top": "DESK_Top",
    "cabinet": "DESK_Cabinet_Body",
    "drawers": "DESK_Drawer_",
    "riser": "SHELF_Riser",
    "upper": "SHELF_Upper",
    "monitors": "MON_",
    "props": "PROP_",
}
PAIRS = [("chair", "desk_top"), ("chair", "cabinet"), ("chair", "drawers"),
         ("monitors", "upper"), ("monitors", "props"), ("monitors", "riser")]


def run():
    bpy.context.view_layer.update()
    lines, problems = [], []
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bbs = {o.name: _bbox(o) for o in meshes}

    # 1) resting contacts: bottom of object == top of its declared support (within TOL)
    checked = 0
    for o in meshes:
        sup = o.get("rests_on")
        if not sup:
            continue
        checked += 1
        bottom = bbs[o.name][0].z
        top = bbs[sup][1].z if sup in bbs else None
        if top is None or abs(bottom - top) > TOL:
            problems.append(f"FLOAT/SINK {o.name}: bottom {bottom:.4f} vs {sup} top {top}")
    lines.append(f"Resting-contact checks: {checked} objects declared, "
                 f"{sum(p.startswith('FLOAT') for p in problems)} problems")

    # 2) collisions between major groups
    groups = {k: [n for n in bbs if n.startswith(p)] for k, p in COLLISION_GROUPS.items()}
    hits = 0
    for ga, gb in PAIRS:
        for a in groups[ga]:
            for b in groups[gb]:
                if a != b and _overlap(bbs[a], bbs[b]):
                    # monitors legitimately rest on the riser (touching, not overlapping)
                    hits += 1
                    problems.append(f"OVERLAP {a} <-> {b}")
    lines.append(f"Collision pairs checked: {len(PAIRS)} group pairs, {hits} overlaps")

    # 3) counts + overall size
    for c in bpy.context.scene.collection.children:
        lines.append(f"  {c.name:<20} {len(c.objects):>4} objects")
    lo = Vector((min(b[0].x for b in bbs.values()), min(b[0].y for b in bbs.values()),
                 min(b[0].z for b in bbs.values())))
    hi = Vector((max(b[1].x for b in bbs.values()), max(b[1].y for b in bbs.values()),
                 max(b[1].z for b in bbs.values())))
    size = hi - lo
    lines.append(f"Overall size (m): {size.x:.2f} W x {size.y:.2f} D x {size.z:.2f} H")
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        m.calc_loop_triangles()
        tris += len(m.loop_triangles)
        ev.to_mesh_clear()
    lines.append(f"Mesh objects: {len(meshes)}, evaluated triangles (with bevels): {tris:,}")
    return lines, problems
