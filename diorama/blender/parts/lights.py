"""LIGHTS (Phase 3): miniature-photography lighting for the desk + a reusable exhibit rig.

Desk rig (matches the reference: dark room, warm amber + purple practicals):
  LIGHT_Key_Top     soft overhead spotlight - a pool of light on the model, falls off to black
  LIGHT_Key_Soft    large soft front-left fill (keeps faces/props readable)
  LIGHT_Rim_L/R     cool purple + warm amber rims that separate the silhouette from #080808
  LIGHT_Screen_L/R  rectangle lights in front of each monitor, tinted by the screen image
  LIGHT_LED_*       rectangle lights under each emissive LED strip (amber / purple)
  LIGHT_DeskLamp    warm point at the Edison filament (the glass casts no shadow)
Practical lights are invisible to the camera; the glowing meshes provide what you see.

Exhibit rig (standalone assets, e.g. NAV_GamesCrate on the Games page):
  LIGHT_Exhibit_*   key spot + soft fill + rim, scaled to the asset; hidden in desk renders.
"""
from math import radians
import numpy as np
import bpy
from mathutils import Vector

from config import DESK, MONITOR, HUTCH
from lib import scene as S
from lib.mats import TEX

AMBER = (1.0, 0.52, 0.18)
PURPLE = (0.36, 0.16, 1.0)


def _light(name, kind, loc, power, color, target=None, rot=None, parent=None, **kw):
    data = bpy.data.lights.new(name, kind)
    data.energy = power
    data.color = color
    for k, v in kw.items():
        setattr(data, k, v)
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    if target is not None:
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    elif rot is not None:
        obj.rotation_euler = rot
    if parent:
        obj.parent = parent
    try:
        obj.visible_camera = False
    except AttributeError:
        pass
    S.coll("LIGHTS").objects.link(obj)
    return obj


def _strip(name, center, length, power, color, tilt=0.0):
    """Rectangle light under an LED strip, pointing down (tilt > 0 leans it toward +Y)."""
    return _light(name, 'AREA', center, power, color, rot=(radians(tilt), 0, 0),
                  shape='RECTANGLE', size=length, size_y=0.025)


def _mean_color(tex, gain=1.0):
    img = TEX[tex]
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)[:, :3]
    c = px.mean(0)
    c = c / max(c.max(), 1e-3)
    return tuple(float(v) for v in c)


def build(root):
    bpy.context.view_layer.update()
    cx, cy = DESK["center"]
    w, d, top = DESK["width"], DESK["depth"], DESK["height"]
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    top_z = top - DESK["top_thickness"]
    riser_top = top + HUTCH["riser_clear"] + HUTCH["plank"]
    upper_z = riser_top + HUTCH["upper_gap"]

    # --- key / fill / rims
    _light("LIGHT_Key_Top", 'SPOT', (0.25, -1.1, 3.6), 850, (1.0, 0.9, 0.78), target=(0.05, 0.2, 0.55),
           spot_size=radians(48), spot_blend=0.85, shadow_soft_size=0.35)
    _light("LIGHT_Key_Soft", 'AREA', (-1.8, -2.0, 2.2), 45, (1.0, 0.88, 0.75), target=(0, 0.2, 0.6), size=1.6)
    _light("LIGHT_Rim_L", 'AREA', (-1.7, 1.9, 1.9), 110, (0.62, 0.48, 1.0), target=(-0.2, 0.4, 0.8), size=1.0)
    _light("LIGHT_Rim_R", 'AREA', (1.9, 1.6, 1.5), 70, (1.0, 0.65, 0.35), target=(0.5, 0.4, 0.7), size=1.0)

    # --- monitors: light tinted by each screen image
    for side, tex in (("L", "screen_left"), ("R", "screen_right")):
        grp = bpy.data.objects[f"MON_{side}"]
        _light(f"LIGHT_Screen_{side}", 'AREA', (0, -0.04, MONITOR["lift"] + MONITOR["height"] / 2), 16,
               _mean_color(tex), rot=(radians(-90), 0, 0), parent=grp, shape='RECTANGLE',
               size=MONITOR["width"] - 0.03, size_y=MONITOR["height"] - 0.03)

    # --- LED strips (positions mirror the emissive strips in desk.py / hutch.py)
    ry0 = y1 - HUTCH["riser_depth"]
    uy0 = y1 - HUTCH["upper_depth"]
    _strip("LIGHT_LED_DeskFront", (cx, y0 + 0.03, top_z - 0.012), w - 0.14, 9, AMBER)
    _strip("LIGHT_LED_Riser", (cx, ry0 + 0.02, top + HUTCH["riser_clear"] - 0.012), w - 0.12, 6, AMBER)
    _strip("LIGHT_LED_ShelfFront", (cx, uy0 + 0.015, upper_z - 0.012), w - 0.08, 12, PURPLE)
    _strip("LIGHT_LED_BackWash", (cx, y1 - 0.025, upper_z - 0.012), w - 0.14, 30, PURPLE, tilt=25)
    cab = bpy.data.objects["DESK_Cabinet_LED"].matrix_world.translation
    _strip("LIGHT_LED_Cabinet", (cab.x, cab.y, cab.z - 0.01), 0.40, 2.5, AMBER)

    # --- Edison lamp
    _light("LIGHT_DeskLamp", 'POINT', (-0.615, 0.71, 1.065), 7, (1.0, 0.55, 0.2), shadow_soft_size=0.01)


def exhibit_rig(target, radius=None, prefix="LIGHT_Exhibit"):
    """Reusable spotlight rig for any standalone asset, scaled to its size. Hidden by default;
    build.render_assets() enables it while hiding the desk lights."""
    bpy.context.view_layer.update()
    objs = [target] + list(target.children_recursive)
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    r = radius or max((hi - lo).length / 2, 0.05)
    lights = [
        _light(f"{prefix}_Spot", 'SPOT', c + Vector((0.6, -1.0, 2.2)) * r * 2.2, 55 * r / 0.2,
               (1.0, 0.92, 0.82), target=c, spot_size=radians(40), spot_blend=0.8, shadow_soft_size=0.12 * r / 0.2),
        _light(f"{prefix}_Fill", 'AREA', c + Vector((-1.4, -0.8, 0.6)) * r * 2.5, 5 * r / 0.2,
               (0.85, 0.8, 1.0), target=c, size=r * 2),
        _light(f"{prefix}_Rim", 'AREA', c + Vector((-0.6, 1.6, 1.0)) * r * 2.5, 8 * r / 0.2,
               (0.7, 0.55, 1.0), target=c, size=r * 1.5),
    ]
    for o in lights:
        o.hide_render = True
    return lights


def exhibit_spot(target):        # backwards-compatible name used by build.py
    return exhibit_rig(target)
