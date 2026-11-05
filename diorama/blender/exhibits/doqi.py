"""DOQI exhibit: an office of the Department of Questionable Inventions, from the game's cover art.

A corner of the office, cut away like a dollhouse: grimy green walls, the riveted DOQI sign, posters
("SAME FORMS / DIFFERENT PEOPLE", "INVENT / FILE / REPEAT" with a flying saucer), a window onto a dusk
city of smokestacks with a blimp behind half-drawn blinds, a filing cabinet with a globe. At the desk,
facing the viewer: J.E.F.F. (Judicial Encyclopedic Filing Facilitator), the rusty green terminal with
the grumpy eyes; the labelled folder stack (PROPOSALS ... FILE ANYWAY); the BUREAUCRACY FUELS
CREATIVITY mug; the QUESTION INVENT REPEAT pencil cup; blueprints, a crumpled idea, a desk lamp, a tin
robot; and a rubber stamp on its ink pad beside a form (the website stamps it FILED).

Real-world scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos
import random
import numpy as np
import bmesh
import bpy
from mathutils import Vector, Matrix

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D, H = 1.4, 1.15, 1.15
BACK_Y, LEFT_X = D / 2, -W / 2
DESK = dict(x=0.12, y=-0.08, rz=40, w=1.0, d=0.55, h=0.74)
WIN = dict(x=0.3, w=0.46, z0=0.48, z1=1.0)
FOLDERS = ["PROPOSALS", "IDEAS", "REJECTED", "PENDING", "MAYBE", "ACTUALLY...?", "ABSURD", "FILE ANYWAY"]
CLOSEUPS = [("CAM_Exhibit_CloseDesk", ["DQ_Jeff", "DQ_Folders", "DQ_Stamp", "DQ_Form", "DQ_Mug"], 24, 30, 50, 0.85)]
LIGHT_GAIN = dict(key=4.6, fill=3.0, rim=2.0)
BAKE_HIDE = ["DQ_Stamp"]          # it moves (the website stamps forms with it)


# ---------------------------------------------------------------- textures (code-painted)
def _tex_wall(name="dq_wall", size=1024):
    c = T.Canvas(size, size, T.rgb("#2c3a33"))
    c.mul(0.78 + 0.35 * T.noise(size, size, 5, 41))
    c.mul(0.9 + 0.14 * T.noise(size, size, 40, 42))
    g = np.clip((c.yy / size - 0.55) / 0.45, 0, 1) * (0.6 + 0.4 * T.noise(size, size, 18, 43))
    c._blend(g, T.rgb("#161c18"), 0.6)                       # grime rising from the floor
    rng = random.Random(4)
    for _ in range(30):                                      # water stains / drips
        x = rng.uniform(0, size); L = rng.uniform(0.05, 0.3) * size
        c.line(x, 0, x + rng.uniform(-3, 3), L, rng.uniform(2, 6), T.rgb("#1c241f"), 0.25)
    for x in range(0, size, size // 4):                      # panel seams
        c.line(x, 0, x, size, 2, T.rgb("#18201b"), 0.6)
    return c.save(name)


def _tex_floor(name="dq_floor", size=1024):
    c = T.Canvas(size, size, T.rgb("#232824"))
    t = size // 8
    for i in range(8):
        for j in range(8):
            if (i + j) % 2:
                c.rect(i * t, j * t, (i + 1) * t, (j + 1) * t, T.rgb("#3a3d33"))
    c.mul(0.75 + 0.4 * T.noise(size, size, 6, 51))
    for k in range(9):
        c.line(k * t, 0, k * t, size, 2, T.rgb("#141614"), 0.7); c.line(0, k * t, size, k * t, 2, T.rgb("#141614"), 0.7)
    return c.save(name)


def _tex_sky(name="dq_dusk", w=512, h=640):
    c = T.Canvas(w, h)
    c.vgrad(0, int(h * 0.75), T.rgb("#1c2236"), T.rgb("#c0744a"))
    c.vgrad(int(h * 0.75), h, T.rgb("#c0744a"), T.rgb("#3a2a2a"))
    rng = random.Random(7)
    base = h * 0.86
    pts, x = [(0, h)], 0
    while x < w:
        bw, bh = rng.uniform(22, 55), rng.uniform(60, 220)
        pts += [(x, base - bh), (x + bw, base - bh)]
        x += bw
    pts += [(w, h)]
    for k in range(3):                                        # factory chimneys + smoke
        cx = rng.uniform(40, w - 40)
        c.rect(cx - 7, base - 300, cx + 7, base, T.rgb("#14161c"))
        for j in range(8):
            c.circle(cx + j * 9, base - 310 - j * 18, 12 + j * 2, T.rgb("#4a4652"), 0.25)
    c.poly(pts, T.rgb("#14161c"))
    for _ in range(90):
        x0, y0 = rng.uniform(0, w), rng.uniform(base - 200, base)
        c.rect(x0, y0, x0 + 3, y0 + 4, T.rgb("#ffb860"), 0.75)
    bx, by = w * 0.55, h * 0.3                               # the blimp, with the department's triangle
    c.circle(bx - 50, by, 26, T.rgb("#2a2c36")); c.circle(bx + 50, by, 26, T.rgb("#2a2c36")); c.rect(bx - 50, by - 26, bx + 50, by + 26, T.rgb("#2a2c36"))
    c.poly([(bx + 70, by), (bx + 100, by - 26), (bx + 100, by + 26)], T.rgb("#2a2c36"))
    c.rect(bx - 16, by + 24, bx + 16, by + 34, T.rgb("#22242c"))
    c.poly([(bx - 12, by - 10), (bx + 12, by - 10), (bx, by + 10)], T.rgb("#c8a96a"), 0.8)
    return c.save(name)


def _poster(name, lines, ufo=False, w=360, h=540):
    c = T.Canvas(w, h, T.rgb("#1f2b3a"))
    c.mul(0.85 + 0.2 * T.noise(h, w, 6, hash(name) % 97))
    cream = T.rgb("#d8cfb5")
    c.rect(10, 10, w - 10, 14, cream, 0.8); c.rect(10, h - 14, w - 10, h - 10, cream, 0.8)
    c.rect(10, 10, 14, h - 10, cream, 0.8); c.rect(w - 14, 10, w - 10, h - 10, cream, 0.8)
    y = 60 if not ufo else 250
    if ufo:                                                   # saucer beaming over pine trees
        c.poly([(w / 2 - 20, 120), (w / 2 + 20, 120), (w / 2 + 90, 235), (w / 2 - 90, 235)], cream, 0.35)
        c.circle(w / 2, 108, 26, cream); c.rect(w / 2 - 70, 108, w / 2 + 70, 122, cream)
        for k in range(7):
            x0 = 40 + k * 45
            c.poly([(x0, 240), (x0 + 18, 190 - (k % 2) * 20), (x0 + 36, 240)], T.rgb("#0f1720"))
    for text in lines:
        px = 6 if len(text) <= 6 else 5
        tw = len(text) * 6 * px
        c.text(text, (w - tw) / 2, y, px, cream)
        y += px * 11
    c.poly([(w / 2 - 22, h - 70), (w / 2 + 22, h - 70), (w / 2, h - 40)], cream, 0.9)
    return c.save(name)


def _tex_jeff_face(name="dq_jeff_face", w=320, h=240):
    """The face on J.E.F.F.'s screen for the still renders (the website draws a live one)."""
    c = T.Canvas(w, h, T.rgb("#0d2a1c"))
    c._blend(np.clip(1 - (((c.xx - w / 2) / (w * 0.6)) ** 2 + ((c.yy - h / 2) / (h * 0.6)) ** 2), 0, 1), T.rgb("#1f5a3a"), 0.9)
    for y in range(0, h, 4):
        c.line(0, y, w, y, 1, T.rgb("#06160e"), 0.35)
    for sx in (-1, 1):
        ex, ey = w / 2 + sx * 66, h * 0.55
        c.circle(ex, ey, 40, T.rgb("#bff7c8")); c.circle(ex, ey, 34, T.rgb("#5fdc84"))
        c.circle(ex + sx * -4, ey + 6, 14, T.rgb("#0b2416"))
        # angry brows: the inner ends come down (a V over the nose)
        c.poly([(ex - 50, ey - 30 + sx * 16), (ex + 50, ey - 30 - sx * 16), (ex + 50, ey - 70), (ex - 50, ey - 70)], T.rgb("#0d2a1c"))
        c.line(ex - 48, ey - 32 + sx * 16, ex + 48, ey - 32 - sx * 16, 9, T.rgb("#0a1d13"))
    return c.save(name)


