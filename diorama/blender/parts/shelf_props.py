"""PROPS on the upper shelf: book row (spine atlas), crystal cluster, small retro gadget box,
stacked game boxes. Plants and figurines live in their own modules."""
from math import radians, pi
import bmesh
import bpy
from mathutils import Vector

from lib import geo, scene as S
from lib.library import M

SLOTS = 8


GAME_BOX_PROJECTS = ["labyrinth-fate", "macabre-dolls", "juicebox"]   # bottom to top; see data/interactions.json


def book(root, name, slot, dims, loc, rot=(0, 0, 0), rests_on="SHELF_Upper"):
    """Book whose -Y face shows spine `slot` of the atlas; covers sample a plain band; top = pages."""
    w, d, h = dims
    bm = geo._cube_bm(dims)
    uv = geo._uv_layer(bm)
    bm.normal_update()
    u0, u1 = slot / SLOTS, (slot + 1) / SLOTS
    for f in bm.faces:
        n = f.normal
        for lp in f.loops:
            co = lp.vert.co
            if n.y < -0.5:     # spine
                lp[uv].uv = (u0 + (co.x / w + 0.5) * (u1 - u0), co.z / h * 0.97)
            elif n.z > 0.5 or n.y > 0.5:   # pages (top) / fore-edge
                lp[uv].uv = (u0 + 0.5 * (u1 - u0), 0.99)
            else:              # covers
                lp[uv].uv = (u0 + 0.5 * (u1 - u0), 0.45 * 0.97)
    return geo.from_bm(name, bm, loc=loc, rot=rot, material=M("spines"), parent=root, bevel=0.0015,
                       seg=2, rests_on=rests_on, uv="keep")


def build(root, hutch):
    ut, uy = hutch["upper_top"], hutch["upper_y"]
    # --- book row with one leaning book
    x = -0.35
    specs = [(0, 0.032, 0.15, 0.21), (1, 0.038, 0.15, 0.20), (2, 0.030, 0.14, 0.19), (3, 0.040, 0.16, 0.215),
             (4, 0.034, 0.15, 0.20)]
    for i, (slot, w, d, h) in enumerate(specs):
        book(root, f"PROP_Book_{i}", slot, (w, d, h), (x + w / 2, uy, ut))
        x += w + 0.002
    # leaning book: rotated about Y, resting its corner on the shelf against the last book
    lean = book(root, "PROP_Book_Leaning", 5, (0.03, 0.14, 0.19), (x + 0.03, uy, ut + 0.003),
                rot=(0, radians(-16), 0), rests_on=None)
    for i in range(5):
        S.mark_interactive(bpy.data.objects[f"PROP_Book_{i}"], f"book_{i + 1}", "Optional discovery (placeholder)",
                           kind="discovery")
    S.mark_interactive(lean, "book_6", "Optional discovery (placeholder)", kind="discovery")

    # --- crystal cluster (hex prisms with pointed tips) on a dark rock
    cx, cy = -0.08, uy - 0.01
    geo.sphere("PROP_Crystal_Rock", 0.035, loc=(cx, cy, ut), material=M("rock"), parent=root,
               scale=(1.2, 1.0, 0.45), segs=12, rests_on="SHELF_Upper")
    for i, (dx, dy, r, h, tx, ty) in enumerate([(0, 0, 0.013, 0.085, 0, 0), (0.018, 0.006, 0.010, 0.06, 18, 10),
                                                (-0.017, 0.004, 0.010, 0.055, -20, 6), (0.004, -0.016, 0.009, 0.05, 12, -22),
                                                (-0.006, 0.017, 0.008, 0.045, -8, 20), (0.022, -0.012, 0.007, 0.035, 30, -15)]):
        prof = [(0, 0), (r, 0), (r, h), (0, h + r * 2.2)]
        geo.lathe(f"PROP_Crystal_{i}", prof, loc=(cx + dx, cy + dy, ut + 0.008), rot=(radians(ty), radians(tx), i),
                  material=M("crystal"), parent=root, segments=6)

    # --- retro gadget box (tiny boxed camera/robot collectible)
    gx = 0.07
    geo.box("PROP_GadgetBox", (0.07, 0.07, 0.05), loc=(gx, uy, ut), material=M("plastic_grey"), parent=root,
            bevel=0.004, rests_on="SHELF_Upper")
    geo.box("PROP_Gadget", (0.06, 0.045, 0.04), loc=(gx, uy - 0.005, ut + 0.05), material=M("vinyl_navy"),
            parent=root, bevel=0.006, rests_on="PROP_GadgetBox")
    geo.cylinder("PROP_Gadget_Lens", 0.013, 0.008, loc=(gx, uy - 0.0275, ut + 0.07), rot=(pi / 2, 0, 0),
                 material=M("glass"), parent=root, verts=20, bevel=0.001)
    geo.cylinder("PROP_Gadget_LensRing", 0.016, 0.004, loc=(gx, uy - 0.0275, ut + 0.07), rot=(pi / 2, 0, 0),
                 material=M("chrome"), parent=root, verts=20, bevel=0.001)

    # --- stacked game boxes at the right end
    bx = 0.77
    z = ut
    for i, (w, d, h, mat, rz) in enumerate([(0.17, 0.13, 0.035, "game_box", 0.0), (0.16, 0.125, 0.032, "game_box_b", 0.05),
                                             (0.165, 0.13, 0.034, "game_box", -0.04)]):
        box = geo.box(f"PROP_GameBox_{i}", (w, d, h), loc=(bx, uy, z), rot=(0, 0, rz), material=M(mat), parent=root,
                      bevel=0.003, rests_on="SHELF_Upper" if i == 0 else f"PROP_GameBox_{i - 1}")
        # Phase 10: each box is a project (The Maze, Macabre Dolls, Juicebox) with a title spine label.
        # The label is a child of its box so a click on either resolves to the box's tag.
        lab = geo.box(f"PROP_GameBox_{i}_Label", (w * 0.86, 0.0015, h * 0.62), loc=(0, -d / 2 - 0.0008, h * 0.19),
                      material=M(f"gamebox_label_{i}"), parent=box, bevel=0, uv="fit", fit_axis=1)
        lab["artwork_slot"] = f"gamebox_label_{i}"
        S.mark_interactive(box, f"project_{GAME_BOX_PROJECTS[i]}", f"Project: {GAME_BOX_PROJECTS[i]}", kind="navigation")
        z += h
