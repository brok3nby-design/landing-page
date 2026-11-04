"""Under-desk storage: fabric bin and wooden crate on the low shelf, filled with game cartridges."""
from math import radians
from lib import geo, scene as S
from lib.library import M

CART = (0.10, 0.017, 0.12)


def _cartridges(root, prefix, x, y0, z, count, step, tilt_seed, first_interactive=False):
    for i in range(count):
        tilt = radians(((i * 37 + tilt_seed) % 9) - 4) * 0.8
        grp = S.empty(f"{prefix}_{i}", "PROPS", loc=(x, y0 + i * step, z), rot=(tilt, 0, 0), parent=root,
                      size=0.03)
        body = geo.box(f"{prefix}_{i}_Body", CART, collection="PROPS", material=M("cartridge"), parent=grp,
                       bevel=0.003, seg=2, shared="cart_body")
        cell = (i + tilt_seed) % 4
        u0, v0 = (cell % 2) * 0.5, (1 - cell // 2) * 0.5
        geo.box(f"{prefix}_{i}_Label", (CART[0] * 0.8, 0.001, CART[2] * 0.62),
                loc=(0, -CART[1] / 2 - 0.0004, CART[2] * 0.36), collection="PROPS",
                material=M("cartridge_lbl"), parent=grp, bevel=0, uv="fit", fit_axis=1,
                uv_region=(u0, v0, u0 + 0.5, v0 + 0.5), shared=f"cart_label_{cell}")
        if first_interactive and i == 0:
            grp.name = "PROP_Cartridge_0"
            S.mark_interactive(grp, "cartridge", "Game details (placeholder)")


def build(root, desk):
    sx0, sx1, sy0, sy1, sz = desk["shelf"]
    # fabric bin
    bw, bd, bh = 0.24, 0.32, 0.095
    bx, by = sx0 + 0.15, sy0 + 0.20
    geo.merged("PROP_StorageBin", lambda bm: geo.add_open_box(bm, (bw, bd, bh), 0.006),
               loc=(bx, by, sz), material=M("fabric_bin"), parent=root, bevel=0.002, seg=1,
               uv="box", uv_scale=3, rests_on="DESK_LowShelf")
    geo.box("PROP_StorageBin_Handle", (0.08, 0.002, 0.025), loc=(bx, by - bd / 2 - 0.0005, sz + bh - 0.05),
            material=M("rubber"), parent=root, bevel=0.0)
    _cartridges(root, "PROP_BinCart", bx, by - 0.10, sz + 0.006, 6, 0.036, 1, first_interactive=True)
    # wooden crate with the pixel creature print on the front
    cw, cd, ch = 0.22, 0.30, 0.095
    cx, cy = sx1 - 0.14, sy0 + 0.18
    geo.merged("PROP_Crate", lambda bm: geo.add_open_box(bm, (cw, cd, ch), 0.012),
               loc=(cx, cy, sz), material=M("crate"), parent=root, bevel=0.002, seg=1,
               uv="fit", fit_axis=1, rests_on="DESK_LowShelf")
    _cartridges(root, "PROP_CrateCart", cx, cy - 0.09, sz + 0.012, 5, 0.04, 2)
