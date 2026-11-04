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
from lib import scene as S, checks, camera, textures, mats, artwork  # noqa: E402
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
    crate = storage.build(root, d)
    cables.build(root, d, h)
    collectibles.build(root, h)
    lights.build(root)
    t = time.time()
    blanket.build(ch)
    print(f"cloth simulation: {time.time() - t:.1f}s")
    artwork.tag_objects()
    for v in config.VIEWS:
        camera.add_view(v["name"], v["az"], v["el"], v["lens"], config.FRAME_FILL, config.RENDER["res"])
    for c in config.CLOSEUPS:
        camera.add_closeup(c["name"], c["target"], c["az"], c["el"], c["lens"], c["dist"])
    for a in config.ASSET_VIEWS:
        objs = [bpy.data.objects[a["root"]]] + list(bpy.data.objects[a["root"]].children_recursive)
        camera.add_view(a["name"], a["az"], a["el"], a["lens"], a["fill"], config.RENDER["res"], objs=objs)
    lights.exhibit_spot(crate)
    _beauty_camera()
    bpy.context.scene.camera = bpy.data.objects["CAM_Hero"]


def _beauty_camera():
    """Copy of the hero camera with a shallow depth of field focused on the desk front."""
    b = config.BEAUTY
    src = bpy.data.objects[b["like"]]
    cam = bpy.data.objects.new(b["name"], src.data.copy())
    cam.matrix_world = src.matrix_world.copy()
    S.coll("CAMERAS").objects.link(cam)
    focus = S.empty("CAM_Beauty_Focus", "CAMERAS", loc=b["focus"], size=0.05)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_object = focus
    cam.data.dof.aperture_fstop = b["fstop"]
    cam.data.dof.aperture_blades = 7


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
    vs = sc.view_settings
    for attr, key in (("view_transform", "view_transform"), ("look", "look")):
        try:
            setattr(vs, attr, config.RENDER[key])
        except TypeError:
            print(f"colour management: {key} '{config.RENDER[key]}' not available, keeping {getattr(vs, attr)}")
    vs.exposure = config.RENDER["exposure"]
    sc.cycles.sample_clamp_indirect = 8.0       # tames fireflies from small bright emitters
    sc.cycles.light_sampling_threshold = 0.005


def render_beauty(out_dir, samples):
    from lib import post
    sc = bpy.context.scene
    b = config.BEAUTY
    keep = sc.cycles.samples
    sc.cycles.samples = samples
    sc.camera = bpy.data.objects[b["name"]]
    raw = os.path.join(out_dir, "_raw_" + b["file"])
    sc.render.filepath = raw
    t = time.time()
    bpy.ops.render.render(write_still=True)
    post.bloom(raw, os.path.join(out_dir, b["file"]))
    os.remove(raw)
    print(f"rendered {os.path.join(out_dir, b['file'])} ({time.time() - t:.0f}s, DOF + bloom)")
    sc.cycles.samples = keep
    sc.camera = bpy.data.objects["CAM_Hero"]


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


def render_assets(out_dir, only=None):
    """Render each reusable asset alone: everything outside its hierarchy is hidden and the
    exhibit spotlight replaces the desk lighting. Proves the asset works as a standalone exhibit."""
    sc = bpy.context.scene
    for a in config.ASSET_VIEWS:
        if only and a["file"][:2] not in only:
            continue
        keep = {bpy.data.objects[a["root"]]} | set(bpy.data.objects[a["root"]].children_recursive)
        saved = {o: o.hide_render for o in bpy.data.objects}
        for o in bpy.data.objects:
            if o.type == 'LIGHT':
                o.hide_render = not o.name.startswith("LIGHT_Exhibit")
            elif o.type != 'CAMERA':
                o.hide_render = o not in keep
        sc.camera = bpy.data.objects[a["name"]]
        sc.render.filepath = os.path.join(out_dir, a["file"])
        bpy.ops.render.render(write_still=True)
        print("rendered", sc.render.filepath)
        for o, h in saved.items():
            o.hide_render = h
    sc.camera = bpy.data.objects["CAM_Hero"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int, default=3)
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--samples", type=int, default=config.RENDER["samples"])
    ap.add_argument("--views", default="", help="comma list of view prefixes, e.g. 01,05")
    ap.add_argument("--retex", action="store_true", help="repaint all textures")
    ap.add_argument("--templates", action="store_true", help="rewrite artwork slot templates")
    args = ap.parse_args()
    artwork.write_templates(force=args.templates)

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
        only = [v.strip() for v in args.views.split(",") if v.strip()] or None
        render(out, only)
        render_assets(out, only)
        if not only or "10" in only:
            render_beauty(out, config.RENDER["beauty_samples"] if args.samples == config.RENDER["samples"]
                          else args.samples)
        with open(os.path.join(out, "checks.txt"), "w") as f:
            f.write(report + "\n")


if __name__ == "__main__":
    main()
