"""Rebuild the miniature developer-desk diorama from nothing.

Usage (from the repository root):
    diorama/.venv/bin/python diorama/blender/build.py --phase 1 [--render] [--samples N]

Deterministic: starts from an empty factory scene every run, no randomness.
Writes  diorama/source/diorama_phase<N>.blend  and (with --render) PNGs + checks.txt
into    diorama/renders/phase<N>/
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, ".."))

import bpy  # noqa: E402

import config  # noqa: E402
from lib import scene as S, checks, camera  # noqa: E402
from lib.mats import world  # noqa: E402
from parts import base, desk, hutch, monitors, chair, props, lights  # noqa: E402


def build():
    S.reset()
    world(config.WORLD_COLOR)
    root = S.empty("DIORAMA_ROOT", "BASE", size=0.3)
    base.build(root)
    d = desk.build(root)
    h = hutch.build(root)
    monitors.build(root, h["riser_top"])
    chair.build(root)
    props.build(root, d, h)
    lights.build(root)
    for v in config.VIEWS:
        camera.add_view(v["name"], v["az"], v["el"], v["lens"], config.FRAME_FILL, config.RENDER["res"])
    bpy.context.scene.camera = bpy.data.objects["CAM_Hero"]


def setup_render(samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = config.RENDER["res"]
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'


def render(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    for v in config.VIEWS:
        sc.camera = bpy.data.objects[v["name"]]
        sc.render.filepath = os.path.join(out_dir, v["file"])
        bpy.ops.render.render(write_still=True)
        print("rendered", sc.render.filepath)
    sc.camera = bpy.data.objects["CAM_Hero"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int, default=1)
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--samples", type=int, default=config.RENDER["samples"])
    args = ap.parse_args()

    blend = os.path.join(ROOT, "source", f"diorama_phase{args.phase}.blend")
    if os.path.basename(blend) in config.APPROVED_FILES and os.path.exists(blend):
        sys.exit(f"Refusing to overwrite approved file {blend}. Bump the phase or edit APPROVED_FILES.")

    build()
    lines, problems = checks.run()
    report = "\n".join(lines + ["Problems:"] + (problems or ["  none"]))
    print(report)

    setup_render(args.samples)
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print("saved", blend)

    if args.render:
        out = os.path.join(ROOT, "renders", f"phase{args.phase}")
        render(out)
        with open(os.path.join(out, "checks.txt"), "w") as f:
            f.write(report + "\n")


if __name__ == "__main__":
    main()
