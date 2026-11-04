"""Under-desk storage: decorative fabric bin + the GAMES CRATE navigation asset.

NAV_GamesCrate is a self-contained, reusable asset:
  NAV_GamesCrate (empty, origin = crate bottom centre, no rotation/scale; asset_id="games_crate")
    NAV_GamesCrate_Body            wooden open-top crate (pixel-creature print)
    GAME_Case_01 .. GAME_Case_NN   one group per game slot (origin = case bottom centre)
      GAME_Case_XX_Body, GAME_Case_XX_Label (own mesh + own material -> per-game label art)
Everything inside uses coordinates local to NAV_GamesCrate, so the same hierarchy can sit
under the desk (homepage) or be exported / placed alone (Games page). Game metadata lives in
diorama/data/games.json, keyed by slot - never in the geometry.
"""
from math import radians
from lib import geo, scene as S
from lib.library import M
from lib.mats import mat
from lib import artwork

CART = (0.10, 0.017, 0.12)
CRATE = dict(size=(0.22, 0.30, 0.095), wall=0.012, slots=5, step=0.04)


def _cartridges(root, prefix, x, y0, z, count, step, tilt_seed):
    """Decorative cartridges (fabric bin). Shared meshes, not interactive."""
    for i in range(count):
        tilt = radians(((i * 37 + tilt_seed) % 9) - 4) * 0.8
        grp = S.empty(f"{prefix}_{i}", "PROPS", loc=(x, y0 + i * step, z), rot=(tilt, 0, 0), parent=root,
                      size=0.03)
        geo.box(f"{prefix}_{i}_Body", CART, collection="PROPS", material=M("cartridge"), parent=grp,
                bevel=0.003, seg=2, shared="cart_body")
        cell = (i + tilt_seed) % 4
        u0, v0 = (cell % 2) * 0.5, (1 - cell // 2) * 0.5
        geo.box(f"{prefix}_{i}_Label", (CART[0] * 0.8, 0.001, CART[2] * 0.62),
                loc=(0, -CART[1] / 2 - 0.0004, CART[2] * 0.36), collection="PROPS",
                material=M("cartridge_lbl"), parent=grp, bevel=0, uv="fit", fit_axis=1,
                uv_region=(u0, v0, u0 + 0.5, v0 + 0.5), shared=f"cart_label_{cell}")


def games_crate(parent, loc, rests_on=None, collection="PROPS"):
    """Build the reusable NAV_GamesCrate hierarchy at `loc` (in `parent` space)."""
    cw, cd, ch = CRATE["size"]
    wall = CRATE["wall"]
    nav = S.empty("NAV_GamesCrate", collection, loc=loc, parent=parent, size=0.12)
    nav["asset_id"] = "games_crate"
    geo.merged("NAV_GamesCrate_Body", lambda bm: geo.add_open_box(bm, (cw, cd, ch), wall),
               collection=collection, material=M("crate"), parent=nav, bevel=0.002, seg=1,
               uv="fit", fit_axis=1, rests_on=rests_on)
    n, step = CRATE["slots"], CRATE["step"]
    y0 = -step * (n - 1) / 2
    for i in range(n):
        slot = i + 1
        name = f"GAME_Case_{slot:02d}"
        tilt = radians(((i * 37 + 2) % 9) - 4) * 0.8
        case = S.empty(name, collection, loc=(0, y0 + i * step, wall), rot=(tilt, 0, 0), parent=nav, size=0.03)
        case["game_slot"] = slot
        geo.box(f"{name}_Body", CART, collection=collection, material=M("cartridge"), parent=case,
                bevel=0.003, seg=2, shared="cart_body")
        # own mesh + own material + own texture per slot -> each game shows its own cover art
        # (artwork slot game_label_XX or games.json label_texture; default = pixel-art label)
        tex = f"game_label_{slot:02d}"
        lbl_mat = mat(f"M_{name}_Label", tex=tex, rough=0.5, closest=not artwork.is_custom(tex))
        lbl = geo.box(f"{name}_Label", (CART[0] * 0.8, 0.001, CART[2] * 0.62),
                      loc=(0, -CART[1] / 2 - 0.0004, CART[2] * 0.36), collection=collection,
                      material=lbl_mat, parent=case, bevel=0, uv="fit", fit_axis=1)
        lbl["artwork_slot"] = tex
        S.mark_interactive(case, f"game_slot_{slot:02d}", f"Game slot {slot} (metadata in games.json)",
                           scope="games")
    S.mark_interactive(nav, "games_crate", "Game collection -> EXPLORE GAMES", scope="home")
    return nav


def build(root, desk):
    sx0, sx1, sy0, sy1, sz = desk["shelf"]
    # decorative fabric bin
    bw, bd, bh = 0.24, 0.32, 0.095
    bx, by = sx0 + 0.15, sy0 + 0.20
    geo.merged("PROP_StorageBin", lambda bm: geo.add_open_box(bm, (bw, bd, bh), 0.006),
               loc=(bx, by, sz), material=M("fabric_bin"), parent=root, bevel=0.002, seg=1,
               uv="box", uv_scale=3, rests_on="DESK_LowShelf")
    geo.box("PROP_StorageBin_Handle", (0.08, 0.002, 0.025), loc=(bx, by - bd / 2 - 0.0005, sz + bh - 0.05),
            material=M("rubber"), parent=root, bevel=0.0)
    _cartridges(root, "PROP_BinCart", bx, by - 0.10, sz + 0.006, 6, 0.036, 1)
    # the games crate (same position as before: right of the bin, on the low shelf)
    return games_crate(root, (sx1 - 0.14, sy0 + 0.18, sz), rests_on="DESK_LowShelf")
