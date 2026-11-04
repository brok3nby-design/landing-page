"""CHAIR: ergonomic swivel chair (blockout). Local +Y = the direction the sitter faces."""
from math import radians, sin, cos, pi
from config import CHAIR as C, RUG, CLAY
from lib import geo, scene as S
from lib.mats import mat


def build(root):
    dark = mat("Clay_Chair", CLAY["chair"], rough=0.55)
    metal = mat("Clay_Metal", CLAY["metal"], rough=0.4, metal=0.6)
    grp = S.empty("CHAIR", "CHAIR", loc=(*C["location"], RUG["thickness"]), rot=(0, 0, C["rot_z"]),
                  parent=root)
    cr = C["caster_r"]
    # 5-star base + casters (one shared caster mesh, instanced 5x)
    leg_len = C["star_radius"] - 0.02
    for k in range(5):
        a = pi / 2 + k * 2 * pi / 5
        mid = leg_len / 2 + 0.02
        geo.box(f"CHAIR_StarLeg_{k}", (0.045, leg_len, 0.03),
                loc=(cos(a) * mid, sin(a) * mid, 2 * cr + 0.004), rot=(0, 0, a - pi / 2),
                collection="CHAIR", material=metal, parent=grp, bevel=0.008, shared="star_leg")
        geo.sphere(f"CHAIR_Caster_{k}", cr,
                   loc=(cos(a) * C["star_radius"], sin(a) * C["star_radius"], 0),
                   collection="CHAIR", material=dark, parent=grp, segs=16, shared="caster",
                   rests_on="BASE_Rug")
    geo.cylinder("CHAIR_Hub", 0.045, 0.06, loc=(0, 0, 2 * cr), collection="CHAIR", material=metal,
                 parent=grp, bevel=0.006)
    gas_bottom = 2 * cr + 0.06
    mech_z = C["seat_z"] - 0.04
    geo.cylinder("CHAIR_GasLift", 0.022, mech_z - gas_bottom, loc=(0, 0, gas_bottom),
                 collection="CHAIR", material=metal, parent=grp, verts=20, bevel=0.002)
    geo.box("CHAIR_Mechanism", (0.22, 0.20, 0.04), loc=(0, 0, mech_z), collection="CHAIR",
            material=metal, parent=grp, bevel=0.006)
    sw, sd, sh = C["seat"]
    geo.box("CHAIR_Seat", (sw, sd, sh), loc=(0, 0, C["seat_z"]), collection="CHAIR", material=dark,
            parent=grp, bevel=0.03, seg=4, rests_on="CHAIR_Mechanism")
    # backrest pivots from behind the seat, leaning back
    piv = S.empty("CHAIR_BackPivot", "CHAIR", loc=(0, -sd / 2 + 0.02, C["seat_z"] + 0.03),
                  rot=(-C["back_tilt"], 0, 0), parent=grp, size=0.05)
    bw, bd, bh = C["back"]
    geo.box("CHAIR_Backrest", (bw, bd, bh), loc=(0, -bd / 2, 0.06), collection="CHAIR",
            material=dark, parent=piv, bevel=0.03, seg=4)
    geo.box("CHAIR_BackSpine", (0.08, 0.03, 0.20), loc=(0, -0.01, -0.07), collection="CHAIR",
            material=metal, parent=piv, bevel=0.005)
    # armrests
    for tag, sx in (("L", -1), ("R", 1)):
        x = sx * C["arm_x"]
        geo.box(f"CHAIR_ArmBracket_{tag}", (C["arm_x"] - 0.10, 0.04, 0.025),
                loc=(sx * (0.10 + (C["arm_x"] - 0.10) / 2), -0.02, mech_z), collection="CHAIR",
                material=metal, parent=grp, bevel=0.004)
        geo.box(f"CHAIR_ArmPost_{tag}", (0.035, 0.05, 0.22), loc=(x, -0.02, mech_z + 0.025),
                collection="CHAIR", material=metal, parent=grp, bevel=0.005)
        geo.box(f"CHAIR_ArmPad_{tag}", (0.075, 0.26, 0.03), loc=(x, 0.02, mech_z + 0.245),
                collection="CHAIR", material=dark, parent=grp, bevel=0.012, seg=3,
                rests_on=f"CHAIR_ArmPost_{tag}")
