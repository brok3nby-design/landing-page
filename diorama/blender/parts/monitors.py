"""MONITORS: two monitors on stands, slightly toed-in. Each is a group so it can move as one."""
from config import MONITOR as M, CLAY
from lib import geo, scene as S
from lib.mats import mat


def build(root, riser_top):
    metal = mat("Clay_Metal", CLAY["metal"], rough=0.4, metal=0.6)
    screen = mat("Clay_Screen", (0.02, 0.02, 0.03), rough=0.2, emit=CLAY["screen"], strength=2.0)
    bw, bd, bh = M["base"]
    nw, nd = M["neck"]
    neck_y = M["thickness"] / 2 + 0.012 + nd / 2
    for side, x, rot in (("L", M["left_x"], -M["toe_in"]), ("R", M["right_x"], M["toe_in"])):
        grp = S.empty(f"MON_{side}", "MONITORS", loc=(x, M["y"], riser_top), rot=(0, 0, rot),
                      parent=root)
        geo.box(f"MON_{side}_Base", (bw, bd, bh), loc=(0, neck_y, 0), collection="MONITORS",
                material=metal, parent=grp, bevel=0.004, shared="mon_base", rests_on="SHELF_Riser")
        neck_h = M["lift"] + M["height"] * 0.5 - bh
        geo.box(f"MON_{side}_Neck", (nw, nd, neck_h), loc=(0, neck_y, bh), collection="MONITORS",
                material=metal, parent=grp, bevel=0.004, shared="mon_neck")
        geo.box(f"MON_{side}_Mount", (0.08, 0.014, 0.08),
                loc=(0, M["thickness"] / 2 + 0.006, M["lift"] + M["height"] * 0.5 - 0.04),
                collection="MONITORS", material=metal, parent=grp, bevel=0.002, shared="mon_mount")
        geo.box(f"MON_{side}_Housing", (M["width"], M["thickness"], M["height"]),
                loc=(0, 0, M["lift"]), collection="MONITORS", material=metal, parent=grp,
                bevel=0.004, shared="mon_housing")
        i = M["screen_inset"]
        scr = geo.box(f"MON_{side}_Screen", (M["width"] - 2 * i, 0.003, M["height"] - 2 * i - 0.012),
                      loc=(0, -M["thickness"] / 2 - 0.0005, M["lift"] + i + 0.012),
                      collection="MONITORS", material=screen, parent=grp, bevel=0)
        S.mark_interactive(scr, f"monitor_{'left' if side == 'L' else 'right'}",
                           "Projects (placeholder)")
