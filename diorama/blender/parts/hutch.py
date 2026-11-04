"""SHELVES: monitor riser (closed back, cable grommet, amber LED) + upper display shelf on back
posts with a back panel, purple LED strips (front edge + back wash)."""
from config import DESK as D, HUTCH as H
from lib import geo
from lib.library import M
from parts.desk import dims


def build(root):
    cx, cy, x0, x1, y0, y1 = dims()
    desk_top = D["height"]
    t = H["plank"]

    ry0 = y1 - H["riser_depth"]
    ry_c = (ry0 + y1) / 2
    for tag, x in (("L", x0 + t / 2), ("R", x1 - t / 2)):
        geo.box(f"SHELF_Riser_End_{tag}", (t, H["riser_depth"], H["riser_clear"]),
                loc=(x, ry_c, desk_top), collection="SHELVES", material=M("wood"), parent=root,
                bevel=0.003, shared="riser_end", uv_swap=True, rests_on="DESK_Top")
    geo.box("SHELF_Riser_Back", (D["width"] - 2 * t, 0.012, H["riser_clear"]),
            loc=(cx, y1 - 0.006, desk_top), collection="SHELVES", material=M("wood_dark"),
            parent=root, bevel=0.002, rests_on="DESK_Top")
    riser_z = desk_top + H["riser_clear"]
    riser_top = riser_z + t
    geo.box("SHELF_Riser", (D["width"], H["riser_depth"], t), loc=(cx, ry_c, riser_z),
            collection="SHELVES", material=M("wood"), parent=root, bevel=0.006, seg=3,
            rests_on="SHELF_Riser_End_L")
    geo.box("SHELF_Riser_LED", (D["width"] - 0.1, 0.008, 0.004), loc=(cx, ry0 + 0.02, riser_z - 0.004),
            collection="SHELVES", material=M("led_amber"), parent=root, bevel=0)
    grom_x = cx + 0.1
    geo.lathe("SHELF_Riser_Grommet", [(0.0, 0.0), (0.022, 0.0), (0.022, 0.003), (0.016, 0.003),
                                      (0.016, 0.001), (0.0, 0.001)],
              loc=(grom_x, y1 - 0.04, riser_top), collection="SHELVES", material=M("plastic_black"),
              parent=root, segments=24, rests_on="SHELF_Riser")

    p = H["post"]
    upper_z = riser_top + H["upper_gap"]
    post_y = y1 - p / 2
    for tag, x in (("L", x0 + p / 2), ("R", x1 - p / 2)):
        geo.box(f"SHELF_Post_{tag}", (p, p, H["upper_gap"]), loc=(x, post_y, riser_top),
                collection="SHELVES", material=M("wood"), parent=root, bevel=0.005,
                shared="hutch_post", uv_swap=True, rests_on="SHELF_Riser")
    geo.box("SHELF_BackPanel", (D["width"] - 2 * p, H["back_panel"], H["upper_gap"]),
            loc=(cx, y1 - H["back_panel"] / 2, riser_top), collection="SHELVES",
            material=M("wood_dark"), parent=root, bevel=0.002, rests_on="SHELF_Riser")
    uy0 = y1 - H["upper_depth"]
    geo.box("SHELF_Upper", (D["width"] + 2 * H["upper_overhang"], H["upper_depth"], t),
            loc=(cx, (uy0 + y1) / 2, upper_z), collection="SHELVES", material=M("wood"),
            parent=root, bevel=0.006, seg=3, rests_on="SHELF_Post_L")
    geo.box("SHELF_Upper_LED_Front", (D["width"] - 0.06, 0.008, 0.004), loc=(cx, uy0 + 0.015, upper_z - 0.004),
            collection="SHELVES", material=M("led_purple"), parent=root, bevel=0)
    geo.box("SHELF_Upper_LED_Back", (D["width"] - 0.12, 0.008, 0.004), loc=(cx, y1 - 0.02, upper_z - 0.004),
            collection="SHELVES", material=M("led_purple"), parent=root, bevel=0)
    return dict(riser_top=riser_top, riser_y=ry_c, upper_top=upper_z + t, upper_y=(uy0 + y1) / 2,
                upper_front=uy0, under_riser=desk_top, riser_z=riser_z, grommet=(grom_x, y1 - 0.04),
                back_y=y1, x0=x0, x1=x1)