def _tex_metal(name, base, rust=0.5, size=512, seed=1):
    c = T.Canvas(size, size, T.rgb(base))
    c.mul(0.82 + 0.3 * T.noise(size, size, 7, seed))
    spots = np.clip((T.noise(size, size, 24, seed + 2) - 0.62) * 5, 0, 1) * rust
    c._blend(spots, T.rgb("#6b3a1c"), 0.8)
    c._blend(np.clip((T.noise(size, size, 60, seed + 3) - 0.7) * 6, 0, 1), T.rgb("#9a9a8a"), 0.25 * rust)
    return c.save(name)


def _tex_blueprint(name="dq_blueprint", w=512, h=384):
    c = T.Canvas(w, h, T.rgb("#d9cfae"))
    c.mul(0.9 + 0.12 * T.noise(h, w, 8, 61))
    ink = T.rgb("#3b3a36")
    for k in range(0, w, 32): c.line(k, 0, k, h, 1, T.rgb("#b8ad8c"), 0.6)
    for k in range(0, h, 32): c.line(0, k, w, k, 1, T.rgb("#b8ad8c"), 0.6)
    c.circle(w * 0.3, h * 0.45, 60, ink, 0.9, ring=3); c.circle(w * 0.3, h * 0.45, 20, ink, 0.9, ring=2)
    for a in range(12):
        t = a * pi / 6
        c.line(w * 0.3 + cos(t) * 60, h * 0.45 + sin(t) * 60, w * 0.3 + cos(t) * 72, h * 0.45 + sin(t) * 72, 6, ink, 0.9)
    c.rect(w * 0.55, h * 0.2, w * 0.62, h * 0.8, ink, 0.0)
    c.line(w * 0.58, h * 0.15, w * 0.58, h * 0.85, 3, ink); c.circle(w * 0.58, h * 0.2, 16, ink, 0.9, ring=2)
    for k in range(6): c.line(w * 0.54, h * 0.4 + k * 18, w * 0.62, h * 0.43 + k * 18, 2, ink)
    c.text("PROTOTYPE 7?", w * 0.66, h * 0.82, 3, ink)
    return c.save(name)


