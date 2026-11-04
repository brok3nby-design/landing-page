"""Rebuild the miniature developer-desk diorama from nothing.

Usage (from the repository root):
    diorama/.venv/bin/python diorama/blender/build.py [--phase 2] [--render] [--samples N]
                                                      [--views 01,05] [--retex]

Deterministic: starts from an empty factory scene every run; all "random" placement is seeded.
Writes  diorama/source/diorama_phase<N>.blend  and (with --render) PNGs + checks.txt
into    diorama/renders/phase<N>/.  Textures are painted into diorama/assets/textures/
(re-painted only when missing or with --retex).
"""
import argparse
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, ".."))

import bpy  # noqa: E402

import config  # noqa: E402
from lib import scene as S, checks, camera, textures, mats  # noqa: E402
from parts import (base, desk, hutch, monitors, chair, blanket, desk_props, shelf_props,  # noqa: E402
                   plants, storage, cables, collectibles, lights)


def build(retex=False):
    S.reset()
    mats.reset_cache()
    mats.TEX.update(textures.generate_all(force=retex))
    mats.world(config.WORLD_COLOR)
    root = S.empty("DIORAMA_ROOT", "BASE", size=0.3)
    base.build(root)
    d = desk.build(root)
    h = hutch.build(root)
    monitors.build(root, h["riser_top"])
    ch = chair.build(root)
    desk_props.build(root, d, h)
    shelf_props.build(root, h)
    plants.pothos(root, h["upper_top"], h["upper_y"], h["upper_front"], h["x0"])
    plants.upright(root, -0.46, h["upper_y"], h["upper_top"])
    storage.build(root, d)
    cables.build(root, d, h)
    collectibles.build(root, h)
    lights.build(root)
    t = time.time()
    blanket.build(ch)
    print(f"cloth simulation: {time.time() - t:.1f}s")
    for v in config.VIEWS:
        camera.add_view(v["name"], v["az"], v["el"], v["lens"], config.FRAME_FILL, config.RENDER["res"])
    for c in config.CLOSEUPS:
        camera.add_closeup(c["name"], c["target"], c["az"], c["el"], c["lens"], c["dist"])
    bpy.context.scene.camera = bpy.data.objects["CAM_Hero"]


def setup_render(samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.transmission_bounces = 8
    sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = config.RENDER["res"]
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'


def render(out_dir, only=None):
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    for v in config.VIEWS + config.CLOSEUPS:
        if only and v["file"][:2] not in only:
            continue
        sc.camera = bpy.data.objects[v["name"]]
        sc.render.filepath = os.path.join(out_dir, v["file"])
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"rendered {sc.render.filepath} ({time.time() - t:.0f}s)")
    sc.camera = bpy.data.objects["CAM_Hero"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int, default=2)
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--samples", type=int, default=config.RENDER["samples"])
    ap.add_argument("--views", default="", help="comma list of view prefixes, e.g. 01,05")
    ap.add_argument("--retex", action="store_true", help="repaint all textures")
    args = ap.parse_args()

    blend = os.path.join(ROOT, "source", f"diorama_phase{args.phase}.blend")
    if os.path.basename(blend) in config.APPROVED_FILES and os.path.exists(blend):
        sys.exit(f"Refusing to overwrite approved file {blend}. Bump the phase or edit APPROVED_FILES.")

    build(args.retex)
    lines, problems = checks.run()
    report = "\n".join(lines + ["Problems:"] + (["  " + p for p in problems] or ["  none"]))
    print(report)

    setup_render(args.samples)
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    bpy.ops.file.make_paths_relative()          # textures referenced relative to the .blend
    bpy.ops.wm.save_mainfile(compress=True)
    print("saved", blend)

    if args.render:
        out = os.path.join(ROOT, "renders", f"phase{args.phase}")
        render(out, [v.strip() for v in args.views.split(",") if v.strip()] or None)
        with open(os.path.join(out, "checks.txt"), "w") as f:
            f.write(report + "\n")


if __name__ == "__main__":
    main()
