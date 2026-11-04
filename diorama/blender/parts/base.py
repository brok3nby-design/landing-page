"""BASE: plank-floor display platform with raised mitred trim, dark plinth, ornate rug + fringe."""
from math import sqrt
from config import PLATFORM as P, RUG as R
from lib import geo
from lib.library import M

TRIM_W, TRIM_H = 0.07, 0.015


def build(root):
    W, D, C, T = P["width"], P["depth"], P["chamfer"], P["thickness"]
    outline = geo.chamfered_rect(W, D, C)
    geo.prism("BASE_Platform", outline, T, loc=(0, 0, -T), collection="BASE",
              material=M("planks"), parent=root, bevel=0.006, seg=2)
    inner = geo.chamfered_rect(W - 2 * TRIM_W, D - 2 * TRIM_W, C - TRIM_W * (2 - sqrt(2)))
    geo.prism("BASE_Trim", outline, TRIM_H, holes=inner, collection="BASE", material=M("wood"),
              parent=root, bevel=0.005, seg=3, uv_scale=1.5, rests_on="BASE_Platform")
    pl = geo.chamfered_rect(W - 0.06, D - 0.06, C - 0.03 * (2 - sqrt(2)))
    geo.prism("BASE_Plinth", pl, 0.025, loc=(0, 0, -T - 0.025), collection="BASE",
              material=M("wood_dark"), parent=root, bevel=0.004, seg=2)

    rw, rd, rt = R["width"], R["depth"], R["thickness"]
    geo.box("BASE_Rug", (rw, rd, rt), loc=(*R["center"], 0), collection="BASE",
            material=M("rug"), parent=root, bevel=0.0015, seg=1, uv="fit", fit_axis=2,
            rests_on="BASE_Platform")

    def fringe(bm):
        n = int(rd / 0.011)
        for side in (-1, 1):
            for k in range(n):
                y = -rd / 2 + 0.008 + k * (rd - 0.016) / (n - 1)
                ln = 0.035 + 0.006 * ((k * 7) % 3) / 2
                geo.add_box(bm, (ln, 0.0035, 0.0018), loc=(side * (rw / 2 + ln / 2 - 0.002), y, 0),
                            rot=(0, 0, 0.12 * (((k * 13) % 5) - 2) / 2))
    geo.merged("BASE_Rug_Fringe", fringe, loc=(*R["center"], 0), collection="BASE",
               material=M("rug_fringe"), parent=root, uv="box", uv_scale=20, rests_on="BASE_Platform")
