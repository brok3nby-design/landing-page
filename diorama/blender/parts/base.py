"""BASE: beveled chamfered wooden display platform + rug."""
from config import PLATFORM as P, RUG as R, CLAY
from lib import geo
from lib.mats import mat


def build(root):
    outline = geo.chamfered_rect(P["width"], P["depth"], P["chamfer"])
    geo.prism("BASE_Platform", outline, P["thickness"], loc=(0, 0, -P["thickness"]),
              collection="BASE", material=mat("Clay_Wood", CLAY["wood"]),
              parent=root, bevel=P["edge_bevel"], seg=3)
    geo.box("BASE_Rug", (R["width"], R["depth"], R["thickness"]),
            loc=(*R["center"], 0), collection="BASE", material=mat("Clay_Rug", CLAY["rug"]),
            parent=root, bevel=0.002, seg=1, rests_on="BASE_Platform")
