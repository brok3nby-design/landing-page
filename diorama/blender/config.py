"""Single source of truth for dimensions, placement and palette.

Units: meters, real-world size of the represented objects.
Axes:  Z up, desk faces -Y (toward the viewer), +X is to the right.
The platform's top surface is z = 0, so everything rests on z >= 0.
"""
from math import radians

# ---------------------------------------------------------------- BASE
PLATFORM = dict(width=2.50, depth=2.00, thickness=0.12, chamfer=0.32, edge_bevel=0.02)
RUG = dict(width=1.80, depth=1.10, thickness=0.008, center=(-0.10, -0.27))

# ---------------------------------------------------------------- DESK
DESK = dict(
    width=1.60, depth=0.72, height=0.76, top_thickness=0.04,
    center=(0.12, 0.52),           # x, y of the desktop centre
    leg=0.045,                     # square metal leg section (left frame)
)
CABINET = dict(width=0.44, depth=0.66, inset_right=0.01, inset_back=0.02,
               drawer_heights=(0.17, 0.20, 0.26), gap=0.008, foot=0.015)
LOW_SHELF = dict(x0=-0.18, z=0.08, thickness=0.02, depth=0.52, divider_height=0.30)

# ---------------------------------------------------------------- HUTCH
HUTCH = dict(
    riser_depth=0.30, riser_clear=0.17, plank=0.03,   # riser plank sits 0.17 above desktop
    upper_gap=0.54,                                    # riser top -> upper shelf bottom
    upper_depth=0.26, upper_overhang=0.03, post=0.04, back_panel=0.01,
)

# ---------------------------------------------------------------- MONITORS (~23")
MONITOR = dict(
    width=0.52, height=0.31, thickness=0.022,
    screen_inset=0.01, lift=0.10,                # screen bottom above riser top
    base=(0.20, 0.16, 0.012), neck=(0.04, 0.02),
    left_x=-0.17, right_x=0.36, y=0.75, toe_in=radians(8),
)

# ---------------------------------------------------------------- CHAIR
CHAIR = dict(
    location=(-0.30, -0.12), rot_z=radians(-35),
    star_radius=0.30, caster_r=0.028, seat=(0.52, 0.50, 0.09), seat_z=0.42,
    back=(0.50, 0.08, 0.68), back_tilt=radians(10), arm_x=0.29,
)

# ---------------------------------------------------------------- PALETTE (blockout clay tints)
# Linear-ish RGB. Phase 1 only needs parts to read clearly; real materials arrive in Phase 2/3.
CLAY = dict(
    wood=(0.42, 0.22, 0.10), wood_dark=(0.26, 0.13, 0.06), wood_light=(0.55, 0.32, 0.15),
    metal=(0.05, 0.05, 0.055), metal_mid=(0.12, 0.11, 0.11),
    chair=(0.06, 0.05, 0.05), rug=(0.35, 0.08, 0.06),
    screen=(0.45, 0.25, 0.95), clay=(0.55, 0.50, 0.46), clay_dark=(0.22, 0.20, 0.19),
    plant=(0.20, 0.30, 0.08), crystal=(0.45, 0.20, 0.85), amber=(1.0, 0.55, 0.15),
)
WORLD_COLOR = (0.010, 0.009, 0.013)   # dark charcoal backdrop

# ---------------------------------------------------------------- RENDER / CAMERAS
RENDER = dict(res=(1600, 900), samples=48)
# azimuth: 0 = straight from the front (-Y), positive = camera moves to the right (+X)
VIEWS = [
    dict(name="CAM_Hero",     file="01_reference_angle.png", az=18,  el=27, lens=85),
    dict(name="CAM_Opposite", file="02_opposite_angle.png",  az=-38, el=27, lens=85),
    dict(name="CAM_Back",     file="03_side_back.png",       az=140, el=27, lens=85),
    dict(name="CAM_Top",      file="04_top_plan.png",        az=0,   el=89.9, lens=85),
]
FRAME_FILL = 0.84   # model occupies at most this fraction of the frame -> negative space

# Files that must never be overwritten by a rebuild once you approve them.
APPROVED_FILES = []
