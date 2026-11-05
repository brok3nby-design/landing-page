"""MONITORS: two slim monitors on stands, toed-in. Each monitor is a group (moves as one).
Screens use code-painted UI textures as emission (left: editor, right: wallpaper)."""
from config import MONITOR as M_
from lib import geo, scene as S
from lib.library import M


def build(root, riser_top):
    W, Hh, T = M_["width"], M_["height"], M_["thickness"]
    bw, bd, bh = M_["base"]
    nw, nd = M_["neck"]
    out = {}
    for side, x, rot in (("L", M_["left_x"], -M_["toe_in"]), ("R", M_["right_x"], M_["toe_in"])):
        grp = S.empty(f"MON_{side}", "MONITORS", loc=(x, M_["y"], riser_top), rot=(0, 0, rot),
                      parent=root)
        neck_y = T / 2 + 0.03
        geo.prism(f"MON_{side}_Base", geo.rounded_rect(bw, bd, 0.03), bh, loc=(0, neck_y - 0.02, 0),
                  collection="MONITORS", material=M("metal_black"), parent=grp, bevel=0.003, seg=2,
                  rests_on="SHELF_Riser")
        neck_h = M_["lift"] + Hh * 0.5 - bh
        geo.box(f"MON_{side}_Neck", (nw, nd, neck_h), loc=(0, neck_y, bh), collection="MONITORS",
                material=M("metal_black"), parent=grp, bevel=0.006, seg=3, shared="mon_neck")
        geo.box(f"MON_{side}_Mount", (0.10, 0.03, 0.10),
                loc=(0, T / 2 + 0.012, M_["lift"] + Hh * 0.5 - 0.05),
                collection="MONITORS", material=M("plastic_black"), parent=grp, bevel=0.012, seg=3,
                shared="mon_mount")
        geo.box(f"MON_{side}_Housing", (W, T, Hh), loc=(0, 0, M_["lift"]), collection="MONITORS",
                material=M("plastic_black"), parent=grp, bevel=0.004, seg=3, shared="mon_housing")
        geo.box(f"MON_{side}_Back", (W * 0.7, 0.014, Hh * 0.62), loc=(0, T / 2, M_["lift"] + Hh * 0.2),
                collection="MONITORS", material=M("plastic_black"), parent=grp, bevel=0.006, seg=3,
                shared="mon_back")
        i = M_["screen_inset"]
        scr = geo.box(f"MON_{side}_Screen", (W - 2 * i, 0.002, Hh - 2 * i - 0.012),
                      loc=(0, -T / 2 - 0.0002, M_["lift"] + i + 0.012), collection="MONITORS",
                      material=M("screen_left" if side == "L" else "screen_right"), parent=grp,
                      bevel=0, uv="fit", fit_axis=1)
        S.mark_interactive(scr, f"monitor_{'left' if side == 'L' else 'right'}", "Projects (placeholder)", kind="navigation")
        out[side] = grp
    # webcam clipped on top of the right monitor
    top = M_["lift"] + Hh
    cam = S.empty("MON_R_Webcam", "MONITORS", loc=(0, 0, top), parent=out["R"], size=0.03)
    geo.box("MON_R_Webcam_Clip", (0.03, 0.03, 0.006), loc=(0, 0.004, 0), collection="MONITORS",
            material=M("plastic_black"), parent=cam, bevel=0.002, rests_on="MON_R_Housing")
    geo.box("MON_R_Webcam_Body", (0.075, 0.026, 0.026), loc=(0, -0.002, 0.006), collection="MONITORS",
            material=M("plastic_black"), parent=cam, bevel=0.011, seg=4, rests_on="MON_R_Webcam_Clip")
    geo.cylinder("MON_R_Webcam_Lens", 0.007, 0.004, loc=(0, -0.0145, 0.019), rot=(1.5708, 0, 0),
                 collection="MONITORS", material=M("glass"), parent=cam, verts=16, bevel=0.001)
    return out
