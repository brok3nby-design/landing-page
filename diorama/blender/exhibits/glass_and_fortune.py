"""Glass & Fortune exhibit: the fortune-teller's parlour from the game's cover art, as a miniature diorama.

A corner of a dark Victorian parlour, cut away like a dollhouse: damask wallpaper over a wood wainscot,
a tall window in the back wall with the full moon and a far-off skyline, a red velvet curtain. In the
middle, a round table under a black velvet cloth with a gold-embroidered, fringed hem. On it: two glass
dice, one red and one blue, with white pips (the website rolls them with real physics); the masked
fortune-teller's beak mask with brass goggles, leaning on a top hat; a crystal ball on a brass stand; an
hourglass; a little brass moth. Against the left wall a small cabinet with an oil lantern and books.

Real-world scale (metres), Blender Z-up. Physics shapes for the website are exported as JSON on the
GF_Physics empty (Blender world space), the dice faces as JSON on each die.
"""
from math import radians, pi, sin, cos
import json
import random
import numpy as np
import bmesh
import bpy
from mathutils import Matrix, Vector

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D, H = 1.3, 1.1, 1.1        # room floor (x, y) and wall height
BACK_Y, LEFT_X = D / 2, -W / 2   # inner wall planes
TABLE = dict(x=0.05, y=-0.08, r=0.42, h=0.724)
DIE = 0.055                       # glass dice, a chunky 45 mm (they are the stars of the table)
WIN = dict(x=0.3, w=0.42, z0=0.42, z1=0.98)
RNG = random.Random(13)
CLOSEUPS = [  # name, object names to frame, azimuth, elevation, lens, fill
    ("CAM_Exhibit_CloseTable", ["GF_Die_Red", "GF_Die_Blue", "GF_Mask", "GF_Hat", "GF_CrystalBall_Stand"], 22, 30, 50, 0.85),
]
LIGHT_GAIN = dict(key=5.0, fill=3.2, rim=2.0)
BAKE_HIDE = ["GF_Die_Red", "GF_Die_Blue"]     # they move: no baked shadow of them on the cloth
# die faces (Blender local axis -> value). Opposite faces add up to 7.
FACES = {"+Z": 1, "-Z": 6, "-Y": 2, "+Y": 5, "+X": 3, "-X": 4}


# ---------------------------------------------------------------- textures (code-painted)
def _tex_wallpaper(name="gf_wallpaper", size=512):
    """Dark damask: a lattice of ornate medallions in dull gold-green on near-black teal (tiles)."""
    c = T.Canvas(size, size, T.rgb("#10171a"))
    c.mul(0.85 + 0.25 * T.noise(size, size, 6, 3))
    ink = T.rgb("#3b4a3a")
    hi = T.rgb("#6b6a45")
    for cx, cy in ((size / 2, size / 2), (0, 0), (size, 0), (0, size), (size, size)):
        for k in range(8):                                   # eight petals around a boss
            a = k * pi / 4
            px, py = cx + cos(a) * size * 0.14, cy + sin(a) * size * 0.14
            c.circle(px, py, size * 0.05, ink, 0.9)
            c.circle(px, py, size * 0.025, hi, 0.5)
        c.circle(cx, cy, size * 0.07, ink, 0.95)
        c.circle(cx, cy, size * 0.04, hi, 0.55, ring=3)
        for k in range(4):                                   # long leaves toward the neighbours
            a = k * pi / 2 + pi / 4
            pts = [(cx + cos(a) * size * 0.2, cy + sin(a) * size * 0.2),
                   (cx + cos(a + 0.18) * size * 0.32, cy + sin(a + 0.18) * size * 0.32),
                   (cx + cos(a) * size * 0.42, cy + sin(a) * size * 0.42),
                   (cx + cos(a - 0.18) * size * 0.32, cy + sin(a - 0.18) * size * 0.32)]
            c.poly(pts, ink, 0.8)
    for x in range(0, size, 4):                              # faint printed stripes
        c.line(x, 0, x, size, 1, T.rgb("#0b1012"), 0.12)
    return c.save(name)


