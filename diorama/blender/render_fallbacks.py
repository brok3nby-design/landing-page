"""Render still images used by the website when 3D isn't available (one per standalone exhibit).

    diorama/.venv/bin/python diorama/blender/render_fallbacks.py
Writes diorama/renders/phase6/notebook_fallback.png. Uses the Phase 4 scene; no model changes.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, ".."))

import bpy  # noqa: E402
import build  # noqa: E402
from lib import camera  # noqa: E402
from parts import lights  # noqa: E402

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "source", "diorama_phase4.blend"))
sc = bpy.context.scene
build.setup_render(96)
nb = bpy.data.objects["NAV_Notebook"]
keep = {nb, *nb.children_recursive}
lights.exhibit_rig(nb, prefix="LIGHT_NoteRig")
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        o.hide_render = not o.name.startswith("LIGHT_NoteRig")
    elif o.type != 'CAMERA':
        o.hide_render = o not in keep
for name in ("NOTE_Pen", "NOTE_Pen_Clip"):          # keep the pen; it is part of the exhibit
    if name in bpy.data.objects:
        bpy.data.objects[name].hide_render = False
cam = camera.add_view("CAM_Notebook_Fallback", 22, 42, 85, 0.62, (1600, 900), objs=list(keep))
sc.camera = cam
out = os.path.join(ROOT, "renders", "phase6", "notebook_fallback.png")
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("rendered", out)
