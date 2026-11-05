"""CHAIR: gaming-style swivel chair. Local +Y = the direction the sitter faces.

Group hierarchy: CHAIR (empty, on the rug) -> base/seat parts, CHAIR_BackPivot -> backrest parts.
"""
from math import pi, sin, cos
from config import CHAIR as C, RUG
from lib import geo, scene as S
from lib.library import M

SEAT_Z = 0.42


def _caster(bm):
    geo.add_box(bm, (0.014, 0.042, 0.03), loc=(0, 0, 0.024))
    for x in (0.008, -0.019):
        geo.add_cyl(bm, 0.024, 0.011, loc=(x, 0, 0.024), rot=(0, pi / 2, 0), verts=16)
    geo.add_cyl(bm, 0.006, 0.012, loc=(0, 0, 0.052), verts=8)


def build(root):
    grp = S.empty("CHAIR", "CHAIR", loc=(*C["location"], RUG["thickness"]), rot=(0, 0, C["rot_z"]),
                  parent=root)
    blk, lea = M("metal_black"), M("leather")

    # --- base: 5-star legs + twin-wheel casters (one shared caster mesh, 5 objects)
    R = C["star_radius"]
    for k in range(5):
        a = pi / 2 + k * 2 * pi / 5
        geo.merged(f"CHAIR_Caster_{k}", _caster, loc=(cos(a) * R, sin(a) * R, 0), rot=(0, 0, a),
                   collection="CHAIR", material=M("plastic_black"), parent=grp, shared="caster",
                   uv="box", uv_scale=20, rests_on="BASE_Rug")
        leg_len = R - 0.02
        mid = leg_len / 2 + 0.03
        geo.box(f"CHAIR_StarLeg_{k}", (0.046, leg_len, 0.03), loc=(cos(a) * mid, sin(a) * mid, 0.062),
                rot=(0, 0, a - pi / 2), collection="CHAIR", material=blk, parent=grp, bevel=0.012,
                seg=3, shared="star_leg")
    geo.lathe("CHAIR_Hub", [(0, 0.05), (0.055, 0.05), (0.05, 0.095), (0.034, 0.11), (0, 0.11)],
              collection="CHAIR", material=blk, parent=grp, segments=24)
    geo.cylinder("CHAIR_GasShroud", 0.03, 0.15, loc=(0, 0, 0.11), collection="CHAIR", material=blk,
                 parent=grp, verts=24, bevel=0.003)
    mech_z = SEAT_Z - 0.045
    geo.cylinder("CHAIR_GasLift", 0.019, mech_z - 0.26, loc=(0, 0, 0.26), collection="CHAIR",
                 material=M("chrome"), parent=grp, verts=20, bevel=0.001)
    geo.box("CHAIR_Mechanism", (0.24, 0.22, 0.045), loc=(0, -0.02, mech_z), collection="CHAIR",
            material=blk, parent=grp, bevel=0.008)
    geo.cylinder("CHAIR_TiltLever", 0.006, 0.12, loc=(0.12, 0.04, mech_z + 0.02), rot=(0, pi / 2, 0.3),
                 collection="CHAIR", material=blk, parent=grp, verts=10, bevel=0.002)

    # --- seat with side bolsters and a brown centre panel
    geo.box("CHAIR_Seat", (0.50, 0.48, 0.07), loc=(0, 0, SEAT_Z), collection="CHAIR", material=lea,
            parent=grp, bevel=0.026, seg=4, uv_scale=3, rests_on="CHAIR_Mechanism")
    for tag, s in (("L", -1), ("R", 1)):
        geo.box(f"CHAIR_Bolster_{tag}", (0.085, 0.46, 0.05), loc=(s * 0.215, 0.0, SEAT_Z + 0.045),
                rot=(0, s * 0.22, 0), collection="CHAIR", material=lea, parent=grp, bevel=0.024,
                seg=4, uv_scale=3, shared="bolster")
    geo.box("CHAIR_SeatPanel", (0.27, 0.38, 0.012), loc=(0, 0.01, SEAT_Z + 0.066), collection="CHAIR",
            material=M("leather_brown"), parent=grp, bevel=0.005, seg=2, uv_scale=3)

    # --- backrest (pivots behind the seat, leaning back)
    piv = S.empty("CHAIR_BackPivot", "CHAIR", loc=(0, -0.23, SEAT_Z + 0.03),
                  rot=(-C["back_tilt"], 0, 0), parent=grp, size=0.05)
    bh = 0.66
    geo.box("CHAIR_Backrest", (0.46, 0.075, bh), loc=(0, -0.0375, 0.05), collection="CHAIR",
            material=lea, parent=piv, bevel=0.03, seg=4, uv_scale=3)
    for tag, s in (("L", -1), ("R", 1)):
        geo.box(f"CHAIR_Wing_{tag}", (0.075, 0.11, 0.40), loc=(s * 0.225, 0.0, 0.10),
                rot=(0, 0, -s * 0.35), collection="CHAIR", material=lea, parent=piv, bevel=0.028,
                seg=4, uv_scale=3, shared="wing")
        geo.box(f"CHAIR_BeltSlot_{tag}", (0.055, 0.012, 0.028), loc=(s * 0.12, 0.0, bh - 0.06),
                collection="CHAIR", material=M("plastic_black"), parent=piv, bevel=0.006, shared="slot")
    geo.box("CHAIR_BackPanel", (0.25, 0.012, 0.40), loc=(0, 0.0, 0.14), collection="CHAIR",
            material=M("leather_brown"), parent=piv, bevel=0.005, seg=2, uv_scale=3)
    geo.box("CHAIR_BackSpine", (0.09, 0.035, 0.22), loc=(0, -0.05, -0.12), collection="CHAIR",
            material=blk, parent=piv, bevel=0.008)
    outer = [(-0.05, 0.035), (0.05, 0.035), (0.0, -0.045)]
    inner = [(-0.032, 0.025), (0.032, 0.025), (0.0, -0.025)]
    geo.prism("CHAIR_Emblem", outer, 0.004, holes=inner, loc=(0, -0.075, bh - 0.12), rot=(pi / 2, 0, 0),
              collection="CHAIR", material=M("brass"), parent=piv, bevel=0.001, seg=1)
    # stitch channels on the back (faces the hero camera) + headrest pillow
    for k, x in enumerate((-0.13, -0.045, 0.045, 0.13)):
        geo.box(f"CHAIR_BackStitch_{k}", (0.006, 0.003, bh - 0.16), loc=(x, -0.0752, 0.12), collection="CHAIR",
                material=M("leather_brown"), parent=piv, bevel=0.0012, seg=1, shared="back_stitch")
    geo.box("CHAIR_HeadPillow", (0.24, 0.065, 0.11), loc=(0.0, 0.032, bh - 0.12), rot=(0.12, 0, 0),
            collection="CHAIR", material=M("leather_brown"), parent=piv, bevel=0.03, seg=5, uv_scale=4)
    geo.box("CHAIR_LumbarPillow", (0.31, 0.10, 0.17), loc=(0.03, 0.05, 0.055), rot=(0.1, 0, 0.06),
            collection="CHAIR", material=M("quilt"), parent=piv, bevel=0.045, seg=5, uv_scale=4)

    # --- armrests
    for tag, s in (("L", -1), ("R", 1)):
        x = s * C["arm_x"]
        geo.box(f"CHAIR_ArmBracket_{tag}", (C["arm_x"] - 0.11, 0.045, 0.022),
                loc=(s * (0.11 + (C["arm_x"] - 0.11) / 2), -0.03, mech_z + 0.01), collection="CHAIR",
                material=blk, parent=grp, bevel=0.005)
        geo.box(f"CHAIR_ArmPost_{tag}", (0.04, 0.06, 0.23), loc=(x, -0.03, mech_z + 0.032),
                collection="CHAIR", material=blk, parent=grp, bevel=0.008)
        geo.box(f"CHAIR_ArmPad_{tag}", (0.09, 0.27, 0.032), loc=(x, 0.0, mech_z + 0.262),
                collection="CHAIR", material=lea, parent=grp, bevel=0.014, seg=4, uv_scale=3,
                rests_on=f"CHAIR_ArmPost_{tag}")
    return grp
