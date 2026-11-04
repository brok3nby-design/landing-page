"""Discovery (Easter-egg) hiding places and the first two hidden test details.

EGG_* empties mark stable hiding places (custom props: egg_id, interactive_kind="discovery",
egg_status). Future hidden details are parented to a marker, so they can be added or swapped
without rebuilding the scene. Only two details exist so far, both invisible from the default
view: a sticker under the desktop and a maker's plate under the display platform.
See diorama/EASTER_EGGS.md for the full proposal list.
"""
import bpy
from config import DESK
from lib import geo, scene as S
from lib.library import M

TOP_Z = DESK["height"] - DESK["top_thickness"]


def _marker(name, egg_id, loc, parent, status="planned", note=""):
    e = S.empty(name, "PROPS", loc=loc, parent=parent, size=0.03)
    e["egg_id"] = egg_id
    e["interactive_kind"] = "discovery"
    e["egg_status"] = status
    e["egg_note"] = note
    return e


def build(root):
    o = bpy.data.objects
    sticker = _marker("EGG_UnderDesktop", "egg_under_desktop", (0.0, 0.55, TOP_Z), root, "test-detail",
                      "Sticker on the underside of the desktop")
    d = geo.box("EGG_UnderDesktop_Sticker", (0.08, 0.05, 0.0006), loc=(0, 0, -0.0006), rot=(0, 0, 0.12 + 3.14159265),   # upright for a viewer under the front edge
                collection="PROPS", material=M("sticker_qa"), parent=sticker, bevel=0, uv="fit", fit_axis=2,
                flip_u=True)
    S.mark_interactive(sticker, "egg_qa_sticker", "Hidden sticker (discovery)", kind="discovery")
    plate = _marker("EGG_UnderPlatform", "egg_under_platform", (0.0, 0.0, -0.145), root, "test-detail",
                    "Maker's plate under the display platform")
    geo.box("EGG_UnderPlatform_Plate", (0.30, 0.075, 0.0012), loc=(0, 0, -0.0012), rot=(0, 0, 3.14159265),
            collection="PROPS",
            material=M("maker_plate"), parent=plate, bevel=0.0004, seg=1, uv="fit", fit_axis=2, flip_u=True)
    S.mark_interactive(plate, "egg_maker_plate", "Hidden maker's plate (discovery)", kind="discovery")

    # planned hiding places (no content yet)
    _marker("EGG_ShelfUnderside", "egg_shelf_underside", (0.12, 0.70, 1.50), root,
            note="Writing on the underside of the upper shelf")
    _marker("EGG_HutchBack", "egg_hutch_back", (0.12, 0.886, 1.20), root, note="Inscription on the back of the hutch")
    _marker("EGG_BehindMonitor", "egg_behind_monitor", (0.36, 0.83, 1.15), root, note="Note taped behind a monitor")
    _marker("EGG_CabinetBack", "egg_cabinet_back", (0.69, 0.865, 0.40), root, note="Label on the back of the cabinet")
    _marker("EGG_DrawerInside", "egg_drawer_inside", (0, 0.05, 0.02), o["DESK_Drawer_1_Group"],
            note="Needs a drawer interior (future); contents revealed when the drawer slides out")
    _marker("EGG_ChairUnderside", "egg_chair_underside", (0, 0, 0.40), o["CHAIR"], note="Tag under the seat")
    _marker("EGG_CrateBottom", "egg_crate_bottom", (0, 0, 0), o["NAV_GamesCrate"],
            note="Stamp under the games crate (Games page exhibit)")
    _marker("EGG_NotebookBack", "egg_notebook_back", (-0.08, 0, 0), o["NOTE_Cover_Back"],
            note="Sticker on the outside of the back cover (About page exhibit)")
