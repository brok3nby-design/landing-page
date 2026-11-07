"""WRFM exhibit: the late-night studio of WRFM 97.1, hosted by Vera Lang.

A corner of the broadcast studio, cut away like a dollhouse: quilted acoustic padding over a dark wood
wainscot, the ON AIR lightbox, the WRFM 97.1 logo and two band posters from the station's own artwork
(Silas North Combo, the Evelyn Crane Ensemble). At the broadcast desk, facing the viewer: the big chrome
microphone on its stand, a mixing console with two glowing VU meters and faders, headphones, a WRFM mug,
the night's running order, a turntable with a record and the "Don't Wake the Typewriter" sleeve, and a
green digital clock. Somewhere in the studio: the red rotary phone nobody tells you about.

The station artwork is the studio's own (app/public/media/projects/wrfm/...), loaded as textures.
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

W, D, H = 1.4, 1.15, 1.15
BACK_Y, LEFT_X = D / 2, -W / 2
DESK = dict(x=0.1, y=-0.06, rz=40, w=1.0, d=0.55, h=0.74)
ART = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "app", "public", "media", "projects", "wrfm"))
CLOSEUPS = [("CAM_Exhibit_CloseDesk", ["WR_Mic", "WR_Console", "WR_Turntable", "WR_Mug"], 24, 30, 50, 0.85)]
LIGHT_GAIN = dict(key=4.2, fill=2.8, rim=2.0)
BAKE_HIDE = ["WR_Record", "WR_VU_Needle_L", "WR_VU_Needle_R"]   # they move on the website


# ---------------------------------------------------------------- textures
def _art(name, file, bg="#0b0a0c", size=None, crop=None):
    """One of the station's own images as a texture (transparency composited onto `bg`)."""
    img = bpy.data.images.load(os.path.join(ART, file))
    if size:
        img.scale(*size)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    if crop:                                                   # (x0, y0, x1, y1) as fractions, row 0 = top
        x0, y0, x1, y1 = crop
        a = a[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    al = a[..., 3:4]
    a[..., :3] = a[..., :3] * al + np.array(T.rgb(bg)) * (1 - al)
    c = T.Canvas(a.shape[1], a.shape[0])
    c.a[..., :3] = a[..., :3]
    return c.save(name)


def _tex_padding(name="wr_padding", size=1024):
    """Quilted acoustic padding: deep burgundy-brown diamonds with buttons in the seams."""
    c = T.Canvas(size, size, T.rgb("#3a1c1f"))
    n = 8
    s = size / n
    yy, xx = c.yy, c.xx
    u = ((xx + yy) / (s * 1.414)) % 1.0
    v = ((xx - yy) / (s * 1.414)) % 1.0
    puff = np.sin(u * pi) * np.sin(v * pi)                     # each diamond swells in the middle
    c.mul(0.55 + 0.6 * puff)
    c.mul(0.9 + 0.15 * T.noise(size, size, 30, 3))
    for i in range(-n, 2 * n):
        for j in range(-n, 2 * n):
            x, y = (i + j) * s / 2, (j - i) * s / 2
            if -10 < x < size + 10 and -10 < y < size + 10:
                c.circle(x, y, 6, T.rgb("#1a0b0c")); c.circle(x - 1.5, y - 1.5, 2.5, T.rgb("#6a4a3a"), 0.6)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=5.0, size=(512, 512), blur=1.2)


def _tex_onair(name="wr_onair", w=512, h=192):
    c = T.Canvas(w, h, T.rgb("#5a0d0a"))
    c._blend(np.clip(1 - (((c.xx - w / 2) / (w * 0.6)) ** 2 + ((c.yy - h / 2) / (h * 0.8)) ** 2), 0, 1), T.rgb("#ff3b22"), 0.9)
    c.text("ON AIR", w / 2 - 6 * 6 * 9 / 2 + 6, h / 2 - 7 * 9 / 2, 9, T.rgb("#fff1d6"))
    return c.save(name)


def _tex_clock(name="wr_clock", w=256, h=96):
    c = T.Canvas(w, h, T.rgb("#071a10"))
    c.text("11:59", 22, 22, 8, T.rgb("#6dff9e"))
    c.text("PM", 196, 56, 3, T.rgb("#6dff9e"))
    return c.save(name)


