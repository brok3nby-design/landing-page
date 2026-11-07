"""Build (and render) a per-game exhibit diorama.

    diorama/.venv/bin/python diorama/blender/build_exhibit.py --game bid-and-buried [--render] [--samples 96]

Writes source/exhibit_<game>.blend and renders/exhibits/<game>/*.png. Uses the same libraries, render
settings (Cycles, AgX look) and exhibit light rig as the desk, so every exhibit matches the series.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, ".."))

import bpy  # noqa: E402
import config  # noqa: E402
import build as desk_build  # noqa: E402  (setup_render)
from lib import scene as S, mats, textures, camera  # noqa: E402
from parts import lights  # noqa: E402

EXHIBITS = {"bid-and-buried": "exhibits.bid_and_buried", "pocket-wilds": "exhibits.pocket_wilds",
            "glass-and-fortune": "exhibits.glass_and_fortune",
            "speck": "exhibits.speck",
            "doqi": "exhibits.doqi", "wrfm": "exhibits.wrfm",
            "labyrinth-fate": "exhibits.maze",
            "macabre-dolls": "exhibits.macabre_dolls", "juicebox": "exhibits.juicebox",
            "graffiti": "exhibits.graffiti", "under-the-radar": "exhibits.under_the_radar"}
VIEWS = [  # name, azimuth, elevation, lens, frame fill
    ("CAM_Exhibit_Hero", 34, 27, 50, 0.84),
    ("CAM_Exhibit_Front", 8, 14, 50, 0.86),
    ("CAM_Exhibit_High", 52, 48, 50, 0.84),
]


def export_exhibit(game, root, mod=None):
    """Same web pipeline as the desk: freeze modifiers, merge untagged meshes per material, bake AO + the
    practical (bulb) light into UV set 1, export a GLB with the interactive tags as node extras."""
    import export as ex
    desk_build.setup_render(32)                          # Cycles: baking needs it
    key = "exhibit_" + game.replace("-", "_")
    every = [o for o in bpy.data.objects if o.type in ("MESH", "EMPTY")]
    ex.apply_modifiers(every)
    ex.merge_static(root)
    ex.merge_siblings()
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    bake = [o for o in meshes if not ex.obj_unbakeable(o)]
    hide = [o for n in getattr(mod, "BAKE_HIDE", []) if n in bpy.data.objects
            for o in (bpy.data.objects[n], *bpy.data.objects[n].children_recursive)]   # moving parts cast no baked shadow
    info = ex.bake_set(key, [o for o in bake if o not in hide], 2048, 128, 192, glow=True, ao_distance=0.6, hide=hide)
    objs = [root, *root.children_recursive]
    os.makedirs(ex.RAW, exist_ok=True)
    size = ex.export_glb(os.path.join(ex.RAW, key + ".glb"), [o for o in objs if o.type in ("MESH", "EMPTY")])
    print(f"exported {key}.glb {size / 1e6:.2f} MB, bake {info}, {len(meshes)} meshes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="bid-and-buried", choices=sorted(EXHIBITS))
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--scale", type=int, default=100, help="render resolution %% (quick previews)")
    ap.add_argument("--views", default="", help="comma list of camera names (default: all)")
    ap.add_argument("--export", action="store_true", help="bake AO + practical glow and export exports/raw/exhibit_<game>.glb")
    args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

    import importlib
    mod = importlib.import_module(EXHIBITS[args.game])
    S.reset()
    mats.reset_cache()
    mats.TEX.update(textures.generate_all())            # shared library textures (wood, rug, ...)
    mod.textures()
    mats.world(config.WORLD_COLOR)
    root = S.empty("EXHIBIT_ROOT", "BASE", size=0.3)
    mod.build(root)
    bpy.context.view_layer.update()
    objs = [o for o in root.children_recursive if o.type == "MESH"]
    gain = getattr(mod, "LIGHT_GAIN", {})
    for o in lights.exhibit_rig(root, prefix="LIGHT_Exhibit"):
        o.hide_render = False
        part = o.name.split("_")[-1].lower()                   # spot / fill / rim
        o.data.energy *= gain.get("key" if part == "spot" else part, 1.0)
    views = list(getattr(mod, "VIEWS", VIEWS))           # an exhibit may look from its own angles
    for name, az, el, lens, fill in views:
        camera.add_view(name, az, el, lens, fill, config.RENDER["res"], objs=objs)
    for name, names, az, el, lens, fill in getattr(mod, "CLOSEUPS", []):
        sub = [bpy.data.objects[n] for n in names]
        sub += [c for o in sub for c in o.children_recursive]
        camera.add_view(name, az, el, lens, fill, config.RENDER["res"], objs=[o for o in sub if o.type == "MESH"])
        views.append((name, az, el, lens, fill))
    bpy.context.scene.camera = bpy.data.objects["CAM_Exhibit_Hero"]
    out_blend = os.path.join(ROOT, "source", f"exhibit_{args.game.replace('-', '_')}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend, compress=True)
    print("saved", out_blend)
    if args.export:
        export_exhibit(args.game, root, mod)
        return
    if args.render:
        desk_build.setup_render(args.samples)
        bpy.context.scene.render.resolution_percentage = args.scale
        out = os.path.join(ROOT, "renders", "exhibits", args.game)
        os.makedirs(out, exist_ok=True)
        only = [v for v in args.views.split(",") if v]
        for name, *_ in views:
            if only and name not in only:
                continue
            bpy.context.scene.camera = bpy.data.objects[name]
            bpy.context.scene.render.filepath = os.path.join(out, name.replace("CAM_Exhibit_", "").lower() + ".png")
            bpy.ops.render.render(write_still=True)
            print("rendered", bpy.context.scene.render.filepath)


if __name__ == "__main__":
    main()
