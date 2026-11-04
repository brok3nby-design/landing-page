"""COLLECTIBLES: two chibi vinyl-style figures on the upper shelf.

config.FAN_ART = True  -> fan-art likenesses from the reference (hooded sniper with eyepatch on a
                          logo base; office manager holding a "World's Best Boss" mug)
config.FAN_ART = False -> generic stand-ins with the same object names (no logos / likeness)
"""
from math import pi, radians, sin, cos
from config import FAN_ART
from lib import geo, scene as S
from lib.library import M
from parts.desk_props import emblem, mug

C = "COLLECTIBLES"


def _eyes(parent, z, spread, r, y, which=(True, True)):
    for tag, s, on in (("L", -1, which[0]), ("R", 1, which[1])):
        if on:
            geo.sphere(f"{parent.name}_Eye_{tag}", r, loc=(s * spread, y, z - r), collection=C,
                       material=M("vinyl_black"), parent=parent, scale=(1, 0.45, 1), segs=12)


def figure_a(root, x, y, z):
    """Hooded sniper (fan art) / hooded wanderer (generic)."""
    grp = S.empty("COLL_FigureA", C, loc=(x, y, z), rot=(0, 0, radians(-10)), parent=root, size=0.05)
    geo.lathe("COLL_FigureA_Base", [(0, 0), (0.048, 0), (0.048, 0.016), (0.044, 0.02), (0, 0.02)],
              collection=C, material=M("vinyl_black"), parent=grp, segments=40, rests_on="SHELF_Upper")
    if FAN_ART:
        e = emblem("COLL_FigureA_Logo", grp, (0, -0.0485, 0.0095), (pi / 2, 0, 0), 0.0075, collection=C)
        for ch in e.children:
            ch.data.materials[0] = M("logo_white")
    hood = M("vinyl_blue") if FAN_ART else M("dice_purple")
    # robe / body
    geo.lathe("COLL_FigureA_Robe", [(0, 0.02), (0.034, 0.02), (0.03, 0.045), (0.024, 0.075), (0.016, 0.085),
                                     (0, 0.086)], collection=C, material=hood, parent=grp, segments=28)
    geo.lathe("COLL_FigureA_Belt", [(0.0285, 0.048), (0.030, 0.048), (0.028, 0.056), (0.0265, 0.056)],
              collection=C, material=M("vinyl_tan"), parent=grp, segments=28)
    for s in (-1, 1):
        geo.sphere(f"COLL_FigureA_Hand_{'L' if s < 0 else 'R'}", 0.009, loc=(s * 0.022, -0.026, 0.055),
                   collection=C, material=M("vinyl_skin2"), parent=grp, segs=12)
        geo.curve_tube(f"COLL_FigureA_Arm_{'L' if s < 0 else 'R'}",
                       [(s * 0.024, 0.0, 0.078), (s * 0.03, -0.012, 0.07), (s * 0.024, -0.024, 0.062)],
                       0.008, collection=C, material=hood, parent=grp, ring=8, steps=4)
    # head with hood
    head_z = 0.083
    head = geo.sphere("COLL_FigureA_Head", 0.036, loc=(0, -0.003, head_z), collection=C,
                      material=M("vinyl_skin2"), parent=grp, scale=(1.05, 0.95, 1.0), segs=24)
    geo.sphere("COLL_FigureA_Hood", 0.041, loc=(0, 0.014, head_z + 0.0), collection=C, material=hood,
               parent=grp, scale=(1.08, 1.0, 1.04), segs=24)
    geo.lathe("COLL_FigureA_HoodRim", [(0.034, 0.0), (0.038, 0.0), (0.038, 0.006), (0.034, 0.006)],
              loc=(0, -0.028, head_z + 0.036), rot=(radians(-80), 0, 0), collection=C,
              material=M("vinyl_gold") if FAN_ART else hood, parent=grp, segments=28)
    face_y = -0.003 - 0.036 * 0.95 + 0.003
    if FAN_ART:
        for s in (-1, 1):   # white hair framing the face
            geo.curve_tube(f"COLL_FigureA_Hair_{'L' if s < 0 else 'R'}",
                           [(s * 0.024, -0.026, head_z + 0.058), (s * 0.033, -0.022, head_z + 0.03),
                            (s * 0.03, -0.02, head_z + 0.004), (s * 0.034, -0.012, head_z - 0.012)],
                           0.0055, collection=C, material=M("vinyl_white"), parent=grp, ring=8, steps=4,
                           taper=lambda t: 1.0 - 0.6 * t)
        _eyes(grp, head_z + 0.040, 0.014, 0.0055, face_y, which=(True, False))
        geo.cylinder("COLL_FigureA_Eyepatch", 0.0075, 0.003, loc=(0.014, face_y + 0.001, head_z + 0.035),
                     rot=(pi / 2, 0, 0), collection=C, material=M("vinyl_black"), parent=grp, verts=16, bevel=0)
        strap = [(cos(a) * 0.0365, -sin(a) * 0.0345 - 0.003, head_z + 0.035 + 0.012 * cos(a))
                 for a in [radians(d) for d in range(-60, 241, 20)]]
        geo.curve_tube("COLL_FigureA_Strap", strap, 0.0015, collection=C, material=M("vinyl_black"),
                       parent=grp, ring=5, steps=3)
        # rifle held diagonally across the body
        geo.curve_tube("COLL_FigureA_Rifle", [(-0.045, -0.034, 0.04), (0.07, -0.03, 0.085)], 0.0045,
                       collection=C, material=M("vinyl_grey"), parent=grp, ring=8, steps=1)
        geo.curve_tube("COLL_FigureA_Barrel", [(0.07, -0.03, 0.085), (0.115, -0.028, 0.102)], 0.0022,
                       collection=C, material=M("vinyl_black"), parent=grp, ring=6, steps=1)
        geo.curve_tube("COLL_FigureA_Scope", [(0.0, -0.039, 0.068), (0.04, -0.037, 0.083)], 0.0035,
                       collection=C, material=M("vinyl_gold"), parent=grp, ring=8, steps=1)
    else:
        _eyes(grp, head_z + 0.040, 0.014, 0.0055, face_y)
        geo.curve_tube("COLL_FigureA_Staff", [(0.03, -0.03, 0.02), (0.035, -0.03, 0.15)], 0.003,
                       collection=C, material=M("wood_light"), parent=grp, ring=6, steps=1)
    S.mark_interactive(grp, "collectible_a", "Collectible detail (placeholder)")
    return grp


