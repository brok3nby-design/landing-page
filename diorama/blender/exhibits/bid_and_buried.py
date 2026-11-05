"""Bid & Buried exhibit: the corner of a storage unit, cut away like a dollhouse.

Two corrugated steel walls (back + left) and a cracked concrete floor; the front and right are open
(no roll-up door - we look in from where it would be). Inside: junk from the game's item list
(teasers/bid-and-buried/js/items.js on the old site): locked safe, CRT television on a dresser, the
"Dusty Explorer's Globe", crate of records, rolled rug, framed painting, taped boxes, wardrobe box,
old barrel, spare tire, suitcase, garbage bag. A bare bulb hangs from the back wall; a bid paddle
and a SOLD ticket lie outside on the apron. Real-world scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos
import random
import numpy as np
import bpy
from mathutils import Vector

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D, H = 2.4, 2.4, 2.3          # unit floor (x, y) and wall height
X0, Y0 = -W / 2, -D / 2          # front-left corner of the unit floor
BACK_Y, LEFT_X = D / 2, -W / 2   # wall planes
RNG = random.Random(27)
PADDLE_FLIP = False
LABEL_FLIP = False
CLOSEUPS = [  # name, object names to frame, azimuth, elevation, lens, fill
    ("CAM_Exhibit_CloseBoxes", ["BB_Box_1", "BB_Box_2", "BB_Box_4", "BB_Safe"], 20, 18, 50, 0.9),
    ("CAM_Exhibit_ClosePaddle", ["BB_Paddle", "BB_Ticket"], 15, 55, 50, 0.7),
]
LIGHT_GAIN = dict(key=3.2, fill=2.2, rim=1.6)   # the generic exhibit rig is tuned for small props


# ---------------------------------------------------------------- textures (code-painted)
def _tex_concrete(name="bb_concrete", size=2048):
    c = T.Canvas(size, size, T.rgb("#8b857b"))
    c.mul(0.82 + 0.3 * T.noise(size, size, 6, 1))
    c.mul(0.9 + 0.14 * T.noise(size, size, 40, 2))
    rng = random.Random(3)
    for _ in range(7):                                   # oil stains
        x, y, r = rng.uniform(.15, .85) * size, rng.uniform(.15, .85) * size, rng.uniform(40, 150)
        c.circle(x, y, r, T.rgb("#3a342c"), op=0.28)
        c.circle(x + r * .2, y - r * .1, r * .55, T.rgb("#2a251f"), op=0.25)
    for _ in range(9):                                   # cracks: wandering lines
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        a = rng.uniform(0, 2 * pi)
        for _ in range(rng.randint(12, 30)):
            a += rng.uniform(-.6, .6)
            nx, ny = x + cos(a) * rng.uniform(10, 34), y + sin(a) * rng.uniform(10, 34)
            c.line(x, y, nx, ny, rng.uniform(1.2, 3.2), T.rgb("#2b2722"), op=0.9)
            x, y = nx, ny
    # control joint across the middle + dust drifts along the back and left walls
    c.line(0, size * .5, size, size * .5, 5, T.rgb("#4a453e"), 0.8)
    c.line(size * .5, 0, size * .5, size, 5, T.rgb("#4a453e"), 0.8)
    dust = np.clip(1 - np.minimum(c.yy / (size * .12), c.xx / (size * .12)), 0, 1) * (0.6 + 0.4 * T.noise(size, size, 18, 4))
    c._blend(dust, T.rgb("#a4906c"), 0.55)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=6.0, size=(1024, 1024), blur=1.0)


def _tex_wall(name, size=2048, number=None, rust=0.0, seed=5):
    """Painted steel, grime rising from the floor, rust streaks under the top rail bolts."""
    c = T.Canvas(size, size, T.rgb("#767a7c"))
    c.mul(0.88 + 0.18 * T.noise(size, size, 5, seed))
    g = np.clip((c.yy / size - 0.72) / 0.28, 0, 1) * (0.7 + 0.3 * T.noise(size, size, 25, seed + 1))
    c._blend(g, T.rgb("#3f3a33"), 0.65)                              # grime near the floor (bottom rows)
    rng = random.Random(seed)
    for i in range(int(14 + rust * 20)):                              # rust streaks from the top
        x = rng.uniform(0, size); L = rng.uniform(.08, .45) * size; w = rng.uniform(3, 9)
        for k in range(6):
            c.line(x + rng.uniform(-2, 2), 0, x + rng.uniform(-4, 4), L * (1 - k * .12), w * (1 - k * .12),
                   T.rgb("#7a3d1a"), 0.10 + 0.05 * rust)
    for _ in range(40):                                               # scuffs + dents
        x, y = rng.uniform(0, size), rng.uniform(.4, .95) * size
        c.line(x, y, x + rng.uniform(-60, 60), y + rng.uniform(-8, 8), rng.uniform(2, 5), T.rgb("#a9adae"), 0.25)
    if number:                                                        # stencilled unit number, sprayed orange
        px = size // 70
        tw = len(number) * 6 * px
        x, y = size * .70 - tw / 2, size * .10       # right of the bulb
        c.text(number, x + 3, y + 3, px, T.rgb("#5e2a10"), 0.35)
        c.text(number, x, y, px, T.rgb("#d4561c"), 0.92)
        c.text("UNIT", x, y - px * 9, px // 2, T.rgb("#d4561c"), 0.85)
    img = c.save(name)
    return img


def _tex_cardboard(name="bb_cardboard", size=512):
    c = T.Canvas(size, size, T.rgb("#a87a48"))
    c.mul(0.9 + 0.16 * T.noise(size, size, 7, 8))
    for x in range(0, size, 6):                                       # faint flute stripes
        c.line(x, 0, x, size, 1, T.rgb("#8e6538"), 0.12)
    return c.save(name)


def _tex_globe(name="bb_globe", w=1024, h=512):
    c = T.Canvas(w, h, T.rgb("#4f6f6a"))
    land = T.noise(h, w, 5, 21) * 0.7 + T.noise(h, w, 14, 22) * 0.3
    c._blend((land > 0.56).astype(np.float32), T.rgb("#b79a62"), 1.0)
    c._blend((land > 0.64).astype(np.float32), T.rgb("#8f7c47"), 0.8)
    for k in range(1, 6):                                             # meridians / parallels, aged ink
        c.line(0, h * k / 6, w, h * k / 6, 1.5, T.rgb("#3a2e1c"), 0.35)
    for k in range(12):
        c.line(w * k / 12, 0, w * k / 12, h, 1.5, T.rgb("#3a2e1c"), 0.3)
    c.mul(0.8 + 0.25 * T.noise(h, w, 9, 23))                         # dusty, sun-faded
    return c.save(name)


def _tex_records(name="bb_record_sleeves", w=512, h=128):
    c = T.Canvas(w, h, T.rgb("#222222"))
    cols = ["#b3301f", "#2f5d8c", "#e0b23a", "#3d7a46", "#e8e1d0", "#6d3f8f", "#c96a2a", "#1d1d1d"]
    rng = random.Random(9)
    for i in range(16):
        x0 = i * w / 16
        c.rect(x0, 0, x0 + w / 16 - 1, h, T.rgb(cols[i % len(cols)]))
        c.circle(x0 + w / 32, h * rng.uniform(.3, .7), w / 70, T.rgb("#f4efe4"), 0.6)
    return c.save(name)


def textures():
    out = {}
    out["bb_concrete"], out["bb_concrete_n"] = _tex_concrete()
    out["bb_wall_back"] = _tex_wall("bb_wall_back", number="27", rust=0.6, seed=5)
    out["bb_wall_left"] = _tex_wall("bb_wall_left", rust=0.3, seed=6)
    out["bb_cardboard"] = _tex_cardboard()
    out["bb_globe"] = _tex_globe()
    out["bb_record_sleeves"] = _tex_records()
    for nm, lines, bg, fg in [("bb_lbl_xmas", [("XMAS", 9)], "#e9e2cf", "#1a1a1a"),
                              ("bb_lbl_misc", [("MISC???", 7)], "#e9e2cf", "#1a1a1a"),
                              ("bb_lbl_dno", [("DO NOT", 6), ("OPEN", 6)], "#e9e2cf", "#a01c14"),
                              ("bb_paddle", [("27", 22)], "#f1ede4", "#1b1b1b"),
                              ("bb_ticket", [("*SOLD", 8), ("LOT 27", 4)], "#e5953a", "#2a1405")]:
        out[nm] = T.label_card(nm, 320, 200, lines, bg, fg, accent="#a01c14", border=nm in ("bb_ticket",))
    TEX.update(out)
    return out


def materials():
    return dict(
        concrete=mat("M_bb_concrete", tex="bb_concrete", rough=0.85, normal="bb_concrete_n", normal_strength=0.6),
        wall_back=mat("M_bb_wall_back", tex="bb_wall_back", rough=0.55, metal=0.45),
        wall_left=mat("M_bb_wall_left", tex="bb_wall_left", rough=0.55, metal=0.45),
        steel=mat("M_bb_steel", color=(0.16, 0.165, 0.17), rough=0.4, metal=0.85),
        steel_rust=mat("M_bb_steel_rust", color=(0.22, 0.11, 0.05), rough=0.7, metal=0.4),
        cardboard=mat("M_bb_cardboard", tex="bb_cardboard", rough=0.9),
        tape=mat("M_bb_tape", color=(0.78, 0.66, 0.45), rough=0.35),
        safe=mat("M_bb_safe", color=(0.05, 0.11, 0.08), rough=0.35, metal=0.6),
        safe_gold=mat("M_bb_safe_gold", color=(0.85, 0.62, 0.25), rough=0.3, metal=1.0),
        crt=mat("M_bb_crt", color=(0.62, 0.57, 0.47), rough=0.45),
        crt_glass=mat("M_bb_crt_glass", color=(0.03, 0.05, 0.045), rough=0.08),
        lampshade=mat("M_bb_lampshade", color=(0.82, 0.74, 0.58), rough=0.9),
        globe=mat("M_bb_globe", tex="bb_globe", rough=0.35),
        sleeves=mat("M_bb_sleeves", tex="bb_record_sleeves", rough=0.6),
        barrel=mat("M_bb_barrel", color=(0.09, 0.2, 0.32), rough=0.55, metal=0.6),
        suitcase=mat("M_bb_suitcase", color=(0.32, 0.17, 0.08), rough=0.55),
        bag=mat("M_bb_bag", color=(0.012, 0.012, 0.014), rough=0.25),
        painting=mat("M_bb_painting", tex="screen_right", rough=0.7),
        paddle_face=mat("M_bb_paddle", tex="bb_paddle", rough=0.6),
        ticket=mat("M_bb_ticket", tex="bb_ticket", rough=0.7),
        plinth=mat("M_bb_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
        **{k: mat(f"M_bb_{k}", tex=f"bb_{k}", rough=0.8) for k in ("lbl_xmas", "lbl_misc", "lbl_dno")},
    )


# ---------------------------------------------------------------- geometry
def corrugated(name, length, height, mt, period=0.12, depth=0.022, parent=None):
    """Trapezoid-ribbed steel sheet: length along local X, height along local Z, ribs along Y."""
    def deform(x, y):
        z = depth * 0.5 * float(np.clip(1.8 * sin(2 * pi * x / period), -1, 1))
        return (x, y, z)
    g = geo.grid(name, length, height, int(length / period * 10), 1, deform=deform, material=mt,
                 collection="BASE", parent=parent, thickness=0.003)
    return g


def build(root):
    m = materials()
    # ---- plinth + slab (the apron outside the unit is part of the same slab)
    geo.box("BB_Plinth", (W + 0.7, D + 0.75, 0.16), loc=(0.1, -0.12, -0.22), material=m["plinth"],
            collection="BASE", parent=root, bevel=0.02)
    geo.box("BB_Slab", (W + 0.5, D + 0.55, 0.06), loc=(0.1, -0.12, -0.06), material=m["concrete"],
            collection="BASE", parent=root, bevel=0.012, uv="fit", fit_axis=2)
    # ---- walls (corrugated sheets) + steel trim
    back = corrugated("BB_Wall_Back", W, H, m["wall_back"], parent=root)
    back.rotation_euler = (radians(90), 0, 0)
    back.location = (0, BACK_Y, H / 2)
    left = corrugated("BB_Wall_Left", D, H, m["wall_left"], parent=root)
    left.rotation_euler = (radians(90), 0, radians(-90))
    left.location = (LEFT_X, 0, H / 2)
    st = m["steel"]
    geo.box("BB_Rail_Back", (W + 0.06, 0.07, 0.06), loc=(0, BACK_Y - 0.02, H), material=st, parent=root, collection="BASE")
    geo.box("BB_Rail_Left", (0.07, D + 0.06, 0.06), loc=(LEFT_X + 0.02, 0, H), material=st, parent=root, collection="BASE")
    geo.box("BB_Post_Corner", (0.08, 0.08, H + 0.06), loc=(LEFT_X + 0.02, BACK_Y - 0.02, 0), material=st, parent=root, collection="BASE")
    geo.box("BB_Post_Jamb", (0.1, 0.12, H + 0.06), loc=(LEFT_X + 0.03, Y0, 0), material=st, parent=root, collection="BASE")
    geo.box("BB_Kick_Back", (W, 0.05, 0.12), loc=(0, BACK_Y - 0.035, 0), material=m["steel_rust"], parent=root, collection="BASE")
    geo.box("BB_Kick_Left", (0.05, D, 0.12), loc=(LEFT_X + 0.035, 0, 0), material=m["steel_rust"], parent=root, collection="BASE")
    geo.box("BB_Threshold", (W - 0.06, 0.09, 0.012), loc=(0.03, Y0, 0), material=st, parent=root, collection="BASE")

    p = dict(parent=root)
    # ---- boxes along the back wall (right side)
    def cbox(name, dims, loc, rz=0, label=None):
        b = geo.box(name, dims, loc=loc, rot=(0, 0, radians(rz)), material=m["cardboard"], bevel=0.008, **p)
        geo.box(name + "_Tape", (dims[0] + 0.004, 0.06, 0.004), loc=(0, 0, dims[2]), material=m["tape"], parent=b, bevel=0.001)
        if label:
            geo.box(name + "_Label", (dims[0] * 0.5, 0.002, dims[2] * 0.32), loc=(0, -dims[1] / 2 - 0.001, dims[2] * 0.45),
                    material=m[label], parent=b, bevel=0, uv="fit", fit_axis=1, flip_u=LABEL_FLIP)
        return b
    b1 = cbox("BB_Box_1", (0.62, 0.46, 0.46), (0.62, 0.9, 0), rz=3, label="lbl_xmas")
    cbox("BB_Box_2", (0.5, 0.4, 0.4), (0.6, 0.9, 0.46), rz=-7, label="lbl_misc")
    cbox("BB_Box_3", (0.34, 0.3, 0.28), (0.66, 0.86, 0.86), rz=12)
    cbox("BB_Box_4", (0.44, 0.38, 0.36), (1.0, 0.45, 0), rz=-18, label="lbl_dno")
    wb = geo.box("BB_WardrobeBox", (0.56, 0.5, 1.28), loc=(0.02, 0.92, 0), rot=(0, 0, radians(-4)), material=m["cardboard"], bevel=0.01, **p)
    geo.box("BB_WardrobeBox_Bar", (0.5, 0.03, 0.03), loc=(0, 0, 1.28), material=st, parent=wb)

    # ---- dresser + CRT television + globe (back-left)
    dr = geo.box("BB_Dresser", (0.95, 0.46, 0.78), loc=(-0.66, 0.92, 0), material=M("wood_dark"), bevel=0.012, **p)
    for i in range(3):
        z = 0.08 + i * 0.235
        geo.box(f"BB_Dresser_Drawer_{i}", (0.86, 0.02, 0.2), loc=(0, -0.235, z), material=M("wood"), parent=dr, bevel=0.006)
        for sx in (-0.22, 0.22):
            geo.cylinder(f"BB_Dresser_Knob_{i}_{'L' if sx < 0 else 'R'}", 0.016, 0.025, loc=(sx, -0.245, z + 0.1),
                         rot=(radians(90), 0, 0), material=M("brass"), parent=dr, verts=14)
    tv = geo.box("BB_TV", (0.5, 0.44, 0.42), loc=(-0.82, 0.93, 0.78), rot=(0, 0, radians(6)), material=m["crt"], bevel=0.03, **p)
    geo.box("BB_TV_Screen", (0.38, 0.02, 0.3), loc=(-0.03, -0.22, 0.07), material=m["crt_glass"], parent=tv, bevel=0.02)
    for k, a in enumerate((-30, 34)):
        geo.curve_tube(f"BB_TV_Antenna_{k}", [Vector((0, 0.05, 0.42)), Vector((sin(radians(a)) * 0.5, 0.12, 0.42 + cos(radians(a)) * 0.5))],
                       0.004, material=M("chrome"), parent=tv, ring=6, steps=1)
    for k in range(2):
        geo.cylinder(f"BB_TV_Knob_{k}", 0.02, 0.02, loc=(0.2, -0.225, 0.26 - k * 0.08), rot=(radians(90), 0, 0),
                     material=M("plastic_black"), parent=tv, verts=12)
    gl = geo.lathe("BB_Globe_Stand", [(0, 0), (0.09, 0), (0.09, 0.015), (0.02, 0.03), (0.015, 0.11), (0, 0.11)],
                   loc=(-0.35, 0.88, 0.78), material=M("brass"), parent=root, segments=28)
    geo.curve_tube("BB_Globe_Meridian", [Vector((0.15 * sin(t), 0, 0.26 + 0.15 * cos(t))) for t in np.linspace(-2.5, 2.5, 12)],
                   0.006, material=M("brass"), parent=gl, ring=6, steps=3)
    g = geo.sphere("BB_Globe", 0.135, loc=(0, 0, 0.125), rot=(radians(23), 0, radians(40)), material=m["globe"], parent=gl, segs=32)

    # ---- rolled rug leaning into the back-left corner, framed painting against the left wall
    geo.cylinder("BB_Rug_Roll", 0.1, 1.85, loc=(LEFT_X + 0.2, BACK_Y - 0.16, 0), rot=(radians(-9), radians(9), 0),
                 material=M("rug"), parent=root, verts=24, bevel=0.01)
    fr = geo.box("BB_Painting_Frame", (0.05, 0.92, 0.7), loc=(LEFT_X + 0.13, -0.55, 0.02), rot=(0, radians(-11), 0),
                 material=M("brass"), parent=root, bevel=0.01)
    geo.box("BB_Painting_Canvas", (0.012, 0.8, 0.58), loc=(0.026, 0, 0.06), material=m["painting"], parent=fr, bevel=0,
            uv="fit", fit_axis=0)

    # ---- locked safe (front-left), floor lamp (left wall)
    sf = geo.box("BB_Safe", (0.58, 0.58, 0.72), loc=(-0.78, -0.05, 0), rot=(0, 0, radians(18)), material=m["safe"], bevel=0.035, **p)
    door = geo.box("BB_Safe_Door", (0.46, 0.02, 0.58), loc=(0, -0.295, 0.07), material=m["safe"], parent=sf, bevel=0.012)
    geo.box("BB_Safe_Pin", (0.42, 0.004, 0.54), loc=(0, -0.011, 0.02), material=m["safe_gold"], parent=door, bevel=0.001)
    geo.box("BB_Safe_PinInner", (0.41, 0.006, 0.53), loc=(0, -0.012, 0.025), material=m["safe"], parent=door, bevel=0.001)
    geo.cylinder("BB_Safe_Dial", 0.055, 0.03, loc=(-0.05, -0.02, 0.36), rot=(radians(90), 0, 0), material=M("chrome"), parent=door, verts=32)
    hub = geo.cylinder("BB_Safe_Handle", 0.022, 0.04, loc=(0.12, -0.02, 0.28), rot=(radians(90), 0, 0), material=M("chrome"), parent=door, verts=16)
    for k in range(3):
        a = radians(90 + k * 120)
        geo.curve_tube(f"BB_Safe_Spoke_{k}", [Vector((0, 0, 0.03)), Vector((cos(a) * 0.08, sin(a) * 0.08, 0.03))], 0.008,
                       material=M("chrome"), parent=hub, ring=8, steps=1)
    geo.box("BB_Safe_Plinth", (0.6, 0.6, 0.04), loc=(0, 0, -0.0001), material=M("metal_black"), parent=sf, bevel=0.01)
    lamp = geo.lathe("BB_Lamp_Base", [(0, 0), (0.15, 0), (0.15, 0.025), (0.02, 0.04), (0, 0.04)], loc=(-0.98, 0.42, 0),
                     rot=(radians(4), 0, 0), material=M("chrome"), parent=root, segments=28)
    geo.cylinder("BB_Lamp_Pole", 0.012, 1.42, loc=(0, 0, 0.04), material=M("chrome"), parent=lamp, verts=12)
    geo.lathe("BB_Lamp_Shade", [(0.12, 0), (0.2, 0), (0.12, 0.26)], loc=(0, 0, 1.3), rot=(radians(-14), 0, 0),
              material=m["lampshade"], parent=lamp, segments=28, loop=False)

    # ---- crate of records, barrel + spare tire, suitcase, garbage bag (middle/right)
    cr = geo.box("BB_RecordCrate", (0.46, 0.36, 0.3), loc=(0.15, 0.28, 0), rot=(0, 0, radians(-12)), material=M("wood_light"), bevel=0.008, **p)
    geo.box("BB_Records", (0.4, 0.3, 0.3), loc=(0, 0.0, 0.04), material=m["sleeves"], parent=cr, bevel=0.002, uv="fit", fit_axis=0)
    geo.lathe("BB_Barrel", [(0, 0), (0.26, 0), (0.275, 0.05), (0.28, 0.2), (0.27, 0.22), (0.28, 0.24), (0.29, 0.43),
                            (0.28, 0.62), (0.27, 0.64), (0.28, 0.66), (0.275, 0.8), (0.26, 0.85), (0, 0.85)],
              loc=(0.98, 0.98, 0), material=m["barrel"], parent=root, segments=32)
    tr = 0.3
    geo.lathe("BB_Tire", [(tr - 0.06 + 0.06 * cos(t), 0.06 * sin(t)) for t in np.linspace(0, 2 * pi, 14)[:-1]],
              loc=(0.62, -0.08, 0.31), rot=(radians(78), 0, radians(-25)), material=M("rubber"), parent=root, segments=36, loop=True)
    sc = geo.box("BB_Suitcase", (0.62, 0.42, 0.18), loc=(-0.05, 0.42, 0), rot=(0, 0, radians(8)), material=m["suitcase"], bevel=0.03, **p)
    for sx in (-0.18, 0.18):
        geo.box(f"BB_Suitcase_Strap_{'L' if sx < 0 else 'R'}", (0.035, 0.43, 0.185), loc=(sx, 0, 0), material=M("leather"), parent=sc, bevel=0.004)
    geo.curve_tube("BB_Suitcase_Handle", [Vector((-0.07, -0.21, 0.09)), Vector((-0.05, -0.25, 0.1)), Vector((0.05, -0.25, 0.1)), Vector((0.07, -0.21, 0.09))],
                   0.012, material=M("leather"), parent=sc, ring=8, steps=4)
    bag = geo.sphere("BB_GarbageBag", 0.24, loc=(1.02, 0.12, 0), scale=(1.1, 0.95, 1.25), material=m["bag"], parent=root, segs=24)
    rng = random.Random(5)
    for v in bag.data.vertices:
        if v.co.z > 0.02:
            v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-.6, .6))) * 0.012
    geo.curve_tube("BB_GarbageBag_Tie", [Vector((0, 0, 0.48)), Vector((0.03, 0.01, 0.56)), Vector((0.07, 0.0, 0.58))], 0.018,
                   material=m["bag"], parent=bag, ring=8, steps=4)

    # ---- the bulb: bracket from the back wall, cord, socket, glass, filament + warm light
    geo.box("BB_Bulb_Bracket", (0.04, 0.3, 0.04), loc=(0.15, BACK_Y - 0.17, H - 0.12), material=st, parent=root)
    geo.curve_tube("BB_Bulb_Cord", [Vector((0.15, BACK_Y - 0.31, H - 0.12)), Vector((0.15, BACK_Y - 0.33, H - 0.3)), Vector((0.15, BACK_Y - 0.33, H - 0.42))],
                   0.006, material=M("cable"), parent=root, ring=6, steps=4)
    geo.cylinder("BB_Bulb_Socket", 0.025, 0.06, loc=(0.15, BACK_Y - 0.33, H - 0.48), material=M("metal_black"), parent=root, verts=16)
    bulb = geo.lathe("BB_Bulb_Glass", [(0, 0), (0.035, 0.012), (0.045, 0.05), (0.02, 0.09), (0.016, 0.1), (0, 0.1)],
                     loc=(0.15, BACK_Y - 0.33, H - 0.58), material=M("glass"), parent=root, segments=24)
    bulb.visible_shadow = False
    geo.curve_tube("BB_Bulb_Filament", [Vector((-0.012, 0, 0.05)), Vector((0, 0, 0.07)), Vector((0.012, 0, 0.05))], 0.0015,
                   material=M("filament"), parent=bulb, ring=6, steps=3)
    L = bpy.data.lights.new("LIGHT_BB_Bulb", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 110, (1.0, 0.62, 0.3), 0.03
    lo = bpy.data.objects.new("LIGHT_BB_Bulb", L)
    lo.location = (0.15, BACK_Y - 0.33, H - 0.53)
    S.coll("LIGHTS").objects.link(lo)

    # ---- outside on the apron: the bid paddle and the SOLD ticket
    pd = geo.box("BB_Paddle", (0.34, 0.012, 0.24), loc=(0.7, Y0 - 0.26, 0.006), rot=(radians(-88), 0, radians(-22)),
                 material=M("wood_light"), parent=root, bevel=0.004)
    geo.box("BB_Paddle_Face", (0.3, 0.002, 0.2), loc=(0, -0.007, 0.02), material=m["paddle_face"], parent=pd, bevel=0,
            uv="fit", fit_axis=1, flip_u=PADDLE_FLIP)
    geo.box("BB_Paddle_Handle", (0.04, 0.02, 0.26), loc=(0, 0, -0.25), material=M("wood_dark"), parent=pd, bevel=0.006)
    geo.box("BB_Ticket", (0.16, 0.1, 0.002), loc=(0.98, Y0 - 0.12, 0.0), rot=(0, 0, radians(14)), material=m["ticket"],
            parent=root, bevel=0, uv="fit", fit_axis=2)

    # interactive tags for the website (scope = this exhibit's page)
    for obj, iid, label in [(sf, "bb_safe", "Locked Safe"), (tv, "bb_tv", "CRT Television"), (g, "bb_globe", "Dusty Explorer's Globe"),
                            (cr, "bb_records", "Crate of Records"), (b1, "bb_boxes", "Cardboard Boxes"), (pd, "bb_paddle", "Bid paddle")]:
        S.mark_interactive(obj, iid, label, scope="bid-and-buried", kind="discovery")
    return dict(safe=sf, bulb=lo)