def _tex_vu(name="wr_vu", w=256, h=160):
    c = T.Canvas(w, h, T.rgb("#f3d58f"))
    c._blend(np.clip(1 - ((c.yy - h) / (h * 1.1)) ** 2, 0, 1), T.rgb("#ffe7a8"), 0.8)
    for k in range(11):                                        # scale arc ticks; red zone on the right
        a = radians(-50 + k * 10)
        x0, y0 = w / 2 + sin(a) * 100, h - 20 - cos(a) * 100
        x1, y1 = w / 2 + sin(a) * 118, h - 20 - cos(a) * 118
        c.line(x0, y0, x1, y1, 3, T.rgb("#b3221c" if k >= 8 else "#2a2015"))
    c.text("VU", w / 2 - 12, h - 52, 4, T.rgb("#2a2015"))
    return c.save(name)


def _tex_console(name="wr_console", w=1024, h=512):
    c = T.Canvas(w, h, T.rgb("#2a2b2e"))
    c.mul(0.9 + 0.12 * T.noise(h, w, 20, 5))
    for k in range(8):                                         # channel strips: slots + scribble strip
        x = 70 + k * 115
        c.rect(x - 4, 200, x + 4, 470, T.rgb("#0c0c0e"))
        c.rect(x - 40, 160, x + 40, 186, T.rgb("#e8e2cf"))
        for j in range(3):
            c.circle(x, 50 + j * 36, 13, T.rgb("#15161a")); c.circle(x, 50 + j * 36, 4, T.rgb("#c9c2b0"))
    labels = ["MIC 1", "VERA", "PHONE", "TT", "CART", "ADS", "AUX", "MAIN"]
    for k, t in enumerate(labels):
        c.text(t, 70 + k * 115 - len(t) * 9, 166, 3, T.rgb("#1c1c1c"))
    return c.save(name)


def textures():
    out = {"wr_onair": _tex_onair(), "wr_clock": _tex_clock(), "wr_vu": _tex_vu(), "wr_console": _tex_console()}
    out["wr_padding"], out["wr_padding_n"] = _tex_padding()
    out["wr_logo"] = _art("wr_logo", "gallery/wrfm_05.webp", bg="#0b0a0c", size=(768, 768))
    out["wr_poster_silas"] = _art("wr_poster_silas", "gallery/wrfm_07.webp", size=(512, 768))
    out["wr_poster_crane"] = _art("wr_poster_crane", "gallery/wrfm_01.webp", size=(512, 768))
    out["wr_sleeve"] = _art("wr_sleeve", "gallery/wrfm_03.webp", size=(512, 512))
    out["wr_label"] = _art("wr_label", "gallery/wrfm_04.webp", size=(512, 512), crop=(0.33, 0.33, 0.67, 0.67))
    rec = T.Canvas(512, 512, T.rgb("#0b0b0c"))                  # the record: grooves, a sheen, the label in the middle
    d = np.sqrt((rec.xx - 256) ** 2 + (rec.yy - 256) ** 2)
    rec.mul(0.75 + 0.35 * (np.sin(d * 1.6) * 0.5 + 0.5) * (d < 250))
    out["wr_record"] = rec.save("wr_record")
    mug = T.mug("wr_mug", text="WRFM|97.1", icon=False, base="#1a1a1e")
    out["wr_mug"] = mug
    out["wr_script"] = T.label_card("wr_script", 300, 400, [("TONIGHT", 4), ("", 2), ("11:00 VERA SIGNS ON", 2), ("11:20 RUBBER DUCK", 2),
                                                           ("11:40 CALLERS", 2), ("12:00 AFTER DARK", 2), ("??:?? STUDIO B", 2)], "#efe9d8", "#222222")
    TEX.update(out)
    return out