def _tex_velvet(name="gf_velvet", w=1024, h=512):
    """Black velvet with a gold-embroidered band above the hem (v ~ 0.08-0.22) and a fine top border."""
    c = T.Canvas(w, h, T.rgb("#1a1620"))
    c.mul(0.8 + 0.4 * T.noise(h, w, 4, 7))
    c.mul(0.9 + 0.15 * T.noise(h, w, 60, 8))
    gold, dark = T.rgb("#a98443"), T.rgb("#5a4220")
    y0, y1 = h * (1 - 0.24), h * (1 - 0.07)                  # rows of the band (row 0 = top = v 1)
    c.line(0, y0, w, y0, 3, gold, 0.85); c.line(0, y1, w, y1, 3, gold, 0.85)
    c.line(0, y0 + 7, w, y0 + 7, 1.5, dark, 0.8); c.line(0, y1 - 7, w, y1 - 7, 1.5, dark, 0.8)
    n = 8                                                    # scroll medallions along the band
    ym = (y0 + y1) / 2
    for k in range(n):
        x = (k + 0.5) * w / n
        c.circle(x, ym, (y1 - y0) * 0.3, gold, 0.75, ring=3)
        c.circle(x, ym, (y1 - y0) * 0.1, gold, 0.8)
        for s in (-1, 1):
            for j in range(6):                               # curling vines out of each medallion
                a = j * 0.5
                x2 = x + s * (24 + j * 9)
                c.circle(x2, ym + sin(a + k) * 14, 4.5 - j * 0.5, gold, 0.6)
    c.line(0, h * 0.02, w, h * 0.02, 2, gold, 0.5)
    return c.save(name)


def _tex_sky(name="gf_night", w=512, h=640):
    c = T.Canvas(w, h, T.rgb("#0a1022"))
    c.vgrad(0, h, T.rgb("#0b1430"), T.rgb("#26324e"))
    rng = random.Random(4)
    for _ in range(120):
        c.circle(rng.uniform(0, w), rng.uniform(0, h * 0.6), rng.uniform(0.6, 1.6), T.rgb("#dfe6ff"), rng.uniform(0.3, 0.9))
    mx, my = w * 0.32, h * 0.26                              # the full moon + halo
    for r, op in ((95, 0.06), (70, 0.1), (52, 0.16)):
        c.circle(mx, my, r, T.rgb("#bcc8ff"), op)
    c.circle(mx, my, 38, T.rgb("#f4f1e4"))
    c.circle(mx - 9, my + 6, 9, T.rgb("#d6d2c2"), 0.6); c.circle(mx + 12, my - 10, 6, T.rgb("#d6d2c2"), 0.5)
    for k in range(5):                                       # drifting cloud
        c.circle(mx - 70 + k * 30, my + 30 + (k % 2) * 6, 18, T.rgb("#3a4466"), 0.55)
    base = h * 0.82                                          # far skyline: towers and spires
    pts = [(0, h)]
    x = 0
    while x < w:
        bw = rng.uniform(25, 60); bh = rng.uniform(30, 110)
        pts += [(x, base - bh * 0.4), (x, base - bh)]
        if rng.random() < 0.45:
            pts += [(x + bw * 0.5, base - bh - rng.uniform(25, 60))]
        pts += [(x + bw, base - bh), (x + bw, base - bh * 0.4)]
        x += bw
    pts += [(w, h)]
    c.poly(pts, T.rgb("#05070d"))
    for _ in range(14):                                      # a few lit windows
        c.rect(*(lambda x, y: (x, y, x + 3, y + 4))(rng.uniform(0, w), rng.uniform(base - 60, base + 20)), T.rgb("#ffcf7a"), 0.8)
    return c.save(name)


def textures():
    out = {}
    out["gf_wallpaper"] = _tex_wallpaper()
    out["gf_velvet"] = _tex_velvet()
    out["gf_night"] = _tex_sky()
    TEX.update(out)
    return out


