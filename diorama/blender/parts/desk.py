"""DESK: desktop, left metal frame, modesty panel, low storage shelf, drawer cabinet."""
from config import DESK as D, CABINET as C, LOW_SHELF as L, CLAY
from lib import geo
from lib.mats import mat


def dims():
    cx, cy = D["center"]
    x0, x1 = cx - D["width"] / 2, cx + D["width"] / 2
    y0, y1 = cy - D["depth"] / 2, cy + D["depth"] / 2
    return cx, cy, x0, x1, y0, y1


def build(root):
    wood = mat("Clay_Wood", CLAY["wood"])
    wood_dark = mat("Clay_WoodDark", CLAY["wood_dark"])
    metal = mat("Clay_Metal", CLAY["metal"], rough=0.4, metal=0.6)
    metal_mid = mat("Clay_MetalMid", CLAY["metal_mid"], rough=0.45, metal=0.5)
    cx, cy, x0, x1, y0, y1 = dims()
    top_z = D["height"] - D["top_thickness"]

    geo.box("DESK_Top", (D["width"], D["depth"], D["top_thickness"]), loc=(cx, cy, top_z),
            collection="DESK", material=wood, parent=root, bevel=0.008, seg=3)

    # --- left metal sled frame (two legs + top and floor rails)
    lg = D["leg"]
    lx = x0 + 0.04
    for tag, y in (("Front", y0 + 0.04), ("Back", y1 - 0.04)):
        geo.box(f"DESK_Leg_L_{tag}", (lg, lg, top_z), loc=(lx, y, 0), collection="DESK",
                material=metal, parent=root, bevel=0.004, shared="leg", rests_on="BASE_Platform")
    rail_len = (y1 - 0.04) - (y0 + 0.04) - lg
    geo.box("DESK_Rail_L_Top", (lg * 0.8, rail_len, 0.04), loc=(lx, cy, top_z - 0.04),
            collection="DESK", material=metal, parent=root, bevel=0.003)
    geo.box("DESK_Rail_L_Foot", (lg, rail_len + 2 * lg + 0.04, 0.03), loc=(lx, cy, 0),
            collection="DESK", material=metal, parent=root, bevel=0.004, rests_on="BASE_Platform")

    # --- drawer cabinet (right)
    cab_x1 = x1 - C["inset_right"]
    cab_x0 = cab_x1 - C["width"]
    cab_cx = (cab_x0 + cab_x1) / 2
    cab_y1 = y1 - C["inset_back"]
    cab_y0 = cab_y1 - C["depth"]
    cab_cy = (cab_y0 + cab_y1) / 2
    body_h = top_z - C["foot"]
    for i, (fx, fy) in enumerate([(cab_x0 + 0.03, cab_y0 + 0.03), (cab_x1 - 0.03, cab_y0 + 0.03),
                                  (cab_x0 + 0.03, cab_y1 - 0.03), (cab_x1 - 0.03, cab_y1 - 0.03)]):
        geo.cylinder(f"DESK_Cabinet_Foot_{i}", 0.012, C["foot"], loc=(fx, fy, 0), collection="DESK",
                     material=metal, parent=root, verts=12, bevel=0, shared="cab_foot",
                     rests_on="BASE_Platform")
    geo.box("DESK_Cabinet_Body", (C["width"], C["depth"], body_h), loc=(cab_cx, cab_cy, C["foot"]),
            collection="DESK", material=metal_mid, parent=root, bevel=0.006)
    z = top_z - 0.015
    front_y = cab_y0 - 0.009
    for i, h in enumerate(C["drawer_heights"]):
        z -= h
        drawer = geo.box(f"DESK_Drawer_{i + 1}", (C["width"] - 0.03, 0.018, h - C["gap"]),
                         loc=(cab_cx, front_y, z + C["gap"] / 2), collection="DESK",
                         material=metal, parent=root, bevel=0.004)
        geo.box(f"DESK_Drawer_{i + 1}_Handle", (0.13, 0.016, 0.012),
                loc=(cab_cx, front_y - 0.017, z + h - 0.05), collection="DESK",
                material=mat("Clay_Brass", CLAY["amber"], rough=0.3, metal=1.0),
                parent=root, bevel=0.004, shared="drawer_handle")
        z -= C["gap"]

    # --- modesty panel at the back, between left frame and cabinet
    pan_x0, pan_x1 = lx + lg / 2, cab_x0
    geo.box("DESK_ModestyPanel", (pan_x1 - pan_x0, 0.015, 0.38),
            loc=((pan_x0 + pan_x1) / 2, y1 - 0.05, top_z - 0.40), collection="DESK",
            material=metal, parent=root, bevel=0.003)

    # --- low storage shelf (holds bins / crate) between a divider and the cabinet
    sx0 = L["x0"]
    sy1 = y1 - 0.06
    sy0 = sy1 - L["depth"]
    geo.box("DESK_LowShelf_Divider", (0.02, L["depth"], L["divider_height"]),
            loc=(sx0 - 0.01, (sy0 + sy1) / 2, 0), collection="DESK", material=wood_dark,
            parent=root, bevel=0.003, rests_on="BASE_Platform")
    geo.box("DESK_LowShelf", (cab_x0 - sx0, L["depth"], L["thickness"]),
            loc=((sx0 + cab_x0) / 2, (sy0 + sy1) / 2, L["z"]), collection="DESK",
            material=wood, parent=root, bevel=0.003)
    return dict(top=D["height"], cab_x0=cab_x0, shelf=(sx0, cab_x0, sy0, sy1, L["z"] + L["thickness"]))
