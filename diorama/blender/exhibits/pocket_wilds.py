"""Pocket Wilds exhibit: the treasure room from the game's cover art, as a miniature diorama.

The corner of a dungeon, cut away like a dollhouse: two walls of rough stone blocks (back + left) whose
tops crumble away toward the open sides, a floor of worn flagstones. In the middle, a wooden treasure
chest with iron bands and its barrel lid thrown open, heaped with gold coins and gems (emerald, ruby,
sapphire). Gold has spilled over the front rim onto the floor; a golden goblet lies tipped over with
coins pouring out of its mouth. A torch on the left wall and the gold's own warm glow light the room.

Real-world scale (metres), Blender Z-up. The website adds real coin physics on top (Rapier): the
physics colliders are exported as JSON on the PW_Physics empty (box list, Blender world space).
"""
from math import radians, pi, sin, cos, asin, atan2
import json
import random
import numpy as np
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D, H = 1.5, 1.25, 1.15          # room floor (x, y) and wall height at the corner
BACK_Y, LEFT_X = D / 2, -W / 2    # inner wall planes (stone faces sit in front of these)
STONE_DEPTH = 0.13                # stone block depth (from the wall plane into the room)
CHEST = dict(x=0.06, y=-0.02, rz=-14, w=0.78, d=0.48, h=0.36, wall=0.035, lid_h=0.17, open=-104)
COIN_R, COIN_T = 0.0135, 0.0032   # a chunky 27 mm gold coin
RNG = random.Random(77)
CLOSEUPS = [  # name, object names to frame, azimuth, elevation, lens, fill
    ("CAM_Exhibit_CloseChest", ["PW_Chest"], 24, 30, 50, 0.85),
    ("CAM_Exhibit_CloseGoblet", ["PW_Goblet", "PW_Coins_Floor"], 18, 34, 50, 0.8),
]
LIGHT_GAIN = dict(key=3.6, fill=2.4, rim=1.6)


# ---------------------------------------------------------------- textures (code-painted)
def _tex_stone(name, base="#57504a", size=1024, seed=1):
    """Rough dungeon stone, tiling at 1 m: mottled, pitted, a few lighter chips and damp stains."""
    c = T.Canvas(size, size, T.rgb(base))
    c.mul(0.75 + 0.4 * T.noise(size, size, 5, seed))
    c.mul(0.85 + 0.22 * T.noise(size, size, 22, seed + 1))
    c.mul(0.9 + 0.16 * T.noise(size, size, 90, seed + 2))
    rng = random.Random(seed)
    for _ in range(260):                                    # pits
        c.circle(rng.uniform(0, size), rng.uniform(0, size), rng.uniform(1.5, 5), T.rgb("#1d1a17"), 0.55)
    for _ in range(90):                                     # pale chips
        c.circle(rng.uniform(0, size), rng.uniform(0, size), rng.uniform(2, 7), T.rgb("#8c8378"), 0.35)
    damp = np.clip((T.noise(size, size, 3, seed + 5) - 0.55) * 4, 0, 1)
    c._blend(damp, T.rgb("#2c2a22"), 0.35)                  # damp, slightly greenish patches
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=5.0, size=(512, 512), blur=1.0)


def _tex_gold_pile(name, w=1024, h=600, seed=4):
    """Top view of a heap of coins: hundreds of overlapping discs, each with a dark edge, a bright
    rim and a stamped centre, in slightly different golds. UV-fitted over the pile surface."""
    c = T.Canvas(w, h, T.rgb("#5a3a0c"))
    rng = random.Random(seed)
    golds = ["#e8b23c", "#f3c64e", "#d39a2a", "#ffd76a", "#c98c22", "#f0bd45"]
    r = 19
    for _ in range(int(w * h / (r * r) * 1.25)):
        x, y = rng.uniform(-r, w + r), rng.uniform(-r, h + r)
        rr = r * rng.uniform(0.75, 1.1) * rng.choice([1.0, 1.0, 0.7])   # some seen edge-on (narrower)
        col = T.rgb(rng.choice(golds))
        c.circle(x, y, rr + 1.5, T.rgb("#4a2e08"), 0.9)                  # shadowed edge
        c.circle(x, y, rr, col)
        c.circle(x - rr * 0.18, y - rr * 0.18, rr * 0.55, T.rgb("#fff0b0"), 0.25)   # sheen
        c.circle(x, y, rr * 0.82, T.rgb("#a8731a"), 0.5, ring=1.6)        # raised rim line
        c.circle(x, y, rr * 0.32, T.rgb("#b07a1c"), 0.35)                 # stamp
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=4.0, size=(512, 300), blur=0.8)


