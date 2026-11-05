"""PROPS on the desktop, under the riser, and on the riser (lamp, speakers, headphones)."""
from math import radians, pi, sin, cos
import bmesh
from mathutils import Vector

from config import FAN_ART
from lib import geo, scene as S, textures as T
from lib.library import M
from lib.mats import mat, TEX

U = 0.0195          # keyboard unit (key pitch)
TKL_ROWS = [        # (key widths in units, gap before) ; None = gap
    [1, None, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 0.5, 1, 1, 1, 1],
    [1] * 13 + [2],
    [1.5] + [1] * 12 + [1.5],
    [1.75] + [1] * 11 + [2.25],
    [2.25] + [1] * 10 + [2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
]


def keyboard(root, top):
    grp = S.empty("PROP_Keyboard", "PROPS", loc=(-0.13, 0.36, top + 0.003), rot=(0, 0, radians(1.5)),
                  parent=root)
    W, D = 18.6 * U, 6.6 * U
    geo.box("PROP_Keyboard_Case", (W, D, 0.018), collection="PROPS", material=M("metal_black"),
            parent=grp, bevel=0.005, seg=3, rests_on="PROP_DeskMat")
    geo.box("PROP_Keyboard_Glow", (W - 0.012, D - 0.012, 0.002), loc=(0, 0, 0.018), collection="PROPS",
            material=M("key_glow"), parent=grp, bevel=0, rests_on="PROP_Keyboard_Case")

    def keys(bm):
        x_start = -W / 2 + 0.3 * U
        for r, row in enumerate(TKL_ROWS):
            y = D / 2 - 0.55 * U - r * U - (0.25 * U if r > 0 else 0)
            x = x_start
            for w in row:
                if w is None:
                    x += U
                    continue
                if w == 0.5:
                    x += 0.5 * U
                    continue
                geo.add_box(bm, (w * U - 0.0032, U - 0.0032, 0.0085), loc=(x + w * U / 2, y, 0))
                x += w * U
            # navigation cluster
            nx0 = x_start + 15.25 * U
            if r == 0 or r in (1, 2):
                for k in range(3):
                    geo.add_box(bm, (U - 0.0032, U - 0.0032, 0.0085), loc=(nx0 + (k + 0.5) * U, y, 0))
            if r == 4:
                geo.add_box(bm, (U - 0.0032, U - 0.0032, 0.0085), loc=(nx0 + 1.5 * U, y, 0))
            if r == 5:
                for k in range(3):
                    geo.add_box(bm, (U - 0.0032, U - 0.0032, 0.0085), loc=(nx0 + (k + 0.5) * U, y, 0))
    geo.merged("PROP_Keyboard_Keys", keys, loc=(0, 0, 0.020), collection="PROPS",
               material=M("keycap"), parent=grp, bevel=0.0012, seg=2, uv="box", uv_scale=10,
               rests_on="PROP_Keyboard_Glow")
    return grp


def mug(root, x, y, z, name="PROP_Mug", tex="mug", scale=1.0, collection="PROPS", rot_z=0.0,
        parent=None, coffee=True, rests_on=None):
    r, h, t = 0.040 * scale, 0.092 * scale, 0.004 * scale
    prof = [(0, 0), (r * 0.92, 0), (r, 0.006 * scale), (r, h), (r - t, h), (r - t, t * 2), (0, t * 2)]
    m = geo.lathe(name, prof, loc=(x, y, z), rot=(0, 0, rot_z), collection=collection,
                  material=[M(tex), M("ceramic")],
                  parent=parent or root, segments=40, rests_on=rests_on, uv_span=(2, 3))
    m["artwork_slot"] = "mug_wrap" if tex == "mug" else "mug_figure"
    hp = [(r - 0.002 * scale, 0, h * 0.78), (r + 0.022 * scale, 0, h * 0.74), (r + 0.026 * scale, 0, h * 0.45),
          (r + 0.018 * scale, 0, h * 0.25), (r - 0.002 * scale, 0, h * 0.22)]
    geo.curve_tube(name + "_Handle", hp, 0.0055 * scale, collection=collection, material=M("ceramic"),
                   parent=m, ring=10, steps=5)
    if coffee:
        geo.cylinder(name + "_Coffee", r - t - 0.0005, 0.001, loc=(0, 0, h * 0.86), collection=collection,
                     material=M("coffee"), parent=m, verts=32, bevel=0)
    return m


def steam(mug_obj):
    """Wisps of steam above the mug. Blender-only effect (flag `blender_only`): the website
    will draw its own animated steam instead of exporting these meshes."""
    wisps = [[(0.0, 0.0, 0.088), (0.006, 0.004, 0.11), (-0.004, 0.0, 0.135), (0.005, -0.003, 0.16), (0.0, 0.0, 0.18)],
             [(0.012, 0.006, 0.088), (0.004, 0.012, 0.115), (0.014, 0.008, 0.14), (0.006, 0.014, 0.165)],
             [(-0.012, -0.004, 0.088), (-0.018, 0.002, 0.112), (-0.01, -0.006, 0.134), (-0.017, 0.0, 0.152)]]
    for i, pts in enumerate(wisps):
        o = geo.curve_tube(f"FX_Steam_{i}", pts, 0.0035, collection="PROPS", material=M("steam"),
                           parent=mug_obj, ring=8, steps=6, taper=lambda t: 0.4 + 1.2 * t * (1 - t) * 2)
        o["blender_only"] = True
        o.visible_shadow = False


def sticky_notes(root, top):
    for i, (x, y, rz, mat) in enumerate([(0.235, 0.47, 0.15, "sticky_yellow"), (0.28, 0.505, -0.2, "sticky_pink"),
                                         (-0.50, 0.30, 0.35, "sticky_yellow")]):
        note = geo.box(f"PROP_StickyNote_{i}", (0.038, 0.038, 0.0012), loc=(x, y, top), rot=(0, 0, rz),
                       material=M(mat), parent=root, bevel=0.0003, seg=1, rests_on="DESK_Top")
        S.mark_interactive(note, "graffiti", "Graffiti guestbook", kind="navigation")   # Phase 10


def card_holder(root, x, y, top):
    """Small business-card holder (the Contact navigation object)."""
    grp = S.empty("NAV_ContactCards", "PROPS", loc=(x, y, top), rot=(0, 0, radians(-8)), parent=root, size=0.04)
    geo.box("NAV_ContactCards_Base", (0.072, 0.034, 0.004), collection="PROPS", material=M("metal_black"),
            parent=grp, bevel=0.0012, rests_on="DESK_Top")
    geo.box("NAV_ContactCards_Back", (0.072, 0.003, 0.026), loc=(0, 0.014, 0.004), rot=(radians(-14), 0, 0),
            collection="PROPS", material=M("metal_black"), parent=grp, bevel=0.001)
    for i in range(2):
        c = geo.box(f"NAV_ContactCards_Card_{i}", (0.064, 0.0012, 0.038), loc=(0, 0.0095 - i * 0.002, 0.004),
                    rot=(radians(-14), 0, 0), collection="PROPS", material=M("business_card"), parent=grp,
                    bevel=0.0002, seg=1, uv="fit", fit_axis=1, shared="contact_card")
        c["artwork_slot"] = "business_card"
    S.mark_interactive(grp, "contact_card", "Contact", kind="navigation")
    return grp


def sketchbook(root, top):
    """Phase 2/3 sketchbook (superseded by parts/notebook.py; kept for reference)."""
    grp = S.empty("PROP_Notebook", "PROPS", loc=(0.66, 0.33, top), rot=(0, 0, radians(9)), parent=root)
    W, D = 0.30, 0.21
    geo.box("PROP_Notebook_Cover", (W + 0.01, D + 0.01, 0.003), collection="PROPS",
            material=M("book_cover"), parent=grp, bevel=0.0012, rests_on="DESK_Top")

    def page_shape(x, y):
        ax = abs(x) / (W / 2)
        z = 0.003 + 0.010 * (1 - (1 - min(ax * 4, 1)) ** 2) - 0.004 * ax ** 3
        return (x, y, z)
    geo.grid("PROP_Notebook_Pages", W, D, 40, 6, deform=page_shape, collection="PROPS",
             material=M("paper"), parent=grp, thickness=0.002)
    pen = [(0.03, -0.07, 0.016), (0.14, 0.05, 0.016)]
    geo.curve_tube("PROP_Pen", pen, 0.0045, collection="PROPS", material=M("metal_black"), parent=grp,
                   ring=10, steps=1, taper=lambda t: 0.6 if t > 0.95 else 1.0)
    geo.box("PROP_Pen_Clip", (0.002, 0.04, 0.002), loc=(0.11, 0.015, 0.0195), rot=(0, 0, -0.73),
            collection="PROPS", material=M("brass"), parent=grp, bevel=0)
    return grp


def pencil_cup(root, name, x, y, z, mat_cup, items):
    r, h = 0.034, 0.10
    cup = geo.lathe(name, [(0, 0), (r, 0), (r, h), (r - 0.003, h), (r - 0.003, 0.004), (0, 0.004)],
                    loc=(x, y, z), collection="PROPS", material=M(mat_cup), parent=root, segments=28,
                    rests_on="DESK_Top")
    for i, (mat, length, tilt, az) in enumerate(items):
        a = radians(az)
        base = Vector((cos(a) * 0.012, sin(a) * 0.012, 0.006))
        tip = base + Vector((cos(a) * sin(radians(tilt)), sin(a) * sin(radians(tilt)), cos(radians(tilt)))) * length
        geo.curve_tube(f"{name}_Item_{i}", [base, tip], 0.0038, collection="PROPS", material=M(mat),
                       parent=cup, ring=6, steps=1, taper=lambda t: max(0.15, min(1.0, (1 - t) * 14)))
    return cup


def lamp(root, x, y, z):
    grp = S.empty("PROP_Lamp", "PROPS", loc=(x, y, z), parent=root)
    geo.lathe("PROP_Lamp_Base", [(0, 0), (0.05, 0), (0.05, 0.022), (0.044, 0.03), (0, 0.03)],
              collection="PROPS", material=M("wood_dark"), parent=grp, segments=32, rests_on="SHELF_Riser")
    geo.lathe("PROP_Lamp_Ring", [(0, 0.03), (0.042, 0.03), (0.042, 0.038), (0, 0.038)],
              collection="PROPS", material=M("copper"), parent=grp, segments=32)
    geo.lathe("PROP_Lamp_Socket", [(0, 0.038), (0.012, 0.038), (0.012, 0.058), (0, 0.058)],
              collection="PROPS", material=M("copper"), parent=grp, segments=16)
    bulb = geo.lathe("PROP_Lamp_Bulb", [(0, 0.058), (0.010, 0.058), (0.022, 0.085), (0.026, 0.11),
                                        (0.02, 0.135), (0, 0.142)],
                     collection="PROPS", material=M("glass"), parent=grp, segments=24, sharp=None)
    bulb.visible_shadow = False
    fil = [(-0.008, 0, 0.07)]
    for k in range(7):
        fil.append(((-0.008 + k * 0.0027), 0, 0.10 + (0.012 if k % 2 else 0)))
    fil.append((0.008, 0, 0.07))
    geo.curve_tube("PROP_Lamp_Filament", fil, 0.0012, collection="PROPS", material=M("filament"),
                   parent=grp, ring=6, steps=3)
    r, h = 0.042, 0.16
    dome = geo.lathe("PROP_Lamp_Dome", [(r, 0.038), (r, 0.038 + h), (r * 0.7, 0.038 + h + 0.025),
                                        (0, 0.038 + h + 0.03), (0, 0.036 + h + 0.028),
                                        (r * 0.7 - 0.002, 0.036 + h + 0.023), (r - 0.002, 0.036 + h),
                                        (r - 0.002, 0.038)],
                     collection="PROPS", material=M("glass"), parent=grp, segments=32, sharp=None)
    dome.visible_shadow = False
    return grp


def speaker(root, name, x, y, z, rot_z):
    grp = S.empty(name, "PROPS", loc=(x, y, z), rot=(0, 0, rot_z), parent=root)
    w, d, h = 0.095, 0.11, 0.16
    geo.box(name + "_Body", (w, d, h), collection="PROPS", material=M("wood_dark"), parent=grp,
            bevel=0.006, seg=3, uv_swap=True, uv_scale=2, shared="speaker_body", rests_on="SHELF_Riser")
    geo.box(name + "_Baffle", (w - 0.01, 0.004, h - 0.01), loc=(0, -d / 2 - 0.001, 0.005),
            collection="PROPS", material=M("plastic_black"), parent=grp, bevel=0.002, shared="speaker_baffle")
    fy = -d / 2 - 0.003
    for nm, r, zc in (("Woofer", 0.034, 0.055), ("Tweeter", 0.014, 0.125)):
        cone = geo.lathe(f"{name}_{nm}", [(0, -0.004 if nm == "Woofer" else 0.003), (r * 0.3, 0.0),
                                           (r * 0.85, 0.006), (r, 0.006), (r, 0.0), (0, 0.0)][::-1],
                         loc=(0, fy, zc), rot=(pi / 2, 0, 0), collection="PROPS",
                         material=M("rubber"), parent=grp, segments=28, shared=f"spk_{nm}")
        geo.lathe(f"{name}_{nm}_Ring", [(r, 0.0), (r + 0.004, 0.0), (r + 0.004, 0.003), (r, 0.003)],
                  loc=(0, fy, zc), rot=(pi / 2, 0, 0), collection="PROPS", material=M("brass"),
                  parent=grp, segments=28, shared=f"spk_{nm}_ring")
    return grp


def emblem(name, parent, loc, rot, r, collection="PROPS"):
    """Fan-art game-logo emblem: broken ring with two inner fangs (flat 3D relief)."""
    grp = S.empty(name, collection, loc=loc, rot=rot, parent=parent, size=r)
    pts = [(cos(a) * r, sin(a) * r, 0) for a in [radians(d) for d in range(-60, 241, 15)]]
    geo.curve_tube(name + "_Ring", pts, r * 0.16, collection=collection, material=M("logo_orange"),
                   parent=grp, ring=8, steps=2, flatten=0.35)
    for s in (-1, 1):
        geo.box(name + f"_Fang_{'L' if s < 0 else 'R'}", (r * 0.28, r * 1.05, r * 0.11),
                loc=(s * r * 0.3, -r * 0.05, -r * 0.055), rot=(0, 0, s * 0.42), collection=collection,
                material=M("logo_orange"), parent=grp, bevel=0)
    return grp


def headphones(root, x, y, z):
    grp = S.empty("PROP_Headphones_Stand", "PROPS", loc=(x, y, z), parent=root)
    S.mark_interactive(grp, "headphones", "WRFM / audio experience", kind="navigation")
    geo.lathe("PROP_HPStand_Base", [(0, 0), (0.055, 0), (0.055, 0.008), (0.045, 0.014), (0, 0.014)],
              collection="PROPS", material=M("metal_black"), parent=grp, segments=32, rests_on="SHELF_Riser")
    pole_h = 0.29
    geo.cylinder("PROP_HPStand_Pole", 0.007, pole_h, loc=(0, 0, 0.014), collection="PROPS",
                 material=M("metal_black"), parent=grp, verts=12, bevel=0)
    top = 0.014 + pole_h
    geo.curve_tube("PROP_HPStand_Hanger", [(0, -0.045, top - 0.012), (0, -0.02, top + 0.004),
                                           (0, 0.02, top + 0.004), (0, 0.045, top - 0.012)],
                   0.008, collection="PROPS", material=M("metal_black"), parent=grp, ring=10, steps=4)
    # headphones hang on the hanger: band arcs over it in the XZ plane, cups face +/-X
    hp = S.empty("PROP_Headphones", "PROPS", loc=(0, 0, top + 0.012), parent=grp, size=0.05)
    R = 0.078
    band = [(cos(a) * R, 0, sin(a) * R - R) for a in [radians(d) for d in range(-10, 191, 10)]]
    geo.curve_tube("PROP_Headphones_Band", band, 0.009, collection="PROPS", material=M("metal_black"),
                   parent=hp, ring=10, steps=3, flatten=0.55)
    pad = [(cos(a) * (R - 0.012), 0, sin(a) * (R - 0.012) - R) for a in [radians(d) for d in range(40, 141, 10)]]
    geo.curve_tube("PROP_Headphones_BandPad", pad, 0.011, collection="PROPS", material=M("leather"),
                   parent=hp, ring=10, steps=3, flatten=0.5)
    for tag, s in (("L", -1), ("R", 1)):
        cx = s * (R + 0.008)
        geo.curve_tube(f"PROP_Headphones_Yoke_{tag}", [(s * R, 0, -R + 0.01), (cx, 0, -R - 0.03)], 0.004,
                       collection="PROPS", material=M("chrome"), parent=hp, ring=6, steps=1)
        cup = geo.lathe(f"PROP_Headphones_Cup_{tag}",
                        [(0, 0), (0.042, 0), (0.046, 0.008), (0.044, 0.024), (0.032, 0.03), (0, 0.031)],
                        loc=(cx, 0, -R - 0.075), rot=(0, s * pi / 2, 0), collection="PROPS",
                        material=M("metal_black"), parent=hp, segments=32, shared="hp_cup")
        geo.lathe(f"PROP_Headphones_Pad_{tag}",
                  [(0.02, 0), (0.044, 0), (0.047, 0.008), (0.044, 0.018), (0.02, 0.018)],
                  loc=(cx, 0, -R - 0.075), rot=(0, -s * pi / 2, 0), collection="PROPS",
                  material=M("leather"), parent=hp, segments=32, shared="hp_pad")
        geo.lathe(f"PROP_Headphones_Ring_{tag}", [(0.044, 0.026), (0.047, 0.026), (0.047, 0.03), (0.044, 0.03)],
                  loc=(cx, 0, -R - 0.075), rot=(0, s * pi / 2, 0), collection="PROPS",
                  material=M("led_purple"), parent=hp, segments=32, shared="hp_ring")
        if FAN_ART and s > 0:
            emblem("PROP_Headphones_Logo", hp, (cx + 0.032, 0, -R - 0.075), (pi / 2, 0, pi / 2), 0.017)
    return grp


# ---------------------------------------------------------------- phase 11: better small props
def mouse(root, top):
    """A shaped mouse (not an egg): low nose, a hump under the palm, split buttons, a scroll wheel and
    two thumb buttons. The glow pad underneath is unchanged."""
    x, y = 0.17, 0.335
    geo.sphere("PROP_Mouse_Glow", 0.036, loc=(x, y, top + 0.003), material=M("mouse_glow"),
               parent=root, scale=(0.85, 1.4, 0.02), segs=24, rests_on="PROP_DeskMat")
    m = geo.sphere("PROP_Mouse", 0.030, loc=(x, y, top + 0.00444), material=M("plastic_black"),
                   parent=root, segs=40, rot=(0, 0, radians(-6)), rests_on="PROP_Mouse_Glow")
    r = 0.030
    for v in m.data.vertices:                                  # shape it in the mesh, so children aren't scaled
        t = v.co.y / r                                         # -1 back (palm) .. +1 front (buttons)
        v.co.x *= 1.0 - 0.14 * max(t, 0) + 0.04 * max(-t, 0)
        v.co.y *= 1.75
        v.co.z *= 0.62 * (1.0 - 0.32 * max(t, 0) + 0.08 * max(-t, 0) * (1 - abs(t)))
    m.data.update()
    vs = [v.co.copy() for v in m.data.vertices]
    def hz(yy):                                                # the real top of the shaped shell at y = yy (x ~ 0)
        near = [c.z for c in vs if abs(c.y - yy) < 0.004 and abs(c.x) < 0.006]
        return max(near) if near else 0.03
    for k in range(6):                                         # the button split, following the curve of the shell
        yy = 0.026 + k * 0.004
        geo.box(f"PROP_Mouse_Seam_{k}", (0.0014, 0.0042, 0.0012), loc=(0, yy, hz(yy) - 0.0006), material=M("plastic_grey"), parent=m, bevel=0)
    geo.cylinder("PROP_Mouse_Wheel", 0.0058, 0.005, loc=(-0.0025, 0.018, hz(0.018) - 0.0035), rot=(0, radians(90), 0),
                 material=M("metal_dark"), parent=m, verts=18, bevel=0.0008)
    geo.box("PROP_Mouse_LED", (0.0022, 0.012, 0.0012), loc=(0, -0.022, hz(-0.022) - 0.0005), material=M("led_purple"), parent=m, bevel=0)
    for k, yy in enumerate((-0.004, 0.012)):
        geo.box(f"PROP_Mouse_Thumb_{k}", (0.002, 0.012, 0.005), loc=(-0.0292, yy, 0.016), rot=(0, radians(-12), 0),
                material=M("plastic_grey"), parent=m, bevel=0.0008)
    return m


def router(root, top):
    """Wi-fi router: slim body with vent slots, two antennas, status LEDs, little feet."""
    rt = geo.box("PROP_Router", (0.14, 0.09, 0.022), loc=(0.10, 0.72, top + 0.003), material=M("plastic_black"),
                 parent=root, bevel=0.006, seg=3, rests_on="PROP_Router_Feet")
    def feet(bm):
        for sx in (-1, 1):
            for sy in (-1, 1):
                geo.add_cyl(bm, 0.006, 0.003, (0.10 + sx * 0.055, 0.72 + sy * 0.032, top), verts=10)
    geo.merged("PROP_Router_Feet", feet, material=M("rubber"), parent=root, bevel=0, rests_on="DESK_Top")
    def vents(bm):
        for k in range(9):
            geo.add_box(bm, (0.08, 0.0025, 0.0008), (0, -0.03 + k * 0.0075, 0.0218))
    geo.merged("PROP_Router_Vents", vents, material=M("metal_black"), parent=rt, bevel=0)
    for sx in (-1, 1):                                          # antennas, hinged at the back, tilted out a little
        base = geo.cylinder(f"PROP_Router_Hinge_{'L' if sx < 0 else 'R'}", 0.006, 0.01, loc=(sx * 0.055, 0.047, 0.006),
                            rot=(radians(90), 0, 0), material=M("plastic_black"), parent=rt, verts=12, bevel=0.001)
        geo.cylinder(f"PROP_Router_Antenna_{'L' if sx < 0 else 'R'}", 0.0045, 0.12, loc=(sx * 0.055, 0.052, 0.008),
                     rot=(radians(-8), radians(sx * 10), 0), r_top=0.0038, material=M("plastic_black"), parent=rt, verts=12, bevel=0.0015)
    for k in range(4):
        geo.box(f"PROP_Router_LED_{k}", (0.004, 0.002, 0.003), loc=(-0.03 + k * 0.012, -0.0455, 0.009),
                material=M("led_green"), parent=rt, bevel=0, shared="router_led")
    return rt


def flat_book(root, name, dims, cover, loc, rot_z=0.0, rests_on="DESK_Top"):
    """A book lying flat: hard covers that overhang the page block, a rounded spine, cream page edges."""
    w, d, h = dims
    c, o = 0.0022, 0.003                                       # board thickness, overhang
    def shell(bm):
        geo.add_box(bm, (w, d, c), (0, 0, 0))                  # back board
        geo.add_box(bm, (w, d, c), (0, 0, h - c))              # front board
        geo.add_cyl(bm, h / 2, d, (-w / 2 + h / 4, d / 2, h / 2), (radians(90), 0, 0), verts=14)   # spine
    b = geo.merged(name, shell, loc=loc, rot=(0, 0, rot_z), material=M(cover), parent=root, bevel=0.0008, seg=1,
                   rests_on=rests_on)
    geo.box(name + "_Pages", (w - o - h / 4, d - 2 * o, h - 2 * c), loc=(o / 2 + h / 8 - o / 2, 0, c), material=M("pages"),
            parent=b, bevel=0.0005, seg=1)
    geo.box(name + "_Band", (0.004, d + 0.0004, h + 0.0004), loc=(-w / 2 + h / 2 + 0.006, 0, -0.0002),
            material=M("label_gold"), parent=b, bevel=0)
    return b


def passport(root, top):
    """The Studio Passport booklet (navigation: /passport). Navy cover, gold lettering, a corner of pages."""
    if "studio_passport" not in TEX:
        TEX["studio_passport"] = T.label_card("studio_passport", 360, 512, [("BROK3N", 3), ("BY DESIGN", 2), ("", 3),
                                              ("*STUDIO", 4), ("*PASSPORT", 4)], "#1c2742", "#d9b45e", accent="#d9b45e", border=True)
    cover = mat("M_studio_passport", tex="studio_passport", rough=0.55)
    # on the right of the desk mat, between the mouse and the mug: in plain view from the default camera
    grp = S.empty("NAV_Passport", "PROPS", loc=(0.28, 0.27, top + 0.003), rot=(0, 0, radians(12)), parent=root, size=0.04)
    geo.box("NAV_Passport_Back", (0.09, 0.126, 0.0015), material=mat("M_passport_navy", color=(0.07, 0.09, 0.16), rough=0.55),
            parent=grp, bevel=0.0006, seg=1, rests_on="PROP_DeskMat")
    geo.box("NAV_Passport_Pages", (0.086, 0.121, 0.005), loc=(0.0015, 0, 0.0015), material=M("pages"), parent=grp, bevel=0.0004, seg=1)
    geo.box("NAV_Passport_Cover", (0.09, 0.126, 0.0015), loc=(0, 0, 0.0065), material=cover, parent=grp, bevel=0.0006, seg=1,
            uv="fit", fit_axis=2)
    S.mark_interactive(grp, "passport", "Studio Passport", kind="navigation")
    return grp


def rubber_duck(root, x, y, z, rests_on):
    """A rubber duck for debugging (discovery: it squeaks, and plays WRFM's Rubber Duck Rental ad)."""
    yellow = mat("M_duck_yellow", color=(1.0, 0.62, 0.0), rough=0.22)
    orange = mat("M_duck_orange", color=(1.0, 0.22, 0.0), rough=0.3)
    grp = S.empty("PROP_Duck", "PROPS", loc=(x, y, z), rot=(0, 0, radians(-28)), parent=root, size=0.03)
    body = geo.sphere("PROP_Duck_Body", 0.026, material=yellow, parent=grp, segs=28, rests_on=rests_on)
    for v in body.data.vertices:                               # a chubby boat-shaped body, tail up at the back
        v.co.x *= 1.0
        v.co.y *= 1.25
        v.co.z *= 0.78
        if v.co.y > 0.012:
            v.co.z += (v.co.y - 0.012) * 0.9 * (v.co.z / 0.04)
    body.data.update()
    head = geo.sphere("PROP_Duck_Head", 0.016, loc=(0, -0.016, 0.03), material=yellow, parent=grp, segs=22)
    beak = geo.sphere("PROP_Duck_Beak", 0.008, loc=(0, -0.03, 0.039), material=orange, parent=grp, segs=14, scale=(1.25, 1.1, 0.45))
    for sx in (-1, 1):
        geo.sphere(f"PROP_Duck_Eye_{'L' if sx < 0 else 'R'}", 0.0034, loc=(sx * 0.0085, -0.026, 0.047), material=M("vinyl_black"),
                   parent=grp, segs=10)
    S.mark_interactive(grp, "duck", "Rubber duck (discovery)", kind="discovery")
    return grp


def build(root, desk, hutch):
    top = desk["top"]
    rt, ry = hutch["riser_top"], hutch["riser_y"]

    # ---------------------------------------------------- on the desktop
    geo.box("PROP_DeskMat", (0.80, 0.30, 0.003), loc=(-0.05, 0.35, top), material=M("deskmat"),
            parent=root, bevel=0.0012, seg=1, uv="fit", fit_axis=2, rests_on="DESK_Top")
    keyboard(root, top)
    mouse(root, top)
    geo.curve_tube("CABLE_Mouse", [(0.17, 0.39, top + 0.006), (0.16, 0.45, top + 0.004),
                                   (0.12, 0.56, top + 0.003), (0.09, 0.66, top + 0.003)], 0.0022,
                   material=M("cable"), parent=root, ring=6)
    geo.lathe("PROP_Coaster", [(0, 0), (0.05, 0), (0.05, 0.005), (0, 0.005)], loc=(0.36, 0.43, top),
              material=M("cork"), parent=root, segments=32, rests_on="DESK_Top")
    m = mug(root, 0.36, 0.43, top + 0.005, rot_z=0.0, rests_on="PROP_Coaster")
    S.mark_interactive(m, "mug", "Optional humorous interaction (placeholder)", kind="discovery")
    steam(m)
    from parts import notebook
    notebook.build(root, (0.66, 0.33, top))
    sticky_notes(root, top)
    card_holder(root, 0.605, 0.552, top)
    pencil_cup(root, "PROP_PencilCup", 0.52, 0.53, top, "copper",
               [("pencil_yellow", 0.15, 8, 30), ("pencil_red", 0.14, 12, 150), ("pencil_yellow", 0.16, 6, 260),
                ("graphite", 0.13, 14, 200), ("pencil_yellow", 0.15, 10, 330)])
    pencil_cup(root, "PROP_BrushCup", -0.61, 0.47, top, "terracotta",
               [("wood_light", 0.13, 10, 40), ("wood_dark", 0.12, 16, 180), ("wood_light", 0.14, 6, 290)])
    dice = [("d20", "dice_purple", (-0.53, 0.43), 0.015), ("d8", "dice_teal", (-0.485, 0.405), 0.013),
            ("d20", "dice_cream", (-0.445, 0.435), 0.014)]
    for i, (kind, mat, (dx, dy), sz) in enumerate(dice):
        geo.polyhedron(f"PROP_Dice_{i}", kind, sz, loc=(dx, dy, top), rot=(0, 0, i * 1.3),
                       material=M(mat), parent=root, rests_on="DESK_Top")
    # under the riser: two real books + the router (phase 11)
    flat_book(root, "PROP_BookLow_Green", (0.15, 0.11, 0.022), "book_green", (-0.36, 0.71, top))
    flat_book(root, "PROP_BookLow_Yellow", (0.14, 0.10, 0.02), "book_yellow", (-0.355, 0.712, top + 0.022), rot_z=0.06,
              rests_on="PROP_BookLow_Green")
    router(root, top)
    passport(root, top)

    # ---------------------------------------------------- on the riser
    lamp(root, -0.615, ry - 0.02, rt)
    speaker(root, "PROP_Speaker_L", -0.505, ry - 0.025, rt, radians(-12))
    speaker(root, "PROP_Speaker_R", 0.68, ry - 0.025, rt, radians(12))
    headphones(root, 0.835, ry - 0.01, rt)
    rubber_duck(root, 0.555, ry - 0.105, rt, "SHELF_Riser")