def materials():
    return dict(
        wallpaper=mat("M_gf_wallpaper", tex="gf_wallpaper", rough=0.75),
        velvet=mat("M_gf_velvet", tex="gf_velvet", rough=0.95),
        curtain=mat("M_gf_curtain", color=(0.24, 0.018, 0.035), rough=0.85),
        sky=mat("M_gf_sky", color=(0, 0, 0), rough=0.9, emit_tex="gf_night", strength=0.45),
        gold=mat("M_gf_gold_thread", color=(0.75, 0.55, 0.25), rough=0.45, metal=0.7),
        die_red=mat("M_gf_die_red", color=(0.85, 0.04, 0.06), rough=0.04, transmission=0.9, ior=1.5),
        die_blue=mat("M_gf_die_blue", color=(0.05, 0.2, 0.95), rough=0.04, transmission=0.9, ior=1.5),
        pip=mat("M_gf_pip", color=(0.95, 0.95, 0.92), rough=0.35, emit=(1, 1, 1), strength=0.12),
        glass=M("glass"),
        orb_glow=mat("M_gf_orb_glow", color=(0.4, 0.15, 0.9), emit=(0.45, 0.15, 1.0), strength=0.9),
        flame=mat("M_gf_flame", color=(1.0, 0.6, 0.25), emit=(1.0, 0.55, 0.2), strength=12),
        hat=mat("M_gf_hat", color=(0.035, 0.03, 0.03), rough=0.5),
        ribbon=mat("M_gf_ribbon", color=(0.3, 0.03, 0.04), rough=0.5),
        lens=mat("M_gf_lens", color=(0.05, 0.08, 0.07), rough=0.05, metal=0.3),
        sand=mat("M_gf_sand", color=(0.78, 0.62, 0.38), rough=0.9),
        floor=mat("M_gf_floor", tex="planks", rough=0.55, normal="planks_n", normal_strength=0.6, tint=(0.42, 0.3, 0.26)),
        plinth=mat("M_gf_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
        book_a=mat("M_gf_book_a", color=(0.25, 0.06, 0.05), rough=0.6),
        book_b=mat("M_gf_book_b", color=(0.06, 0.12, 0.09), rough=0.6),
    )


# ---------------------------------------------------------------- room
def build_room(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("GF_Plinth", (W + 0.4, D + 0.42, 0.16), loc=(0.1, -0.12, -0.21), material=m["plinth"], bevel=0.02, **p)
    geo.box("GF_Floor", (W + 0.2, D + 0.22, 0.05), loc=(0.08, -0.09, -0.05), material=m["floor"], bevel=0.006, **p)
    geo.box("GF_Rug", (1.12, 0.86, 0.006), loc=(TABLE["x"], TABLE["y"], 0), material=M("rug"), bevel=0.002, uv="fit", fit_axis=2, **p)
    t = 0.06
    # back wall around the window opening
    wx0, wx1 = WIN["x"] - WIN["w"] / 2, WIN["x"] + WIN["w"] / 2
    for nm, x0, x1, z0, z1 in [("L", LEFT_X - t, wx0, 0, H), ("R", wx1, W / 2 + 0.1, 0, H),
                               ("Below", wx0, wx1, 0, WIN["z0"]), ("Above", wx0, wx1, WIN["z1"], H)]:
        geo.box(f"GF_Wall_Back_{nm}", (x1 - x0, t, z1 - z0), loc=((x0 + x1) / 2, BACK_Y + t / 2, z0), material=m["wallpaper"],
                bevel=0, uv="box", uv_scale=3, **p)
    geo.box("GF_Wall_Left", (t, D + 0.1, H), loc=(LEFT_X - t / 2, -0.05, 0), material=m["wallpaper"], bevel=0, uv="box", uv_scale=3, **p)
    # wainscot, chair rail, baseboard, crown moulding on both walls
    wood = M("wood_dark")
    for nm, dims, loc in [
        ("Back", (W + 0.1, 0.018, 0.34), (0.05, BACK_Y - 0.009, 0)), ("Left", (0.018, D + 0.1, 0.34), (LEFT_X + 0.009, -0.05, 0))]:
        geo.box(f"GF_Wainscot_{nm}", dims, loc=loc, material=wood, bevel=0.002, **p)
    for nm, dims, loc in [
        ("Rail_Back", (W + 0.1, 0.035, 0.028), (0.05, BACK_Y - 0.017, 0.34)), ("Rail_Left", (0.035, D + 0.1, 0.028), (LEFT_X + 0.017, -0.05, 0.34)),
        ("Base_Back", (W + 0.1, 0.03, 0.08), (0.05, BACK_Y - 0.015, 0)), ("Base_Left", (0.03, D + 0.1, 0.08), (LEFT_X + 0.015, -0.05, 0)),
        ("Crown_Back", (W + 0.1, 0.05, 0.05), (0.05, BACK_Y - 0.025, H - 0.05)), ("Crown_Left", (0.05, D + 0.1, 0.05), (LEFT_X + 0.025, -0.05, H - 0.05))]:
        geo.box(f"GF_{nm}", dims, loc=loc, material=wood, bevel=0.006, **p)
    def panels(bm):                                           # raised panels on the wainscot
        for k in range(6):
            x = LEFT_X + 0.12 + k * 0.25
            if x < W / 2 - 0.05:
                geo.add_box(bm, (0.19, 0.008, 0.2), (x, BACK_Y - 0.022, 0.1))
        for k in range(5):
            y = BACK_Y - 0.15 - k * 0.25
            if y > -D / 2:
                geo.add_box(bm, (0.008, 0.19, 0.2), (LEFT_X + 0.022, y, 0.1))
    geo.merged("GF_Wainscot_Panels", panels, material=wood, bevel=0.003, seg=1, **p)

    # the window: frame, mullions, the night outside, the curtain
    geo.box("GF_Night", (WIN["w"] + 0.3, 0.01, WIN["z1"] - WIN["z0"] + 0.3), loc=(WIN["x"], BACK_Y + 0.2, WIN["z0"] - 0.15),
            material=m["sky"], bevel=0, uv="fit", fit_axis=1, **p)
    def frame(bm):
        fw, z0, z1 = WIN["w"], WIN["z0"], WIN["z1"]
        y = BACK_Y + 0.03
        for x in (WIN["x"] - fw / 2 + 0.015, WIN["x"] + fw / 2 - 0.015, WIN["x"]):
            geo.add_box(bm, (0.03 if x != WIN["x"] else 0.016, 0.05, z1 - z0), (x, y, z0))
        for z in (z0, z1 - 0.03, (z0 + z1) / 2 - 0.008, z0 + (z1 - z0) * 0.25, z0 + (z1 - z0) * 0.75):
            geo.add_box(bm, (fw, 0.05, 0.03 if z in (z0, z1 - 0.03) else 0.016), (WIN["x"], y, z))
        geo.add_box(bm, (fw + 0.08, 0.08, 0.025), (WIN["x"], BACK_Y - 0.01, z0 - 0.025))     # sill
    geo.merged("GF_Window_Frame", frame, material=wood, bevel=0.003, seg=1, **p)
    geo.box("GF_Window_Glass", (WIN["w"] - 0.03, 0.004, WIN["z1"] - WIN["z0"] - 0.03), loc=(WIN["x"], BACK_Y + 0.045, WIN["z0"] + 0.015),
            material=m["glass"], bevel=0, **p)
    rod_z = WIN["z1"] + 0.09
    geo.cylinder("GF_Curtain_Rod", 0.009, WIN["w"] + 0.42, loc=(WIN["x"] - (WIN["w"] + 0.42) / 2, BACK_Y - 0.06, rod_z),
                 rot=(0, radians(90), 0), material=M("brass"), parent=root, verts=12)
    for side in (-1, 1):                                       # two drapes, gathered toward the sides
        cx = WIN["x"] + side * (WIN["w"] / 2 + 0.06)
        hgt = rod_z - 0.02
        def deform(x, y, side=side, hgt=hgt):
            t_ = (y + hgt / 2) / hgt                           # 0 = hem, 1 = rod
            gather = 1.0 - 0.45 * np.exp(-((t_ - 0.42) ** 2) / 0.01)   # tie-back
            fx = x * gather
            fold = 0.018 * sin(x * 70) * (0.5 + 0.5 * (1 - t_))
            return (fx + side * 0.02 * (1 - gather), fold, y)
        cur = geo.grid(f"GF_Curtain_{'L' if side < 0 else 'R'}", 0.22, hgt, 30, 40, material=m["curtain"], parent=root,
                       deform=deform, thickness=0.006)
        cur.location = (cx, BACK_Y - 0.075, hgt / 2 + 0.01)
        cur.rotation_euler = (radians(90) * 0, 0, 0)
    L = bpy.data.lights.new("LIGHT_GF_Moon", 'AREA')
    L.energy, L.color, L.size = 9, (0.55, 0.65, 1.0), 0.35
    lo = bpy.data.objects.new("LIGHT_GF_Moon", L)
    lo.location = (WIN["x"], BACK_Y + 0.12, 0.85)
    lo.rotation_euler = (radians(-68), 0, 0)
    S.coll("LIGHTS").objects.link(lo)


# ---------------------------------------------------------------- the round table + velvet cloth
def _cloth(name, m, parent):
    """Round velvet tablecloth: a flat top, a rounded edge and a skirt that flares and falls into soft
    folds toward a gold-fringed hem. UV u runs around (8 repeats), v = height (the band is near the hem)."""
    R, h = TABLE["r"], TABLE["h"]
    prof = [(0.0, h + 0.004, 0), (R - 0.03, h + 0.004, 0), (R - 0.005, h, 0), (R + 0.004, h - 0.02, 0.05),
            (R + 0.012, h - 0.12, 0.25), (R + 0.03, h - 0.38, 0.6), (R + 0.05, 0.12, 0.9), (R + 0.06, 0.03, 1.0)]
    n = 96
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    rings = []
    for r, z, amp in prof:
        ring = []
        for k in range(n + 1):
            a = 2 * pi * k / n
            rr = r + 0.022 * amp * sin(a * 14 + 0.6) + 0.008 * amp * sin(a * 31)
            ring.append(bm.verts.new((cos(a) * rr, sin(a) * rr, z)) if r > 0 else None)
        rings.append(ring)
    centre = bm.verts.new((0, 0, h + 0.004))
    for k in range(n):
        f = bm.faces.new((centre, rings[1][k], rings[1][k + 1]))
        for lp, t in zip(f.loops, [(k / n * 8 + 4 / n, 0.999), (k / n * 8, 0.995), ((k + 1) / n * 8, 0.995)]):
            lp[uv].uv = t
    vs = [0.995, 0.99, 0.97] + [z / h for _, z, _ in prof[4:]]
    for i in range(1, len(prof) - 1):
        for k in range(n):
            f = bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]))
            vi, vj = vs[i - 1], vs[i]
            for lp, t in zip(f.loops, [(k / n * 8, vi), (k / n * 8, vj), ((k + 1) / n * 8, vj), ((k + 1) / n * 8, vi)]):
                lp[uv].uv = t
    bmesh.ops.remove_doubles(bm, verts=[r[0] for r in rings[1:]] + [r[-1] for r in rings[1:]], dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cloth = geo.from_bm(name, bm, loc=(TABLE["x"], TABLE["y"], 0), material=m["velvet"], parent=parent, uv="keep")
    hem = prof[-1]
    def fringe(bm2):
        for k in range(180):
            a = 2 * pi * k / 180
            rr = hem[0] + 0.022 * sin(a * 14 + 0.6) + 0.008 * sin(a * 31)
            geo.add_cyl(bm2, 0.0028, 0.03, (cos(a) * rr, sin(a) * rr, 0.0), verts=5)
    geo.merged(name + "_Fringe", fringe, material=m["gold"], parent=cloth, bevel=0)
    return cloth


def _die(name, mt, m, loc, rot, parent):
    s = DIE
    die = geo.box(name, (s, s, s), loc=(0, 0, 0), material=mt, parent=parent, bevel=s * 0.16, seg=4)
    # origin at the die's CENTRE (physics bodies rotate about their centre): shift the mesh down by s/2
    for v in die.data.vertices:
        v.co.z -= s / 2
    die.location = Vector(loc) + Vector((0, 0, s / 2))
    die.rotation_euler = rot
    pip_r, off, g = s * 0.085, s * 0.25, s / 2 + 0.0002
    layouts = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)], 4: [(-1, -1), (-1, 1), (1, -1), (1, 1)],
               5: [(-1, -1), (-1, 1), (0, 0), (1, -1), (1, 1)], 6: [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)]}
    axes = {"+Z": (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))), "-Z": (Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, 1, 0))),
            "+X": (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), "-X": (Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
            "+Y": (Vector((0, 1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))), "-Y": (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)))}
    def pips(bm):
        for face, value in FACES.items():
            n, a, b = axes[face]
            for i, j in layouts[value]:
                c = n * g + a * (i * off) + b * (j * off)
                rot_m = n.to_track_quat('Z', 'X' if abs(n.y) > 0.9 else 'Y').to_euler()
                vs = geo.add_cyl(bm, pip_r, 0.0012, (0, 0, 0), (0, 0, 0), verts=14)
                bmesh.ops.translate(bm, vec=Vector((0, 0, -0.0011)), verts=vs)       # mostly sunk into the face
                bmesh.ops.transform(bm, matrix=geo.mtx(c, rot_m), verts=vs)
    geo.merged(name + "_Pips", pips, material=m["pip"], parent=die, bevel=0)
    die["faces"] = json.dumps(FACES)
    die["size"] = s
    return die


