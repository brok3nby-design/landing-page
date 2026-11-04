"""SHELVES: monitor riser shelf + upper display shelf with back posts and back panel."""
from config import DESK as D, HUTCH as H, CLAY
from lib import geo
from lib.mats import mat
from parts.desk import dims


def build(root):
    wood = mat("Clay_Wood", CLAY["wood"])
    wood_dark = mat("Clay_WoodDark", CLAY["wood_dark"])
    cx, cy, x0, x1, y0, y1 = dims()
    desk_top = D["height"]
    t = H["plank"]

    # riser: two end panels + plank
    ry0 = y1 - H["riser_depth"]
    ry_c = (ry0 + y1) / 2
    for tag, x in (("L", x0 + t / 2), ("R", x1 - t / 2)):
        geo.box(f"SHELF_Riser_End_{tag}", (t, H["riser_depth"], H["riser_clear"]),
                loc=(x, ry_c, desk_top), collection="SHELVES", material=wood, parent=root,
                bevel=0.003, shared="riser_end", rests_on="DESK_Top")
    riser_top = desk_top + H["riser_clear"] + t
    geo.box("SHELF_Riser", (D["width"], H["riser_depth"], t), loc=(cx, ry_c, desk_top + H["riser_clear"]),
            collection="SHELVES", material=wood, parent=root, bevel=0.005,
            rests_on="SHELF_Riser_End_L")

    # upper shelf on two back posts, back panel between them
    p = H["post"]
    upper_z = riser_top + H["upper_gap"]
    post_y = y1 - p / 2
    for tag, x in (("L", x0 + p / 2), ("R", x1 - p / 2)):
        geo.box(f"SHELF_Post_{tag}", (p, p, H["upper_gap"]), loc=(x, post_y, riser_top),
                collection="SHELVES", material=wood, parent=root, bevel=0.004,
                shared="hutch_post", rests_on="SHELF_Riser")
    geo.box("SHELF_BackPanel", (D["width"] - 2 * p, H["back_panel"], H["upper_gap"]),
            loc=(cx, y1 - H["back_panel"] / 2, riser_top), collection="SHELVES",
            material=wood_dark, parent=root, bevel=0.002, rests_on="SHELF_Riser")
    uy0 = y1 - H["upper_depth"]
    geo.box("SHELF_Upper", (D["width"] + 2 * H["upper_overhang"], H["upper_depth"], t),
            loc=(cx, (uy0 + y1) / 2, upper_z), collection="SHELVES", material=wood,
            parent=root, bevel=0.005, rests_on="SHELF_Post_L")
    return dict(riser_top=riser_top, riser_y=ry_c, upper_top=upper_z + t, upper_y=(uy0 + y1) / 2,
                under_riser=desk_top)