def textures():
    out = {"dq_wall": _tex_wall(), "dq_floor": _tex_floor(), "dq_dusk": _tex_sky(), "dq_jeff_face": _tex_jeff_face(),
           "dq_jeff_metal": _tex_metal("dq_jeff_metal", "#4a5a42", 0.7, seed=3), "dq_cabinet": _tex_metal("dq_cabinet", "#4b544e", 0.35, seed=9),
           "dq_blueprint": _tex_blueprint(),
           "dq_poster_a": _poster("dq_poster_a", ["SAME", "FORMS", "DIFFERENT", "PEOPLE"]),
           "dq_poster_b": _poster("dq_poster_b", ["INVENT", "FILE", "REPEAT"], ufo=True)}
    out["dq_sign"] = T.label_card("dq_sign", 720, 240, [("DOQI", 18), ("DEPARTMENT OF QUESTIONABLE INVENTIONS", 2)], "#d6cba9", "#2a2418", border=True)
    out["dq_plate"] = T.label_card("dq_plate", 360, 140, [("J.E.F.F.", 7), ("JUDICIAL ENCYCLOPEDIC", 2), ("FILING FACILITATOR", 2)], "#d3c7a2", "#1f1b14", border=True)
    out["dq_mug"] = T.mug("dq_mug", text="BUREAUCRACY|FUELS|CREATIVITY", icon=False, base="#e9e2d0")
    cupc = T.Canvas(1024, 256, T.rgb("#2f3a33"))                # wraps all the way round; the words face u = 0.5
    cupc.mul(0.85 + 0.2 * T.noise(256, 1024, 8, 71))
    for k, word in enumerate(("QUESTION", "INVENT", "REPEAT")):
        cupc.text(word, 512 - len(word) * 15, 50 + k * 56, 5, T.rgb("#c9c0a4"))
    out["dq_cup"] = cupc.save("dq_cup")
    out["dq_form"] = T.label_card("dq_form", 300, 400, [("FORM 27-B", 5), ("", 2), ("NAME ________", 2), ("IDEA ________", 2),
                                                       ("WHY? ________", 2), ("", 2), ("SIGN HERE  X___", 2)], "#ece5d2", "#2a2620", border=True)
    # folder tab labels, one row each (uv_region picks the row)
    n = len(FOLDERS)
    c = T.Canvas(512, 64 * n, T.rgb("#e8dcb5"))
    for k, text in enumerate(FOLDERS):
        y0 = k * 64
        c.rect(0, y0, 512, y0 + 3, T.rgb("#b7a777"))
        px = 5 if len(text) < 10 else 4
        c.text(text, 24, y0 + 32 - px * 3.5, px, T.rgb("#2a2418"))
    out["dq_tabs"] = c.save("dq_tabs")
    TEX.update(out)
    return out


