"""DESK: desktop, left metal sled frame, modesty panel, low storage shelf, drawer cabinet,
LED strip, cable tray and power strip."""
from config import DESK as D, CABINET as C, LOW_SHELF as L
from lib import geo, scene as S
from lib.library import M


def dims():
    cx, cy = D["center"]
    x0, x1 = cx - D["width"] / 2, cx + D["width"] / 2
    y0, y1 = cy - D["depth"] / 2, cy + D["depth"] / 2
    return cx, cy, x0, x1, y0, y1


def build(root):
    cx, cy, x0, x1, y0, y1 = dims()
    top_z = D["height"] - D["top_thickness"]

    geo.box("DESK_Top", (D["width"], D["depth"], D["top_thickness"]), loc=(cx, cy, top_z),
            collection="DESK", material=M("wood"), parent=root, bevel=0.007, seg=4, uv_scale=0.8)
    geo.box("DESK_LED_Front", (D["width"] - 0.12, 0.008, 0.004), loc=(cx, y0 + 0.03, top_z - 0.004),
            collection="DESK", material=M("led_amber"), parent=root, bevel=0)

    # --- left metal sled frame
    lg = D["leg"]
    lx = x0 + 0.04
    for tag, y in (("Front", y0 + 0.04), ("Back", y1 - 0.04)):
        geo.box(f"DESK_Leg_L_{tag}", (lg, lg, top_z - 0.03), loc=(lx, y, 0.03), collection="DESK",
                material=M("metal_black"), parent=root, bevel=0.005, shared="leg",
                rests_on="DESK_Rail_L_Foot")
    rail_len = (y1 - 0.04) - (y0 + 0.04) - lg
    geo.box("DESK_Rail_L_Top", (lg * 0.8, rail_len, 0.04), loc=(lx, cy, top_z - 0.04),
            collection="DESK", material=M("metal_black"), parent=root, bevel=0.004)
    geo.box("DESK_Rail_L_Foot", (lg * 1.1, rail_len + 2 * lg + 0.04, 0.03), loc=(lx, cy, 0),
            collection="DESK", material=M("metal_black"), parent=root, bevel=0.006,
            rests_on="BASE_Platform")

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
        geo.cylinder(f"DESK_Cabinet_Foot_{i}", 0.014, C["foot"], loc=(fx, fy, 0), collection="DESK",
                     material=M("metal_black"), parent=root, verts=16, bevel=0, shared="cab_foot",
                     rests_on="BASE_Platform")
    geo.box("DESK_Cabinet_Body", (C["width"], C["depth"], body_h), loc=(cab_cx, cab_cy, C["foot"]),
            collection="DESK", material=M("metal_dark"), parent=root, bevel=0.008, seg=3)
    z = top_z - 0.012
    front_y = cab_y0 - 0.008
    for i, h in enumerate(C["drawer_heights"]):
        z -= h
        # drawer group: origin at the front-bottom centre; slide it along local -Y to open later
        dg = S.empty(f"DESK_Drawer_{i + 1}_Group", "DESK", loc=(cab_cx, front_y, z + C["gap"] / 2),
                     parent=root, size=0.05)
        geo.box(f"DESK_Drawer_{i + 1}", (C["width"] - 0.026, 0.016, h - C["gap"]),
                collection="DESK", material=M("metal_dark"), parent=dg, bevel=0.005, seg=3)
        hz = h - 0.055 - C["gap"] / 2
        geo.cylinder(f"DESK_Drawer_{i + 1}_Handle", 0.006, 0.15, loc=(-0.075, -0.026, hz),
                     rot=(0, 1.5708, 0), collection="DESK", material=M("brass"), parent=dg,
                     verts=12, bevel=0.001, shared="drawer_handle")
        for s in (-1, 1):
            geo.cylinder(f"DESK_Drawer_{i + 1}_Standoff_{'L' if s < 0 else 'R'}", 0.004, 0.019,
                         loc=(s * 0.06, -0.008, hz), rot=(1.5708, 0, 0),
                         collection="DESK", material=M("brass"), parent=dg, verts=8, bevel=0,
                         shared="drawer_standoff")
        S.mark_interactive(dg, f"drawer_{i + 1}", "Potential future interaction (placeholder)", kind="discovery")
        z -= C["gap"]
    geo.box("DESK_Cabinet_LED", (C["width"] - 0.04, 0.006, 0.004), loc=(cab_cx, cab_y0 + 0.01, top_z - 0.004),
            collection="DESK", material=M("led_amber"), parent=root, bevel=0)

    # --- modesty panel at the back, between left frame and cabinet
    pan_x0, pan_x1 = lx + lg / 2, cab_x0
    geo.box("DESK_ModestyPanel", (pan_x1 - pan_x0, 0.015, 0.38),
            loc=((pan_x0 + pan_x1) / 2, y1 - 0.05, top_z - 0.40), collection="DESK",
            material=M("metal_black"), parent=root, bevel=0.003)

    # --- cable tray + power strip under the back edge
    tray_w = 0.60
    tx = (pan_x0 + pan_x1) / 2 + 0.05
    geo.merged("DESK_CableTray", lambda bm: geo.add_open_box(bm, (tray_w, 0.07, 0.05), 0.003),
               loc=(tx, y1 - 0.095, top_z - 0.075), collection="DESK", material=M("metal_black"),
               parent=root)
    geo.box("DESK_PowerStrip", (0.28, 0.05, 0.03), loc=(tx, y1 - 0.095, top_z - 0.072),
            collection="DESK", material=M("plastic_black"), parent=root, bevel=0.006)   # sits on the tray floor
    for k in range(4):
        geo.box(f"DESK_PowerStrip_Plug_{k}", (0.025, 0.03, 0.02),
                loc=(tx - 0.09 + k * 0.06, y1 - 0.095, top_z - 0.042), collection="DESK",
                material=M("plastic_grey"), parent=root, bevel=0.004, shared="plug",
                rests_on="DESK_PowerStrip")

    # --- low storage shelf (holds bins / crate) between a divider and the cabinet
    sx0 = L["x0"]
    sy1 = y1 - 0.06
    sy0 = sy1 - L["depth"]
    geo.box("DESK_LowShelf_Divider", (0.02, L["depth"], L["divider_height"]),
            loc=(sx0 - 0.01, (sy0 + sy1) / 2, 0), collection="DESK", material=M("wood_dark"),
            parent=root, bevel=0.003, uv_swap=True, rests_on="BASE_Platform")
    geo.box("DESK_LowShelf", (cab_x0 - sx0, L["depth"], L["thickness"]),
            loc=((sx0 + cab_x0) / 2, (sy0 + sy1) / 2, L["z"]), collection="DESK",
            material=M("wood"), parent=root, bevel=0.003)
    for tag, x in (("L", sx0 + 0.03), ("R", cab_x0 - 0.03)):
        geo.box(f"DESK_LowShelf_Leg_{tag}", (0.03, L["depth"] - 0.06, L["z"]),
                loc=(x, (sy0 + sy1) / 2, 0), collection="DESK", material=M("wood_dark"),
                parent=root, bevel=0.002, shared="lowshelf_leg", rests_on="BASE_Platform")
    return dict(top=D["height"], top_z=top_z, cab_x0=cab_x0, tray=(tx, y1 - 0.095, top_z - 0.042),
                shelf=(sx0, cab_x0, sy0, sy1, L["z"] + L["thickness"]))