def materials():
    return dict(
        padding=mat("M_wr_padding", tex="wr_padding", rough=0.9, normal="wr_padding_n", normal_strength=0.9),
        onair=mat("M_wr_onair", color=(0, 0, 0), rough=0.3, emit_tex="wr_onair", strength=3.5),
        onair_case=mat("M_wr_onair_case", color=(0.05, 0.05, 0.05), rough=0.35, metal=0.7),
        logo=mat("M_wr_logo", tex="wr_logo", rough=0.5),
        silas=mat("M_wr_silas", tex="wr_poster_silas", rough=0.75),
        crane=mat("M_wr_crane", tex="wr_poster_crane", rough=0.8),
        sleeve=mat("M_wr_sleeve", tex="wr_sleeve", rough=0.7),
        label=mat("M_wr_label", tex="wr_label", rough=0.6),
        record=mat("M_wr_record", tex="wr_record", rough=0.25),
        console=mat("M_wr_console", tex="wr_console", rough=0.5, metal=0.4),
        vu=mat("M_wr_vu", color=(0, 0, 0), rough=0.3, emit_tex="wr_vu", strength=1.6),
        needle=mat("M_wr_needle", color=(0.05, 0.04, 0.03), rough=0.4),
        clock=mat("M_wr_clock", color=(0, 0, 0), rough=0.2, emit_tex="wr_clock", strength=2.0),
        mug=mat("M_wr_mug", tex="wr_mug", rough=0.3),
        script=mat("M_wr_script", tex="wr_script", rough=0.9),
        phone=mat("M_wr_phone", color=(0.55, 0.03, 0.04), rough=0.25),
        dial=mat("M_wr_dial", color=(0.9, 0.88, 0.82), rough=0.4),
        felt=mat("M_wr_felt", color=(0.12, 0.02, 0.03), rough=0.95),
        whisky=mat("M_wr_whisky", color=(0.6, 0.3, 0.05), rough=0.05, transmission=0.8, ior=1.33),
        bulb=mat("M_wr_bulb", color=(1.0, 0.85, 0.6), emit=(1.0, 0.8, 0.5), strength=14),
        floor=mat("M_wr_floor", tex="planks", rough=0.55, normal="planks_n", normal_strength=0.5, tint=(0.35, 0.26, 0.22)),
        plinth=mat("M_wr_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
        grille=mat("M_wr_grille", color=(0.5, 0.5, 0.52), rough=0.35, metal=1.0),
    )


# ---------------------------------------------------------------- room
def build_room(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("WR_Plinth", (W + 0.4, D + 0.42, 0.16), loc=(0.1, -0.12, -0.21), material=m["plinth"], bevel=0.02, **p)
    geo.box("WR_Floor", (W + 0.2, D + 0.22, 0.05), loc=(0.08, -0.09, -0.05), material=m["floor"], bevel=0.006, **p)
    geo.box("WR_Rug", (1.0, 0.8, 0.006), loc=(DESK["x"], DESK["y"] - 0.05, 0), rot=(0, 0, radians(DESK["rz"])), material=m["felt"], bevel=0.002, **p)
    t = 0.06
    geo.box("WR_Wall_Back", (W + 0.1 + t, t, H), loc=(0.05 - t / 2, BACK_Y + t / 2, 0), material=m["padding"], bevel=0, uv="box", uv_scale=1.2, **p)
    geo.box("WR_Wall_Left", (t, D + 0.1, H), loc=(LEFT_X - t / 2, -0.05, 0), material=m["padding"], bevel=0, uv="box", uv_scale=1.2, **p)
    wood = M("wood_dark")
    for nm, dims, loc in [("Wainscot_Back", (W + 0.1, 0.02, 0.32), (0.05, BACK_Y - 0.01, 0)), ("Wainscot_Left", (0.02, D + 0.1, 0.32), (LEFT_X + 0.01, -0.05, 0)),
                          ("Rail_Back", (W + 0.1, 0.035, 0.03), (0.05, BACK_Y - 0.017, 0.32)), ("Rail_Left", (0.035, D + 0.1, 0.03), (LEFT_X + 0.017, -0.05, 0.32)),
                          ("Crown_Back", (W + 0.1, 0.045, 0.045), (0.05, BACK_Y - 0.022, H - 0.045)), ("Crown_Left", (0.045, D + 0.1, 0.045), (LEFT_X + 0.022, -0.05, H - 0.045))]:
        geo.box(f"WR_{nm}", dims, loc=loc, material=wood, bevel=0.005, **p)
    # ON AIR lightbox (lit on the website while Vera is on air)
    oa = geo.box("WR_OnAir", (0.3, 0.06, 0.11), loc=(0.12, BACK_Y - 0.03, 0.9), material=m["onair_case"], parent=root, bevel=0.008)
    geo.box("WR_OnAir_Face", (0.27, 0.004, 0.085), loc=(0, -0.031, 0.0125), material=m["onair"], parent=oa, bevel=0, uv="fit", fit_axis=1)
    L = bpy.data.lights.new("LIGHT_Exhibit_OnAir", 'POINT')     # render only: the website lights it at runtime
    L.energy, L.color, L.shadow_soft_size = 6, (1.0, 0.25, 0.15), 0.1
    lo = bpy.data.objects.new("LIGHT_Exhibit_OnAir", L)
    lo.location = (0.12, BACK_Y - 0.12, 0.95)
    S.coll("LIGHTS").objects.link(lo)
    # the WRFM 97.1 logo (framed) + the band posters
    fr = geo.box("WR_Logo", (0.36, 0.02, 0.36), loc=(-0.32, BACK_Y - 0.012, 0.52), material=wood, parent=root, bevel=0.006)
    geo.box("WR_Logo_Art", (0.32, 0.004, 0.32), loc=(0, -0.011, 0.02), material=m["logo"], parent=fr, bevel=0, uv="fit", fit_axis=1)
    for nm, mt, y in (("WR_Poster_Silas", "silas", -0.05), ("WR_Poster_Crane", "crane", -0.4)):
        geo.box(nm, (0.006, 0.22, 0.33), loc=(LEFT_X + 0.004, y, 0.5), material=m[mt], parent=root, bevel=0, uv="fit", fit_axis=0)
    # the clock
    clk = geo.box("WR_Clock", (0.2, 0.04, 0.08), loc=(0.5, BACK_Y - 0.02, 0.78), material=m["onair_case"], parent=root, bevel=0.006)
    geo.box("WR_Clock_Face", (0.18, 0.003, 0.06), loc=(0, -0.0205, 0.01), material=m["clock"], parent=clk, bevel=0, uv="fit", fit_axis=1)


# ---------------------------------------------------------------- the broadcast desk
def build_desk(root, m):
    c = DESK
    w, d, h = c["w"], c["d"], c["h"]
    desk = geo.box("WR_Desk", (w, d, 0.04), loc=(c["x"], c["y"], h - 0.04), rot=(0, 0, radians(c["rz"])), material=M("wood_dark"), parent=root, bevel=0.008)
    geo.box("WR_Desk_Front", (w - 0.04, 0.03, h - 0.06), loc=(0, -d / 2 + 0.03, -(h - 0.04)), material=m["felt"], parent=desk, bevel=0.004)
    for sx in (-1, 1):
        geo.box(f"WR_Desk_Side_{'L' if sx < 0 else 'R'}", (0.03, d - 0.02, h - 0.04), loc=(sx * (w / 2 - 0.03), 0, -(h - 0.04)), material=M("wood_dark"), parent=desk, bevel=0.004)
    geo.box("WR_Desk_Trim", (w - 0.04, 0.012, 0.02), loc=(0, -d / 2 + 0.012, -0.03), material=M("brass"), parent=desk, bevel=0.002)
    plq = geo.box("WR_Desk_Plaque", (0.3, 0.012, 0.3), loc=(0, -d / 2 + 0.012, -0.42), material=M("brass"), parent=desk, bevel=0.004)
    geo.box("WR_Desk_Plaque_Art", (0.27, 0.003, 0.27), loc=(0, -0.007, 0.015), material=m["logo"], parent=plq, bevel=0, uv="fit", fit_axis=1)
    top = 0.04
    # ---- the mixing console: sloped, with faders and two VU meters
    con = geo.box("WR_Console", (0.46, 0.22, 0.05), loc=(0.05, 0.08, top), rot=(radians(-8), 0, 0), material=m["console"], parent=desk, bevel=0.006,
                  uv="fit", fit_axis=2)
    def faders(bm):
        for k in range(8):
            x = -0.46 / 2 + (70 + k * 115) / 1024 * 0.46
            geo.add_box(bm, (0.014, 0.01, 0.012), (x, -0.03 + (k % 3) * 0.012, 0.05))
    geo.merged("WR_Console_Faders", faders, material=M("plastic_black"), parent=con, bevel=0.002, seg=1)
    vu = geo.box("WR_VU", (0.2, 0.05, 0.07), loc=(0, 0.1, 0.05), rot=(radians(-12), 0, 0), material=m["onair_case"], parent=con, bevel=0.005)
    needles = []
    for k, sx in enumerate((-1, 1)):
        geo.box(f"WR_VU_Face_{'L' if sx < 0 else 'R'}", (0.08, 0.003, 0.05), loc=(sx * 0.047, -0.026, 0.01), material=m["vu"], parent=vu, bevel=0,
                uv="fit", fit_axis=1)
        piv = S.empty(f"WR_VU_Needle_{'L' if sx < 0 else 'R'}", "PROPS", loc=(sx * 0.047, -0.029, 0.013), rot=(0, radians(40), 0), parent=vu, size=0.01)
        geo.box(f"WR_VU_Needle_{'L' if sx < 0 else 'R'}_Bar", (0.0015, 0.001, 0.038), loc=(0, 0, 0), material=m["needle"], parent=piv, bevel=0)
        needles.append(piv)
    # ---- the microphone on its desk stand (the big chrome one from the cover art)
    mic = geo.lathe("WR_Mic", [(0, 0), (0.075, 0), (0.075, 0.014), (0.02, 0.022), (0, 0.022)], loc=(-0.2, -0.02, top), material=M("metal_black"),
                    parent=desk, segments=32)
    geo.cylinder("WR_Mic_Pole", 0.008, 0.2, loc=(0, 0, 0.02), material=M("chrome"), parent=mic, verts=12, bevel=0)
    yoke = geo.curve_tube("WR_Mic_Yoke", [Vector((-0.05, 0, 0.27)), Vector((-0.05, 0, 0.22)), Vector((0, 0, 0.215)), Vector((0.05, 0, 0.22)), Vector((0.05, 0, 0.27))],
                          0.005, material=M("chrome"), parent=mic, ring=8, steps=4)
    head = geo.lathe("WR_Mic_Body", [(0, 0), (0.036, 0.0), (0.042, 0.012), (0.042, 0.06), (0.04, 0.066), (0.04, 0.072), (0.042, 0.078), (0.042, 0.13),
                                      (0.034, 0.16), (0.02, 0.172), (0, 0.175)], loc=(0, 0, 0.19), rot=(radians(-12), 0, 0), material=M("metal_black"), parent=mic, segments=32)
    geo.lathe("WR_Mic_Grille", [(0.0425, 0.08), (0.0425, 0.128), (0.035, 0.157), (0.021, 0.169)], material=m["grille"], parent=head, segments=32, loop=False)
    for z in (0.014, 0.066, 0.078):
        geo.lathe(f"WR_Mic_Ring_{int(z * 1000)}", [(0.0425, z - 0.003), (0.0445, z - 0.003), (0.0445, z + 0.003), (0.0425, z + 0.003)], material=M("chrome"),
                  parent=head, segments=32)
    geo.curve_tube("WR_Mic_Cable", [Vector((0, 0.02, 0.2)), Vector((0, 0.07, 0.1)), Vector((0.03, 0.12, 0.0))], 0.005, material=M("cable"), parent=mic, ring=6, steps=6)
    # ---- headphones (lying on the desk), the mug, the running order, a glass
    hp = S.empty("WR_Headphones", "PROPS", loc=(-0.36, 0.1, top), rot=(0, 0, radians(-20)), parent=desk, size=0.03)
    geo.curve_tube("WR_Headphones_Band", [Vector((-0.07, 0, 0.02)), Vector((-0.06, 0.07, 0.025)), Vector((0, 0.1, 0.028)), Vector((0.06, 0.07, 0.025)),
                                          Vector((0.07, 0, 0.02))], 0.008, material=M("leather"), parent=hp, ring=8, steps=6)
    for sx in (-1, 1):
        geo.cylinder(f"WR_Headphones_Cup_{'L' if sx < 0 else 'R'}", 0.04, 0.035, loc=(sx * 0.075, -0.005, 0.0), material=M("metal_black"), parent=hp, verts=24, bevel=0.006)
    r_, hh, tt = 0.038, 0.09, 0.004
    mug = geo.lathe("WR_Mug", [(0, 0), (r_ * 0.92, 0), (r_, 0.006), (r_, hh), (r_ - tt, hh), (r_ - tt, tt * 2), (0, tt * 2)], loc=(0.33, -0.17, top),
                    rot=(0, 0, radians(-6)), material=[m["mug"], M("ceramic")], parent=desk, segments=40, uv_span=(2, 3))
    geo.curve_tube("WR_Mug_Handle", [(r_ - 0.002, 0, hh * 0.78), (r_ + 0.022, 0, hh * 0.74), (r_ + 0.026, 0, hh * 0.45), (r_ + 0.018, 0, hh * 0.25),
                                     (r_ - 0.002, 0, hh * 0.22)], 0.0055, material=M("ceramic"), parent=mug, ring=10, steps=5)
    geo.cylinder("WR_Mug_Coffee", r_ - tt - 0.0005, 0.001, loc=(0, 0, hh * 0.84), material=M("coffee"), parent=mug, verts=32, bevel=0)
    geo.box("WR_Script", (0.15, 0.2, 0.002), loc=(0.02, -0.16, top), rot=(0, 0, radians(-8)), material=m["script"], parent=desk, bevel=0, uv="fit", fit_axis=2)
    gl = geo.lathe("WR_Glass", [(0, 0), (0.028, 0), (0.03, 0.08), (0.027, 0.08), (0.025, 0.006), (0, 0.006)], loc=(-0.08, -0.2, top), material=M("glass"),
                   parent=desk, segments=24)
    geo.cylinder("WR_Glass_Whisky", 0.024, 0.03, loc=(0, 0, 0.006), material=m["whisky"], parent=gl, verts=24, bevel=0)
    # ---- the turntable with a record, and the album sleeve
    tt_ = geo.box("WR_Turntable", (0.3, 0.26, 0.05), loc=(0.36, 0.13, top), rot=(0, 0, radians(-10)), material=M("wood"), parent=desk, bevel=0.006)
    geo.cylinder("WR_Platter", 0.11, 0.008, loc=(-0.03, 0, 0.05), material=M("metal_dark"), parent=tt_, verts=48, bevel=0.002)
    rec = geo.cylinder("WR_Record", 0.105, 0.002, loc=(-0.03, 0, 0.058), material=m["record"], parent=tt_, verts=64, bevel=0, uv="box", uv_scale=1)
    lab = geo.cylinder("WR_Record_Label", 0.035, 0.0005, loc=(0, 0, 0.002), material=m["label"], parent=rec, verts=40, bevel=0)
    for o, s_ in ((rec, 0.105), (lab, 0.035)):                 # disc UVs: fit the circle to the texture
        uvl = o.data.uv_layers[0]
        for poly in o.data.polygons:
            for li in poly.loop_indices:
                v = o.data.vertices[o.data.loops[li].vertex_index].co
                uvl.data[li].uv = (0.5 + v.x / (2 * s_), 0.5 + v.y / (2 * s_))
    arm = geo.cylinder("WR_Tonearm_Base", 0.014, 0.02, loc=(0.105, 0.08, 0.05), material=M("chrome"), parent=tt_, verts=16, bevel=0)
    geo.curve_tube("WR_Tonearm", [Vector((0, 0, 0.022)), Vector((-0.02, -0.06, 0.026)), Vector((-0.05, -0.12, 0.024))], 0.003, material=M("chrome"), parent=arm, ring=6, steps=4)
    geo.box("WR_Sleeve", (0.18, 0.004, 0.18), loc=(0.44, 0.27, top), rot=(radians(-12), 0, radians(-24)), material=m["sleeve"], parent=desk, bevel=0, uv="fit", fit_axis=1)
    # ---- a little gooseneck lamp
    lamp = geo.cylinder("WR_Lamp", 0.04, 0.012, loc=(-0.42, 0.2, top), material=M("brass"), parent=desk, verts=24, bevel=0.003)
    geo.curve_tube("WR_Lamp_Neck", [Vector((0, 0, 0.01)), Vector((0, 0, 0.15)), Vector((0.03, -0.04, 0.24)), Vector((0.07, -0.08, 0.25))], 0.005, material=M("brass"), parent=lamp, ring=6, steps=6)
    shade = geo.lathe("WR_Lamp_Shade", [(0.012, 0.05), (0.03, 0.03), (0.045, 0.0), (0.043, -0.002), (0.028, 0.028), (0.01, 0.048)], loc=(0.08, -0.09, 0.22),
                      rot=(radians(40), 0, 0), material=M("brass"), parent=lamp, segments=24, loop=True)
    b = geo.sphere("WR_Lamp_Bulb", 0.012, loc=(0, 0, 0.004), material=m["bulb"], parent=shade, segs=12)
    b.visible_shadow = False
    Ll = bpy.data.lights.new("LIGHT_WR_Lamp", 'SPOT')
    Ll.energy, Ll.color, Ll.spot_size, Ll.spot_blend, Ll.shadow_soft_size = 9, (1.0, 0.75, 0.45), radians(90), 0.6, 0.02
    ll = bpy.data.objects.new("LIGHT_WR_Lamp", Ll)
    ll.parent = shade
    ll.location = (0, 0, 0.02)
    S.coll("LIGHTS").objects.link(ll)
    return desk, con, needles, mic, hp, mug, tt_, rec


# ---------------------------------------------------------------- the phone nobody tells you about
def build_phone(root, m):
    # on the floor in the back-left corner, half hidden behind the desk, beside a crate of records
    crate = geo.box("WR_RecordCrate", (0.36, 0.3, 0.26), loc=(LEFT_X + 0.24, BACK_Y - 0.22, 0), rot=(0, 0, radians(8)), material=M("wood_light"), parent=root, bevel=0.006)
    def sleeves(bm):
        rng = random.Random(5)
        for k in range(14):
            geo.add_box(bm, (0.31, 0.006, 0.28), (0, -0.12 + k * 0.018, 0.02), (radians(rng.uniform(-8, 8)), 0, 0))
    geo.merged("WR_RecordCrate_Sleeves", sleeves, material=m["felt"], parent=crate, bevel=0)
    ph = geo.box("WR_Phone", (0.16, 0.18, 0.07), loc=(LEFT_X + 0.42, BACK_Y - 0.56, 0), rot=(0, 0, radians(30)), material=m["phone"], parent=root, bevel=0.025, seg=4)
    geo.cylinder("WR_Phone_Dial", 0.05, 0.006, loc=(0, -0.03, 0.068), rot=(radians(-18), 0, 0), material=m["dial"], parent=ph, verts=32, bevel=0.002)
    def holes(bm):
        for k in range(10):
            a = radians(-60 + k * 28)
            geo.add_cyl(bm, 0.0065, 0.004, (cos(a) * 0.034, -0.03 + sin(a) * 0.034 * 0.95, 0.073), (radians(-18), 0, 0), verts=10)
    geo.merged("WR_Phone_Holes", holes, material=M("plastic_black"), parent=ph, bevel=0)
    hs = geo.curve_tube("WR_Phone_Handset", [Vector((-0.085, 0.04, 0.085)), Vector((-0.05, 0.055, 0.1)), Vector((0.05, 0.055, 0.1)), Vector((0.085, 0.04, 0.085))],
                        0.016, material=m["phone"], parent=ph, ring=12, steps=6)
    for sx in (-1, 1):
        geo.cylinder(f"WR_Phone_Cup_{'L' if sx < 0 else 'R'}", 0.026, 0.03, loc=(sx * 0.085, 0.04, 0.062), material=m["phone"], parent=ph, verts=20, bevel=0.008)
    pts = [Vector((-0.085, 0.07, 0.07))] + [Vector((-0.1 - k * 0.012, 0.09 + 0.012 * sin(k * 1.9), 0.04 - k * 0.003)) for k in range(8)]
    geo.curve_tube("WR_Phone_Cord", pts, 0.004, material=m["phone"], parent=ph, ring=6, steps=3)
    return ph, crate


def build(root):
    m = materials()
    build_room(root, m)
    desk, con, needles, mic, hp, mug, tt_, rec = build_desk(root, m)
    ph, crate = build_phone(root, m)
    for obj, iid, label in [(mic, "wr_mic", "The Microphone"), (ph, "wr_phone", "The Phone"), (tt_, "wr_turntable", "Turntable"),
                            (bpy.data.objects["WR_OnAir"], "wr_onair", "ON AIR"), (con, "wr_console", "Mixing Console"),
                            (bpy.data.objects["WR_Logo"], "wr_logo", "WRFM 97.1"), (crate, "wr_records", "Record Crate"), (mug, "wr_mug", "Mug")]:
        S.mark_interactive(obj, iid, label, scope="wrfm", kind="discovery")
    return dict(desk=desk)