def textures():
    out = {}
    out["pw_stone"], out["pw_stone_n"] = _tex_stone("pw_stone", "#57504a", seed=1)
    out["pw_stone_b"], out["pw_stone_b_n"] = _tex_stone("pw_stone_b", "#4c4741", seed=9)
    out["pw_flag"], out["pw_flag_n"] = _tex_stone("pw_flag", "#4f4842", seed=17)
    out["pw_chest_wood"] = T.wood("pw_chest_wood", light="#8a4020", dark="#4b1d0c", size=1024, rings=16, seed=31, streak=0.5)
    out["pw_gold_pile"], out["pw_gold_pile_n"] = _tex_gold_pile("pw_gold_pile")
    TEX.update(out)
    return out


def materials():
    return dict(
        stone=mat("M_pw_stone", tex="pw_stone", rough=0.88, normal="pw_stone_n", normal_strength=0.8),
        stone_b=mat("M_pw_stone_b", tex="pw_stone_b", rough=0.9, normal="pw_stone_b_n", normal_strength=0.8),
        flag=mat("M_pw_flag", tex="pw_flag", rough=0.8, normal="pw_flag_n", normal_strength=0.7),
        mortar=mat("M_pw_mortar", color=(0.035, 0.03, 0.026), rough=1.0),
        wood=mat("M_pw_chest_wood", tex="pw_chest_wood", rough=0.62),
        wood_in=mat("M_pw_chest_inside", tex="pw_chest_wood", rough=0.75, tint=(0.45, 0.4, 0.38)),
        iron=mat("M_pw_iron", color=(0.11, 0.11, 0.12), rough=0.45, metal=0.85),
        gold=mat("M_pw_gold", color=(1.0, 0.71, 0.24), rough=0.22, metal=1.0),
        gold_pile=mat("M_pw_gold_pile", tex="pw_gold_pile", rough=0.28, metal=1.0, normal="pw_gold_pile_n", normal_strength=0.9),
        goblet=mat("M_pw_goblet", color=(1.0, 0.76, 0.3), rough=0.3, metal=1.0),
        emerald=mat("M_pw_emerald", color=(0.05, 0.75, 0.3), rough=0.05, emit=(0.05, 0.9, 0.35), strength=0.6),
        ruby=mat("M_pw_ruby", color=(0.8, 0.03, 0.1), rough=0.05, emit=(1.0, 0.05, 0.15), strength=0.6),
        sapphire=mat("M_pw_sapphire", color=(0.06, 0.2, 0.95), rough=0.05, emit=(0.1, 0.3, 1.0), strength=0.7),
        flame=mat("M_pw_flame", color=(1.0, 0.45, 0.1), emit=(1.0, 0.36, 0.05), strength=7),
        plinth=mat("M_pw_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
    )


# ---------------------------------------------------------------- stone walls + floor
def _wall_blocks(bm_a, bm_b, length, top_at, along_x):
    """Courses of rough blocks along one wall. `top_at(s)` = wall height at position s (0 = corner):
    the cut-away top crumbles toward the open end. Blocks go into two meshes (two stone tints)."""
    rng = RNG
    z, row = 0.0, 0
    while z < H - 0.05:
        ch = rng.uniform(0.2, 0.27)
        s = -rng.uniform(0, 0.2) if row % 2 else 0.0
        while s < length:
            bw = rng.uniform(0.28, 0.48)
            s0, s1 = max(s, 0.0), min(s + bw, length)
            s = s + bw
            if s1 - s0 < 0.07:
                continue
            mid = (s0 + s1) / 2
            if z + ch * 0.5 > top_at(mid):                    # crumbled away
                continue
            gap = 0.012
            dims = (s1 - s0 - gap, rng.uniform(STONE_DEPTH - 0.035, STONE_DEPTH + 0.015), ch - gap * rng.uniform(1, 2.2))
            tilt = (rng.uniform(-2.5, 2.5), rng.uniform(-2.5, 2.5), rng.uniform(-2.5, 2.5))
            bm = bm_a if rng.random() < 0.6 else bm_b
            if along_x:                                       # back wall: s runs +X from the corner
                loc = (LEFT_X + mid, BACK_Y - dims[1] / 2, z + gap / 2)
                rot = tuple(radians(a) for a in tilt)
                geo.add_box(bm, dims, loc, rot)
            else:                                             # left wall: s runs -Y from the corner
                loc = (LEFT_X + dims[1] / 2, BACK_Y - STONE_DEPTH - mid, z + gap / 2)
                rot = (radians(tilt[0]), radians(tilt[1]), radians(90 + tilt[2]))
                geo.add_box(bm, dims, loc, rot)
        z += ch
        row += 1


def build_room(root, m):
    geo.box("PW_Plinth", (W + 0.4, D + 0.42, 0.16), loc=(0.1, -0.12, -0.3), material=m["plinth"],
            collection="BASE", parent=root, bevel=0.02)
    geo.box("PW_Grout", (W + 0.2, D + 0.22, 0.13), loc=(0.08, -0.09, -0.15), material=m["mortar"],
            collection="BASE", parent=root, bevel=0.01)
    # flagstones: irregular slabs with worn, slightly uneven tops; their sides show at the floor edge
    def flags(bm):
        rng = random.Random(5)
        x0, x1, y0, y1 = LEFT_X - 0.02, W / 2 + 0.18, -D / 2 - 0.2, BACK_Y + 0.02
        y = y0
        while y < y1 - 0.05:
            rh = rng.uniform(0.28, 0.4)
            x = x0 - rng.uniform(0, 0.15)
            while x < x1 - 0.05:
                rw = rng.uniform(0.3, 0.48)
                a, b = max(x, x0), min(x + rw, x1)
                c_, d_ = y, min(y + rh, y1)
                x += rw
                if b - a < 0.08 or d_ - c_ < 0.08:
                    continue
                g = 0.014
                top = rng.uniform(-0.004, 0.004)
                geo.add_box(bm, (b - a - g, d_ - c_ - g, 0.12 + top), ((a + b) / 2, (c_ + d_) / 2, -0.12),
                            (radians(rng.uniform(-0.6, 0.6)), radians(rng.uniform(-0.6, 0.6)), radians(rng.uniform(-1.5, 1.5))))
            y += rh
    geo.merged("PW_Floor", flags, material=m["flag"], collection="BASE", parent=root, bevel=0.014, seg=2)

    # walls: height falls off toward the open ends (the dollhouse cut), with a ragged edge
    back_top = lambda s: H - max(0, s - 0.45) * 0.6 + RNG.uniform(-0.05, 0.05)
    left_top = lambda s: H - max(0, s - 0.3) * 0.62 + RNG.uniform(-0.05, 0.05)
    bma, bmb = bmesh.new(), bmesh.new()
    _wall_blocks(bma, bmb, W + 0.02, back_top, along_x=True)
    _wall_blocks(bma, bmb, D - STONE_DEPTH, left_top, along_x=False)
    for nm, bm, mt in (("PW_Wall_A", bma, m["stone"]), ("PW_Wall_B", bmb, m["stone_b"])):
        geo.merged(nm, lambda b, src=bm: b.from_mesh(_bm_to_mesh(src)), material=mt, collection="BASE",
                   parent=root, bevel=0.034, seg=3)
    # dark mortar backing behind the blocks (fills the joints)
    geo.box("PW_Wall_Back_Mortar", (W + 0.02, 0.04, H - 0.05), loc=(0, BACK_Y - 0.03, 0), material=m["mortar"],
            collection="BASE", parent=root, bevel=0)
    geo.box("PW_Wall_Left_Mortar", (0.04, D, H - 0.05), loc=(LEFT_X + 0.03, 0, 0), material=m["mortar"],
            collection="BASE", parent=root, bevel=0)
    for nm in ("PW_Wall_Back_Mortar", "PW_Wall_Left_Mortar"):          # follow the crumbled top
        o = bpy.data.objects[nm]
        for v in o.data.vertices:
            if v.co.z > 0.1:
                s = (v.co.x - LEFT_X) if nm.endswith("Back_Mortar") else (BACK_Y - v.co.y)
                v.co.z = max(0.3, (back_top if nm.endswith("Back_Mortar") else left_top)(max(s, 0)) - 0.16)
    # rubble fallen from the crumbled tops
    def rubble(bm):
        rng = random.Random(8)
        for _ in range(16):
            x = rng.uniform(0.4, 0.72) if rng.random() < 0.5 else rng.uniform(LEFT_X + 0.16, LEFT_X + 0.4)
            y = rng.uniform(0.32, 0.47) if x > 0 else rng.uniform(-0.55, -0.25)
            s = rng.uniform(0.03, 0.08)
            geo.add_box(bm, (s * rng.uniform(1, 1.6), s, s * rng.uniform(0.6, 1)), (x, y, -0.002),
                        (radians(rng.uniform(-12, 12)), radians(rng.uniform(-12, 12)), radians(rng.uniform(0, 90))))
    geo.merged("PW_Rubble", rubble, material=m["stone_b"], collection="BASE", parent=root, bevel=0.01, seg=1)


def _bm_to_mesh(bm):
    me = bpy.data.meshes.new("pw_tmp")
    bm.to_mesh(me)
    bm.free()
    return me


# ---------------------------------------------------------------- the chest
def _lid_shell(bm, w, R, Hl, t, n=16, x_pad=0.0):
    """Barrel lid in hinge space: closed, it spans y = -2R..0 and z = 0..Hl (half ellipse, axis X)."""
    rings = []
    for xs in (-w / 2 - x_pad, w / 2 + x_pad):
        outer = [bm.verts.new((xs, -R + R * cos(pi * k / n), Hl * sin(pi * k / n))) for k in range(n + 1)]
        inner = [bm.verts.new((xs, -R + (R - t) * cos(pi * k / n), (Hl - t) * sin(pi * k / n))) for k in range(n + 1)]
        rings.append((outer, inner))
    (oa, ia), (ob, ib) = rings
    for k in range(n):
        bm.faces.new((oa[k], oa[k + 1], ob[k + 1], ob[k]))       # outside
        bm.faces.new((ib[k], ib[k + 1], ia[k + 1], ia[k]))       # inside
    for end in (0, n):
        bm.faces.new((oa[end], ob[end], ib[end], ia[end]))       # the two long bottom edges
    return rings


def _lid_end(bm, x0, x1, R, Hl, n=16):
    """Solid half-ellipse end plate of the lid between x0 and x1."""
    a = [bm.verts.new((x0, -R + R * cos(pi * k / n), Hl * sin(pi * k / n))) for k in range(n + 1)]
    b = [bm.verts.new((x1, -R + R * cos(pi * k / n), Hl * sin(pi * k / n))) for k in range(n + 1)]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for k in range(n):
        bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
    bm.faces.new((a[n], a[0], b[0], b[n]))


def mound_z(x, y):
    """Height of the gold heap (chest space) - a lumpy dome peaking toward the back middle."""
    c = CHEST
    ax, ay = c["w"] / 2 - c["wall"], c["d"] / 2 - c["wall"]
    u, v = min(abs(x - 0.03) / ax, 1.0), min(abs(y - 0.04) / ay, 1.0)
    dome = max(0.0, 1 - u ** 2.2) ** 1.7 * max(0.0, 1 - v ** 2.2) ** 1.3
    lump = 0.006 * sin(x * 61 + 1.3) * sin(y * 47 + 0.4) + 0.004 * sin(x * 133 + y * 97)
    return c["h"] - 0.004 + 0.19 * dome + lump * (0.3 + dome)


def build_chest(root, m):
    c = CHEST
    w, d, h, t = c["w"], c["d"], c["h"], c["wall"]
    chest = geo.box("PW_Chest", (w - 2 * t, d - 2 * t, t), loc=(c["x"], c["y"], 0), rot=(0, 0, radians(c["rz"])),
                    material=m["wood_in"], parent=root, bevel=0.002)          # the floor of the chest
    # walls from planks: 3 per side, with a hairline seam between them
    def planks(bm, inner=False):
        ph = h / 3
        for i in range(3):
            z = i * ph
            th = t * (0.5 if inner else 0.5)
            off = t * 0.25 if inner else t * 0.75
            for sy in (-1, 1):                                   # front / back
                geo.add_box(bm, (w - (2 * t if inner else 0), th, ph - 0.004), (0, sy * (d / 2 - off), z))
            for sx in (-1, 1):                                   # ends
                geo.add_box(bm, (th, d - 2 * t, ph - 0.004), (sx * (w / 2 - off), 0, z))
    geo.merged("PW_Chest_Planks", planks, material=m["wood"], parent=chest, bevel=0.004, seg=1, uv_scale=1.5)
    geo.merged("PW_Chest_Lining", lambda bm: planks(bm, True), material=m["wood_in"], parent=chest, bevel=0, uv_scale=1.5)

    # iron: top and bottom bands all round, corner angles, two front/back straps, rivets, lock plate
    def iron(bm):
        e = 0.006                                                # sits proud of the wood
        for z0, bh in ((0.0, 0.045), (h - 0.05, 0.05)):
            for sy in (-1, 1):
                geo.add_box(bm, (w + 2 * e, e * 1.6, bh), (0, sy * (d / 2 + e * 0.3), z0))
            for sx in (-1, 1):
                geo.add_box(bm, (e * 1.6, d + 2 * e, bh), (sx * (w / 2 + e * 0.3), 0, z0))
        for sx in (-1, 1):
            for sy in (-1, 1):
                geo.add_box(bm, (0.055, e * 1.8, h + 0.004), (sx * (w / 2 - 0.022), sy * (d / 2 + e * 0.4), -0.002))
                geo.add_box(bm, (e * 1.8, 0.055, h + 0.004), (sx * (w / 2 + e * 0.4), sy * (d / 2 - 0.022), -0.002))
        for sx in (-0.2, 0.2):
            for sy in (-1, 1):
                geo.add_box(bm, (0.05, e * 1.5, h), (sx, sy * (d / 2 + e * 0.35), 0))
        # rivets on the bands
        for z in (0.022, h - 0.025):
            for xr in np.linspace(-w / 2 + 0.05, w / 2 - 0.05, 9):
                geo.add_cyl(bm, 0.006, 0.006, (xr, -d / 2 - e, z), (radians(90), 0, 0), verts=8, r_top=0.004)
        for sx in (-0.2, 0.2):
            for z in np.linspace(0.08, h - 0.08, 3):
                geo.add_cyl(bm, 0.006, 0.006, (sx, -d / 2 - e, z), (radians(90), 0, 0), verts=8, r_top=0.004)
        geo.add_box(bm, (0.09, 0.012, 0.11), (0, -d / 2 - e - 0.004, h - 0.13))      # lock plate
    geo.merged("PW_Chest_Iron", iron, material=m["iron"], parent=chest, bevel=0.0015, seg=1)
    geo.box("PW_Chest_Keyhole", (0.012, 0.004, 0.03), loc=(0, -d / 2 - 0.0165, h - 0.1), material=M("metal_black"),
            parent=chest, bevel=0)

    # the barrel lid, hinged along the back top edge and thrown open
    hinge = S.empty("PW_Lid", "PROPS", loc=(0, d / 2, h), rot=(radians(c["open"]), 0, 0), parent=chest, size=0.05)
    R, Hl = d / 2, c["lid_h"]
    def lid(bm):
        _lid_shell(bm, w - 2 * t, R, Hl, t)
        for sx in (-1, 1):
            _lid_end(bm, sx * (w / 2 - t), sx * w / 2, R, Hl)
    geo.merged("PW_Lid_Wood", lid, material=m["wood"], parent=hinge, bevel=0.003, seg=1, uv_scale=1.5)
    def lid_iron(bm):
        for xc in (-w / 2 + 0.02, -0.2, 0.2, w / 2 - 0.02):
            sub = bmesh.new()
            _lid_shell(sub, 0.05, R + 0.006, Hl + 0.006, 0.008, x_pad=0)
            bmesh.ops.translate(sub, vec=Vector((xc, 0, 0)), verts=sub.verts)
            bm.from_mesh(_bm_to_mesh(sub))
        geo.add_box(bm, (0.05, 0.012, 0.1), (0, -2 * R - 0.004, -0.06))     # the hasp, hanging from the lid edge
    geo.merged("PW_Lid_Iron", lid_iron, material=m["iron"], parent=hinge, bevel=0.0015, seg=1)

    # the gold heap (a UV-fitted surface; the outer ring drops into the walls as a skirt)
    ax, ay = w / 2 - t - 0.002, d / 2 - t - 0.002
    nx, ny = 44, 28
    def deform(x, y):
        edge = abs(abs(x) - ax) < 1e-4 or abs(abs(y) - ay) < 1e-4
        return (x, y, h - 0.06 if edge else mound_z(x, y))
    pile = geo.grid("PW_GoldPile", 2 * ax, 2 * ay, nx, ny, material=m["gold_pile"], parent=chest, deform=deform)
    # real coins on top of the heap (for sparkle and silhouette) + a few spilling over the front rim
    rng = random.Random(11)
    def coins_chest(bm):
        for _ in range(140):
            x, y = rng.uniform(-ax + 0.02, ax - 0.02), rng.uniform(-ay + 0.02, ay - 0.02)
            z = mound_z(x, y)
            gx = (mound_z(x + 0.01, y) - mound_z(x - 0.01, y)) / 0.02
            gy = (mound_z(x, y + 0.01) - mound_z(x, y - 0.01)) / 0.02
            rot = (-atan2(gy, 1) + radians(rng.uniform(-14, 14)), atan2(gx, 1) + radians(rng.uniform(-14, 14)), rng.uniform(0, 2 * pi))
            geo.add_cyl(bm, COIN_R, COIN_T, (x, y, z - 0.0025), rot, verts=14)
        for _ in range(26):                                      # over the front rim
            x = rng.uniform(-0.3, 0.3)
            k = rng.random()
            y = -d / 2 - 0.012 - k * 0.02
            z = h + 0.005 - k * rng.uniform(0.05, 0.3)
            geo.add_cyl(bm, COIN_R, COIN_T, (x, y, z), (radians(rng.uniform(55, 95)), radians(rng.uniform(-30, 30)), rng.uniform(0, 2 * pi)), verts=14)
    geo.merged("PW_Coins_Chest", coins_chest, material=m["gold"], parent=pile, bevel=0.0007, seg=1)
    # gems on the heap
    for nm, kind, mt, x, y, sz in [("PW_Gem_Emerald", "d8", "emerald", 0.02, -0.03, 0.042), ("PW_Gem_Ruby", "d20", "ruby", -0.2, -0.08, 0.028),
                                   ("PW_Gem_Emerald_2", "d8", "emerald", 0.18, 0.02, 0.022), ("PW_Gem_Sapphire", "d20", "sapphire", 0.24, -0.12, 0.02),
                                   ("PW_Gem_Ruby_2", "d20", "ruby", -0.05, 0.1, 0.018)]:
        geo.polyhedron(nm, kind, sz, loc=(x, y, mound_z(x, y) - sz * 0.3), rot=(radians(RNG.uniform(-25, 25)), radians(RNG.uniform(-25, 25)), RNG.uniform(0, 6)),
                       material=m[mt], parent=pile)
    # warm glow from the gold (practical light: baked into the room + kept as a light in Cycles)
    L = bpy.data.lights.new("LIGHT_PW_Gold", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 11, (1.0, 0.76, 0.38), 0.15
    lo = bpy.data.objects.new("LIGHT_PW_Gold", L)
    lo.parent = chest
    lo.location = (0.02, -0.12, h + 0.32)
    S.coll("LIGHTS").objects.link(lo)
    return chest, pile, hinge


# ---------------------------------------------------------------- goblet, floor gold, gems, torch
GOBLET_PROFILE = [(0, 0), (0.05, 0), (0.052, 0.006), (0.03, 0.014), (0.012, 0.03), (0.01, 0.062), (0.022, 0.07),
                  (0.012, 0.082), (0.02, 0.092), (0.045, 0.112), (0.058, 0.15), (0.062, 0.19), (0.056, 0.19),
                  (0.052, 0.152), (0.04, 0.118), (0, 0.104)]


def build_floor_treasure(root, m, chest):
    c = CHEST
    # the goblet lies on its side, front-left of the chest, mouth toward the viewer's right
    tilt = asin((0.062 - 0.052) / 0.19)
    yaw = radians(-28)
    gob = geo.lathe("PW_Goblet", GOBLET_PROFILE, loc=(-0.42, -0.34, 0.052), rot=(0, radians(90) - tilt, yaw),
                    material=m["goblet"], parent=root, segments=36)
    geo.polyhedron("PW_Goblet_Gem", "d8", 0.012, loc=(0.0, -0.058, 0.15), rot=(radians(90), 0, 0), material=m["ruby"], parent=gob)
    mouth = Vector((-0.42, -0.34, 0.0)) + Vector((cos(yaw), sin(yaw), 0)) * 0.2

    # floor gold: a low heap in front of the chest + a scatter fanning out to the goblet and beyond
    cm = Matrix.Translation((c["x"], c["y"], 0)) @ Matrix.Rotation(radians(c["rz"]), 4, 'Z')
    front = cm @ Vector((0.0, -c["d"] / 2 - 0.14, 0))
    def heap_z(x, y):
        u, v = (x / 0.32), (y / 0.13)
        r2 = u * u + v * v
        return max(0.0, 1 - r2) ** 1.4 * 0.045 + 0.003 * sin(x * 80) * sin(y * 70)
    def heap_deform(x, y):
        return (x, y, heap_z(x, y) - (0.004 if abs(x) > 0.329 or abs(y) > 0.129 else 0))
    heap = geo.grid("PW_FloorGold", 0.66, 0.27, 30, 14, material=m["gold_pile"], parent=root, deform=heap_deform,
                    loc=(front.x, front.y, -0.001), rot=(0, 0, radians(c["rz"])))
    rng = random.Random(23)
    def scatter(bm):
        def coin(x, y, z, flat=True):
            if flat:
                rot = (radians(rng.uniform(-8, 8)), radians(rng.uniform(-8, 8)), rng.uniform(0, 2 * pi))
            else:
                rot = (radians(rng.uniform(20, 80)), radians(rng.uniform(-20, 20)), rng.uniform(0, 2 * pi))
            geo.add_cyl(bm, COIN_R, COIN_T, (x, y, z), rot, verts=14)
        for _ in range(110):                                     # on the heap
            lx, ly = rng.uniform(-0.3, 0.3), rng.uniform(-0.12, 0.12)
            z = heap_z(lx, ly)
            p = Matrix.Translation(front) @ Matrix.Rotation(radians(c["rz"]), 4, 'Z') @ Vector((lx, ly, 0))
            coin(p.x, p.y, z - 0.001, flat=rng.random() < 0.6)
        for _ in range(150):                                     # spread out across the flagstones
            a = rng.uniform(-pi * 0.95, -pi * 0.05)
            rr = 0.12 + rng.expovariate(1 / 0.16)
            x, y = front.x + cos(a) * rr * 1.5, front.y + sin(a) * rr * 0.7 + 0.04
            if y < -D / 2 - 0.12 or x > W / 2 + 0.1 or x < LEFT_X + 0.2:
                continue
            stack = rng.random() < 0.15
            coin(x, y, 0.0)
            if stack:
                coin(x + rng.uniform(-0.006, 0.006), y + rng.uniform(-0.006, 0.006), COIN_T)
        for _ in range(45):                                      # pouring out of the goblet's mouth
            rr = rng.uniform(0.0, 0.2)
            a = yaw + rng.uniform(-0.6, 0.6)
            x, y = mouth.x + cos(a) * rr, mouth.y + sin(a) * rr
            coin(x, y, 0.0 if rr > 0.04 else rng.uniform(0.0, 0.03), flat=rr > 0.05)
    geo.merged("PW_Coins_Floor", scatter, material=m["gold"], parent=heap, bevel=0.0007, seg=1)
    # the scatter was built in room space: undo the heap's transform for the child
    bpy.context.view_layer.update()
    bpy.data.objects["PW_Coins_Floor"].matrix_world = root.matrix_world.copy()
    # loose gems on the floor (right of the chest, like the cover)
    for nm, kind, mt, x, y, sz in [("PW_FloorGem_Ruby", "d20", "ruby", 0.3, -0.4, 0.02), ("PW_FloorGem_Sapphire", "d20", "sapphire", 0.46, -0.33, 0.024),
                                   ("PW_FloorGem_Emerald", "d8", "emerald", 0.52, -0.1, 0.022), ("PW_FloorGem_Ruby_2", "d20", "ruby", -0.2, -0.5, 0.016)]:
        geo.polyhedron(nm, kind, sz, loc=(x, y, 0), rot=(0, 0, RNG.uniform(0, 6)), material=m[mt], parent=root)
    return gob, heap


def build_torch(root, m):
    x, y, z = LEFT_X + STONE_DEPTH, 0.0, 0.8
    br = geo.box("PW_Torch_Bracket", (0.05, 0.03, 0.12), loc=(x + 0.005, y, z - 0.06), material=m["iron"], parent=root, bevel=0.003)
    geo.lathe("PW_Torch_Ring", [(0.032, 0), (0.04, 0), (0.04, 0.012), (0.032, 0.012)], loc=(0.105, 0, 0.09),
              material=m["iron"], parent=br, segments=20)
    geo.curve_tube("PW_Torch_Arm", [Vector((0.02, 0, 0.1)), Vector((0.05, 0, 0.1)), Vector((0.075, 0, 0.1))], 0.007,
                   material=m["iron"], parent=br, ring=6, steps=1)
    handle = geo.cylinder("PW_Torch", 0.018, 0.34, loc=(x + 0.075, y, z - 0.12), rot=(0, radians(14), 0), r_top=0.024,
                          material=M("wood_dark"), parent=root, verts=12)
    geo.cylinder("PW_Torch_Wrap", 0.028, 0.06, loc=(0, 0, 0.29), material=M("rug_fringe"), parent=handle, verts=12, bevel=0.004)
    flame = geo.lathe("PW_Torch_Flame", [(0, 0), (0.034, 0.012), (0.042, 0.05), (0.03, 0.1), (0.012, 0.16), (0, 0.19)],
                      loc=(0, 0, 0.34), material=m["flame"], parent=handle, segments=16)
    flame.visible_shadow = False
    L = bpy.data.lights.new("LIGHT_PW_Torch", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 40, (1.0, 0.52, 0.2), 0.06
    lo = bpy.data.objects.new("LIGHT_PW_Torch", L)
    lo.location = (x + 0.16, y, z + 0.3)
    S.coll("LIGHTS").objects.link(lo)
    return handle


# ---------------------------------------------------------------- physics colliders for the website
def physics_boxes(chest, hinge):
    """Boxes (Blender world space): {c: centre, h: half extents, q: quaternion wxyz} for Rapier."""
    bpy.context.view_layer.update()
    c = CHEST
    w, d, h, t = c["w"], c["d"], c["h"], c["wall"]
    out = []
    def add(mw, centre, half):
        loc, rot, _ = (mw @ Matrix.Translation(centre)).decompose()
        out.append(dict(c=[round(v, 4) for v in loc], h=[round(v, 4) for v in half], q=[round(v, 5) for v in rot]))
    I = Matrix.Identity(4)
    add(I, Vector((0.1, -0.12, -0.5)), (W / 2 + 0.2, D / 2 + 0.22, 0.5))                     # floor (top at z = 0)
    add(I, Vector((0.1, BACK_Y - STONE_DEPTH + 0.5, H / 2)), (W / 2 + 0.2, 0.5, H / 2))         # back wall face
    add(I, Vector((LEFT_X + STONE_DEPTH - 0.5, 0, H / 2)), (0.5, D / 2 + 0.2, H / 2))            # left wall face
    cm = chest.matrix_world
    add(cm, Vector((0, 0, t / 2)), (w / 2, d / 2, t / 2))                                       # chest floor
    for sy in (-1, 1):
        add(cm, Vector((0, sy * (d / 2 - t / 2), h / 2)), (w / 2 + 0.006, t / 2 + 0.006, h / 2))
    for sx in (-1, 1):
        add(cm, Vector((sx * (w / 2 - t / 2), 0, h / 2)), (t / 2 + 0.006, d / 2, h / 2))
    add(hinge.matrix_world, Vector((0, -d / 2, c["lid_h"] / 2)), (w / 2, d / 2, c["lid_h"] / 2))   # the open lid
    return out


def build(root):
    m = materials()
    build_room(root, m)
    chest, pile, hinge = build_chest(root, m)
    gob, heap = build_floor_treasure(root, m, chest)
    torch = build_torch(root, m)
    phys = S.empty("PW_Physics", "PROPS", parent=root, size=0.05)
    phys["phys_boxes"] = json.dumps(physics_boxes(chest, hinge))
    phys["coin"] = json.dumps(dict(r=COIN_R, t=COIN_T))
    # interactive tags (scope = this exhibit's page)
    for obj, iid, label in [(pile, "pw_gold", "The Gold"), (chest, "pw_chest", "Treasure Chest"), (gob, "pw_goblet", "Golden Goblet"),
                            (torch, "pw_torch", "Wall Torch")]:
        S.mark_interactive(obj, iid, label, scope="pocket-wilds", kind="discovery")
    S.mark_interactive(heap, "pw_gold", "The Gold", scope="pocket-wilds", kind="discovery")
    return dict(chest=chest)
