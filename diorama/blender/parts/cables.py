"""Cable management: device cables run to the riser grommet, drop under the desk into the tray,
and the power strip lead runs to the back of the platform. Purely visual (CABLE_* objects)."""
from lib import geo
from lib.library import M

R = 0.0028


def build(root, desk, hutch):
    rt, top_z, top = hutch["riser_top"], desk["top_z"], desk["top"]
    gx, gy = hutch["grommet"]
    by = hutch["back_y"]
    run_y = by - 0.022
    c = lambda name, pts, r=R: geo.curve_tube(name, pts, r, material=M("cable"), parent=root, ring=6, steps=6)

    c("CABLE_Monitor_L", [(-0.17, 0.80, rt + 0.25), (-0.15, 0.82, rt + 0.10), (-0.05, run_y, rt + 0.006),
                          (gx - 0.012, run_y, rt + 0.004), (gx - 0.008, gy, rt - 0.02)])
    c("CABLE_Monitor_R", [(0.36, 0.80, rt + 0.25), (0.34, 0.82, rt + 0.10), (0.28, run_y, rt + 0.006),
                          (gx + 0.012, run_y, rt + 0.004), (gx + 0.008, gy, rt - 0.02)])
    c("CABLE_Speaker_L", [(-0.50, 0.79, rt + 0.04), (-0.48, run_y + 0.004, rt + 0.0035),
                          (gx - 0.02, run_y + 0.004, rt + 0.0035), (gx - 0.004, gy + 0.004, rt - 0.02)], 0.002)
    c("CABLE_Speaker_R", [(0.67, 0.79, rt + 0.04), (0.64, run_y + 0.004, rt + 0.0035),
                          (gx + 0.02, run_y + 0.004, rt + 0.0035), (gx + 0.004, gy + 0.004, rt - 0.02)], 0.002)
    c("CABLE_Lamp", [(-0.615, 0.765, rt + 0.012), (-0.6, run_y - 0.004, rt + 0.0035),
                     (gx - 0.03, run_y - 0.004, rt + 0.0035), (gx - 0.002, gy - 0.004, rt - 0.02)], 0.0022)
    c("CABLE_Keyboard", [(-0.13, 0.43, top + 0.012), (-0.12, 0.50, top + 0.0035), (-0.05, 0.70, top + 0.0035),
                         (0.0, by - 0.03, top + 0.0035), (0.02, by - 0.025, top - 0.02)], 0.0022)

    # under the desk: bundle from the desk grommet into the tray / power strip
    tx, ty, tz = desk["tray"]
    for k, dx in enumerate((-0.09, -0.03, 0.03, 0.09)):
        c(f"CABLE_Under_{k}", [(gx + (k - 1.5) * 0.006, gy, top_z), (gx + (k - 1.5) * 0.006, gy - 0.01, top_z - 0.03),
                               (tx + dx, ty + 0.012, tz + 0.03), (tx + dx, ty, tz + 0.02)])
    # power lead drops to the floor and runs off the back
    c("CABLE_Power", [(tx + 0.14, ty, tz - 0.015), (tx + 0.20, ty + 0.01, tz - 0.12), (tx + 0.24, by - 0.03, 0.25),
                      (tx + 0.25, by - 0.02, 0.003), (tx + 0.30, by + 0.06, 0.003), (tx + 0.32, by + 0.09, 0.004)], 0.0032)
