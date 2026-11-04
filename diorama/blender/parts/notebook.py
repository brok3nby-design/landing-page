"""NAV_Notebook — the open sketchbook, built as a reusable, animation-ready asset.

Same look as the Phase 2/3 sketchbook, split into parts so it can open/close and turn pages
later (About page). Every moving part is a PIVOT EMPTY sitting on the spine line with its
hinge axis along local +Y; the visible mesh is its child.

NAV_Notebook (empty; origin = spine centre on the desk; interactive_id "notebook")
  NOTE_Cover_Back   pivot -> NOTE_Cover_Back_Board     left board
  NOTE_Cover_Front  pivot -> NOTE_Cover_Front_Board    right board (rotate about Y to close)
  NOTE_Spine                                           rounded spine
  NOTE_PageBlock_L / _R  pivots -> page stacks
  NOTE_Page_L / _R       pivots -> visible top pages (left/right half of artwork slot "sketchbook")
  NOTE_Bookmark          red ribbon
  NOTE_Pen, NOTE_Pen_Clip
"""
from math import radians
from lib import geo, scene as S
from lib.library import M

W, D = 0.30, 0.21          # open spread
COVER_T = 0.003


def _page_z(X):
    """Height of the open page surface at distance X from the spine (matches Phase 3 shape)."""
    ax = abs(X) / (W / 2)
    return 0.003 + 0.010 * (1 - (1 - min(ax * 4, 1)) ** 2) - 0.004 * ax ** 3


def _sheet(name, side, pivot, material, offset=0.0, thickness=0.002, uv_half=None, nx=20):
    """Curved sheet covering one half of the spread; vertices relative to the spine pivot."""
    s = -1 if side == "L" else 1

    def shape(x, y):
        X = x + s * W / 4          # grid is centred on its half; shift so x = 0 is the spine
        return (X, y, _page_z(X) - offset)
    obj = geo.grid(name, W / 2, D - (0.004 if offset else 0.0), nx, 6, deform=shape, collection="PROPS",
                   material=material, parent=pivot, thickness=thickness)
    if uv_half is not None:        # left page -> u 0..0.5, right page -> u 0.5..1 of the slot image
        uv = obj.data.uv_layers.active.data
        for lp in uv:
            lp.uv = (lp.uv[0] * 0.5 + uv_half * 0.5, lp.uv[1])
    return obj


def build(parent, loc, rot_z=radians(9), collection="PROPS", rests_on="DESK_Top"):
    nb = S.empty("NAV_Notebook", collection, loc=loc, rot=(0, 0, rot_z), parent=parent, size=0.1)
    nb["asset_id"] = "studio_notebook"
    cover = M("book_cover")
    for side, s, tag in (("Back", -1, "L"), ("Front", 1, "R")):
        piv = S.empty(f"NOTE_Cover_{side}", collection, loc=(0, 0, 0), parent=nb, size=0.03)
        piv["hinge_axis"] = "Y"
        bw = W / 2 + 0.005
        geo.box(f"NOTE_Cover_{side}_Board", (bw, D + 0.01, COVER_T), loc=(s * bw / 2, 0, 0),
                collection=collection, material=cover, parent=piv, bevel=0.0012, rests_on=rests_on)
    geo.cylinder("NOTE_Spine", 0.0035, D + 0.008, loc=(0, -(D + 0.008) / 2, 0.0025), rot=(radians(-90), 0, 0),
                 collection=collection, material=cover, parent=nb, verts=12, bevel=0)
    for tag, s in (("L", 0), ("R", 1)):
        bp = S.empty(f"NOTE_PageBlock_{tag}", collection, parent=nb, size=0.02)
        bp["hinge_axis"] = "Y"
        _sheet(f"NOTE_PageBlock_{tag}_Mesh", tag, bp, M("pages"), offset=0.0028, thickness=0.0035, nx=12)
        pp = S.empty(f"NOTE_Page_{tag}", collection, parent=nb, size=0.02)
        pp["hinge_axis"] = "Y"
        page = _sheet(f"NOTE_Page_{tag}_Sheet", tag, pp, M("paper"), uv_half=s)
        page["artwork_slot"] = "sketchbook"
    rib = geo.curve_tube("NOTE_Bookmark", [(0.002, -0.07, 0.0042), (0.004, -0.098, 0.0036), (0.009, -0.118, 0.0018),
                                           (0.016, -0.136, 0.0004)], 0.0032, collection=collection,
                         material=M("ribbon_red"), parent=nb, ring=6, steps=6, flatten=0.18)
    pen = [(0.03, -0.07, 0.016), (0.14, 0.05, 0.016)]
    geo.curve_tube("NOTE_Pen", pen, 0.0045, collection=collection, material=M("metal_black"), parent=nb,
                   ring=10, steps=1, taper=lambda t: 0.6 if t > 0.95 else 1.0)
    geo.box("NOTE_Pen_Clip", (0.002, 0.04, 0.002), loc=(0.11, 0.015, 0.0195), rot=(0, 0, -0.73),
            collection=collection, material=M("brass"), parent=nb, bevel=0)
    S.mark_interactive(nb, "notebook", "About the studio / process", scope="home", kind="navigation")
    return nb