def build_table(root, m):
    tx, ty, h = TABLE["x"], TABLE["y"], TABLE["h"]
    cloth = _cloth("GF_Table", m, root)
    top = lambda x, y: (tx + x, ty + y, h + 0.004)
    # the dice: red shows 5, blue shows 3 (FACES: +Y = 5 -> rotate +Y up; +X = 3 -> rotate +X up)
    red = _die("GF_Die_Red", m["die_red"], m, top(-0.04, -0.24), (radians(90), 0, radians(24)), root)
    blue = _die("GF_Die_Blue", m["die_blue"], m, top(0.1, -0.2), (0, radians(-90), radians(-31)), root)

    # the top hat (back-left) and the beak mask leaning against it
    hat = geo.lathe("GF_Hat", [(0, 0), (0.105, 0), (0.112, 0.006), (0.1, 0.011), (0.062, 0.011), (0.059, 0.12), (0.064, 0.135),
                                (0.064, 0.138), (0, 0.138)], loc=top(-0.2, 0.12), rot=(0, 0, 0), material=m["hat"], parent=root, segments=40)
    geo.lathe("GF_Hat_Band", [(0.0605, 0.012), (0.0625, 0.012), (0.0612, 0.036), (0.0597, 0.036)], material=m["ribbon"], parent=hat, segments=40)
    mask = S.empty("GF_Mask", "PROPS", loc=top(-0.1, -0.02), rot=(radians(-28), 0, radians(32)), parent=root, size=0.05)
    geo.sphere("GF_Mask_Shell", 0.055, scale=(1.0, 0.62, 1.25), material=M("leather_brown"), parent=mask, segs=28)
    for sx in (-1, 1):                                         # brass goggles with dark lenses
        g = geo.lathe(f"GF_Mask_Goggle_{'L' if sx < 0 else 'R'}", [(0.016, 0), (0.023, 0), (0.023, 0.012), (0.016, 0.012)],
                      loc=(sx * 0.024, -0.027, 0.08), rot=(radians(90), 0, 0), material=M("brass"), parent=mask, segments=24)
        geo.cylinder(f"GF_Mask_Lens_{'L' if sx < 0 else 'R'}", 0.0165, 0.004, loc=(0, 0, 0.007), material=m["lens"], parent=g, verts=24, bevel=0)
    geo.curve_tube("GF_Mask_Bridge", [Vector((-0.008, -0.04, 0.086)), Vector((0, -0.043, 0.088)), Vector((0.008, -0.04, 0.086))], 0.003,
                   material=M("brass"), parent=mask, ring=6, steps=3)
    beak = geo.lathe("GF_Mask_Beak", [(0.03, 0), (0.027, 0.03), (0.02, 0.07), (0.012, 0.11), (0.005, 0.145), (0, 0.155)],
                     loc=(0, -0.02, 0.055), rot=(radians(108), 0, 0), scale=(1.0, 0.8, 1.0), material=M("leather_brown"), parent=mask, segments=20)
    for v in beak.data.vertices:                               # the beak curves down toward its tip
        v.co.y -= 0.45 * (v.co.z ** 2)

    # crystal ball on a brass stand (back-right), with a faint violet light inside
    stand = geo.lathe("GF_CrystalBall_Stand", [(0, 0), (0.055, 0), (0.055, 0.008), (0.036, 0.02), (0.03, 0.034), (0.044, 0.044), (0.038, 0.05), (0, 0.05)],
                      loc=top(0.24, 0.1), material=M("brass"), parent=root, segments=36)
    ball = geo.sphere("GF_CrystalBall", 0.064, loc=(0, 0, 0.036), material=m["glass"], parent=stand, segs=40)
    geo.sphere("GF_CrystalBall_Glow", 0.013, loc=(0, 0, 0.087), material=m["orb_glow"], parent=stand, segs=16)
    Lb = bpy.data.lights.new("LIGHT_GF_Orb", 'POINT')
    Lb.energy, Lb.color, Lb.shadow_soft_size = 1.6, (0.6, 0.35, 1.0), 0.03
    lb = bpy.data.objects.new("LIGHT_GF_Orb", Lb)
    lb.location = Vector(top(0.24, 0.1)) + Vector((0, 0, 0.1))
    S.coll("LIGHTS").objects.link(lb)

    # hourglass (front-right)
    hg = geo.cylinder("GF_Hourglass", 0.038, 0.01, loc=top(0.31, -0.14), material=M("wood_dark"), parent=root, verts=24, bevel=0.002)
    geo.cylinder("GF_Hourglass_Top", 0.038, 0.01, loc=(0, 0, 0.13), material=M("wood_dark"), parent=hg, verts=24, bevel=0.002)
    for k in range(3):
        a = k * 2 * pi / 3 + 0.4
        geo.cylinder(f"GF_Hourglass_Post_{k}", 0.0035, 0.12, loc=(cos(a) * 0.031, sin(a) * 0.031, 0.01), material=M("wood_dark"), parent=hg, verts=8, bevel=0)
    geo.lathe("GF_Hourglass_Glass", [(0.004, 0), (0.024, 0.008), (0.026, 0.03), (0.016, 0.05), (0.003, 0.06), (0.016, 0.07), (0.026, 0.09),
                                     (0.024, 0.112), (0.004, 0.12)], loc=(0, 0, 0.01), material=m["glass"], parent=hg, segments=24, loop=False)
    geo.lathe("GF_Hourglass_Sand", [(0, 0), (0.021, 0), (0.017, 0.016), (0, 0.028)], loc=(0, 0, 0.012), material=m["sand"], parent=hg, segments=20)
    geo.lathe("GF_Hourglass_SandTop", [(0, 0), (0.012, 0.0), (0.019, 0.012), (0, 0.014)], loc=(0, 0, 0.085), material=m["sand"], parent=hg, segments=20)

    # the brass moth, resting near the edge of the table
    moth = S.empty("GF_Moth", "PROPS", loc=top(0.17, -0.33), rot=(0, 0, radians(-20)), parent=root, size=0.02)
    geo.sphere("GF_Moth_Body", 0.006, scale=(1, 3.2, 1), material=M("brass"), parent=moth, segs=12)
    def wings(bm):
        for sx in (-1, 1):
            for fy, sz in ((0.006, 0.034), (-0.01, 0.024)):
                pts = [(0, 0), (sx * sz, fy + sz * 0.25), (sx * sz * 0.95, fy - sz * 0.35), (sx * sz * 0.2, fy - sz * 0.4)]
                vs = [bm.verts.new((x, y, 0.006)) for x, y in pts]
                bm.faces.new(vs if sx > 0 else list(reversed(vs)))
    geo.merged("GF_Moth_Wings", wings, material=M("brass"), parent=moth, bevel=0, uv="box", uv_scale=30)
    return cloth, red, blue, mask, hat, stand, hg, moth


