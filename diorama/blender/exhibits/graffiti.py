"""Graffiti exhibit: a corner of the alley where the pixel-art guestbook lives ("Draw something small. Leave it behind.").

Two black brick walls covered in the studio's own Graffiti artwork: the cover mural (the GRAFFITI title among
pixel cats, ghosts, stars, rockets and hearts) across the back wall, the pixel creatures from the second
picture along the side wall. A drainpipe in the corner, a caged wall lamp, wet asphalt with a puddle and paint
splatter, a milk crate of spray cans (one can per colour of the palette, one knocked over), a cardboard box.
On the back wall, a primed blank tile with tape at its corners: on the website, visitors spray their own
16 x 16 pixel tag on it (saved in their browser; the real, shared wall is the live Graffiti guestbook).
Real-world scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos
import os
import random
import numpy as np
import bmesh
import bpy
from mathutils import Vector

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

BW, BH = 1.8, 1.0125                 # back wall: the cover's 16:9
SD = BH * 806 / 784                  # side wall depth: the creature crop's aspect
BACK_Y, LEFT_X = 0.55, -BW / 2
FD = 1.15                            # floor depth
ART = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "app", "public", "media", "projects", "graffiti"))
PALETTE = [("orange", (1.0, 0.42, 0.06)), ("pink", (1.0, 0.25, 0.55)), ("cyan", (0.12, 0.78, 0.9)), ("green", (0.25, 0.85, 0.25)),
           ("purple", (0.55, 0.3, 1.0)), ("yellow", (1.0, 0.8, 0.15))]
TILE = dict(x=0.5, z=0.2, s=0.34)
CLOSEUPS = [("CAM_Exhibit_CloseTile", ["GF_Tile", "GF_Crate"], 24, 20, 50, 0.8)]
LIGHT_GAIN = dict(key=2.6, fill=2.2, rim=1.8)
BAKE_HIDE = []


def _art(name, file, crop=None):
    img = bpy.data.images.load(os.path.join(ART, file))
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    if crop:
        x0, y0, x1, y1 = crop
        a = a[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    c = T.Canvas(a.shape[1], a.shape[0])
    c.a[..., :3] = a[..., :3]
    return c.save(name)


def _tex_asphalt(name="gf_asphalt", size=1024):
    c = T.Canvas(size, size, T.rgb("#1c1c20"))
    c.mul(0.7 + 0.45 * T.noise(size, size, 8, 301))
    c.mul(0.85 + 0.2 * T.noise(size, size, 70, 302))
    rng = random.Random(4)
    for _ in range(26):                                       # paint drips and splats on the ground
        x, y, r = rng.uniform(0, size), rng.uniform(0, size), rng.uniform(4, 22)
        col = PALETTE[rng.randrange(len(PALETTE))][1]
        c.circle(x, y, r, col, 0.55)
        for _ in range(6):
            c.circle(x + rng.uniform(-3, 3) * r, y + rng.uniform(-3, 3) * r, rng.uniform(1, 4), col, 0.6)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=3.0, size=(512, 512), blur=1.0)


def _tex_primer(name="gf_primer", size=256):
    c = T.Canvas(size, size, T.rgb("#e9e4d8"))
    c.mul(0.9 + 0.12 * T.noise(size, size, 10, 303))
    for k in range(0, size, 16):                              # a faint pencil grid: 16 x 16
        c.line(k, 0, k, size, 1, T.rgb("#c9c2b2"), 0.5)
        c.line(0, k, size, k, 1, T.rgb("#c9c2b2"), 0.5)
    return c.save(name)


def textures():
    out = {}
    out["gf_wall_back"] = _art("gf_wall_back", "graffiti.webp")
    out["gf_wall_back_n"] = T.normal_map("gf_wall_back_n", "gf_wall_back", strength=4.0, size=(1024, 576), blur=1.2)
    out["gf_wall_side"] = _art("gf_wall_side", "gallery/graffiti.webp", crop=(0, 0.31, 1, 1))
    out["gf_wall_side_n"] = T.normal_map("gf_wall_side_n", "gf_wall_side", strength=4.0, size=(512, 512), blur=1.2)
    out["gf_asphalt"], out["gf_asphalt_n"] = _tex_asphalt()
    out["gf_primer"] = _tex_primer()
    TEX.update(out)
    return out


def materials():
    return dict(
        wall_back=mat("M_gf_wall_back", tex="gf_wall_back", rough=0.85, normal="gf_wall_back_n", normal_strength=0.8),
        wall_side=mat("M_gf_wall_side", tex="gf_wall_side", rough=0.85, normal="gf_wall_side_n", normal_strength=0.8),
        brick=mat("M_gf_brick", color=(0.05, 0.045, 0.045), rough=0.9),
        asphalt=mat("M_gf_asphalt", tex="gf_asphalt", rough=0.75, normal="gf_asphalt_n", normal_strength=0.5),
        puddle=mat("M_gf_puddle", color=(0.07, 0.075, 0.09), rough=0.06, metal=0.25),
        primer=mat("M_gf_primer", tex="gf_primer", rough=0.8),
        tape=mat("M_gf_tape", color=(0.82, 0.76, 0.6), rough=0.6),
        pipe=mat("M_gf_pipe", color=(0.22, 0.24, 0.25), rough=0.45, metal=0.8),
        crate=mat("M_gf_crate", color=(0.12, 0.3, 0.6), rough=0.5),
        cardboard=mat("M_gf_cardboard", color=(0.45, 0.32, 0.18), rough=0.9),
        bulb=mat("M_gf_bulb", color=(1.0, 0.85, 0.6), emit=(1.0, 0.82, 0.55), strength=16),
        nozzle=mat("M_gf_nozzle", color=(0.9, 0.9, 0.88), rough=0.4),
        plinth=mat("M_gf_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
        **{f"can_{n}": mat(f"M_gf_can_{n}", color=c, rough=0.3, metal=0.5) for n, c in PALETTE},
        **{f"paint_{n}": mat(f"M_gf_paint_{n}", color=c, rough=0.2) for n, c in PALETTE},
    )


def build_alley(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("GF_Plinth", (BW + 0.36, FD + 0.36, 0.16), loc=(0.0, BACK_Y - FD / 2 - 0.04, -0.21), material=m["plinth"], bevel=0.02, **p)
    geo.box("GF_Ground", (BW + 0.16, FD + 0.12, 0.05), loc=(0.0, BACK_Y - FD / 2, -0.05), material=m["asphalt"], bevel=0.006, uv="box", uv_scale=0.9, **p)
    t = 0.07
    geo.box("GF_Wall_Back", (BW + t, t, BH), loc=(-t / 2, BACK_Y + t / 2, 0), material=m["wall_back"], bevel=0, uv="fit", fit_axis=1, **p)
    geo.box("GF_Wall_Left", (t, SD, BH), loc=(LEFT_X - t / 2, BACK_Y - SD / 2, 0), material=m["wall_side"], bevel=0, uv="fit", fit_axis=0, **p)
    for nm, dims, loc in [("Coping_Back", (BW + t + 0.03, t + 0.03, 0.04), (-t / 2, BACK_Y + t / 2, BH)), ("Coping_Left", (t + 0.03, SD + 0.03, 0.04), (LEFT_X - t / 2, BACK_Y - SD / 2, BH))]:
        geo.box(f"GF_{nm}", dims, loc=loc, material=m["brick"], bevel=0.006, **p)
    # drainpipe down the corner, with brackets and an elbow onto the ground
    geo.cylinder("GF_Pipe", 0.025, BH - 0.06, loc=(LEFT_X + 0.04, BACK_Y - 0.04, 0.06), material=m["pipe"], parent=root, verts=16, bevel=0)
    geo.curve_tube("GF_Pipe_Elbow", [Vector((LEFT_X + 0.04, BACK_Y - 0.04, 0.07)), Vector((LEFT_X + 0.05, BACK_Y - 0.06, 0.02)), Vector((LEFT_X + 0.12, BACK_Y - 0.1, 0.015))],
                   0.025, material=m["pipe"], parent=root, ring=12, steps=6)
    for z in (0.3, 0.65, 0.95):
        geo.box(f"GF_Pipe_Bracket_{int(z * 100)}", (0.07, 0.07, 0.015), loc=(LEFT_X + 0.04, BACK_Y - 0.04, z), material=m["pipe"], parent=root, bevel=0.003)
    # caged wall lamp, high on the back wall
    lx, lz = 0.05, BH - 0.12
    geo.box("GF_Lamp_Plate", (0.08, 0.015, 0.1), loc=(lx, BACK_Y - 0.0075, lz - 0.05), material=m["pipe"], parent=root, bevel=0.004)
    geo.curve_tube("GF_Lamp_Arm", [Vector((lx, BACK_Y - 0.01, lz)), Vector((lx, BACK_Y - 0.09, lz + 0.01)), Vector((lx, BACK_Y - 0.14, lz - 0.02))], 0.008,
                   material=m["pipe"], parent=root, ring=8, steps=4)
    shade = geo.lathe("GF_Lamp_Shade", [(0.01, 0.04), (0.06, 0.0), (0.058, -0.004), (0.008, 0.036)], loc=(lx, BACK_Y - 0.14, lz - 0.03), material=m["pipe"], parent=root, segments=24, loop=True)
    geo.sphere("GF_Lamp_Bulb", 0.02, loc=(lx, BACK_Y - 0.14, lz - 0.075), material=m["bulb"], parent=root, segs=14).visible_shadow = False
    def cage(bm):
        for k in range(6):
            a = k * pi / 3
            geo.add_cyl(bm, 0.002, 0.05, (lx + cos(a) * 0.028, BACK_Y - 0.14 + sin(a) * 0.028, lz - 0.09), verts=4)
    geo.merged("GF_Lamp_Cage", cage, material=m["pipe"], parent=root, bevel=0)
    L = bpy.data.lights.new("LIGHT_GF_Lamp", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 30, (1.0, 0.82, 0.6), 0.03
    lo = bpy.data.objects.new("LIGHT_GF_Lamp", L)
    lo.location = (lx, BACK_Y - 0.16, lz - 0.1)
    S.coll("LIGHTS").objects.link(lo)
    # a puddle on the asphalt
    geo.sphere("GF_Puddle", 0.13, loc=(-0.05, BACK_Y - 0.85, 0.0005), scale=(1.5, 0.75, 0.004), material=m["puddle"], parent=root, segs=24)


def spray_can(root, m, name, colour, loc, rot=(0, 0, 0), parent=None):
    can = geo.cylinder(name, 0.033, 0.16, loc=loc, rot=rot, material=m[f"can_{colour}"], parent=parent or root, verts=20, bevel=0.004)
    geo.lathe(f"{name}_Shoulder", [(0.033, 0), (0.03, 0.012), (0.018, 0.022), (0.012, 0.024), (0, 0.024)], loc=(0, 0, 0.16), material=M("chrome"), parent=can, segments=20)
    geo.cylinder(f"{name}_Cap", 0.01, 0.016, loc=(0, 0, 0.183), material=m["nozzle"], parent=can, verts=12, bevel=0.002)
    geo.box(f"{name}_Nozzle", (0.004, 0.006, 0.004), loc=(0, -0.01, 0.192), material=M("plastic_black"), parent=can, bevel=0)
    geo.cylinder(f"{name}_Band", 0.0335, 0.03, loc=(0, 0, 0.06), material=m["nozzle"], parent=can, verts=20, bevel=0)
    return can


def build_props(root, m):
    # milk crate (open slatted box) with four cans, two cans on the ground, one knocked over in its own paint
    cr = S.empty("GF_Crate", "PROPS", loc=(0.12, BACK_Y - 0.3, 0), rot=(0, 0, radians(-14)), parent=root, size=0.05)
    def crate(bm):
        w, d, h, t = 0.33, 0.33, 0.28, 0.012
        geo.add_box(bm, (w, d, t), (0, 0, 0))
        for z in np.linspace(0.02, h - 0.02, 5):
            for sy in (-1, 1):
                geo.add_box(bm, (w, t, 0.02), (0, sy * (d / 2 - t / 2), z))
            for sx in (-1, 1):
                geo.add_box(bm, (t, d, 0.02), (sx * (w / 2 - t / 2), 0, z))
        for sx in (-1, 1):
            for sy in (-1, 1):
                geo.add_box(bm, (0.025, 0.025, h), (sx * (w / 2 - 0.0125), sy * (d / 2 - 0.0125), 0))
    geo.merged("GF_Crate_Body", crate, material=m["crate"], parent=cr, bevel=0.002, seg=1)
    cans = []
    for k, (n, _) in enumerate(PALETTE[:4]):
        cx, cy = (-0.07 + (k % 2) * 0.14, -0.07 + (k // 2) * 0.14)
        cans.append((spray_can(root, m, f"GF_Can_{n}", n, (cx, cy, 0.012), rot=(radians(4 * (k - 1.5)), radians(3), 0), parent=cr), n))
    cans.append((spray_can(root, m, f"GF_Can_{PALETTE[4][0]}", PALETTE[4][0], (0.42, BACK_Y - 0.42, 0), rot=(0, 0, radians(30))), PALETTE[4][0]))
    # the yellow one lies on its side in a yellow splash
    cans.append((spray_can(root, m, f"GF_Can_{PALETTE[5][0]}", PALETTE[5][0], (-0.3, BACK_Y - 0.55, 0.033), rot=(radians(90), 0, radians(65))), PALETTE[5][0]))
    geo.sphere("GF_Splash", 0.09, loc=(-0.38, BACK_Y - 0.62, 0.0006), scale=(1.5, 1.0, 0.004), material=m[f"paint_{PALETTE[5][0]}"], parent=root, segs=20)
    for k, (dx, dy, r) in enumerate([(0.1, -0.05, 0.02), (-0.06, 0.08, 0.015), (0.13, 0.06, 0.012)]):
        geo.sphere(f"GF_Splash_Dot_{k}", r, loc=(-0.38 + dx, BACK_Y - 0.62 + dy, 0.0006), scale=(1, 1, 0.01), material=m[f"paint_{PALETTE[5][0]}"], parent=root, segs=10)
    # a cardboard box against the side wall
    bx = geo.box("GF_Box", (0.3, 0.26, 0.24), loc=(LEFT_X + 0.2, BACK_Y - 0.55, 0), rot=(0, 0, radians(8)), material=m["cardboard"], bevel=0.006, parent=root)
    geo.box("GF_Box_Flap", (0.3, 0.13, 0.004), loc=(0, -0.18, 0.24), rot=(radians(-40), 0, 0), material=m["cardboard"], parent=bx, bevel=0)
    return cr, cans


def build_tile(root, m):
    s = TILE["s"]
    g = S.empty("GF_Tile", "PROPS", loc=(TILE["x"], BACK_Y, TILE["z"]), parent=root, size=0.05)
    geo.box("GF_Tile_Paint", (s, 0.004, s), loc=(0, -0.002, 0), material=m["primer"], parent=g, bevel=0, uv="fit", fit_axis=1)
    for sx in (-1, 1):                                        # tape across the corners
        for sz in (0, 1):
            geo.box(f"GF_Tile_Tape_{sx}_{sz}", (0.06, 0.002, 0.022), loc=(sx * s / 2, -0.0048, sz * s - 0.011), rot=(0, radians(45 * sx * (1 if sz else -1)), 0),
                    material=m["tape"], parent=g, bevel=0)
    return g


def build(root):
    m = materials()
    build_alley(root, m)
    crate, cans = build_props(root, m)
    tile = build_tile(root, m)
    S.mark_interactive(tile, "gf_tile", "Your tile", scope="graffiti", kind="discovery")
    S.mark_interactive(crate, "gf_crate", "Spray cans", scope="graffiti", kind="discovery")
    for can, n in cans:                                       # each can picks its colour on the website
        S.mark_interactive(can, f"gf_can_{n}", f"{n.title()} spray can", scope="graffiti", kind="discovery")
    return dict(tile=tile)
