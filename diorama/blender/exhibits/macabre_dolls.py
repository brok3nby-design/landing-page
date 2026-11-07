"""Macabre Dolls exhibit: the forgotten nursery from the game's cover art ("Some toys should stay forgotten").

A corner of an old nursery, cut away like a dollhouse: dark wood-panelled walls with cobwebs, a window with
the full moon and bare branches behind a lace curtain, an ornate wall mirror. On a lace doily in the middle,
three porcelain dolls in lace bonnets and dresses with hollow black eyes (two kneeling, one small one sitting
in front). Around them: a worn teddy bear with a ribbon, a rocking horse, a painted music box, wooden letter
blocks (C, D), a dollhouse, a chest with old books and a burning candle, a cracked hand mirror, a tipped
teacup and dried rose petals. In front of the dolls, a deck of MACABRE cards (the game's own card back).

For the website: draw cards from the deck (the faces are the studio's doll artwork), the dolls' heads turn
to watch you whenever the view is still, and the music box plays. The heads are separate pivots
(MD_Doll_N_Head) and the music-box lid is hinged (MD_MusicBox_Lid). Real-world scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos, sqrt
import os
import random
import numpy as np
import bmesh
import bpy
from mathutils import Vector, Matrix

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D, H = 1.5, 1.25, 1.2
BACK_Y, LEFT_X = D / 2, -W / 2
WIN = dict(y=0.05, w=0.46, z0=0.46, z1=1.02)               # window in the left wall
CARD = (0.075, 0.11)
ART = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "app", "public", "media", "projects", "macabre-dolls"))
CLOSEUPS = [("CAM_Exhibit_CloseDolls", ["MD_Doll_1", "MD_Doll_2", "MD_Doll_3", "MD_Deck"], 26, 18, 50, 0.85)]
LIGHT_GAIN = dict(key=3.6, fill=2.6, rim=2.0)
BAKE_HIDE = []
RNG = random.Random(66)


# ---------------------------------------------------------------- textures
def _art(name, file, crop=None, size=None):
    img = bpy.data.images.load(os.path.join(ART, file))
    if size:
        img.scale(*size)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    if crop:
        x0, y0, x1, y1 = crop
        a = a[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    c = T.Canvas(a.shape[1], a.shape[0])
    c.a[..., :3] = a[..., :3]
    return c.save(name)


def _tex_lace(name="md_lace", size=512, base="#d9ceb6"):
    """Aged cream lace: a lattice of little holes and scalloped rosettes."""
    c = T.Canvas(size, size, T.rgb(base))
    c.mul(0.88 + 0.16 * T.noise(size, size, 8, 61))
    hole = T.rgb("#8a7f6c")
    s = size / 48                                             # fine mesh: lathe UVs wrap the whole texture once
    for i in range(49):
        for j in range(49):
            x, y = i * s, j * s
            c.circle(x, y, s * 0.18, hole, 0.7)
            if (i + j) % 6 == 0:
                for k in range(6):
                    a = k * pi / 3
                    c.circle(x + s / 2 + cos(a) * s * 0.32, y + s / 2 + sin(a) * s * 0.32, s * 0.1, hole, 0.5)
    stain = np.clip((T.noise(size, size, 4, 62) - 0.5) * 2.5, 0, 1)
    c._blend(stain, T.rgb("#9d8a66"), 0.35)
    return c.save(name)


def _tex_night(name="md_night", w=512, h=640):
    c = T.Canvas(w, h)
    c.vgrad(0, h, T.rgb("#1a2236"), T.rgb("#3a4660"))
    mx, my = w * 0.36, h * 0.28
    for r, op in ((110, 0.06), (80, 0.1), (60, 0.16)):
        c.circle(mx, my, r, T.rgb("#c8d2f0"), op)
    c.circle(mx, my, 44, T.rgb("#eef0f2"))
    c.circle(mx - 10, my + 8, 10, T.rgb("#cfd3d8"), 0.6); c.circle(mx + 14, my - 10, 7, T.rgb("#cfd3d8"), 0.5)
    rng = random.Random(8)
    def branch(x, y, a, L, wdt, depth):
        if depth == 0 or L < 6:
            return
        x2, y2 = x + cos(a) * L, y + sin(a) * L
        c.line(x, y, x2, y2, wdt, T.rgb("#0a0c12"))
        for _ in range(2):
            branch(x2, y2, a + rng.uniform(-0.7, 0.7), L * rng.uniform(0.6, 0.8), max(1, wdt * 0.65), depth - 1)
    branch(w * 0.8, h, -pi / 2 - 0.15, 160, 18, 7)
    branch(w * 0.05, h, -pi / 2 + 0.3, 140, 14, 6)
    return c.save(name)


def _tex_fur(name="md_fur", size=512):
    c = T.Canvas(size, size, T.rgb("#6b4a2c"))
    c.mul(0.7 + 0.4 * T.noise(size, size, 30, 63))
    c.mul(0.85 + 0.2 * T.noise(size, size, 120, 64, aniso=(0.3, 1.0)))
    worn = np.clip((T.noise(size, size, 5, 65) - 0.6) * 3, 0, 1)
    c._blend(worn, T.rgb("#a08a6a"), 0.4)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=5.0, size=(256, 256), blur=0.6)


def _tex_musicbox(name="md_musicbox", w=512, h=320):
    """Painted lid: dark lacquer with faded roses and a gilt border."""
    c = T.Canvas(w, h, T.rgb("#2a1414"))
    c.mul(0.85 + 0.2 * T.noise(h, w, 6, 66))
    gold = T.rgb("#b8955a")
    c.rect(10, 10, w - 10, 16, gold, 0.9); c.rect(10, h - 16, w - 10, h - 10, gold, 0.9)
    c.rect(10, 10, 16, h - 10, gold, 0.9); c.rect(w - 16, 10, w - 10, h - 10, gold, 0.9)
    rng = random.Random(4)
    for _ in range(7):
        x, y, r = rng.uniform(60, w - 60), rng.uniform(60, h - 60), rng.uniform(18, 30)
        for k in range(5):
            a = k * 2 * pi / 5
            c.circle(x + cos(a) * r * 0.5, y + sin(a) * r * 0.5, r * 0.55, T.rgb("#7a2030"), 0.75)
        c.circle(x, y, r * 0.35, T.rgb("#a83a45"), 0.8)
        c.line(x, y + r, x + rng.uniform(-30, 30), y + r + 30, 3, T.rgb("#3a4a2a"), 0.7)
    return c.save(name)


def _tex_cracked(name="md_cracked", size=256):
    c = T.Canvas(size, size, T.rgb("#3c4248"))
    c.vgrad(0, size, T.rgb("#5a646e"), T.rgb("#2a3036"))
    rng = random.Random(12)
    cx, cy = size * 0.4, size * 0.45
    for _ in range(9):
        a = rng.uniform(0, 2 * pi)
        x, y = cx, cy
        for _ in range(6):
            a += rng.uniform(-0.4, 0.4)
            nx, ny = x + cos(a) * rng.uniform(12, 30), y + sin(a) * rng.uniform(12, 30)
            c.line(x, y, nx, ny, 1.5, T.rgb("#e8eef2"), 0.85)
            x, y = nx, ny
    return c.save(name)


def textures():
    out = {}
    out["md_lace"] = _tex_lace()
    out["md_lace_dark"] = _tex_lace("md_lace_dark", base="#b8ab92")
    out["md_night"] = _tex_night()
    out["md_fur"], out["md_fur_n"] = _tex_fur()
    out["md_musicbox"] = _tex_musicbox()
    out["md_cracked"] = _tex_cracked()
    out["md_cardback"] = _art("md_cardback", "gallery/creepy-dolls_8.webp", crop=(0.045, 0.011, 0.983, 0.986))
    out["md_block_c"] = T.label_card("md_block_c", 256, 256, [("C", 26)], "#c9b48a", "#7a1e1e", border=True)
    out["md_block_d"] = T.label_card("md_block_d", 256, 256, [("D", 26)], "#c9b48a", "#1e3a6a", border=True)
    TEX.update(out)
    return out


def materials():
    return dict(
        wall=mat("M_md_wall", tex="planks", rough=0.7, normal="planks_n", normal_strength=0.5, tint=(0.22, 0.16, 0.14)),
        floor=mat("M_md_floor", tex="planks", rough=0.6, normal="planks_n", normal_strength=0.6, tint=(0.32, 0.24, 0.2)),
        night=mat("M_md_night", color=(0, 0, 0), rough=0.9, emit_tex="md_night", strength=0.5),
        lace=mat("M_md_lace", tex="md_lace", rough=0.85),
        lace_dark=mat("M_md_lace_dark", tex="md_lace_dark", rough=0.85),
        curtain=mat("M_md_curtain", color=(0.86, 0.82, 0.74), rough=0.9, alpha=0.72),
        porcelain=mat("M_md_porcelain", color=(0.88, 0.85, 0.8), rough=0.22),
        eye=mat("M_md_eye", color=(0.005, 0.005, 0.006), rough=0.04),
        lips=mat("M_md_lips", color=(0.45, 0.2, 0.2), rough=0.4),
        blush=mat("M_md_blush", color=(0.78, 0.6, 0.56), rough=0.3),
        hair=mat("M_md_hair", color=(0.03, 0.025, 0.025), rough=0.5),
        ribbon=mat("M_md_ribbon", color=(0.72, 0.6, 0.52), rough=0.45),
        fur=mat("M_md_fur", tex="md_fur", rough=1.0, normal="md_fur_n", normal_strength=1.0),
        bow=mat("M_md_bow", color=(0.32, 0.03, 0.06), rough=0.5),
        horse=mat("M_md_horse", color=(0.32, 0.18, 0.1), rough=0.6),
        saddle=mat("M_md_saddle", color=(0.4, 0.05, 0.06), rough=0.5),
        musicbox=mat("M_md_musicbox", tex="md_musicbox", rough=0.35),
        lacquer=mat("M_md_lacquer", color=(0.1, 0.04, 0.04), rough=0.35),
        velvet=mat("M_md_velvet", color=(0.28, 0.02, 0.05), rough=0.95),
        gilt=mat("M_md_gilt", color=(0.72, 0.55, 0.3), rough=0.35, metal=0.9),
        mirror=mat("M_md_mirror", color=(0.55, 0.58, 0.62), rough=0.06, metal=1.0),
        cracked=mat("M_md_cracked", tex="md_cracked", rough=0.15, metal=0.6),
        house=mat("M_md_house", color=(0.62, 0.56, 0.46), rough=0.8),
        roof=mat("M_md_roof", color=(0.18, 0.12, 0.1), rough=0.8),
        dark_window=mat("M_md_dark_window", color=(0.02, 0.02, 0.025), rough=0.2),
        candle=mat("M_md_candle", color=(0.88, 0.83, 0.7), rough=0.6),
        flame=mat("M_md_flame", color=(1.0, 0.6, 0.25), emit=(1.0, 0.55, 0.2), strength=14),
        cardback=mat("M_md_cardback", tex="md_cardback", rough=0.5),
        card_edge=mat("M_md_card_edge", color=(0.75, 0.7, 0.6), rough=0.7),
        petal=mat("M_md_petal", color=(0.25, 0.02, 0.04), rough=0.7),
        web=mat("M_md_web", color=(0.75, 0.75, 0.75), rough=0.9),
        china=mat("M_md_china", color=(0.86, 0.84, 0.8), rough=0.2),
        block_c=mat("M_md_block_c", tex="md_block_c", rough=0.7),
        block_d=mat("M_md_block_d", tex="md_block_d", rough=0.7),
        block=mat("M_md_block", color=(0.66, 0.54, 0.36), rough=0.7),
        plinth=mat("M_md_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
    )


# ---------------------------------------------------------------- the room
def build_room(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("MD_Plinth", (W + 0.4, D + 0.42, 0.16), loc=(0.1, -0.12, -0.21), material=m["plinth"], bevel=0.02, **p)
    geo.box("MD_Floor", (W + 0.2, D + 0.22, 0.05), loc=(0.08, -0.09, -0.05), material=m["floor"], bevel=0.006, **p)
    t = 0.06
    geo.box("MD_Wall_Back", (W + 0.1 + t, t, H), loc=(0.05 - t / 2, BACK_Y + t / 2, 0), material=m["wall"], bevel=0, uv="box", uv_swap=True, uv_scale=1.4, **p)
    y0, y1 = WIN["y"] - WIN["w"] / 2, WIN["y"] + WIN["w"] / 2
    for nm, a, b, z0, z1 in [("Front", -D / 2 - 0.05, y0, 0, H), ("Back", y1, BACK_Y, 0, H), ("Below", y0, y1, 0, WIN["z0"]), ("Above", y0, y1, WIN["z1"], H)]:
        geo.box(f"MD_Wall_Left_{nm}", (t, b - a, z1 - z0), loc=(LEFT_X - t / 2, (a + b) / 2, z0), material=m["wall"], bevel=0, uv="box", uv_swap=True, uv_scale=1.4, **p)
    wood = M("wood_dark")
    for nm, dims, loc in [("Base_Back", (W + 0.1, 0.025, 0.08), (0.05, BACK_Y - 0.012, 0)), ("Base_Left", (0.025, D + 0.1, 0.08), (LEFT_X + 0.012, -0.05, 0)),
                          ("Rail_Back", (W + 0.1, 0.03, 0.03), (0.05, BACK_Y - 0.015, 0.4)), ("Rail_Left_F", (0.03, y0 + D / 2 + 0.05, 0.03), (LEFT_X + 0.015, (y0 - D / 2 - 0.05) / 2, 0.4)),
                          ("Rail_Left_B", (0.03, BACK_Y - y1, 0.03), (LEFT_X + 0.015, (y1 + BACK_Y) / 2, 0.4)),
                          ("Crown_Back", (W + 0.1, 0.045, 0.045), (0.05, BACK_Y - 0.022, H - 0.045)), ("Crown_Left", (0.045, D + 0.1, 0.045), (LEFT_X + 0.022, -0.05, H - 0.045))]:
        geo.box(f"MD_{nm}", dims, loc=loc, material=wood, bevel=0.004, **p)
    # the window: night outside, frame, the lace curtain
    geo.box("MD_Night", (0.01, WIN["w"] + 0.3, WIN["z1"] - WIN["z0"] + 0.3), loc=(LEFT_X - 0.2, WIN["y"], WIN["z0"] - 0.15), material=m["night"], bevel=0,
            uv="fit", fit_axis=0, **p)
    def frame(bm):
        x = LEFT_X - 0.03
        for yy in (y0 + 0.012, y1 - 0.012, WIN["y"]):
            geo.add_box(bm, (0.04, 0.024 if yy != WIN["y"] else 0.012, WIN["z1"] - WIN["z0"]), (x, yy, WIN["z0"]))
        for zz in (WIN["z0"], WIN["z1"] - 0.024, (WIN["z0"] + WIN["z1"]) / 2):
            geo.add_box(bm, (0.04, WIN["w"], 0.024 if zz in (WIN["z0"], WIN["z1"] - 0.024) else 0.012), (x, WIN["y"], zz))
        geo.add_box(bm, (0.07, WIN["w"] + 0.08, 0.02), (LEFT_X + 0.01, WIN["y"], WIN["z0"] - 0.02))
    geo.merged("MD_Window_Frame", frame, material=wood, bevel=0.002, seg=1, **p)
    geo.box("MD_Window_Glass", (0.004, WIN["w"] - 0.03, WIN["z1"] - WIN["z0"] - 0.03), loc=(LEFT_X - 0.035, WIN["y"], WIN["z0"] + 0.015), material=M("glass"), bevel=0, **p)
    hgt = WIN["z1"] + 0.08
    for side in (-1, 1):
        def deform(x, y, side=side):
            tt = (y + hgt / 2) / hgt
            gather = 1.0 - 0.3 * np.exp(-((tt - 0.45) ** 2) / 0.02)
            return (0.015 * sin(x * 60) * (0.4 + 0.6 * (1 - tt)), x * gather + side * 0.02 * (1 - gather), y)
        cur = geo.grid(f"MD_Curtain_{'F' if side < 0 else 'B'}", 0.2, hgt, 24, 30, material=m["curtain"], parent=root, deform=deform, thickness=0.003)
        cur.location = (LEFT_X + 0.05, WIN["y"] + side * (WIN["w"] / 2 + 0.02), hgt / 2 + 0.01)
    geo.cylinder("MD_Curtain_Rod", 0.008, WIN["w"] + 0.5, loc=(LEFT_X + 0.05, WIN["y"] - (WIN["w"] + 0.5) / 2, hgt + 0.01), rot=(radians(-90), 0, 0),
                 material=M("brass"), parent=root, verts=10)
    L = bpy.data.lights.new("LIGHT_MD_Moon", 'AREA')
    L.energy, L.color, L.size = 8, (0.6, 0.7, 1.0), 0.35
    lo = bpy.data.objects.new("LIGHT_MD_Moon", L)
    lo.location = (LEFT_X - 0.12, WIN["y"], 0.8)
    lo.rotation_euler = (0, radians(-70), 0)
    S.coll("LIGHTS").objects.link(lo)
    # cobwebs in the top corner
    def webs(bm):
        cx, cy, cz = LEFT_X + 0.03, BACK_Y - 0.03, H - 0.05
        spokes = [Vector((0.25, 0, -0.05)), Vector((0.18, -0.18, -0.08)), Vector((0, -0.24, -0.06)), Vector((0.06, -0.06, -0.26)), Vector((0.2, 0, -0.2))]
        for sp in spokes:
            pts = [Vector((cx, cy, cz)) + sp * t for t in np.linspace(0, 1, 6)]
            for a, b in zip(pts, pts[1:]):
                v = b - a
                geo.add_cyl(bm, 0.0012, v.length, a, v.to_track_quat('Z', 'Y').to_euler(), verts=4)
        for r in (0.3, 0.55, 0.8):
            for a_, b_ in zip(spokes, spokes[1:]):
                p0, p1 = Vector((cx, cy, cz)) + a_ * r, Vector((cx, cy, cz)) + b_ * r
                mid = (p0 + p1) / 2 + Vector((0.01, -0.01, -0.012)) * r
                for q0, q1 in ((p0, mid), (mid, p1)):
                    v = q1 - q0
                    geo.add_cyl(bm, 0.0009, v.length, q0, v.to_track_quat('Z', 'Y').to_euler(), verts=4)
    geo.merged("MD_Cobwebs", webs, material=m["web"], parent=root, bevel=0)
    # the ornate wall mirror
    mx, mz = 0.32, 0.74
    pts = [Vector((mx + cos(a) * 0.13, BACK_Y - 0.012, mz + sin(a) * 0.19)) for a in np.linspace(0, 2 * pi, 33)[:-1]]
    fr = geo.curve_tube("MD_Mirror", pts + pts[:1], 0.016, material=m["gilt"], parent=root, ring=8, steps=2)
    geo.sphere("MD_Mirror_Glass", 0.125, loc=(mx, BACK_Y - 0.008, mz - 0.18), scale=(1.0, 0.03, 1.45), material=m["mirror"], parent=root, segs=32)
    for k in range(5):                                         # little scrolls on top
        a = pi / 2 + (k - 2) * 0.22
        geo.sphere(f"MD_Mirror_Scroll_{k}", 0.012, loc=(mx + cos(a) * 0.15, BACK_Y - 0.014, mz + sin(a) * 0.21 - 0.012), material=m["gilt"], parent=root, segs=10)
    return fr


# ---------------------------------------------------------------- the dolls
def doll(root, m, name, loc, rz, s, kneel=True, hair=True):
    grp = S.empty(name, "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.05 * s)
    waist = (0.22 if kneel else 0.14) * s
    hem = (0.17 if kneel else 0.2) * s
    skirt = [(0, 0), (hem, 0), (hem, 0.015 * s), (hem * 0.82, 0.06 * s), (hem * 0.58, waist * 0.7), (0.065 * s, waist), (0, waist)]
    geo.lathe(f"{name}_Skirt", skirt, material=m["lace"], parent=grp, segments=36)
    for k, z in enumerate((0.012 * s, waist * 0.45)):          # lace frills on the skirt
        r = hem * (1.0 if k == 0 else 0.72) + 0.006 * s
        ring = [Vector((cos(a) * r, sin(a) * r, z)) for a in np.linspace(0, 2 * pi, 41)]
        geo.curve_tube(f"{name}_Frill_{k}", ring, 0.012 * s, material=m["lace_dark"], parent=grp, ring=6, steps=1, flatten=0.5)
    top = waist + 0.15 * s
    torso = [(0, waist - 0.01 * s), (0.06 * s, waist - 0.01 * s), (0.068 * s, waist + 0.06 * s), (0.073 * s, top - 0.05 * s),
             (0.066 * s, top - 0.015 * s), (0.04 * s, top), (0, top)]
    geo.lathe(f"{name}_Bodice", torso, material=m["lace"], parent=grp, segments=28)
    sash = [Vector((cos(a) * 0.069 * s, sin(a) * 0.069 * s, waist + 0.005 * s)) for a in np.linspace(0, 2 * pi, 29)]
    geo.curve_tube(f"{name}_Sash", sash, 0.009 * s, material=m["ribbon"], parent=grp, ring=6, steps=1, flatten=0.6)
    collar = [Vector((cos(a) * 0.05 * s, sin(a) * 0.05 * s, top - 0.004 * s)) for a in np.linspace(0, 2 * pi, 25)]
    geo.curve_tube(f"{name}_Collar", collar, 0.013 * s, material=m["lace_dark"], parent=grp, ring=6, steps=1, flatten=0.5)
    # ribbon bow at the collar
    for sx in (-1, 1):
        geo.sphere(f"{name}_Bow_{'L' if sx < 0 else 'R'}", 0.012 * s, loc=(sx * 0.014 * s, -0.05 * s, top - 0.03 * s), scale=(1.4, 0.5, 0.9), material=m["ribbon"], parent=grp, segs=10)
    for sx in (-1, 1):                                         # puffed sleeves, arms resting on the lap, hands
        sh = Vector((sx * 0.088 * s, 0, top - 0.03 * s))
        geo.sphere(f"{name}_Sleeve_{'L' if sx < 0 else 'R'}", 0.034 * s, loc=sh - Vector((0, 0, 0.034 * s)), material=m["lace"], parent=grp, segs=14)
        hand = Vector((sx * 0.04 * s, -0.11 * s, waist + 0.005 * s))
        elbow = Vector((sx * 0.1 * s, -0.04 * s, waist + 0.03 * s))
        geo.curve_tube(f"{name}_Arm_{'L' if sx < 0 else 'R'}", [sh - Vector((0, 0, 0.03 * s)), elbow, hand], 0.013 * s, material=m["porcelain"], parent=grp, ring=8, steps=4)
        geo.sphere(f"{name}_Hand_{'L' if sx < 0 else 'R'}", 0.018 * s, loc=hand - Vector((0, 0, 0.012 * s)), scale=(0.9, 1.2, 0.7), material=m["porcelain"], parent=grp, segs=10)
    if not kneel:                                              # the little one sits: shoes peek out of the hem
        for sx in (-1, 1):
            geo.sphere(f"{name}_Shoe_{'L' if sx < 0 else 'R'}", 0.02 * s, loc=(sx * 0.045 * s, -hem - 0.005 * s, 0), scale=(0.9, 1.5, 0.8), material=M("vinyl_black"), parent=grp, segs=10)
    geo.cylinder(f"{name}_Neck", 0.022 * s, 0.035 * s, loc=(0, 0, top - 0.005 * s), material=m["porcelain"], parent=grp, verts=14, bevel=0)
    # ---- the head: its own pivot so the website can turn it
    head = S.empty(f"{name}_Head", "PROPS", loc=(0, 0, top + 0.025 * s), parent=grp, size=0.03 * s)
    R = 0.07 * s
    face = geo.sphere(f"{name}_Face", R, loc=(0, 0, -0.008 * s), scale=(0.95, 0.9, 0.98), material=m["porcelain"], parent=head, segs=36)
    for v in face.data.vertices:                               # a child's face: full cheeks, a softer chin
        zn = (v.co.z - R) / R                                  # -1 chin .. +1 crown
        if zn < -0.1:
            v.co.x *= 1.0 - 0.18 * (-zn - 0.1)
        if -0.55 < zn < 0.05 and v.co.y < 0:
            v.co.y *= 1.06
    face.data.update()
    cz = R * 0.98 - 0.008 * s                                  # centre height of the face
    for sx in (-1, 1):                                         # big, hollow, black, glossy (as on the cover)
        geo.sphere(f"{name}_Eye_{'L' if sx < 0 else 'R'}", 0.0175 * s, loc=(sx * 0.026 * s, -0.051 * s, cz - 0.004 * s - 0.0175 * s), scale=(1.0, 0.7, 1.12),
                   material=m["eye"], parent=head, segs=16)
        geo.sphere(f"{name}_Blush_{'L' if sx < 0 else 'R'}", 0.012 * s, loc=(sx * 0.035 * s, -0.052 * s, cz - 0.038 * s), scale=(1.2, 0.3, 0.8),
                   material=m["blush"], parent=head, segs=10)
    geo.sphere(f"{name}_Nose", 0.006 * s, loc=(0, -0.064 * s, cz - 0.03 * s), scale=(1.0, 0.8, 1.1), material=m["porcelain"], parent=head, segs=10)
    geo.box(f"{name}_Mouth", (0.011 * s, 0.003 * s, 0.0035 * s), loc=(0, -0.0615 * s, cz - 0.05 * s), material=m["lips"], parent=head, bevel=0.0008 * s)
    # bonnet: a shell over the back and top of the head, open at the front, with a frilled brim
    Rb = R * 1.16
    def bonnet(bm):
        vs = bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=16, radius=Rb)["verts"]
        bmesh.ops.delete(bm, geom=[v for v in vs if v.co.y < -0.3 * Rb or v.co.z < -0.55 * Rb], context='VERTS')
        bmesh.ops.translate(bm, vec=Vector((0, 0.008 * s, cz + 0.008 * s)), verts=bm.verts)
    geo.merged(f"{name}_Bonnet", bonnet, material=m["lace"], parent=head, bevel=0, uv="box", uv_scale=12 / s)
    rr = sqrt(1 - 0.3 ** 2) * Rb
    brim = [Vector((cos(a) * rr, -0.3 * Rb + 0.008 * s, cz + 0.008 * s + sin(a) * rr)) for a in np.linspace(radians(-35), radians(215), 30)]
    geo.curve_tube(f"{name}_Brim", brim, 0.016 * s, material=m["lace_dark"], parent=head, ring=6, steps=2, flatten=0.45)
    for sx in (-1, 1):                                         # ties under the chin
        geo.curve_tube(f"{name}_Tie_{'L' if sx < 0 else 'R'}", [Vector((sx * 0.06 * s, -0.01 * s, cz - 0.03 * s)), Vector((sx * 0.03 * s, -0.04 * s, cz - 0.07 * s)),
                       Vector((sx * 0.008 * s, -0.05 * s, cz - 0.075 * s))], 0.004 * s, material=m["ribbon"], parent=head, ring=6, steps=4)
    if hair:                                                   # long dark hair falling past the shoulders
        rng = random.Random(len(name) * 7 + int(s * 100))
        def strands(bm):
            for k in range(16):
                a = radians(-70 + k * (140 / 15))
                x0 = sin(a) * R * 0.95
                y0 = cos(a) * R * 0.6 + 0.01 * s
                pts = [Vector((x0, y0, cz - 0.01 * s)), Vector((x0 * 1.15, y0 + 0.01 * s, cz - 0.07 * s)),
                       Vector((x0 * 1.25 + rng.uniform(-0.01, 0.01) * s, y0 + 0.005 * s, cz - 0.15 * s - rng.uniform(0, 0.04) * s))]
                for p0, p1 in zip(pts, pts[1:]):
                    v = p1 - p0
                    geo.add_cyl(bm, 0.012 * s, v.length, p0, v.to_track_quat('Z', 'Y').to_euler(), verts=6, r_top=0.009 * s)
        geo.merged(f"{name}_Hair", strands, material=m["hair"], parent=head, bevel=0)
    return grp, head


# ---------------------------------------------------------------- the toys around them
def teddy(root, m, loc, rz):
    g = S.empty("MD_Teddy", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.05)
    f = m["fur"]
    geo.sphere("MD_Teddy_Body", 0.085, scale=(1.0, 0.85, 1.15), material=f, parent=g, segs=24)
    geo.sphere("MD_Teddy_Head", 0.068, loc=(0, -0.01, 0.17), material=f, parent=g, segs=24)
    for sx in (-1, 1):
        geo.sphere(f"MD_Teddy_Ear_{'L' if sx < 0 else 'R'}", 0.026, loc=(sx * 0.052, 0.0, 0.27), scale=(1, 0.6, 1), material=f, parent=g, segs=12)
        geo.sphere(f"MD_Teddy_Arm_{'L' if sx < 0 else 'R'}", 0.032, loc=(sx * 0.085, -0.03, 0.06), scale=(0.8, 0.9, 1.6), material=f, parent=g, segs=12)
        geo.sphere(f"MD_Teddy_Leg_{'L' if sx < 0 else 'R'}", 0.04, loc=(sx * 0.055, -0.07, 0.0), scale=(0.95, 1.4, 0.8), material=f, parent=g, segs=12)
        geo.sphere(f"MD_Teddy_Eye_{'L' if sx < 0 else 'R'}", 0.008, loc=(sx * 0.024, -0.068, 0.21), material=M("vinyl_black"), parent=g, segs=8)
    geo.sphere("MD_Teddy_Snout", 0.028, loc=(0, -0.06, 0.165), scale=(1.1, 0.8, 0.8), material=m["lace_dark"], parent=g, segs=12)
    geo.sphere("MD_Teddy_Nose", 0.009, loc=(0, -0.085, 0.19), material=M("vinyl_black"), parent=g, segs=8)
    for sx in (-1, 1):
        geo.sphere(f"MD_Teddy_Bow_{'L' if sx < 0 else 'R'}", 0.022, loc=(sx * 0.022, -0.06, 0.12), scale=(1.4, 0.5, 0.9), material=m["bow"], parent=g, segs=10)
    return g


def rocking_horse(root, m, loc, rz):
    g = S.empty("MD_RockingHorse", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.05)
    for sy in (-1, 1):                                         # the two rockers
        pts = [Vector((x, sy * 0.055, 0.012 + 0.11 * (x / 0.26) ** 2)) for x in np.linspace(-0.26, 0.26, 13)]
        geo.curve_tube(f"MD_Horse_Rocker_{'L' if sy < 0 else 'R'}", pts, 0.011, material=M("wood_dark"), parent=g, ring=6, steps=2, flatten=0.4)
    geo.sphere("MD_Horse_Body", 0.07, loc=(0, 0, 0.17), scale=(2.1, 0.85, 0.9), material=m["horse"], parent=g, segs=20)
    for sx in (-1, 1):
        for sy in (-1, 1):
            a, b = Vector((sx * 0.1, sy * 0.035, 0.2)), Vector((sx * 0.16, sy * 0.05, 0.03))
            v = b - a
            geo.cylinder(f"MD_Horse_Leg_{sx}_{sy}", 0.012, v.length, loc=a, rot=v.to_track_quat('Z', 'Y').to_euler(), material=m["horse"], parent=g, verts=8, bevel=0)
    geo.curve_tube("MD_Horse_Neck", [Vector((-0.12, 0, 0.24)), Vector((-0.17, 0, 0.32)), Vector((-0.18, 0, 0.37))], 0.03, material=m["horse"], parent=g, ring=10, steps=4)
    geo.sphere("MD_Horse_Head", 0.04, loc=(-0.21, 0, 0.34), scale=(1.5, 0.7, 0.8), material=m["horse"], parent=g, segs=16)
    geo.curve_tube("MD_Horse_Mane", [Vector((-0.1, 0, 0.27)), Vector((-0.15, 0, 0.35)), Vector((-0.17, 0, 0.41))], 0.012, material=m["hair"], parent=g, ring=6, steps=4, flatten=0.5)
    geo.box("MD_Horse_Saddle", (0.09, 0.105, 0.012), loc=(0.0, 0, 0.225), material=m["saddle"], parent=g, bevel=0.004)
    for sy in (-1, 1):
        geo.sphere(f"MD_Horse_Eye_{sy}", 0.006, loc=(-0.24, sy * 0.025, 0.36), material=M("vinyl_black"), parent=g, segs=8)
    return g


def music_box(root, m, loc, rz):
    g = S.empty("MD_MusicBox", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.04)
    w, d, h = 0.17, 0.115, 0.07
    geo.box("MD_MusicBox_Body", (w, d, h), material=m["lacquer"], parent=g, bevel=0.004)
    geo.box("MD_MusicBox_Velvet", (w - 0.02, d - 0.02, 0.004), loc=(0, 0, h - 0.004), material=m["velvet"], parent=g, bevel=0)
    geo.cylinder("MD_MusicBox_Drum", 0.012, 0.08, loc=(-0.04, 0.02, h - 0.016), rot=(0, radians(90), 0), material=m["gilt"], parent=g, verts=14, bevel=0)
    def trim(bm):
        for z in (0.0, h - 0.008):
            for sy in (-1, 1):
                geo.add_box(bm, (w + 0.004, 0.004, 0.008), (0, sy * d / 2, z))
            for sx in (-1, 1):
                geo.add_box(bm, (0.004, d + 0.004, 0.008), (sx * w / 2, 0, z))
        for sx in (-1, 1):
            for sy in (-1, 1):
                geo.add_box(bm, (0.012, 0.012, h), (sx * (w / 2 - 0.004), sy * (d / 2 - 0.004), 0))
    geo.merged("MD_MusicBox_Trim", trim, material=m["gilt"], parent=g, bevel=0.001)
    crank = geo.cylinder("MD_MusicBox_Crank", 0.004, 0.025, loc=(w / 2, 0, h * 0.5), rot=(0, radians(90), 0), material=m["gilt"], parent=g, verts=8, bevel=0)
    geo.curve_tube("MD_MusicBox_CrankArm", [Vector((0, 0, 0.025)), Vector((0, 0.025, 0.028)), Vector((0, 0.025, 0.04))], 0.003, material=m["gilt"], parent=crank, ring=6, steps=3)
    lid = S.empty("MD_MusicBox_Lid", "PROPS", loc=(0, d / 2, h), parent=g, size=0.03)
    geo.box("MD_MusicBox_LidBox", (w + 0.006, d + 0.006, 0.022), loc=(0, -d / 2, 0), material=m["lacquer"], parent=lid, bevel=0.004)
    geo.box("MD_MusicBox_LidArt", (w - 0.012, d - 0.012, 0.002), loc=(0, -d / 2, 0.022), material=m["musicbox"], parent=lid, bevel=0, uv="fit", fit_axis=2)
    return g


def dollhouse(root, m, loc, rz):
    g = S.empty("MD_Dollhouse", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.05)
    w, d, h = 0.3, 0.2, 0.28
    geo.box("MD_House_Body", (w, d, h), material=m["house"], parent=g, bevel=0.004)
    roof = [(-w / 2 - 0.02, 0), (w / 2 + 0.02, 0), (0, 0.13)]
    def roof_mesh(bm):
        front = [bm.verts.new((x, -d / 2 - 0.015, h + z)) for x, z in roof]
        back = [bm.verts.new((x, d / 2 + 0.015, h + z)) for x, z in roof]
        bm.faces.new(front); bm.faces.new(list(reversed(back)))
        for k in range(3):
            bm.faces.new((front[k], front[(k + 1) % 3], back[(k + 1) % 3], back[k]))
    geo.merged("MD_House_Roof", roof_mesh, material=m["roof"], parent=g, bevel=0.003)
    geo.box("MD_House_Chimney", (0.03, 0.03, 0.08), loc=(0.08, 0.04, h + 0.04), material=m["roof"], parent=g, bevel=0.002)
    def windows(bm):
        for (x, z, ww, hh) in ((-0.08, 0.17, 0.05, 0.06), (0.08, 0.17, 0.05, 0.06), (-0.08, 0.05, 0.05, 0.06), (0.0, 0.215, 0.03, 0.03)):
            geo.add_box(bm, (ww, 0.004, hh), (x, -d / 2 - 0.001, z))
        geo.add_box(bm, (0.05, 0.004, 0.1), (0.075, -d / 2 - 0.001, 0.0))                # the door
    geo.merged("MD_House_Windows", windows, material=m["dark_window"], parent=g, bevel=0)
    def frames(bm):
        for (x, z, ww, hh) in ((-0.08, 0.17, 0.05, 0.06), (0.08, 0.17, 0.05, 0.06), (-0.08, 0.05, 0.05, 0.06)):
            for zz in (z - 0.004, z + hh):
                geo.add_box(bm, (ww + 0.012, 0.008, 0.006), (x, -d / 2 - 0.002, zz))
            geo.add_box(bm, (0.004, 0.008, hh), (x, -d / 2 - 0.002, z))
    geo.merged("MD_House_Frames", frames, material=M("wood_light"), parent=g, bevel=0)
    return g


def chest_and_candle(root, m, loc, rz):
    from parts.desk_props import flat_book
    g = S.empty("MD_Chest", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.05)
    geo.box("MD_Chest_Body", (0.36, 0.24, 0.26), material=M("wood_dark"), parent=g, bevel=0.008)
    geo.box("MD_Chest_Lid", (0.37, 0.25, 0.03), loc=(0, 0, 0.26), material=M("wood_dark"), parent=g, bevel=0.006)
    for sx in (-1, 1):
        geo.box(f"MD_Chest_Band_{sx}", (0.02, 0.252, 0.29), loc=(sx * 0.13, 0, 0.0), material=M("metal_dark"), parent=g, bevel=0.002)
    top = 0.29
    flat_book(g, "MD_Book_0", (0.22, 0.16, 0.04), "book_cover", (-0.03, 0.01, top), rests_on=None)
    flat_book(g, "MD_Book_1", (0.19, 0.14, 0.035), "book_green", (-0.02, 0.0, top + 0.04), rot_z=0.15, rests_on=None)
    holder = geo.lathe("MD_Candle_Holder", [(0, 0), (0.045, 0), (0.045, 0.006), (0.015, 0.012), (0.012, 0.03), (0.02, 0.034), (0, 0.034)],
                       loc=(0.11, -0.03, top), material=M("brass"), parent=g, segments=24)
    cnd = geo.cylinder("MD_Candle", 0.016, 0.1, loc=(0, 0, 0.034), material=m["candle"], parent=holder, verts=16, bevel=0.002)
    for k in range(3):                                         # drips
        a = k * 2.1 + 0.4
        geo.sphere(f"MD_Candle_Drip_{k}", 0.004, loc=(cos(a) * 0.016, sin(a) * 0.016, 0.06 - k * 0.012), scale=(1, 1, 2.2), material=m["candle"], parent=cnd, segs=8)
    fl = geo.lathe("MD_Candle_Flame", [(0, 0), (0.006, 0.006), (0.0065, 0.014), (0.003, 0.026), (0, 0.032)], loc=(0, 0, 0.102), material=m["flame"], parent=cnd, segments=12)
    fl.visible_shadow = False
    L = bpy.data.lights.new("LIGHT_MD_Candle", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 9, (1.0, 0.62, 0.3), 0.015
    lo = bpy.data.objects.new("LIGHT_MD_Candle", L)
    bpy.context.view_layer.update()
    lo.location = fl.matrix_world.translation + Vector((0, 0, 0.02))
    S.coll("LIGHTS").objects.link(lo)
    return g


def floor_things(root, m):
    geo.cylinder("MD_Doily", 0.36, 0.004, loc=(-0.02, -0.05, 0), material=m["lace"], parent=root, verts=48, bevel=0.001, uv="box", uv_scale=2.5)
    # wooden letter blocks C and D (one stacked)
    for k, (nm, mt, loc, rz) in enumerate((("MD_Block_C", "block_c", (0.4, -0.42, 0), 18), ("MD_Block_D", "block_d", (0.5, -0.33, 0), -12),
                                           ("MD_Block_C2", "block_c", (0.5, -0.33, 0.07), 34))):
        b = geo.box(nm, (0.07, 0.07, 0.07), loc=loc, rot=(0, 0, radians(rz)), material=m["block"], parent=root, bevel=0.005)
        geo.box(nm + "_Front", (0.056, 0.002, 0.056), loc=(0, -0.0355, 0.007), material=m[mt], parent=b, bevel=0, uv="fit", fit_axis=1)
        geo.box(nm + "_Top", (0.056, 0.056, 0.002), loc=(0, 0, 0.0705), material=m["block_d" if mt == "block_c" else "block_c"], parent=b, bevel=0, uv="fit", fit_axis=2)
    # the cracked hand mirror
    hm = S.empty("MD_HandMirror", "PROPS", loc=(0.17, -0.4, 0.004), rot=(0, 0, radians(-30)), parent=root, size=0.03)
    ring = [Vector((cos(a) * 0.055, sin(a) * 0.075, 0.006)) for a in np.linspace(0, 2 * pi, 33)]
    geo.curve_tube("MD_HandMirror_Frame", ring, 0.008, material=m["gilt"], parent=hm, ring=6, steps=1)
    geo.sphere("MD_HandMirror_Glass", 0.052, loc=(0, 0, 0.002), scale=(1.0, 1.38, 0.06), material=m["cracked"], parent=hm, segs=24)
    geo.curve_tube("MD_HandMirror_Handle", [Vector((0, -0.08, 0.006)), Vector((0.005, -0.14, 0.006)), Vector((0.0, -0.18, 0.008))], 0.009, material=m["gilt"], parent=hm, ring=6, steps=3,
                   taper=lambda t: 1.0 - 0.3 * t)
    # the tipped teacup + saucer
    sc = geo.lathe("MD_Saucer", [(0, 0), (0.05, 0.0), (0.06, 0.008), (0.056, 0.01), (0, 0.004)], loc=(-0.14, -0.46, 0), material=m["china"], parent=root, segments=28)
    geo.lathe("MD_Teacup", [(0, 0), (0.022, 0), (0.035, 0.03), (0.04, 0.055), (0.037, 0.055), (0.032, 0.032), (0.02, 0.006), (0, 0.006)],
              loc=(-0.22, -0.4, 0.04), rot=(radians(90), 0, radians(40)), material=m["china"], parent=root, segments=28, loop=False)
    # dried rose petals scattered over the front
    rng = random.Random(21)
    def petals(bm):
        for _ in range(60):
            x, y = rng.uniform(-0.6, 0.6), rng.uniform(-0.58, 0.05)
            if abs(x - 0.4) < 0.08 and abs(y + 0.4) < 0.08:
                continue
            r = rng.uniform(0.008, 0.016)
            vs = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=r)["verts"]
            bmesh.ops.transform(bm, matrix=geo.mtx((x, y, 0.004 + r * 0.12), (0, 0, rng.uniform(0, 6.3)), (1.0, 0.65, 0.14)), verts=vs)
    geo.merged("MD_Petals", petals, material=m["petal"], parent=root, bevel=0, uv="box", uv_scale=20)
    # the deck of MACABRE cards, on the doily in front of the dolls
    deck = S.empty("MD_Deck", "PROPS", loc=(0.2, -0.24, 0.004), rot=(0, 0, radians(22)), parent=root, size=0.03)
    cw, ch = CARD
    geo.box("MD_Deck_Stack", (cw, ch, 0.022), material=m["card_edge"], parent=deck, bevel=0.002, seg=2)
    geo.box("MD_Deck_Top", (cw - 0.002, ch - 0.002, 0.0008), loc=(0, 0, 0.022), material=m["cardback"], parent=deck, bevel=0, uv="fit", fit_axis=2)
    for k in range(2):                                         # a couple of cards slightly askew on top
        geo.box(f"MD_Deck_Loose_{k}", (cw, ch, 0.0012), loc=(0.003 * (k + 1), -0.002 * k, 0.0228 + k * 0.0013), rot=(0, 0, radians(4 + k * 5)),
                material=m["cardback"], parent=deck, bevel=0, uv="fit", fit_axis=2)
    return deck, hm


def build(root):
    m = materials()
    mirror = build_room(root, m)
    d1, h1 = doll(root, m, "MD_Doll_1", (-0.2, 0.2, 0.004), 40, 1.22, kneel=True, hair=True)
    d2, h2 = doll(root, m, "MD_Doll_2", (0.12, 0.27, 0.004), 30, 1.28, kneel=True, hair=True)
    d3, h3 = doll(root, m, "MD_Doll_3", (-0.02, -0.06, 0.004), 34, 0.82, kneel=False, hair=False)
    ted = teddy(root, m, (-0.52, -0.12, 0), 55)
    horse = rocking_horse(root, m, (-0.52, 0.4, 0), 25)
    mbox = music_box(root, m, (-0.32, -0.4, 0), 24)
    house = dollhouse(root, m, (0.48, 0.38, 0), -18)
    chest = chest_and_candle(root, m, (0.56, -0.04, 0), -60)
    deck, hm = floor_things(root, m)
    for obj, iid, label in [(deck, "md_deck", "The Deck"), (d1, "md_doll_1", "The Eldest"), (d2, "md_doll_2", "The Tall One"), (d3, "md_doll_3", "The Little One"),
                            (mbox, "md_musicbox", "Music Box"), (ted, "md_teddy", "Teddy Bear"), (horse, "md_horse", "Rocking Horse"),
                            (house, "md_dollhouse", "Dollhouse"), (mirror, "md_mirror", "The Mirror"), (chest, "md_candle", "The Candle")]:
        S.mark_interactive(obj, iid, label, scope="macabre-dolls", kind="discovery")
    return dict(deck=deck)
