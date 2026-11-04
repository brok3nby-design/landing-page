"""PROPS + COLLECTIBLES: blockout placeholders that mark position and size of the clutter.

They are intentionally simple in Phase 1; Phase 2 replaces each with detailed geometry
using the same object names, so positions and interaction tags stay stable.
"""
from math import radians, sin, cos, pi
from config import DESK as D, CLAY
from lib import geo, scene as S
from lib.mats import mat


def build(root, desk, hutch):
    clay = mat("Clay_Neutral", CLAY["clay"])
    clay_dark = mat("Clay_NeutralDark", CLAY["clay_dark"])
    wood_light = mat("Clay_WoodLight", CLAY["wood_light"])
    metal = mat("Clay_Metal", CLAY["metal"], rough=0.4, metal=0.6)
    plant = mat("Clay_Plant", CLAY["plant"])
    crystal = mat("Clay_Crystal", CLAY["crystal"], rough=0.2, emit=CLAY["crystal"], strength=0.6)
    amber = mat("Clay_LampGlow", CLAY["amber"], emit=CLAY["amber"], strength=6.0)

    top = desk["top"]
    rt, ry = hutch["riser_top"], hutch["riser_y"]
    ut, uy = hutch["upper_top"], hutch["upper_y"]

    # ---------------------------------------------------- on the desktop
    geo.box("PROP_DeskMat", (0.80, 0.30, 0.003), loc=(-0.05, 0.35, top), material=clay_dark,
            parent=root, bevel=0.001, seg=1, rests_on="DESK_Top")
    geo.box("PROP_Keyboard", (0.36, 0.12, 0.025), loc=(-0.13, 0.36, top + 0.003), material=metal,
            parent=root, bevel=0.006, rests_on="PROP_DeskMat")
    geo.box("PROP_Mouse", (0.06, 0.10, 0.032), loc=(0.17, 0.34, top + 0.003), material=metal,
            parent=root, bevel=0.014, seg=4, rests_on="PROP_DeskMat")
    geo.cylinder("PROP_Coaster", 0.05, 0.005, loc=(0.36, 0.42, top), material=wood_light,
                 parent=root, bevel=0.001, rests_on="DESK_Top")
    mug = geo.cylinder("PROP_Mug", 0.04, 0.09, loc=(0.36, 0.42, top + 0.005), material=clay,
                       parent=root, bevel=0.003, rests_on="PROP_Coaster")
    S.mark_interactive(mug, "mug", "Easter egg (placeholder)")
    geo.cylinder("PROP_PencilCup", 0.035, 0.10, loc=(0.52, 0.52, top), material=wood_light,
                 parent=root, rests_on="DESK_Top")
    note = geo.box("PROP_Notebook", (0.32, 0.22, 0.015), loc=(0.68, 0.33, top), rot=(0, 0, radians(8)),
                   material=clay, parent=root, bevel=0.003, rests_on="DESK_Top")
    S.mark_interactive(note, "notebook", "About / process (placeholder)")
    geo.cylinder("PROP_BrushCup", 0.03, 0.07, loc=(-0.60, 0.45, top), material=clay_dark,
                 parent=root, rests_on="DESK_Top")
    for i in range(3):
        geo.sphere(f"PROP_Dice_{i}", 0.017, loc=(-0.52 + i * 0.045, 0.42 - (i % 2) * 0.02, top),
                   material=mat("Clay_Dice", (0.30, 0.10, 0.45)), parent=root, ico=True,
                   shared="dice", rests_on="DESK_Top")
    # under the riser
    geo.box("PROP_BookStack_Low", (0.14, 0.10, 0.05), loc=(-0.38, 0.70, top), material=clay,
            parent=root, bevel=0.003, rests_on="DESK_Top")
    geo.box("PROP_Router", (0.12, 0.08, 0.025), loc=(0.10, 0.72, top), material=metal,
            parent=root, bevel=0.004, rests_on="DESK_Top")

    # ---------------------------------------------------- on the riser
    geo.cylinder("PROP_Lamp_Base", 0.045, 0.03, loc=(-0.61, ry - 0.02, rt), material=metal,
                 parent=root, rests_on="SHELF_Riser")
    geo.cylinder("PROP_Lamp_Bulb", 0.035, 0.12, loc=(-0.61, ry - 0.02, rt + 0.03), material=amber,
                 parent=root, bevel=0.01)
    for tag, x in (("L", -0.50), ("R", 0.69)):
        geo.box(f"PROP_Speaker_{tag}", (0.09, 0.10, 0.15), loc=(x, ry - 0.03, rt), material=metal,
                parent=root, bevel=0.005, shared="speaker", rests_on="SHELF_Riser")
    sx = 0.84
    geo.cylinder("PROP_HeadphoneStand_Base", 0.05, 0.012, loc=(sx, ry - 0.02, rt), material=metal,
                 parent=root, rests_on="SHELF_Riser")
    geo.cylinder("PROP_HeadphoneStand_Pole", 0.008, 0.30, loc=(sx, ry - 0.02, rt + 0.012),
                 material=metal, parent=root, verts=12, bevel=0)
    hz = rt + 0.312
    geo.arc_tube("PROP_Headphones_Band", 0.085, 0.012, radians(200), loc=(sx, ry - 0.02, hz - 0.075),
                 material=metal, parent=root)
    for tag, s in (("L", -1), ("R", 1)):
        geo.cylinder(f"PROP_Headphones_Cup_{tag}", 0.045, 0.035,
                     loc=(sx + s * 0.07, ry - 0.02, hz - 0.13), rot=(0, s * pi / 2, 0),
                     material=metal, parent=root, bevel=0.01, shared="hp_cup")

    # ---------------------------------------------------- on the upper shelf
    for tag, x, r, h in (("A", -0.62, 0.05, 0.08), ("B", -0.47, 0.04, 0.07)):
        geo.cylinder(f"PROP_PlantPot_{tag}", r, h, loc=(x, uy, ut), r_top=r * 1.15, material=clay,
                     parent=root, rests_on="SHELF_Upper")
        geo.sphere(f"PROP_PlantFoliage_{tag}", r * 1.8, loc=(x, uy, ut + h - r * 0.6), material=plant,
                   parent=root, scale=(1.2, 1.0, 0.8))
    for i in range(4):
        geo.box(f"PROP_Book_{i}", (0.035, 0.15, 0.20 - (i % 2) * 0.02),
                loc=(-0.30 + i * 0.04, uy, ut), material=mat("Clay_Book", (0.18, 0.10, 0.06)),
                parent=root, bevel=0.002, rests_on="SHELF_Upper")
    for i, (dx, dy, h, tilt) in enumerate([(0, 0, 0.10, 0), (0.03, 0.01, 0.07, 20),
                                           (-0.03, 0.01, 0.07, -20), (0.0, -0.03, 0.06, 15)]):
        geo.cylinder(f"PROP_Crystal_{i}", 0.018, h, loc=(-0.07 + dx, uy + dy, ut), r_top=0.0,
                     rot=(radians(tilt), radians(tilt * 0.5), 0), material=crystal, parent=root,
                     verts=6, bevel=0,
                     # tilted crystals are deliberately embedded into the cluster's base
                     rests_on="SHELF_Upper" if i == 0 else None)
    geo.box("PROP_SmallBox", (0.08, 0.08, 0.06), loc=(0.07, uy, ut), material=clay_dark,
            parent=root, bevel=0.004, rests_on="SHELF_Upper")
    geo.box("PROP_BoxStack", (0.17, 0.12, 0.10), loc=(0.76, uy, ut), material=clay_dark,
            parent=root, bevel=0.004, rests_on="SHELF_Upper")

    # ---------------------------------------------------- under-desk storage
    sx0, sx1, sy0, sy1, sz = desk["shelf"]
    bin_ = geo.box("PROP_StorageBin", (0.24, 0.32, 0.17), loc=(sx0 + 0.15, sy0 + 0.20, sz),
                   material=clay_dark, parent=root, bevel=0.006, rests_on="DESK_LowShelf")
    geo.box("PROP_Crate", (0.22, 0.30, 0.15), loc=(sx1 - 0.14, sy0 + 0.18, sz), material=wood_light,
            parent=root, bevel=0.005, rests_on="DESK_LowShelf")
    for i in range(3):
        c = geo.box(f"PROP_Cartridge_{i}", (0.10, 0.018, 0.12),
                    loc=(sx0 + 0.15, sy0 + 0.14 + i * 0.05, sz + 0.17 - 0.08),
                    material=mat("Clay_Cartridge", (0.12, 0.10, 0.20)), parent=root,
                    bevel=0.002, shared="cartridge")
        if i == 0:
            S.mark_interactive(c, "cartridge", "Game details (placeholder)")

    # ---------------------------------------------------- collectibles (generic placeholders)
    for tag, x in (("A", 0.25), ("B", 0.52)):
        base = geo.cylinder(f"COLL_Figure{tag}_Base", 0.045, 0.015, loc=(x, uy, ut), collection="COLLECTIBLES",
                            material=metal, parent=root, rests_on="SHELF_Upper")
        geo.cylinder(f"COLL_Figure{tag}_Body", 0.03, 0.08, loc=(x, uy, ut + 0.015), r_top=0.026,
                     collection="COLLECTIBLES", material=clay, parent=root, bevel=0.008,
                     rests_on=f"COLL_Figure{tag}_Base")
        head = geo.sphere(f"COLL_Figure{tag}_Head", 0.045, loc=(x, uy, ut + 0.090),
                          collection="COLLECTIBLES", material=clay, parent=root)
        S.mark_interactive(head, f"collectible_{tag.lower()}", "Collectible detail (placeholder)")