def figure_b(root, x, y, z):
    """Office manager with mug (fan art) / generic office figure (generic)."""
    grp = S.empty("COLL_FigureB", C, loc=(x, y, z), rot=(0, 0, radians(-14)), parent=root, size=0.05)
    for s in (-1, 1):
        t = "L" if s < 0 else "R"
        geo.box(f"COLL_FigureB_Shoe_{t}", (0.022, 0.032, 0.012), loc=(s * 0.013, -0.004, 0), collection=C,
                material=M("vinyl_black"), parent=grp, bevel=0.005, shared="figb_shoe", rests_on="SHELF_Upper")
        geo.cylinder(f"COLL_FigureB_Leg_{t}", 0.0095, 0.03, loc=(s * 0.013, 0, 0.012), collection=C,
                     material=M("vinyl_navy"), parent=grp, verts=14, bevel=0.002, shared="figb_leg")
    geo.box("COLL_FigureB_Torso", (0.05, 0.034, 0.05), loc=(0, 0, 0.04), collection=C,
            material=M("vinyl_navy"), parent=grp, bevel=0.012, seg=3)
    geo.box("COLL_FigureB_Shirt", (0.014, 0.004, 0.03), loc=(0, -0.017, 0.058), collection=C,
            material=M("vinyl_white"), parent=grp, bevel=0.002)
    geo.box("COLL_FigureB_Tie", (0.006, 0.003, 0.026), loc=(0, -0.0195, 0.058), collection=C,
            material=M("vinyl_red"), parent=grp, bevel=0.001)
    for s in (-1, 1):
        t = "L" if s < 0 else "R"
        geo.curve_tube(f"COLL_FigureB_Arm_{t}", [(s * 0.028, 0.0, 0.08), (s * 0.033, -0.008, 0.065),
                                                 (s * 0.018, -0.026, 0.06)], 0.008, collection=C,
                       material=M("vinyl_navy"), parent=grp, ring=8, steps=4)
        geo.sphere(f"COLL_FigureB_Hand_{t}", 0.0075, loc=(s * 0.014, -0.03, 0.053), collection=C,
                   material=M("vinyl_skin"), parent=grp, segs=12)
    m = mug(grp, 0, -0.036, 0.048, name="COLL_FigureB_Mug", tex="mug_boss" if FAN_ART else "mug",
            scale=0.32, collection=C, rot_z=0.0, parent=grp, coffee=False)
    head_z = 0.088
    geo.sphere("COLL_FigureB_Head", 0.04, loc=(0, 0, head_z), collection=C, material=M("vinyl_skin"),
               parent=grp, scale=(1.05, 0.92, 0.95), segs=24)
    hair = M("vinyl_hair")
    geo.sphere("COLL_FigureB_Hair", 0.041, loc=(0, 0.006, head_z + 0.026), collection=C, material=hair,
               parent=grp, scale=(1.06, 0.95, 0.55), segs=24)
    if FAN_ART:   # side-parted quiff
        geo.sphere("COLL_FigureB_Quiff", 0.018, loc=(-0.01, -0.022, head_z + 0.058), collection=C,
                   material=hair, parent=grp, scale=(1.6, 0.9, 0.6), segs=14)
    face_y = -0.036
    _eyes(grp, head_z + 0.042, 0.015, 0.006, face_y)
    for s in (-1, 1):
        geo.box(f"COLL_FigureB_Brow_{'L' if s < 0 else 'R'}", (0.012, 0.003, 0.0028),
                loc=(s * 0.015, face_y - 0.0005, head_z + 0.049), rot=(0, s * 0.15, 0), collection=C,
                material=hair, parent=grp, bevel=0, shared="figb_brow")
    S.mark_interactive(grp, "collectible_b", "Collectible detail (placeholder)")
    return grp


def build(root, hutch):
    ut, uy = hutch["upper_top"], hutch["upper_y"]
    figure_a(root, 0.27, uy, ut)
    figure_b(root, 0.53, uy, ut)
