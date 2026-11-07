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
CRATE = dict(size=(0.22, 0.30, 0.095), wall=0.011, post=0.018, boards=4, gap=0.0035, slots=5, step=0.04)


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
    """Build the reusable NAV_GamesCrate hierarchy at `loc` (in `parent` space).

    A slatted wooden crate: four corner posts, four boards per side with small gaps, a floor of boards,
    nail heads and rope handles. The front and back boards carry the printed pixel creature
    (NAV_GamesCrate_Body, fitted UVs); the posts, side boards and floor are plain wood (NAV_GamesCrate_Frame).
    Five cartridges stand in it (GAME_Case_01..05), each with grip ridges and gold contacts."""
    cw, cd, ch = CRATE["size"]
    wall, post, n_b, gap = CRATE["wall"], CRATE["post"], CRATE["boards"], CRATE["gap"]
    nav = S.empty("NAV_GamesCrate", collection, loc=loc, parent=parent, size=0.12)
    nav["asset_id"] = "games_crate"
    pitch = ch / n_b
    def boards(bm, along_x):                         # n_b boards on the two walls facing +/-Y (or +/-X)
        L = (cw if along_x else cd) - 2 * post + 0.002
        for side in (-1, 1):
            for k in range(n_b):
                h = pitch - gap
                if along_x:
                    geo.add_box(bm, (L, wall, h), (0, side * (cd / 2 - wall / 2 - 0.001), k * pitch + gap / 2))
                else:
                    geo.add_box(bm, (wall, L, h), (side * (cw / 2 - wall / 2 - 0.001), 0, k * pitch + gap / 2))
    # front + back: the printed boards (the crate texture's seams fall between the boards)
    geo.merged("NAV_GamesCrate_Body", lambda bm: boards(bm, True), collection=collection, material=M("crate"),
               parent=nav, bevel=0.0012, seg=1, uv="fit", fit_axis=1, rests_on=rests_on)
    def frame(bm):
        for sx in (-1, 1):                           # corner posts, a touch taller than the boards
            for sy in (-1, 1):
                geo.add_box(bm, (post, post, ch + 0.004), (sx * (cw / 2 - post / 2), sy * (cd / 2 - post / 2), 0))
        boards(bm, False)                            # the two short sides
        for k in range(3):                           # floor: three boards between the walls
            bw = (cw - 2 * wall) / 3
            geo.add_box(bm, (bw - 0.002, cd - 2 * wall - 0.002, 0.008),
                        (-cw / 2 + wall + bw * (k + 0.5), 0, 0.0005))
    geo.merged("NAV_GamesCrate_Frame", frame, collection=collection, material=M("wood_light"), parent=nav,
               bevel=0.0015, seg=1, uv="box", uv_scale=4, rests_on=rests_on)
    def nails(bm):                                   # two nail heads per board end, front and back
        for sy in (-1, 1):
            for sx in (-1, 1):
                for k in range(n_b):
                    for dz in (0.3, 0.7):
                        geo.add_cyl(bm, 0.0018, 0.0012, (sx * (cw / 2 - post - 0.008), sy * (cd / 2 + 0.0002),
                                                        k * pitch + gap / 2 + (pitch - gap) * dz),
                                    (radians(90), 0, 0), verts=8)
    geo.merged("NAV_GamesCrate_Nails", nails, collection=collection, material=M("metal_dark"), parent=nav, bevel=0)
    for sx in (-1, 1):                               # rope handles through the short sides
        x = sx * (cw / 2 + 0.004)
        geo.curve_tube(f"NAV_GamesCrate_Rope_{'L' if sx < 0 else 'R'}",
                       [(x - sx * 0.004, -0.045, ch * 0.72), (x + sx * 0.010, -0.040, ch * 0.80), (x + sx * 0.016, 0, ch * 0.84),
                        (x + sx * 0.010, 0.040, ch * 0.80), (x - sx * 0.004, 0.045, ch * 0.72)],
                       0.004, collection=collection, material=M("rope"), parent=nav, ring=8, steps=8)
    n, step = CRATE["slots"], CRATE["step"]
    y0 = -step * (n - 1) / 2
    for i in range(n):
        slot = i + 1
        name = f"GAME_Case_{slot:02d}"
        tilt = radians(((i * 37 + 2) % 9) - 4) * 0.8
        case = S.empty(name, collection, loc=(0, y0 + i * step, 0.0085), rot=(tilt, 0, 0), parent=nav, size=0.03)
        case["game_slot"] = slot
        geo.merged(f"{name}_Body", _cart_shell, collection=collection, material=M("cartridge"), parent=case,
                   bevel=0.002, seg=2, shared="cart_body_v2")
        geo.box(f"{name}_Pins", (CART[0] * 0.7, CART[1] * 0.5, 0.006), loc=(0, 0, -0.0015), collection=collection,
                material=M("brass"), parent=case, bevel=0, shared="cart_pins")
        # own mesh + own material + own texture per slot -> each game shows its own cover art
        # (artwork slot game_label_XX or games.json label_texture; default = pixel-art label)
        tex = f"game_label_{slot:02d}"
        lbl_mat = mat(f"M_{name}_Label", tex=tex, rough=0.5, closest=not artwork.is_custom(tex))
        lbl = geo.box(f"{name}_Label", (CART[0] * 0.78, 0.001, CART[2] * 0.58),
                      loc=(0, -CART[1] / 2 - 0.0004, CART[2] * 0.30), collection=collection,
                      material=lbl_mat, parent=case, bevel=0, uv="fit", fit_axis=1)
        lbl["artwork_slot"] = tex
        S.mark_interactive(case, f"game_slot_{slot:02d}", f"Game slot {slot} (metadata in games.json)",
                           scope="games", kind="navigation")
    S.mark_interactive(nav, "games_crate", "Game collection -> EXPLORE GAMES", scope="home", kind="navigation")
    return nav


def _cart_shell(bm):
    """Cartridge shell: the body with a stepped top, a recessed label well and grip ridges across the back."""
    w, d, h = CART
    geo.add_box(bm, (w, d, h * 0.9), (0, 0, 0))                        # main body
    geo.add_box(bm, (w * 0.84, d * 0.86, h * 0.1), (0, 0.0006, h * 0.9))   # stepped top
    for k in range(6):                                                  # grip ridges on the back, upper half
        geo.add_box(bm, (w * 0.62, 0.0016, 0.0024), (0, d / 2 + 0.0006, h * (0.56 + k * 0.06)))
    for sx in (-1, 1):                                                  # side notches (where fingers pull it out)
        geo.add_box(bm, (0.003, d * 0.7, 0.012), (sx * (w / 2 + 0.0008), 0, h * 0.72))


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