# ---------------------------------------------------------------- the cabinet with the lantern and books
def build_cabinet(root, m):
    cx, cy = LEFT_X + 0.16, 0.28
    cab = geo.box("GF_Cabinet", (0.3, 0.4, 0.6), loc=(cx, cy, 0), material=M("wood_dark"), parent=root, bevel=0.01)
    for k in range(2):
        geo.box(f"GF_Cabinet_Drawer_{k}", (0.012, 0.34, 0.2), loc=(0.152, 0, 0.1 + k * 0.25), material=M("wood"), parent=cab, bevel=0.004)
        geo.cylinder(f"GF_Cabinet_Knob_{k}", 0.012, 0.02, loc=(0.16, 0, 0.2 + k * 0.25), rot=(0, radians(90), 0), material=M("brass"), parent=cab, verts=12)
    geo.box("GF_Cabinet_Top", (0.32, 0.42, 0.025), loc=(0, 0, 0.6), material=M("wood"), parent=cab, bevel=0.006)
    z = 0.625
    lamp = geo.lathe("GF_Lantern", [(0, 0), (0.05, 0), (0.05, 0.014), (0.04, 0.02), (0.034, 0.034), (0, 0.034)], loc=(cx + 0.02, cy - 0.06, z),
                     material=M("brass"), parent=root, segments=28)
    geo.lathe("GF_Lantern_Glass", [(0.03, 0), (0.042, 0.035), (0.042, 0.08), (0.028, 0.115)], loc=(0, 0, 0.034), material=m["glass"],
              parent=lamp, segments=28, loop=False)
    cap = geo.lathe("GF_Lantern_Cap", [(0, 0), (0.034, 0), (0.022, 0.03), (0.009, 0.05), (0, 0.05)], loc=(0, 0, 0.149), material=M("brass"), parent=lamp, segments=28)
    geo.curve_tube("GF_Lantern_Handle", [Vector((-0.02, 0, 0.05)), Vector((-0.012, 0, 0.075)), Vector((0.012, 0, 0.075)), Vector((0.02, 0, 0.05))],
                   0.0025, material=M("brass"), parent=cap, ring=6, steps=4)
    for k in range(4):
        a = k * pi / 2 + pi / 4
        geo.cylinder(f"GF_Lantern_Post_{k}", 0.0028, 0.115, loc=(cos(a) * 0.044, sin(a) * 0.044, 0.034), material=M("brass"), parent=lamp, verts=6, bevel=0)
    fl = geo.lathe("GF_Lantern_Flame", [(0, 0), (0.008, 0.006), (0.009, 0.016), (0.005, 0.03), (0, 0.04)], loc=(0, 0, 0.05), material=m["flame"],
                   parent=lamp, segments=12)
    fl.visible_shadow = False
    L = bpy.data.lights.new("LIGHT_GF_Lantern", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 14, (1.0, 0.62, 0.3), 0.03
    lo = bpy.data.objects.new("LIGHT_GF_Lantern", L)
    lo.location = (cx + 0.02, cy - 0.06, z + 0.075)
    S.coll("LIGHTS").objects.link(lo)
    for k, (bw, bd, bh, mt, rz) in enumerate([(0.2, 0.14, 0.035, "book_a", 6), (0.18, 0.13, 0.03, "book_b", -4)]):
        b = geo.box(f"GF_Cab_Book_{k}", (bw, bd, bh), loc=(cx - 0.02, cy + 0.12, z + k * 0.035), rot=(0, 0, radians(80 + rz)), material=m[mt], parent=root, bevel=0.003)
        geo.box(f"GF_Cab_Book_{k}_Pages", (bw - 0.012, bd - 0.008, bh - 0.008), loc=(0.006, 0, 0.004), material=M("pages"), parent=b, bevel=0.001)
    # books stacked on the floor, front-right
    for k, (bw, bd, bh, mt, rz) in enumerate([(0.26, 0.19, 0.05, "book_b", 8), (0.24, 0.17, 0.045, "book_a", -6), (0.2, 0.15, 0.04, "book_b", 14)]):
        z0 = sum([0.05, 0.045, 0.04][:k])
        b = geo.box(f"GF_Books_{k}", (bw, bd, bh), loc=(0.58, -0.56, z0), rot=(0, 0, radians(rz)), material=m[mt], parent=root, bevel=0.004)
        geo.box(f"GF_Books_{k}_Pages", (bw - 0.014, bd - 0.01, bh - 0.01), loc=(0.007, 0, 0.005), material=M("pages"), parent=b, bevel=0.001)
    return cab, lamp


# ---------------------------------------------------------------- physics shapes for the website
def _aabb(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def physics_shapes(props):
    r4 = lambda v: [round(x, 4) for x in v]
    out = [dict(t="box", c=[0.1, -0.12, -0.5], h=[W / 2 + 0.2, D / 2 + 0.22, 0.5], tag="floor"),
           dict(t="box", c=[0.1, BACK_Y + 0.5, H / 2], h=[W / 2 + 0.2, 0.5, H / 2], tag="wall"),
           dict(t="box", c=[LEFT_X - 0.5, 0, H / 2], h=[0.5, D / 2 + 0.2, H / 2], tag="wall"),
           dict(t="cyl", c=[TABLE["x"], TABLE["y"], TABLE["h"] / 2 + 0.002], hh=TABLE["h"] / 2 + 0.002, r=TABLE["r"], tag="cloth")]
    for tag, o in props:
        lo, hi = _aabb([o, *o.children_recursive])
        out.append(dict(t="box", c=r4((lo + hi) / 2), h=r4((hi - lo) / 2), tag=tag))
    return out


def build(root):
    m = materials()
    build_room(root, m)
    cloth, red, blue, mask, hat, stand, hg, moth = build_table(root, m)
    cab, lamp = build_cabinet(root, m)
    phys = S.empty("GF_Physics", "PROPS", parent=root, size=0.05)
    books = [o for o in bpy.data.objects if o.name.startswith("GF_Books_") and not o.name.endswith("Pages")]
    phys["phys_shapes"] = json.dumps(physics_shapes([("glass", stand), ("glass", hg), ("soft", hat), ("soft", mask), ("wood", cab), ("metal", lamp)]
                                                    + [("wood", b) for b in books]))
    phys["table"] = json.dumps(dict(x=TABLE["x"], y=TABLE["y"], r=TABLE["r"], h=TABLE["h"]))
    for obj, iid, label in [(red, "gf_die_red", "Red die"), (blue, "gf_die_blue", "Blue die"), (mask, "gf_mask", "The Fortune-Teller's Mask"),
                            (stand, "gf_ball", "Crystal Ball"), (lamp, "gf_lantern", "Oil Lantern"), (hg, "gf_hourglass", "Hourglass"),
                            (moth, "gf_moth", "Brass Moth"), (hat, "gf_hat", "Top Hat")]:
        S.mark_interactive(obj, iid, label, scope="glass-and-fortune", kind="discovery")
    return dict(table=cloth)
