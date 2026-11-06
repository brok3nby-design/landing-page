"""Under the Radar exhibit: the late-night desk from the cover art ("One more game.").

A corner of a dark study: a night-sky wall with the radar rings and stars of the title graphic, a plum side
wall with small framed pictures and a shelf. On the wooden desk: a beige retro computer with a glowing CRT,
its keyboard, a trackball with a red ball, a floppy disk, a stack of four illustrated game boxes, maps and
loose sketches, an open notebook and pen, a mug of pencils, a pothos trailing over the edge, a brass compass
and a glowing orb lamp.

For the website the CRT becomes an amber radar (MD-style overlay on UR_Screen): scan, and each sweep turns up
a blip and sends one of the cover's postcards (lighthouse, manor, night train, clockwork) flying out of the
screen. Real-world scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos
import os
import random
import numpy as np
import bmesh
import bpy
from mathutils import Vector, Matrix

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D, H = 1.5, 1.1, 1.3
BACK_Y, LEFT_X = 0.55, -0.75
DESK = dict(w=1.3, d=0.6, h=0.74)
ART = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "app", "public", "media", "projects", "under-the-radar", "Under_Radar_logo.webp"))
# the four game boxes on the cover (bottom left), as crops (x0, y0, x1, y1) of the 1024 x 1536 artwork
BOX_CROPS = [(0, 1190, 285, 1275), (0, 1262, 325, 1342), (0, 1305, 372, 1400), (0, 1388, 375, 1490)]
CLOSEUPS = [("CAM_Exhibit_CloseDesk", ["UR_Computer", "UR_Boxes", "UR_Trackball"], 24, 22, 50, 0.85)]
LIGHT_GAIN = dict(key=4.6, fill=3.4, rim=2.4)
BAKE_HIDE = []
RNG = random.Random(19)


# ---------------------------------------------------------------- textures
def _crop(name, box):
    img = bpy.data.images.load(ART)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    x0, y0, x1, y1 = box
    a = a[int(y0 * h / 1536):int(y1 * h / 1536), int(x0 * w / 1024):int(x1 * w / 1024)]
    c = T.Canvas(a.shape[1], a.shape[0])
    c.a[..., :3] = a[..., :3]
    return c.save(name)


def _tex_sky(name="ur_sky", w=1024, h=768):
    """The back wall: deep plum night with stars and the radar rings of the title, a crosshair and two sparkles."""
    c = T.Canvas(w, h, T.rgb("#1a0f1e"))
    c.mul(0.7 + 0.5 * T.noise(h, w, 4, 401))
    dust = np.clip((T.noise(h, w, 9, 402) - 0.5) * 2, 0, 1)
    c._blend(dust, T.rgb("#3a1a2a"), 0.5)
    rng = random.Random(3)
    for _ in range(160):
        c.circle(rng.uniform(0, w), rng.uniform(0, h), rng.uniform(0.6, 1.8), T.rgb("#f2d6a0"), rng.uniform(0.3, 0.9))
    cx, cy = w * 0.55, h * 0.42
    gold = T.rgb("#c8955a")
    for r, op in ((300, 0.55), (230, 0.45), (150, 0.35)):
        c.circle(cx, cy, r, gold, op, ring=1.6)
    for k in range(72):                                       # tick marks round the outer ring
        a = k * 2 * pi / 72
        L = 14 if k % 6 == 0 else 6
        c.line(cx + cos(a) * 300, cy + sin(a) * 300, cx + cos(a) * (300 - L), cy + sin(a) * (300 - L), 1.4, gold, 0.6)
    c.line(cx - 380, cy, cx + 380, cy, 1.2, gold, 0.45)
    c.line(cx, cy - 360, cx, cy + 360, 1.2, gold, 0.45)
    for sy in (-1, 1):                                        # four-point sparkles top and bottom
        x, y = cx, cy + sy * 330
        c.poly([(x, y - 22), (x + 5, y), (x, y + 22), (x - 5, y)], T.rgb("#f7d28a"))
        c.poly([(x - 22, y), (x, y - 5), (x + 22, y), (x, y + 5)], T.rgb("#f7d28a"))
    return c.save(name)


def _tex_wallpaper(name="ur_plum", size=512):
    c = T.Canvas(size, size, T.rgb("#2a1624"))
    c.mul(0.8 + 0.3 * T.noise(size, size, 6, 403))
    for x in range(0, size, 32):
        c.line(x, 0, x, size, 2, T.rgb("#1c0e18"), 0.5)
    return c.save(name)


def _tex_map(name="ur_map", w=512, h=384, seed=1):
    c = T.Canvas(w, h, T.rgb("#d8c7a0"))
    c.mul(0.85 + 0.2 * T.noise(h, w, 6, 404 + seed))
    ink = T.rgb("#5a4228")
    rng = random.Random(seed)
    x, y = rng.uniform(40, 120), rng.uniform(60, h - 60)
    for _ in range(26):                                       # a dotted route across hills and a coast
        nx, ny = x + rng.uniform(8, 22), y + rng.uniform(-16, 16)
        c.line(x, y, nx, ny, 2, ink, 0.7 if _ % 2 else 0.0)
        x, y = nx, max(30, min(h - 30, ny))
    for _ in range(8):
        hx, hy = rng.uniform(30, w - 30), rng.uniform(30, h - 30)
        c.poly([(hx - 14, hy + 8), (hx, hy - 10), (hx + 14, hy + 8)], ink, 0.5)
    c.line(w * 0.7, 20, w * 0.72, h - 20, 3, T.rgb("#4a6a8a"), 0.4)
    c.circle(w * 0.78, h * 0.3, 10, T.rgb("#8a2a20"), 0.8, ring=3)
    c.text("X", w * 0.78 - 9, h * 0.3 - 12, 3, T.rgb("#8a2a20"))
    return c.save(name)


def _tex_frame_art(name, seed):
    w, h = 256, 192
    c = T.Canvas(w, h)
    rng = random.Random(seed)
    top, bot = rng.choice([("#2a2a5a", "#c86a4a"), ("#1a2a4a", "#6a5a8a"), ("#3a1a3a", "#d89a5a")])
    c.vgrad(0, h, T.rgb(top), T.rgb(bot))
    pts = [(0, h)] + [(x, h * 0.6 - rng.uniform(0, 50)) for x in np.linspace(0, w, 7)] + [(w, h)]
    c.poly(pts, T.rgb("#1a1222"))
    c.circle(w * rng.uniform(0.2, 0.8), h * 0.3, 14, T.rgb("#f2e2b0"), 0.9)
    return c.save(name)


def _tex_radar(name="ur_radar", w=320, h=240):
    """The CRT for the still renders: an amber radar with a sweep and a few blips (the website draws a live one)."""
    c = T.Canvas(w, h, T.rgb("#120a04"))
    cx, cy = w / 2, h / 2
    amber = T.rgb("#ffb34a")
    for r in (30, 60, 90, 112):
        c.circle(cx, cy, r, amber, 0.35, ring=1.5)
    c.line(cx - 115, cy, cx + 115, cy, 1, amber, 0.25); c.line(cx, cy - 115, cx, cy + 115, 1, amber, 0.25)
    for k in range(24):                                       # the sweep's fading wedge
        a = radians(-30 - k * 2.5)
        c.line(cx, cy, cx + cos(a) * 110, cy + sin(a) * 110, 3, amber, 0.5 * (1 - k / 24))
    for bx, by in ((cx + 55, cy - 40), (cx - 70, cy + 25), (cx + 20, cy + 70)):
        c.circle(bx, by, 4, T.rgb("#ffe0a0"), 0.9)
    for y in range(0, h, 3):
        c.line(0, y, w, y, 1, T.rgb("#000000"), 0.25)
    return c.save(name)


def textures():
    out = {"ur_sky": _tex_sky(), "ur_plum": _tex_wallpaper(), "ur_radar": _tex_radar()}
    for k in range(3):
        out[f"ur_map_{k}"] = _tex_map(f"ur_map_{k}", seed=k + 1)
        out[f"ur_frame_{k}"] = _tex_frame_art(f"ur_frame_{k}", k + 5)
    for k, box in enumerate(BOX_CROPS):
        out[f"ur_box_{k}"] = _crop(f"ur_box_{k}", box)
    out["ur_floppy"] = T.label_card("ur_floppy", 256, 160, [("ONE MORE", 4), ("GAME", 6)], "#efe8d8", "#2a2a4a")
    TEX.update(out)
    return out


def materials():
    return dict(
        sky=mat("M_ur_sky", tex="ur_sky", rough=0.9),
        plum=mat("M_ur_plum", tex="ur_plum", rough=0.9),
        floor=mat("M_ur_floor", tex="planks", rough=0.6, normal="planks_n", normal_strength=0.5, tint=(0.3, 0.22, 0.2)),
        beige=mat("M_ur_beige", color=(0.66, 0.6, 0.5), rough=0.55),
        beige_dark=mat("M_ur_beige_dark", color=(0.42, 0.38, 0.32), rough=0.6),
        screen=mat("M_ur_screen", color=(0.0, 0.0, 0.0), rough=0.1, emit_tex="ur_radar", strength=2.2),
        rug=mat("M_ur_rug", tex="rug", rough=0.95, normal="rug_n", normal_strength=0.5),
        led=mat("M_ur_led", color=(0.2, 1.0, 0.3), emit=(0.2, 1.0, 0.3), strength=6),
        red_ball=mat("M_ur_red_ball", color=(0.55, 0.04, 0.05), rough=0.12),
        floppy=mat("M_ur_floppy", color=(0.06, 0.07, 0.14), rough=0.4),
        floppy_label=mat("M_ur_floppy_label", tex="ur_floppy", rough=0.7),
        orb=mat("M_ur_orb", color=(1.0, 0.7, 0.35), emit=(1.0, 0.62, 0.25), strength=6),
        pot=mat("M_ur_pot", color=(0.5, 0.26, 0.15), rough=0.85),
        leaf=mat("M_ur_leaf", color=(0.16, 0.32, 0.1), rough=0.55),
        mug=mat("M_ur_mug", color=(0.88, 0.84, 0.76), rough=0.25),
        paper=mat("M_ur_paper", color=(0.86, 0.8, 0.68), rough=0.9),
        plinth=mat("M_ur_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
        **{f"map_{k}": mat(f"M_ur_map_{k}", tex=f"ur_map_{k}", rough=0.9) for k in range(3)},
        **{f"frame_{k}": mat(f"M_ur_frame_{k}", tex=f"ur_frame_{k}", rough=0.7) for k in range(3)},
        **{f"box_{k}": mat(f"M_ur_box_{k}", tex=f"ur_box_{k}", rough=0.6) for k in range(4)},
    )


# ---------------------------------------------------------------- room + desk
def build_room(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("UR_Plinth", (W + 0.36, D + 0.36, 0.16), loc=(0.0, BACK_Y - D / 2 - 0.04, -0.21), material=m["plinth"], bevel=0.02, **p)
    geo.box("UR_Floor", (W + 0.16, D + 0.12, 0.05), loc=(0.0, BACK_Y - D / 2, -0.05), material=m["floor"], bevel=0.006, **p)
    t = 0.06
    geo.box("UR_Wall_Back", (W + t, t, H), loc=(-t / 2, BACK_Y + t / 2, 0), material=m["sky"], bevel=0, uv="fit", fit_axis=1, **p)
    geo.box("UR_Wall_Left", (t, D, H), loc=(LEFT_X - t / 2, BACK_Y - D / 2, 0), material=m["plum"], bevel=0, uv="box", uv_scale=1.5, **p)
    wood = M("wood_dark")
    for nm, dims, loc in [("Base_Back", (W, 0.025, 0.08), (0, BACK_Y - 0.012, 0)), ("Base_Left", (0.025, D, 0.08), (LEFT_X + 0.012, BACK_Y - D / 2, 0))]:
        geo.box(f"UR_{nm}", dims, loc=loc, material=wood, bevel=0.003, **p)
    # framed pictures + a little shelf on the side wall
    for k, (y, z, w, h) in enumerate(((BACK_Y - 0.25, 0.95, 0.2, 0.15), (BACK_Y - 0.55, 1.0, 0.16, 0.12), (BACK_Y - 0.45, 0.78, 0.14, 0.11))):
        fr = geo.box(f"UR_Frame_{k}", (0.02, w + 0.03, h + 0.03), loc=(LEFT_X + 0.01, y, z), material=wood, parent=root, bevel=0.004)
        geo.box(f"UR_Frame_{k}_Art", (0.003, w, h), loc=(0.011, 0, 0.015), material=m[f"frame_{k}"], parent=fr, bevel=0, uv="fit", fit_axis=0)
    sh = geo.box("UR_Shelf", (0.16, 0.5, 0.02), loc=(LEFT_X + 0.08, BACK_Y - 0.4, 1.12), material=wood, parent=root, bevel=0.004)
    for k in range(5):
        geo.box(f"UR_Shelf_Book_{k}", (0.12, 0.025 + 0.005 * (k % 2), 0.12 + 0.02 * (k % 3)), loc=(0, -0.2 + k * 0.035, 0.02),
                material=M(["book_cover", "book_green", "book_yellow"][k % 3]), parent=sh, bevel=0.002)
    L = bpy.data.lights.new("LIGHT_UR_Sky", 'AREA')               # faint starlight on the room
    L.energy, L.color, L.size = 4, (0.6, 0.55, 1.0), 1.0
    lo = bpy.data.objects.new("LIGHT_UR_Sky", L)
    lo.location = (0.1, BACK_Y - 0.3, H)
    S.coll("LIGHTS").objects.link(lo)


def build_desk(root, m):
    w, d, h = DESK["w"], DESK["d"], DESK["h"]
    cy = BACK_Y - d / 2 - 0.02
    desk = geo.box("UR_Desk", (w, d, 0.035), loc=(0.02, cy, h - 0.035), material=M("wood_dark"), parent=root, bevel=0.006)
    for sx in (-1, 1):
        for sy in (-1, 1):
            geo.box(f"UR_Desk_Leg_{sx}_{sy}", (0.05, 0.05, h - 0.035), loc=(sx * (w / 2 - 0.05), sy * (d / 2 - 0.05), -(h - 0.035)), material=M("wood_dark"), parent=desk, bevel=0.004)
    geo.box("UR_Desk_Apron", (w - 0.12, 0.02, 0.1), loc=(0, -d / 2 + 0.05, -0.1), material=M("wood_dark"), parent=desk, bevel=0.003)
    top = 0.035
    # ---- the computer
    pc = S.empty("UR_Computer", "PROPS", loc=(-0.14, 0.08, top), rot=(0, 0, radians(8)), parent=desk, size=0.05)
    geo.box("UR_Computer_Base", (0.36, 0.34, 0.07), material=m["beige"], parent=pc, bevel=0.01)
    geo.box("UR_Computer_FloppySlot", (0.1, 0.004, 0.008), loc=(0.09, -0.171, 0.03), material=M("plastic_black"), parent=pc, bevel=0)
    geo.box("UR_Computer_LED", (0.008, 0.004, 0.006), loc=(-0.14, -0.171, 0.03), material=m["led"], parent=pc, bevel=0)
    crt = geo.box("UR_Computer_Monitor", (0.34, 0.32, 0.3), loc=(0, 0.01, 0.07), material=m["beige"], parent=pc, bevel=0.02, seg=3)
    geo.box("UR_Computer_Back", (0.26, 0.14, 0.22), loc=(0, 0.2, 0.03), material=m["beige"], parent=crt, bevel=0.03, seg=3)
    geo.box("UR_Computer_Bezel", (0.3, 0.01, 0.24), loc=(0, -0.163, 0.035), material=m["beige_dark"], parent=crt, bevel=0.008)
    geo.box("UR_Screen", (0.25, 0.006, 0.19), loc=(0, -0.168, 0.06), material=m["screen"], parent=crt, bevel=0.004, uv="fit", fit_axis=1)
    def vents(bm):
        for k in range(7):
            geo.add_box(bm, (0.004, 0.18, 0.006), (0.171, 0.02, 0.12 + k * 0.018))
    geo.merged("UR_Computer_Vents", vents, material=m["beige_dark"], parent=crt, bevel=0)
    Ls = bpy.data.lights.new("LIGHT_UR_Screen", 'AREA')
    Ls.energy, Ls.color, Ls.size = 3.5, (1.0, 0.65, 0.3), 0.22
    ls = bpy.data.objects.new("LIGHT_UR_Screen", Ls)
    bpy.context.view_layer.update()
    ls.location = desk.matrix_world @ Vector((-0.14, 0.08 - 0.22, top + 0.22))
    ls.rotation_euler = (radians(-90), 0, radians(8))
    S.coll("LIGHTS").objects.link(ls)
    # ---- keyboard, trackball, floppy
    kb = geo.box("UR_Keyboard", (0.42, 0.15, 0.022), loc=(-0.1, -0.16, top), rot=(0, 0, radians(4)), material=m["beige"], parent=desk, bevel=0.006)
    def keys(bm):
        for r in range(5):
            for k in range(15):
                geo.add_box(bm, (0.022, 0.022, 0.01), (-0.18 + k * 0.026, -0.05 + r * 0.025, 0.022))
    geo.merged("UR_Keyboard_Keys", keys, material=m["beige_dark"], parent=kb, bevel=0.002, seg=1)
    tb = S.empty("UR_Trackball", "PROPS", loc=(0.2, -0.14, top), parent=desk, size=0.03)
    geo.sphere("UR_Trackball_Base", 0.05, scale=(1.1, 1.25, 0.45), material=M("plastic_grey"), parent=tb, segs=24)
    geo.sphere("UR_Trackball_Ball", 0.026, loc=(0, 0.008, 0.022), material=m["red_ball"], parent=tb, segs=20)
    fl = geo.box("UR_Floppy", (0.09, 0.09, 0.003), loc=(0.02, -0.26, top), rot=(0, 0, radians(-12)), material=m["floppy"], parent=desk, bevel=0.0008)
    geo.box("UR_Floppy_Label", (0.07, 0.05, 0.0006), loc=(0, -0.012, 0.003), material=m["floppy_label"], parent=fl, bevel=0, uv="fit", fit_axis=2)
    geo.box("UR_Floppy_Shutter", (0.04, 0.025, 0.0007), loc=(0, 0.03, 0.003), material=M("chrome"), parent=fl, bevel=0)
    # ---- the stack of game boxes (cover art on their long sides)
    stack = S.empty("UR_Boxes", "PROPS", loc=(-0.48, -0.05, top), rot=(0, 0, radians(-12)), parent=desk, size=0.05)
    z = 0
    for k in range(4):
        bw, bd, bh = 0.27 - k * 0.012, 0.2, 0.05
        b = geo.box(f"UR_Box_{k}", (bw, bd, bh), loc=(RNG.uniform(-0.01, 0.01), RNG.uniform(-0.01, 0.01), z), rot=(0, 0, radians(RNG.uniform(-5, 5))),
                    material=M("book_cover"), parent=stack, bevel=0.003)
        geo.box(f"UR_Box_{k}_Art", (bw - 0.004, 0.002, bh - 0.006), loc=(0, -bd / 2 - 0.001, 0.003), material=m[f"box_{3 - k}"], parent=b, bevel=0, uv="fit", fit_axis=1)
        z += bh
    # ---- maps and sketches, notebook + pen, mug of pencils, compass
    for k, (x, y, rz) in enumerate(((0.33, -0.2, 14), (0.42, -0.08, -10), (0.24, -0.27, 30))):
        geo.box(f"UR_Map_{k}", (0.24, 0.17, 0.0012), loc=(x, y, top + k * 0.0013), rot=(0, 0, radians(rz)), material=m[f"map_{k}"], parent=desk, bevel=0, uv="fit", fit_axis=2)
    nb = geo.box("UR_Notebook", (0.22, 0.16, 0.012), loc=(0.48, -0.24, top + 0.004), rot=(0, 0, radians(-20)), material=M("book_cover"), parent=desk, bevel=0.002)
    geo.box("UR_Notebook_Pages", (0.21, 0.15, 0.004), loc=(0, 0, 0.012), material=m["paper"], parent=nb, bevel=0.001)
    geo.curve_tube("UR_Pen", [Vector((0.05, -0.05, 0.02)), Vector((0.1, 0.03, 0.02))], 0.004, material=M("metal_black"), parent=nb, ring=8, steps=1)
    mug = geo.lathe("UR_Mug", [(0, 0), (0.035, 0), (0.037, 0.004), (0.037, 0.095), (0.033, 0.095), (0.033, 0.008), (0, 0.008)], loc=(-0.55, 0.16, top), material=m["mug"], parent=desk, segments=28)
    for k, (a, tilt, col) in enumerate(((0.4, 8, "pencil_yellow"), (2.2, -10, "pencil_red"), (4.0, 6, "graphite"))):
        geo.cylinder(f"UR_Pencil_{k}", 0.0035, 0.16, loc=(cos(a) * 0.014, sin(a) * 0.014, 0.008), rot=(radians(tilt), radians(tilt * 0.7), 0), material=M(col), parent=mug, verts=6, bevel=0)
    cp = geo.cylinder("UR_Compass", 0.028, 0.012, loc=(0.27, 0.02, top), material=M("brass"), parent=desk, verts=24, bevel=0.002)
    geo.cylinder("UR_Compass_Face", 0.024, 0.001, loc=(0, 0, 0.012), material=m["paper"], parent=cp, verts=24, bevel=0)
    geo.box("UR_Compass_Needle", (0.004, 0.04, 0.001), loc=(0, 0, 0.0132), rot=(0, 0, radians(30)), material=m["red_ball"], parent=cp, bevel=0)
    # ---- the orb lamp (the warm light of the cover's right side)
    orb = geo.lathe("UR_Orb_Base", [(0, 0), (0.06, 0), (0.06, 0.012), (0.03, 0.025), (0.025, 0.05), (0, 0.05)], loc=(0.5, 0.12, top), material=M("brass"), parent=desk, segments=28)
    glow = geo.sphere("UR_Orb", 0.075, loc=(0, 0, 0.045), material=m["orb"], parent=orb, segs=28)
    glow.visible_shadow = False
    Lo = bpy.data.lights.new("LIGHT_UR_Orb", 'POINT')
    Lo.energy, Lo.color, Lo.shadow_soft_size = 22, (1.0, 0.62, 0.3), 0.06
    lo2 = bpy.data.objects.new("LIGHT_UR_Orb", Lo)
    lo2.location = desk.matrix_world @ Vector((0.5, 0.12 - 0.05, top + 0.13))
    S.coll("LIGHTS").objects.link(lo2)
    # ---- the pothos trailing over the desk edge
    pot = geo.lathe("UR_Plant_Pot", [(0, 0), (0.05, 0), (0.062, 0.1), (0.056, 0.1), (0.047, 0.008), (0, 0.008)], loc=(-0.58, -0.22, top), material=m["pot"], parent=desk, segments=24)
    rng = random.Random(4)
    def leaves(bm):
        for vine in range(5):
            a0 = vine * 1.3
            pos = Vector((cos(a0) * 0.03, sin(a0) * 0.03, 0.1))
            d_ = Vector((cos(a0) * 0.6 - 0.3, sin(a0) * 0.4 - 0.5, 0.4)).normalized()
            for k in range(7):
                pos = pos + d_ * 0.04
                d_ = (d_ + Vector((0, 0, -0.35))).normalized() if pos.z < 0.12 else d_
                size = 0.055 * rng.uniform(0.8, 1.1)
                mtx = Matrix.Translation(pos) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z') @ Matrix.Rotation(radians(rng.uniform(20, 60)), 4, 'X')
                geo.heart_leaf(bm, size, mtx)
    geo.merged("UR_Plant_Leaves", leaves, material=m["leaf"], parent=pot, bevel=0, uv="box", uv_scale=20)
    # a rug and the chair pulled up to the desk
    geo.box("UR_Rug", (1.0, 0.7, 0.006), loc=(0.05, BACK_Y - 0.72, 0), rot=(0, 0, radians(-4)), material=m["rug"], parent=root, bevel=0.002, uv="fit", fit_axis=2)
    ch = S.empty("UR_Chair", "PROPS", loc=(0.0, BACK_Y - 0.78, 0.006), rot=(0, 0, radians(168)), parent=root, size=0.05)
    def chair(bm):
        for sx in (-1, 1):
            for sy in (-1, 1):
                geo.add_box(bm, (0.035, 0.035, 0.44), (sx * 0.19, sy * 0.18, 0))
        geo.add_box(bm, (0.44, 0.42, 0.035), (0, 0, 0.44))
        for sx in (-1, 1):
            geo.add_box(bm, (0.035, 0.035, 0.42), (sx * 0.19, 0.18, 0.475))
        for z in (0.62, 0.84):
            geo.add_box(bm, (0.42, 0.03, 0.05 if z > 0.7 else 0.03), (0, 0.18, z))
        for x in (-0.08, 0.0, 0.08):
            geo.add_box(bm, (0.02, 0.02, 0.2), (x, 0.18, 0.64))
    geo.merged("UR_Chair_Wood", chair, material=M("wood"), parent=ch, bevel=0.004, seg=1)
    return desk, pc, stack, tb, fl, orb, pot, nb


def build(root):
    m = materials()
    build_room(root, m)
    desk, pc, stack, tb, fl, orb, pot, nb = build_desk(root, m)
    for obj, iid, label in [(pc, "ur_computer", "The Computer"), (stack, "ur_boxes", "Game Boxes"), (tb, "ur_trackball", "Trackball"), (fl, "ur_floppy", "Floppy Disk"),
                            (orb, "ur_orb", "Orb Lamp"), (nb, "ur_notebook", "Notebook")]:
        S.mark_interactive(obj, iid, label, scope="under-the-radar", kind="discovery")
    return dict(desk=desk)