def materials():
    return dict(
        wall=mat("M_dq_wall", tex="dq_wall", rough=0.85),
        floor=mat("M_dq_floor", tex="dq_floor", rough=0.55),
        sky=mat("M_dq_sky", color=(0, 0, 0), rough=0.9, emit_tex="dq_dusk", strength=0.6),
        poster_a=mat("M_dq_poster_a", tex="dq_poster_a", rough=0.75),
        poster_b=mat("M_dq_poster_b", tex="dq_poster_b", rough=0.75),
        sign=mat("M_dq_sign", tex="dq_sign", rough=0.45, metal=0.3),
        plate=mat("M_dq_plate", tex="dq_plate", rough=0.4, metal=0.3),
        jeff=mat("M_dq_jeff", tex="dq_jeff_metal", rough=0.55, metal=0.5),
        bezel=mat("M_dq_bezel", color=(0.28, 0.09, 0.05), rough=0.45, metal=0.3),
        screen=mat("M_dq_screen", color=(0, 0, 0), rough=0.1, emit_tex="dq_jeff_face", strength=1.8),
        amber=mat("M_dq_amber", color=(1.0, 0.6, 0.2), emit=(1.0, 0.55, 0.15), strength=6),
        cabinet=mat("M_dq_cabinet", tex="dq_cabinet", rough=0.5, metal=0.55),
        metal=mat("M_dq_metal", color=(0.12, 0.12, 0.11), rough=0.4, metal=0.8),
        folder=mat("M_dq_folder", color=(0.78, 0.66, 0.42), rough=0.85),
        tabs=mat("M_dq_tabs", tex="dq_tabs", rough=0.8),
        paper=mat("M_dq_paper", color=(0.88, 0.85, 0.77), rough=0.9),
        blueprint=mat("M_dq_blueprint", tex="dq_blueprint", rough=0.9),
        form=mat("M_dq_form", tex="dq_form", rough=0.9),
        mug=mat("M_dq_mug", tex="dq_mug", rough=0.25),
        cup=mat("M_dq_cup", tex="dq_cup", rough=0.5, metal=0.4),
        ink=mat("M_dq_ink", color=(0.35, 0.02, 0.03), rough=0.6),
        rubber=mat("M_dq_rubber", color=(0.5, 0.05, 0.05), rough=0.7),
        lampshade=mat("M_dq_lampshade", color=(0.03, 0.035, 0.04), rough=0.35, metal=0.7),
        bulb=mat("M_dq_bulb", color=(1.0, 0.85, 0.6), emit=(1.0, 0.8, 0.5), strength=18),
        plinth=mat("M_dq_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
    )


# ---------------------------------------------------------------- room
def build_room(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("DQ_Plinth", (W + 0.4, D + 0.42, 0.16), loc=(0.1, -0.12, -0.21), material=m["plinth"], bevel=0.02, **p)
    geo.box("DQ_Floor", (W + 0.2, D + 0.22, 0.05), loc=(0.08, -0.09, -0.05), material=m["floor"], bevel=0.006, uv="box", uv_scale=0.8, **p)
    t = 0.06
    wx0, wx1 = WIN["x"] - WIN["w"] / 2, WIN["x"] + WIN["w"] / 2
    for nm, x0, x1, z0, z1 in [("L", LEFT_X - t, wx0, 0, H), ("R", wx1, W / 2 + 0.1, 0, H),
                               ("Below", wx0, wx1, 0, WIN["z0"]), ("Above", wx0, wx1, WIN["z1"], H)]:
        geo.box(f"DQ_Wall_Back_{nm}", (x1 - x0, t, z1 - z0), loc=((x0 + x1) / 2, BACK_Y + t / 2, z0), material=m["wall"], bevel=0,
                uv="box", uv_scale=0.9, **p)
    geo.box("DQ_Wall_Left", (t, D + 0.1, H), loc=(LEFT_X - t / 2, -0.05, 0), material=m["wall"], bevel=0, uv="box", uv_scale=0.9, **p)
    for nm, dims, loc in [("Base_Back", (W + 0.1, 0.025, 0.07), (0.05, BACK_Y - 0.012, 0)), ("Base_Left", (0.025, D + 0.1, 0.07), (LEFT_X + 0.012, -0.05, 0)),
                          ("Top_Back", (W + 0.1, 0.03, 0.03), (0.05, BACK_Y - 0.015, H - 0.03)), ("Top_Left", (0.03, D + 0.1, 0.03), (LEFT_X + 0.015, -0.05, H - 0.03))]:
        geo.box(f"DQ_{nm}", dims, loc=loc, material=m["metal"], bevel=0.003, **p)
    # window: metal frame, dusk city outside, venetian blinds half drawn
    geo.box("DQ_Dusk", (WIN["w"] + 0.3, 0.01, WIN["z1"] - WIN["z0"] + 0.3), loc=(WIN["x"], BACK_Y + 0.2, WIN["z0"] - 0.15),
            material=m["sky"], bevel=0, uv="fit", fit_axis=1, **p)
    def frame(bm):
        fw, z0, z1, y = WIN["w"], WIN["z0"], WIN["z1"], BACK_Y + 0.03
        for x in (WIN["x"] - fw / 2 + 0.012, WIN["x"] + fw / 2 - 0.012, WIN["x"]):
            geo.add_box(bm, (0.024 if x != WIN["x"] else 0.012, 0.04, z1 - z0), (x, y, z0))
        for z in (z0, z1 - 0.024, (z0 + z1) / 2):
            geo.add_box(bm, (fw, 0.04, 0.024 if z != (z0 + z1) / 2 else 0.012), (WIN["x"], y, z))
        geo.add_box(bm, (fw + 0.06, 0.07, 0.02), (WIN["x"], BACK_Y - 0.01, z0 - 0.02))
        for k in range(11):                                   # blinds: the top 40 %
            geo.add_box(bm, (fw - 0.03, 0.02, 0.003), (WIN["x"], BACK_Y - 0.015, z1 - 0.03 - k * 0.019), (radians(-25), 0, 0))
    geo.merged("DQ_Window_Frame", frame, material=m["metal"], bevel=0.0015, seg=1, **p)
    # the DOQI sign and the posters
    geo.box("DQ_Sign", (0.4, 0.02, 0.15), loc=(-0.14, BACK_Y - 0.012, 0.8), material=m["sign"], bevel=0.004, uv="fit", fit_axis=1, **p)
    def rivets(bm):
        for x in (-0.325, 0.045):
            for z in (0.815, 0.935):
                geo.add_cyl(bm, 0.006, 0.006, (x, BACK_Y - 0.022, z), (radians(90), 0, 0), verts=8, r_top=0.004)
    geo.merged("DQ_Sign_Rivets", rivets, material=M("chrome"), bevel=0, **p)
    for nm, mt, y, z in (("DQ_Poster_A", "poster_a", -0.1, 0.52), ("DQ_Poster_B", "poster_b", -0.42, 0.55)):
        geo.box(nm, (0.006, 0.24, 0.36), loc=(LEFT_X + 0.004, y, z), material=m[mt], bevel=0, uv="fit", fit_axis=0, **p)
    # filing cabinet against the left wall (back), with a globe on top
    cab = geo.box("DQ_Cabinet", (0.42, 0.4, 0.92), loc=(LEFT_X + 0.22, BACK_Y - 0.24, 0), material=m["cabinet"], parent=root, bevel=0.008)
    for k in range(4):
        z = 0.03 + k * 0.225
        geo.box(f"DQ_Cabinet_Drawer_{k}", (0.012, 0.36, 0.2), loc=(0.211, 0, z), material=m["cabinet"], parent=cab, bevel=0.004)
        geo.box(f"DQ_Cabinet_Handle_{k}", (0.012, 0.09, 0.014), loc=(0.222, 0, z + 0.12), material=M("chrome"), parent=cab, bevel=0.003)
        geo.box(f"DQ_Cabinet_Label_{k}", (0.004, 0.07, 0.03), loc=(0.219, 0, z + 0.15), material=m["paper"], parent=cab, bevel=0)
    gl = geo.lathe("DQ_Globe_Stand", [(0, 0), (0.06, 0), (0.06, 0.012), (0.012, 0.025), (0.01, 0.07), (0, 0.07)], loc=(0, 0, 0.92),
                   material=M("brass"), parent=cab, segments=24)
    geo.sphere("DQ_Globe", 0.085, loc=(0, 0, 0.065), rot=(radians(23), 0, 0.6), material=M("brass"), parent=gl, segs=28)
    L = bpy.data.lights.new("LIGHT_DQ_Dusk", 'AREA')
    L.energy, L.color, L.size = 7, (1.0, 0.65, 0.45), 0.4
    lo = bpy.data.objects.new("LIGHT_DQ_Dusk", L)
    lo.location = (WIN["x"], BACK_Y + 0.12, 0.8)
    lo.rotation_euler = (radians(-70), 0, 0)
    S.coll("LIGHTS").objects.link(lo)
    return cab


# ---------------------------------------------------------------- the desk and everything on it
def build_desk(root, m):
    c = DESK
    w, d, h = c["w"], c["d"], c["h"]
    desk = geo.box("DQ_Desk", (w, d, 0.04), loc=(c["x"], c["y"], h - 0.04), rot=(0, 0, radians(c["rz"])), material=M("wood_dark"),
                   parent=root, bevel=0.006)
    for sx in (-1, 1):                                        # two drawer pedestals
        ped = geo.box(f"DQ_Desk_Pedestal_{'L' if sx < 0 else 'R'}", (0.3, d - 0.04, h - 0.04), loc=(sx * (w / 2 - 0.17), 0.0, -(h - 0.04)),
                      material=M("wood_dark"), parent=desk, bevel=0.005)
        for k in range(3):
            geo.box(f"{ped.name}_Drawer_{k}", (0.27, 0.01, 0.2), loc=(0, -(d - 0.04) / 2 - 0.004, 0.03 + k * 0.225), material=M("wood"), parent=ped, bevel=0.003)
            geo.box(f"{ped.name}_Pull_{k}", (0.07, 0.012, 0.012), loc=(0, -(d - 0.04) / 2 - 0.012, 0.15 + k * 0.225), material=M("brass"), parent=ped, bevel=0.002)
    geo.box("DQ_Desk_Modesty", (w - 0.64, 0.02, h - 0.2), loc=(0, d / 2 - 0.04, -(h - 0.04) + 0.12), material=M("wood_dark"), parent=desk, bevel=0.003)
    top = 0.04
    # ---- J.E.F.F.
    jeff = geo.box("DQ_Jeff", (0.28, 0.25, 0.3), loc=(0.0, 0.08, top), material=m["jeff"], parent=desk, bevel=0.018, seg=3)
    geo.box("DQ_Jeff_Bezel", (0.22, 0.02, 0.17), loc=(0, -0.125, 0.11), material=m["bezel"], parent=jeff, bevel=0.012, seg=3)
    geo.box("DQ_Jeff_Screen", (0.18, 0.004, 0.135), loc=(0, -0.136, 0.128), material=m["screen"], parent=jeff, bevel=0, uv="fit", fit_axis=1)
    def grille(bm):
        for k in range(6):
            geo.add_box(bm, (0.13, 0.006, 0.004), (0, -0.126, 0.07 - k * 0.008 + 0.012))
        for k in range(7):
            geo.add_box(bm, (0.004, 0.03, 0.006), (0.143, -0.06 + k * 0.012, 0.2))
    geo.merged("DQ_Jeff_Grille", grille, material=m["metal"], parent=jeff, bevel=0)
    geo.box("DQ_Jeff_Plate", (0.17, 0.004, 0.06), loc=(0, -0.127, 0.012), material=m["plate"], parent=jeff, bevel=0.001, uv="fit", fit_axis=1)
    geo.box("DQ_Jeff_Light", (0.03, 0.006, 0.012), loc=(0.1, -0.127, 0.017), material=m["amber"], parent=jeff, bevel=0.002)
    geo.curve_tube("DQ_Jeff_Cable", [Vector((-0.1, 0.12, 0.05)), Vector((-0.14, 0.2, 0.0)), Vector((-0.2, 0.26, -0.0))], 0.006,
                   material=M("cable"), parent=jeff, ring=8, steps=6)
    L = bpy.data.lights.new("LIGHT_DQ_Jeff", 'AREA')
    L.energy, L.color, L.size = 1.2, (0.35, 1.0, 0.55), 0.16
    lj = bpy.data.objects.new("LIGHT_DQ_Jeff", L)
    lj.parent = jeff
    lj.location = (0, -0.16, 0.2)
    lj.rotation_euler = (radians(-65), 0, 0)              # toward the viewer, a little down
    S.coll("LIGHTS").objects.link(lj)
    # ---- the folder stack (labelled tabs toward the viewer)
    fol = S.empty("DQ_Folders", "PROPS", loc=(-0.34, 0.02, top), rot=(0, 0, radians(6)), parent=desk, size=0.05)
    rng = random.Random(8)
    n = len(FOLDERS)
    for k, label in enumerate(FOLDERS[::-1]):                 # FILE ANYWAY at the bottom, PROPOSALS on top
        row = n - 1 - k
        z = k * 0.017
        f = geo.box(f"DQ_Folder_{k}", (0.24, 0.3, 0.013), loc=(rng.uniform(-0.008, 0.008), rng.uniform(-0.01, 0.01), z),
                    rot=(0, 0, radians(rng.uniform(-4, 4))), material=m["folder"], parent=fol, bevel=0.002)
        geo.box(f"DQ_Folder_{k}_Paper", (0.22, 0.29, 0.004), loc=(0.006, 0.004, 0.011), material=m["paper"], parent=f, bevel=0)
        geo.box(f"DQ_Folder_{k}_Tab", (0.11, 0.003, 0.016), loc=(-0.06 + (row % 3) * 0.06, -0.151, -0.001), material=m["tabs"], parent=f, bevel=0,
                uv="fit", fit_axis=1, uv_region=(0, 1 - (row + 1) / n, 1, 1 - row / n))
    # ---- the mug
    r_, hh, tt = 0.04, 0.095, 0.004
    mug = geo.lathe("DQ_Mug", [(0, 0), (r_ * 0.92, 0), (r_, 0.006), (r_, hh), (r_ - tt, hh), (r_ - tt, tt * 2), (0, tt * 2)], loc=(-0.2, -0.17, top),
                    rot=(0, 0, radians(-6)), material=[m["mug"], M("ceramic")], parent=desk, segments=40, uv_span=(2, 3))
    geo.curve_tube("DQ_Mug_Handle", [(r_ - 0.002, 0, hh * 0.78), (r_ + 0.022, 0, hh * 0.74), (r_ + 0.026, 0, hh * 0.45), (r_ + 0.018, 0, hh * 0.25),
                                     (r_ - 0.002, 0, hh * 0.22)], 0.0055, material=M("ceramic"), parent=mug, ring=10, steps=5)
    geo.cylinder("DQ_Mug_Coffee", r_ - tt - 0.0005, 0.001, loc=(0, 0, hh * 0.84), material=M("coffee"), parent=mug, verts=32, bevel=0)
    # ---- the pencil cup
    cup = geo.lathe("DQ_PencilCup", [(0, 0), (0.038, 0), (0.038, 0.1), (0.034, 0.1), (0.034, 0.006), (0, 0.006)], loc=(0.38, 0.15, top),
                    rot=(0, 0, radians(84)), material=[m["cup"], m["metal"]], parent=desk, segments=32, uv_span=(1, 2))
    for k, (a, tilt, col) in enumerate([(0.3, 8, "pencil_yellow"), (2.0, -10, "pencil_red"), (3.6, 6, "pencil_yellow"), (5.0, -5, "graphite")]):
        geo.cylinder(f"DQ_Pencil_{k}", 0.004, 0.17, loc=(cos(a) * 0.016, sin(a) * 0.016, 0.01), rot=(radians(tilt), radians(tilt * 0.6), 0),
                     material=M(col), parent=cup, verts=6, bevel=0)
    # ---- blueprints, a crumpled idea
    for k, (x, y, rz) in enumerate([(-0.02, -0.12, 8), (0.06, -0.15, -6)]):
        geo.box(f"DQ_Blueprint_{k}", (0.3, 0.2, 0.0015), loc=(x, y, top + k * 0.0016), rot=(0, 0, radians(rz)), material=m["blueprint"], parent=desk,
                bevel=0, uv="fit", fit_axis=2)
    ball = geo.sphere("DQ_Crumple", 0.026, loc=(0.13, -0.2, top), material=m["paper"], parent=desk, segs=12)
    rng2 = random.Random(2)
    for v in ball.data.vertices:                              # crumpled: every vertex pushed in or out
        c0 = Vector((0, 0, 0.026))
        v.co = c0 + (v.co - c0) * rng2.uniform(0.72, 1.18)
    # ---- the form, the ink pad, the stamp
    form = geo.box("DQ_Form", (0.15, 0.2, 0.0015), loc=(0.27, -0.12, top + 0.0017), rot=(0, 0, radians(-6)), material=m["form"], parent=desk, bevel=0,
                   uv="fit", fit_axis=2)
    pad = geo.box("DQ_InkPad", (0.09, 0.06, 0.012), loc=(0.42, -0.02, top), material=m["metal"], parent=desk, bevel=0.002)
    geo.box("DQ_InkPad_Ink", (0.078, 0.048, 0.002), loc=(0, 0, 0.011), material=m["ink"], parent=pad, bevel=0)
    stamp = geo.box("DQ_Stamp", (0.06, 0.035, 0.008), loc=(0.42, -0.02, top + 0.0125), material=m["rubber"], parent=desk, bevel=0.001)
    geo.box("DQ_Stamp_Mount", (0.064, 0.039, 0.012), loc=(0, 0, 0.008), material=M("wood"), parent=stamp, bevel=0.002)
    geo.lathe("DQ_Stamp_Handle", [(0, 0), (0.008, 0), (0.007, 0.035), (0.016, 0.05), (0.017, 0.062), (0.01, 0.07), (0, 0.071)], loc=(0, 0, 0.02),
              material=M("wood_dark"), parent=stamp, segments=20)
    # ---- desk lamp (dome shade, warm bulb)
    lamp = geo.lathe("DQ_Lamp", [(0, 0), (0.07, 0), (0.07, 0.012), (0.02, 0.02), (0, 0.02)], loc=(-0.38, 0.18, top), material=m["lampshade"], parent=desk, segments=28)
    geo.curve_tube("DQ_Lamp_Arm", [Vector((0, 0, 0.015)), Vector((0.02, -0.03, 0.2)), Vector((0.08, -0.08, 0.3))], 0.008, material=m["lampshade"], parent=lamp, ring=8, steps=6)
    shade = geo.lathe("DQ_Lamp_Shade", [(0.02, 0.06), (0.06, 0.04), (0.09, 0.0), (0.088, -0.004), (0.058, 0.036), (0.018, 0.056)],
                      loc=(0.09, -0.09, 0.3), rot=(radians(35), radians(-20), 0), material=m["lampshade"], parent=lamp, segments=28, loop=True)
    bl = geo.sphere("DQ_Lamp_Bulb", 0.022, loc=(0, 0, 0.005), material=m["bulb"], parent=shade, segs=14)
    bl.visible_shadow = False
    Ll = bpy.data.lights.new("LIGHT_DQ_Lamp", 'SPOT')
    Ll.energy, Ll.color, Ll.spot_size, Ll.spot_blend, Ll.shadow_soft_size = 18, (1.0, 0.78, 0.5), radians(95), 0.6, 0.03
    ll = bpy.data.objects.new("LIGHT_DQ_Lamp", Ll)
    ll.parent = shade
    ll.location = (0, 0, 0.03)
    ll.rotation_euler = (0, 0, 0)                         # down out of the shade
    S.coll("LIGHTS").objects.link(ll)
    # ---- the tin robot
    rob = geo.box("DQ_Robot", (0.04, 0.03, 0.045), loc=(0.24, 0.18, top + 0.03), rot=(0, 0, radians(-30)), material=M("chrome"), parent=desk, bevel=0.003)
    for sx in (-1, 1):
        geo.box(f"DQ_Robot_Leg_{'L' if sx < 0 else 'R'}", (0.012, 0.016, 0.03), loc=(sx * 0.01, 0, -0.03), material=m["metal"], parent=rob, bevel=0.002)
        geo.box(f"DQ_Robot_Arm_{'L' if sx < 0 else 'R'}", (0.008, 0.01, 0.03), loc=(sx * 0.025, 0, 0.012), material=m["metal"], parent=rob, bevel=0.002)
    head = geo.box("DQ_Robot_Head", (0.034, 0.028, 0.026), loc=(0, 0, 0.046), material=M("chrome"), parent=rob, bevel=0.003)
    for sx in (-1, 1):
        geo.cylinder(f"DQ_Robot_Eye_{'L' if sx < 0 else 'R'}", 0.005, 0.003, loc=(sx * 0.008, -0.015, 0.012), rot=(radians(90), 0, 0), material=m["amber"], parent=head, verts=10, bevel=0)
    geo.cylinder("DQ_Robot_Antenna", 0.0015, 0.015, loc=(0, 0, 0.026), material=m["metal"], parent=head, verts=6, bevel=0)
    return desk, jeff, fol, mug, cup, form, pad, stamp, lamp, rob


def build(root):
    m = materials()
    cab = build_room(root, m)
    desk, jeff, fol, mug, cup, form, pad, stamp, lamp, rob = build_desk(root, m)
    poster = bpy.data.objects["DQ_Poster_B"]
    for obj, iid, label in [(jeff, "dq_jeff", "J.E.F.F."), (fol, "dq_folders", "The Filing System"), (mug, "dq_mug", "Mug"),
                            (stamp, "dq_stamp", "The Stamp"), (form, "dq_form", "Form 27-B"), (cab, "dq_cabinet", "Filing Cabinet"),
                            (rob, "dq_robot", "Tin Robot"), (poster, "dq_poster", "Poster"), (pad, "dq_pad", "Ink Pad")]:
        S.mark_interactive(obj, iid, label, scope="doqi", kind="discovery")
    return dict(desk=desk)
