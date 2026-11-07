"""The Maze exhibit: a tabletop model of the maze from the game's cover art.

A square stone maze on a dark, rocky plinth: weathered stone walls with moss and ivy along their tops,
the arched gate in the front wall with two burning torches, and in the heart of the maze a little stone
altar with a glowing keyhole (the keyhole of the title). Outside the walls: the wooden signpost (compass,
skull, "?", pines), the lantern and the adventurer's satchel by it, a rope fence, a dead tree with a crow,
and in the far corner a castle on a rocky hill.

For the website: a bone die waits on a flat stone by the gate and a pawn with a lantern stands before it.
Roll the die and the pawn walks that many steps along the path toward the heart (the path is exported
as JSON on MZ_Path, world space). The maze is generated with a seeded depth-first search, so it is the
same maze every build. Real-ish tabletop scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos
import json
import random
from collections import deque
import numpy as np
import bmesh
import bpy
from mathutils import Vector

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

N = 9                      # cells per side
C = 0.15                   # cell size
WALL_H, WALL_T = 0.085, 0.032
HALF = N * C / 2
GATE_COL = N // 2
SEED = 50                  # a path of 27 cells from the gate to the heart (about 8 rolls)
FACES = {"+Z": 1, "-Z": 6, "-Y": 2, "+Y": 5, "+X": 3, "-X": 4}
DIE = 0.038
VIEWS = [  # name, azimuth, elevation, lens, frame fill: higher than the other exhibits, to see into the maze
    ("CAM_Exhibit_Hero", 34, 45, 50, 0.86),
    ("CAM_Exhibit_Front", 8, 30, 50, 0.86),
    ("CAM_Exhibit_High", 40, 68, 50, 0.84),
]
CLOSEUPS = [("CAM_Exhibit_CloseGate", ["MZ_Gate", "MZ_Die", "MZ_Pawn", "MZ_Signpost"], 20, 30, 50, 0.8)]
LIGHT_GAIN = dict(key=5.5, fill=4.0, rim=2.6)
BAKE_HIDE = ["MZ_Die", "MZ_Pawn"]


# ---------------------------------------------------------------- the maze (seeded depth-first search)
def generate():
    rng = random.Random(SEED)
    # walls[(i, j)] = {"N", "S", "E", "W"} still standing for cell i (x, left->right), j (y, front->back)
    walls = {(i, j): {"N", "S", "E", "W"} for i in range(N) for j in range(N)}
    step = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0)}
    opp = {"N": "S", "S": "N", "E": "W", "W": "E"}
    stack, seen = [(GATE_COL, 0)], {(GATE_COL, 0)}
    while stack:
        i, j = stack[-1]
        options = [(d, (i + dx, j + dy)) for d, (dx, dy) in step.items()
                   if 0 <= i + dx < N and 0 <= j + dy < N and (i + dx, j + dy) not in seen]
        if not options:
            stack.pop()
            continue
        d, nxt = rng.choice(options)
        walls[(i, j)].discard(d)
        walls[nxt].discard(opp[d])
        seen.add(nxt)
        stack.append(nxt)
    centre = (N // 2, N // 2)
    walls[(GATE_COL, 0)].discard("S")                        # the gate
    # shortest path gate -> heart
    prev, q = {(GATE_COL, 0): None}, deque([(GATE_COL, 0)])
    while q:
        c = q.popleft()
        if c == centre:
            break
        for d, (dx, dy) in step.items():
            n = (c[0] + dx, c[1] + dy)
            if d not in walls[c] and n in walls and n not in prev:
                prev[n] = c
                q.append(n)
    path, c = [], centre
    while c is not None:
        path.append(c)
        c = prev[c]
    return walls, path[::-1]


def cell_xy(i, j):
    return (-HALF + (i + 0.5) * C, -HALF + (j + 0.5) * C)


# ---------------------------------------------------------------- textures
def _tex_ground(name="mz_ground", size=1024):
    c = T.Canvas(size, size, T.rgb("#2c3326"))
    c.mul(0.7 + 0.45 * T.noise(size, size, 5, 81))
    c.mul(0.85 + 0.25 * T.noise(size, size, 40, 82))
    rng = random.Random(3)
    for _ in range(500):                                      # pebbles and grass tufts
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        if rng.random() < 0.5:
            c.circle(x, y, rng.uniform(2, 6), T.rgb("#5c5a52"), 0.6)
        else:
            c.line(x, y, x + rng.uniform(-4, 4), y - rng.uniform(5, 12), 2, T.rgb("#4a6b32"), 0.6)
    return c.save(name)


def _tex_path(name="mz_path", size=1024):
    """Worn cobbles for the maze floor."""
    c = T.Canvas(size, size, T.rgb("#3b3832"))
    rng = random.Random(5)
    for _ in range(900):
        x, y, r = rng.uniform(0, size), rng.uniform(0, size), rng.uniform(10, 22)
        g = rng.uniform(0.75, 1.1)
        c.circle(x, y, r + 2, T.rgb("#1f1d1a"), 0.9)
        c.circle(x, y, r, tuple(np.array(T.rgb("#6a655a")) * g), 0.95)
    c.mul(0.8 + 0.3 * T.noise(size, size, 6, 83))
    moss = np.clip((T.noise(size, size, 9, 84) - 0.55) * 3, 0, 1)
    c._blend(moss, T.rgb("#3e5a2a"), 0.6)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=5.0, size=(512, 512), blur=1.0)


def _tex_moss(name="mz_moss", size=512):
    c = T.Canvas(size, size, T.rgb("#3a5a26"))
    c.mul(0.6 + 0.6 * T.noise(size, size, 14, 85))
    c.mul(0.8 + 0.3 * T.noise(size, size, 60, 86))
    return c.save(name)


def _tex_sign(name, symbol, w=384, h=128):
    """A weathered board with a burnt-in symbol."""
    c = T.Canvas(w, h, T.rgb("#6b4a2c"))
    c.mul(0.75 + 0.35 * T.noise(h, w, 4, len(name)))
    for k in range(0, h, 9):
        c.line(0, k, w, k + 3, 1.5, T.rgb("#4a321c"), 0.4)    # grain
    ink, cx, cy = T.rgb("#1c120a"), w * 0.5, h * 0.5
    if symbol == "compass":
        c.circle(cx, cy, 40, ink, 0.9, ring=5)
        for a in range(4):
            t = a * pi / 2
            c.poly([(cx + cos(t) * 52, cy + sin(t) * 52), (cx + cos(t + 0.35) * 12, cy + sin(t + 0.35) * 12),
                    (cx + cos(t - 0.35) * 12, cy + sin(t - 0.35) * 12)], ink)
    elif symbol == "skull":
        c.circle(cx, cy - 6, 30, ink); c.rect(cx - 18, cy + 14, cx + 18, cy + 34, ink)
        for sx in (-1, 1):
            c.circle(cx + sx * 12, cy - 6, 8, T.rgb("#6b4a2c"))
        c.poly([(cx, cy + 4), (cx - 5, cy + 14), (cx + 5, cy + 14)], T.rgb("#6b4a2c"))
    elif symbol == "question":
        c.text("?", cx - 21, cy - 31, 9, ink)
    else:                                                     # pines
        for k, dx in enumerate((-40, 0, 40)):
            s = 1.2 if k == 1 else 0.9
            c.poly([(cx + dx, cy - 40 * s), (cx + dx - 22 * s, cy + 30), (cx + dx + 22 * s, cy + 30)], ink)
            c.rect(cx + dx - 3, cy + 30, cx + dx + 3, cy + 42, ink)
    return c.save(name)


def textures():
    from exhibits.pocket_wilds import _tex_stone
    out = {}
    out["mz_stone"], out["mz_stone_n"] = _tex_stone("mz_stone", "#5a564e", seed=41)
    out["mz_rock"], out["mz_rock_n"] = _tex_stone("mz_rock", "#3b3a38", seed=43)
    out["mz_ground"] = _tex_ground()
    out["mz_path"], out["mz_path_n"] = _tex_path()
    out["mz_moss"] = _tex_moss()
    for s in ("compass", "skull", "question", "pines"):
        out[f"mz_sign_{s}"] = _tex_sign(f"mz_sign_{s}", s)
    TEX.update(out)
    return out


def materials():
    return dict(
        stone=mat("M_mz_stone", tex="mz_stone", rough=0.88, normal="mz_stone_n", normal_strength=0.8),
        rock=mat("M_mz_rock", tex="mz_rock", rough=0.92, normal="mz_rock_n", normal_strength=0.9),
        ground=mat("M_mz_ground", tex="mz_ground", rough=0.95),
        path=mat("M_mz_path", tex="mz_path", rough=0.85, normal="mz_path_n", normal_strength=0.7),
        moss=mat("M_mz_moss", tex="mz_moss", rough=0.95),
        ivy=mat("M_mz_ivy", color=(0.12, 0.28, 0.08), rough=0.7),
        bark=mat("M_mz_bark", color=(0.09, 0.07, 0.06), rough=0.9),
        crow=mat("M_mz_crow", color=(0.015, 0.015, 0.02), rough=0.35),
        flame=mat("M_mz_flame", color=(1.0, 0.55, 0.15), emit=(1.0, 0.5, 0.12), strength=9),
        keyhole=mat("M_mz_keyhole", color=(1.0, 0.7, 0.25), emit=(1.0, 0.62, 0.2), strength=5),
        window=mat("M_mz_window", color=(1.0, 0.75, 0.35), emit=(1.0, 0.7, 0.3), strength=4),
        bone=mat("M_mz_bone", color=(0.86, 0.8, 0.68), rough=0.45),
        pip=mat("M_mz_pip", color=(0.08, 0.05, 0.04), rough=0.6),
        pawn=mat("M_mz_pawn", color=(0.45, 0.3, 0.16), rough=0.35, metal=0.7),
        lantern_glow=mat("M_mz_lantern", color=(1.0, 0.75, 0.35), emit=(1.0, 0.7, 0.3), strength=8),
        rope=mat("M_mz_rope", color=(0.5, 0.38, 0.22), rough=0.9),
        plinth=mat("M_mz_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
        **{f"sign_{s}": mat(f"M_mz_sign_{s}", tex=f"mz_sign_{s}", rough=0.85) for s in ("compass", "skull", "question", "pines")},
    )


# ---------------------------------------------------------------- build
def build_maze(root, m, walls, path):
    p = dict(parent=root, collection="BASE")
    B = HALF + 0.22                                            # ground extends beyond the maze for the props
    geo.box("MZ_Plinth", (2 * B + 0.12, 2 * B + 0.12, 0.14), loc=(0, 0, -0.2), material=m["plinth"], bevel=0.02, **p)
    geo.box("MZ_Ground", (2 * B, 2 * B, 0.06), loc=(0, 0, -0.06), material=m["ground"], bevel=0.015, uv="box", uv_scale=1.2, **p)
    geo.box("MZ_Floor", (2 * HALF, 2 * HALF, 0.004), loc=(0, 0, 0), material=m["path"], bevel=0.002, uv="box", uv_scale=2.2, **p)
    rng = random.Random(7)
    segs = []                                                  # (x0, y0, x1, y1) wall segments along cell edges
    for (i, j), ws in walls.items():
        x0, y0 = -HALF + i * C, -HALF + j * C
        if "S" in ws: segs.append((x0, y0, x0 + C, y0))
        if "W" in ws: segs.append((x0, y0, x0, y0 + C))
        if "N" in ws and j == N - 1: segs.append((x0, y0 + C, x0 + C, y0 + C))
        if "E" in ws and i == N - 1: segs.append((x0 + C, y0, x0 + C, y0 + C))
    def wall_mesh(bm, moss=False):
        for (x0, y0, x1, y1) in segs:
            horiz = abs(y1 - y0) < 1e-6
            L = (abs(x1 - x0) if horiz else abs(y1 - y0)) + WALL_T
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            outer = (horiz and (abs(y0 + HALF) < 1e-6 or abs(y0 - HALF) < 1e-6)) or (not horiz and abs(abs(x0) - HALF) < 1e-6)
            h = WALL_H * (1.35 if outer else 1.0)
            if moss:
                dims = (L + 0.004, WALL_T + 0.01, 0.014) if horiz else (WALL_T + 0.01, L + 0.004, 0.014)
                geo.add_box(bm, dims, (cx, cy, h - 0.004))
            else:
                # two courses of slightly uneven stones per segment
                for k, zz in enumerate((0.004, h * 0.5)):
                    nb = 2
                    for b in range(nb):
                        t0, t1 = b / nb, (b + 1) / nb
                        sx0, sx1 = (x0 - WALL_T / 2) + (x1 - x0 + WALL_T) * t0, (x0 - WALL_T / 2) + (x1 - x0 + WALL_T) * t1
                        sy0, sy1 = (y0 - WALL_T / 2) + (y1 - y0 + WALL_T) * t0, (y0 - WALL_T / 2) + (y1 - y0 + WALL_T) * t1
                        jig = rng.uniform(-0.002, 0.002)
                        if horiz:
                            geo.add_box(bm, (sx1 - sx0 - 0.003, WALL_T + jig, h * 0.5 - 0.004 + (0.004 if k else 0)),
                                        ((sx0 + sx1) / 2 + (k % 2) * 0.01, cy, zz))
                        else:
                            geo.add_box(bm, (WALL_T + jig, sy1 - sy0 - 0.003, h * 0.5 - 0.004 + (0.004 if k else 0)),
                                        (cx, (sy0 + sy1) / 2 + (k % 2) * 0.01, zz))
    geo.merged("MZ_Walls", wall_mesh, material=m["stone"], bevel=0.0025, seg=1, uv_scale=6, **p)
    moss = geo.merged("MZ_Moss", lambda bm: wall_mesh(bm, True), material=m["moss"], bevel=0.004, seg=1, uv_scale=4, **p)
    for v in moss.data.vertices:                               # lumpy moss
        v.co.z += rng.uniform(-0.002, 0.004)
    # ivy hanging down some walls
    def ivy(bm):
        for (x0, y0, x1, y1) in rng.sample(segs, k=min(26, len(segs))):
            horiz = abs(y1 - y0) < 1e-6
            for k in range(5):
                t = rng.uniform(0.1, 0.9)
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                side = rng.choice((-1, 1)) * (WALL_T / 2 + 0.002)
                L = rng.uniform(0.02, 0.06)
                if horiz:
                    geo.add_box(bm, (0.006, 0.003, L), (x, y + side, WALL_H - L))
                else:
                    geo.add_box(bm, (0.003, 0.006, L), (x + side, y, WALL_H - L))
    geo.merged("MZ_Ivy", ivy, material=m["ivy"], bevel=0, **p)

    # the gate: an arch in the front wall, two torches
    gx, gy = cell_xy(GATE_COL, 0)[0], -HALF
    gate = S.empty("MZ_Gate", "PROPS", loc=(gx, gy, 0), parent=root, size=0.05)
    gh = WALL_H * 1.35
    for sx in (-1, 1):
        geo.box(f"MZ_Gate_Pillar_{'L' if sx < 0 else 'R'}", (0.035, 0.05, gh + 0.04), loc=(sx * (C / 2 + 0.005), 0, 0), material=m["stone"],
                parent=gate, bevel=0.004, seg=2)
    arch = [(cos(a) * 0.085, sin(a) * 0.085 + gh) for a in np.linspace(0, pi, 12)] + [(cos(a) * 0.06, sin(a) * 0.06 + gh) for a in np.linspace(pi, 0, 12)]
    def arch_mesh(bm):
        n = len(arch)
        front = [bm.verts.new((x, -0.025, z)) for x, z in arch]
        back = [bm.verts.new((x, 0.025, z)) for x, z in arch]
        bm.faces.new(front); bm.faces.new(list(reversed(back)))
        for k in range(n):
            bm.faces.new((front[k], front[(k + 1) % n], back[(k + 1) % n], back[k]))
    geo.merged("MZ_Gate_Arch", arch_mesh, material=m["stone"], parent=gate, bevel=0.002, seg=1, uv_scale=6)
    for sx in (-1, 1):
        t = geo.cylinder(f"MZ_Torch_{'L' if sx < 0 else 'R'}", 0.004, 0.06, loc=(sx * 0.1, -0.035, 0.05), rot=(radians(12), 0, 0), material=M("wood_dark"),
                         parent=gate, verts=8, bevel=0)
        fl = geo.lathe(f"MZ_Torch_Flame_{'L' if sx < 0 else 'R'}", [(0, 0), (0.008, 0.004), (0.009, 0.012), (0.004, 0.024), (0, 0.03)],
                       loc=(0, 0, 0.06), material=m["flame"], parent=t, segments=10)
        fl.visible_shadow = False
        L = bpy.data.lights.new(f"LIGHT_MZ_Torch_{'L' if sx < 0 else 'R'}", 'POINT')
        L.energy, L.color, L.shadow_soft_size = 4, (1.0, 0.55, 0.2), 0.01
        lo = bpy.data.objects.new(L.name, L)
        lo.location = (gx + sx * 0.1, gy - 0.05, 0.13)
        S.coll("LIGHTS").objects.link(lo)
    # the heart: a stone altar with a glowing keyhole
    cx, cy = cell_xy(N // 2, N // 2)
    altar = geo.box("MZ_Altar", (0.06, 0.06, 0.04), loc=(cx, cy + 0.03, 0.004), material=m["stone"], parent=root, bevel=0.004, seg=2)
    geo.box("MZ_Altar_Top", (0.07, 0.07, 0.01), loc=(0, 0, 0.04), material=m["stone"], parent=altar, bevel=0.003)
    geo.box("MZ_Altar_Plate", (0.03, 0.003, 0.03), loc=(0, -0.031, 0.008), material=M("brass"), parent=altar, bevel=0.001)
    def keyhole(bm):
        geo.add_cyl(bm, 0.005, 0.002, (0, -0.0335, 0.027), (radians(90), 0, 0), verts=12)
        geo.add_box(bm, (0.004, 0.002, 0.01), (0, -0.0335, 0.014))
    geo.merged("MZ_Altar_Keyhole", keyhole, material=m["keyhole"], parent=altar, bevel=0)
    Lk = bpy.data.lights.new("LIGHT_MZ_Heart", 'POINT')
    Lk.energy, Lk.color, Lk.shadow_soft_size = 1.5, (1.0, 0.65, 0.25), 0.02
    lk = bpy.data.objects.new("LIGHT_MZ_Heart", Lk)
    lk.location = (cx, cy - 0.02, 0.05)
    S.coll("LIGHTS").objects.link(lk)
    return gate, altar


def build_outside(root, m):
    rng = random.Random(9)
    B = HALF + 0.22
    # the signpost (front-left), lantern + satchel at its foot
    sx, sy = -HALF - 0.12, -HALF - 0.08
    post = geo.box("MZ_Signpost", (0.016, 0.016, 0.26), loc=(sx, sy, 0), rot=(0, 0, radians(30)), material=M("wood_dark"), parent=root, bevel=0.002)
    for k, (sym, z, dirn) in enumerate((("compass", 0.22, 1), ("skull", 0.18, -1), ("question", 0.14, 1), ("pines", 0.1, -1))):
        board = geo.box(f"MZ_Sign_{sym}", (0.1, 0.008, 0.032), loc=(dirn * 0.055, -0.01, z), rot=(0, 0, radians(dirn * 6)), material=m[f"sign_{sym}"],
                        parent=post, bevel=0.0015, uv="fit", fit_axis=1)
    lan = geo.cylinder("MZ_Lantern", 0.014, 0.004, loc=(sx + 0.05, sy - 0.05, 0), material=M("metal_black"), parent=root, verts=12, bevel=0.001)
    geo.cylinder("MZ_Lantern_Glass", 0.011, 0.026, loc=(0, 0, 0.004), material=m["lantern_glow"], parent=lan, verts=12, bevel=0)
    geo.cylinder("MZ_Lantern_Cap", 0.014, 0.008, loc=(0, 0, 0.03), r_top=0.005, material=M("metal_black"), parent=lan, verts=12, bevel=0)
    Ll = bpy.data.lights.new("LIGHT_MZ_Lantern", 'POINT')
    Ll.energy, Ll.color, Ll.shadow_soft_size = 2.5, (1.0, 0.65, 0.3), 0.01
    ll = bpy.data.objects.new("LIGHT_MZ_Lantern", Ll)
    ll.location = (sx + 0.05, sy - 0.05, 0.02)
    S.coll("LIGHTS").objects.link(ll)
    sat = geo.box("MZ_Satchel", (0.07, 0.04, 0.05), loc=(sx - 0.04, sy - 0.06, 0), rot=(0, 0, radians(-20)), material=M("leather_brown"), parent=root, bevel=0.012, seg=3)
    geo.box("MZ_Satchel_Flap", (0.072, 0.042, 0.004), loc=(0, -0.002, 0.048), rot=(radians(-6), 0, 0), material=M("leather_brown"), parent=sat, bevel=0.002)
    geo.box("MZ_Satchel_Buckle", (0.012, 0.003, 0.012), loc=(0, -0.022, 0.03), material=M("brass"), parent=sat, bevel=0.001)
    # rope fence along the front-right
    def fence(bm):
        for k in range(4):
            geo.add_box(bm, (0.014, 0.014, 0.07), (0.25 + k * 0.17, -HALF - 0.12, 0))
    geo.merged("MZ_Fence_Posts", fence, material=M("wood_dark"), parent=root, bevel=0.002)
    for k in range(3):
        x0, x1 = 0.25 + k * 0.17, 0.25 + (k + 1) * 0.17
        geo.curve_tube(f"MZ_Fence_Rope_{k}", [Vector((x0, -HALF - 0.12, 0.06)), Vector(((x0 + x1) / 2, -HALF - 0.12, 0.04)), Vector((x1, -HALF - 0.12, 0.06))],
                       0.003, material=m["rope"], parent=root, ring=6, steps=4)
    # the dead tree with the crow (back-left)
    tx, ty = -HALF - 0.11, HALF + 0.09
    trunk = geo.curve_tube("MZ_Tree", [Vector((tx, ty, 0)), Vector((tx + 0.01, ty, 0.12)), Vector((tx - 0.01, ty + 0.01, 0.24)), Vector((tx + 0.02, ty, 0.34))],
                           0.016, material=m["bark"], parent=root, ring=8, steps=6, taper=lambda t: 1.0 - 0.7 * t)
    for k, (a, z, L) in enumerate(((0.4, 0.2, 0.14), (2.6, 0.26, 0.12), (1.2, 0.31, 0.1), (4.0, 0.16, 0.1), (5.4, 0.29, 0.09))):
        d = Vector((cos(a), sin(a), 0.6)).normalized()
        base = Vector((tx, ty, z))
        mid = base + d * L * 0.6 + Vector((0, 0, 0.02))
        geo.curve_tube(f"MZ_Tree_Branch_{k}", [base, mid, base + d * L + Vector((0, 0, -0.01))], 0.006, material=m["bark"], parent=root, ring=6, steps=4,
                       taper=lambda t: 1.0 - 0.8 * t)
    crow = S.empty("MZ_Crow", "PROPS", loc=(tx + cos(0.4) * 0.09, ty + sin(0.4) * 0.09, 0.2 + 0.06), rot=(0, 0, radians(-120)), parent=root, size=0.02)
    geo.sphere("MZ_Crow_Body", 0.014, loc=(0, 0, 0), scale=(0.8, 1.5, 0.9), material=m["crow"], parent=crow, segs=14)
    geo.sphere("MZ_Crow_Head", 0.009, loc=(0, -0.018, 0.018), material=m["crow"], parent=crow, segs=12)
    geo.lathe("MZ_Crow_Beak", [(0, 0), (0.0035, 0), (0, 0.012)], loc=(0, -0.026, 0.024), rot=(radians(95), 0, 0), material=M("metal_dark"), parent=crow, segments=8)
    geo.box("MZ_Crow_Tail", (0.012, 0.022, 0.003), loc=(0, 0.026, 0.008), rot=(radians(-18), 0, 0), material=m["crow"], parent=crow, bevel=0)
    # the castle on a rocky hill (back-right corner)
    hx, hy = HALF + 0.1, HALF + 0.1
    hill = geo.sphere("MZ_Hill", 0.16, loc=(hx, hy, -0.06), scale=(1.0, 1.0, 0.85), material=m["rock"], parent=root, segs=18)
    for v in hill.data.vertices:
        v.co *= rng.uniform(0.9, 1.08)
    top = 0.16 * 2 * 0.85 - 0.06 - 0.02
    castle = S.empty("MZ_Castle", "PROPS", loc=(hx, hy, top), rot=(0, 0, radians(-30)), parent=root, size=0.04)
    geo.box("MZ_Castle_Keep", (0.07, 0.05, 0.07), material=m["rock"], parent=castle, bevel=0.002)
    for k, (dx, dy, h) in enumerate(((-0.045, -0.02, 0.1), (0.045, -0.02, 0.09), (0.0, 0.03, 0.12))):
        tw = geo.cylinder(f"MZ_Castle_Tower_{k}", 0.015, h, loc=(dx, dy, 0), material=m["rock"], parent=castle, verts=10, bevel=0.001)
        geo.cylinder(f"MZ_Castle_Roof_{k}", 0.019, 0.035, loc=(0, 0, h), r_top=0.0005, material=M("metal_dark"), parent=tw, verts=10, bevel=0)
        geo.box(f"MZ_Castle_Window_{k}", (0.005, 0.002, 0.008), loc=(0, -0.0152, h * 0.6), material=m["window"], parent=tw, bevel=0)
    # pines + rocks scattered outside the walls
    def pines(bm):
        for _ in range(16):
            while True:
                x, y = rng.uniform(-B + 0.05, B - 0.05), rng.uniform(-B + 0.05, B - 0.05)
                if max(abs(x), abs(y)) > HALF + 0.06 and not (x > HALF - 0.1 and y > HALF - 0.1) and not (abs(x - sx) < 0.12 and abs(y - sy) < 0.12) and y > -B + 0.14:
                    break
            s = rng.uniform(0.7, 1.3)
            geo.add_cyl(bm, 0.004 * s, 0.03 * s, (x, y, 0), verts=6)
            for k in range(3):
                geo.add_cyl(bm, (0.03 - k * 0.008) * s, 0.04 * s, (x, y, (0.02 + k * 0.025) * s), verts=8, r_top=0.002)
    geo.merged("MZ_Pines", pines, material=m["ivy"], parent=root, bevel=0)
    def rocks(bm):
        for _ in range(22):
            x, y = rng.uniform(-B + 0.04, B - 0.04), rng.uniform(-B + 0.04, B - 0.04)
            if max(abs(x), abs(y)) < HALF + 0.03:
                continue
            s = rng.uniform(0.012, 0.03)
            geo.add_box(bm, (s * 1.4, s, s * 0.7), (x, y, -0.002), (radians(rng.uniform(-10, 10)), 0, rng.uniform(0, 3)))
    geo.merged("MZ_Rocks", rocks, material=m["rock"], parent=root, bevel=0.004, seg=1)
    return post, crow, castle


def _die(name, m, loc, rot, parent):
    s = DIE
    die = geo.box(name, (s, s, s), loc=(0, 0, 0), material=m["bone"], parent=parent, bevel=s * 0.14, seg=4)
    for v in die.data.vertices:
        v.co.z -= s / 2                                        # origin at the centre (it tumbles about it)
    die.location = Vector(loc) + Vector((0, 0, s / 2))
    die.rotation_euler = rot
    layouts = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)], 4: [(-1, -1), (-1, 1), (1, -1), (1, 1)],
               5: [(-1, -1), (-1, 1), (0, 0), (1, -1), (1, 1)], 6: [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)]}
    axes = {"+Z": (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))), "-Z": (Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, 1, 0))),
            "+X": (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), "-X": (Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
            "+Y": (Vector((0, 1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))), "-Y": (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)))}
    def pips(bm):
        for face, value in FACES.items():
            n, a, b = axes[face]
            for i, j in layouts[value]:
                c = n * (s / 2 + 0.0002) + a * (i * s * 0.25) + b * (j * s * 0.25)
                rot_m = n.to_track_quat('Z', 'X' if abs(n.y) > 0.9 else 'Y').to_euler()
                vs = geo.add_cyl(bm, s * 0.085, 0.0012, (0, 0, 0), (0, 0, 0), verts=12)
                bmesh.ops.translate(bm, vec=Vector((0, 0, -0.0011)), verts=vs)
                bmesh.ops.transform(bm, matrix=geo.mtx(c, rot_m), verts=vs)
    geo.merged(name + "_Pips", pips, material=m["pip"], parent=die, bevel=0)
    die["faces"] = json.dumps(FACES)
    die["size"] = s
    return die


def build(root):
    m = materials()
    walls, path = generate()
    gate, altar = build_maze(root, m, walls, path)
    post, crow, castle = build_outside(root, m)
    gx, gy = cell_xy(GATE_COL, 0)[0], -HALF
    # the die on a flat stone by the gate (right), the pawn waiting in front of the gate
    geo.box("MZ_DieStone", (0.07, 0.06, 0.012), loc=(gx + 0.17, gy - 0.1, 0), rot=(0, 0, radians(10)), material=m["rock"], parent=root, bevel=0.004)
    die = _die("MZ_Die", m, (gx + 0.17, gy - 0.1, 0.012), (radians(90), 0, radians(20)), root)   # shows 5
    pawn = geo.lathe("MZ_Pawn", [(0, 0), (0.014, 0), (0.014, 0.004), (0.009, 0.008), (0.006, 0.026), (0.008, 0.03), (0.0055, 0.034),
                                 (0.009, 0.042), (0.0075, 0.05), (0, 0.052)], loc=(gx, gy - 0.07, 0), material=m["pawn"], parent=root, segments=24)
    geo.curve_tube("MZ_Pawn_Arm", [Vector((0.006, 0, 0.03)), Vector((0.014, -0.004, 0.026)), Vector((0.016, -0.006, 0.018))], 0.0016,
                   material=m["pawn"], parent=pawn, ring=6, steps=3)
    geo.sphere("MZ_Pawn_Lantern", 0.0045, loc=(0.016, -0.006, 0.011), material=m["lantern_glow"], parent=pawn, segs=10)
    # the path for the website: the spot before the gate, then every cell centre to the heart (world space)
    pts = [(gx, gy - 0.07, 0.004)] + [(*cell_xy(i, j), 0.004) for i, j in path]
    holder = S.empty("MZ_Path", "PROPS", parent=root, size=0.02)
    holder["path"] = json.dumps([[round(v, 4) for v in p_] for p_ in pts])
    holder["cells"] = len(path)
    print(f"maze path: {len(path)} cells from the gate to the heart")
    for obj, iid, label in [(die, "mz_die", "The Die"), (pawn, "mz_pawn", "The Wanderer"), (gate, "mz_gate", "The Gate"), (altar, "mz_heart", "The Heart"),
                            (post, "mz_sign", "Signpost"), (crow, "mz_crow", "The Crow"), (castle, "mz_castle", "The Castle")]:
        S.mark_interactive(obj, iid, label, scope="labyrinth-fate", kind="discovery")
    return dict(gate=gate)
