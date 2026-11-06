"""Phase 4: export web-ready GLB assets from the Blender pipeline.

Usage (repository root):
    diorama/.venv/bin/python diorama/blender/export.py [--ao-samples 128] [--glow-samples 256]
                                                       [--atlas 2048] [--only desk,crate,notebook]
                                                       [--tag phase7]   (names the intermediate .blend files)

Produces in diorama/exports/raw/:
    studio_desk.glb        complete diorama (homepage)
    games_collection.glb   NAV_GamesCrate alone, re-rooted at the origin (Games page)
    studio_notebook.glb    NAV_Notebook alone, re-rooted at the origin (About page)
plus diorama/exports/views.json (camera presets) and diorama/exports/raw/export_report.json.
Optimisation (texture sizing/compression, meshopt) is done afterwards by diorama/tools/optimize.mjs.

Lighting strategy (hybrid, view-independent bakes only):
  * AO      -> glTF occlusionTexture on UV set 1 ("UVLight"), shared atlas per asset
  * GLOW    -> glTF emissiveTexture on UV set 1: diffuse light from the PRACTICAL lights only
               (screens, LED strips, lamp, emissive meshes) - the purple wash and amber spill
  * key / fill / rim lights are NOT baked: the web viewer adds them at runtime so highlights
    move correctly while orbiting and the back/sides stay readable.
  Not baked: movable parts (game cases, drawers, notebook on its own page), emissive meshes,
  glass, Blender-only effects (steam is removed).
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
OUT = os.path.join(ROOT, "exports")
RAW = os.path.join(OUT, "raw")
BAKED = os.path.join(OUT, "baked")

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import build  # noqa: E402
import config  # noqa: E402
from lib import checks  # noqa: E402

RUNTIME_LIGHTS = ("LIGHT_Key", "LIGHT_Rim")          # prefixes recreated in the viewer, never baked
MOVABLE_ROOTS = ("GAME_Case_", "DESK_Drawer_")       # subtrees excluded from baking
NAV_ROOT_NAMES = ("NAV_GamesCrate", "NAV_Notebook")


# ------------------------------------------------------------------ helpers
def ctx(objs, active=None):
    active = active or objs[0]
    return bpy.context.temp_override(active_object=active, object=active, selected_objects=objs,
                                     selected_editable_objects=objs)


def select_only(objs, active=None):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def ancestors(o):
    p = o.parent
    while p:
        yield p
        p = p.parent


def is_tagged(o):
    return any(k in o.keys() for k in ("interactive_id", "egg_id", "asset_id", "artwork_slot"))


def in_movable(o):
    return any(x.name.startswith(MOVABLE_ROOTS) for x in [o, *ancestors(o)])


def mat_props(m):
    if not m or not m.node_tree:
        return {}
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b:
        return {}
    emit = b.inputs["Emission Strength"].default_value > 0 and (
        b.inputs["Emission Color"].is_linked or max(b.inputs["Emission Color"].default_value[:3]) > 0)
    return dict(emissive=emit, glass=b.inputs["Transmission Weight"].default_value > 0.5,
                alpha=b.inputs["Alpha"].default_value < 1)


def obj_unbakeable(o):
    return any(mat_props(m).get(k) for m in o.data.materials for k in ("emissive", "glass", "alpha"))


def apply_modifiers(objs):
    """Freeze every modifier (bevel, solidify) into real geometry; shared meshes become unique."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != 'MESH':
            continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        o.modifiers.clear()
        o.data = me


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


# ------------------------------------------------------------------ camera / light presets
def to_gl(v):
    """Blender Z-up -> glTF Y-up."""
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def write_views():
    views = {}
    sc = bpy.context.scene
    for cam in [o for o in bpy.data.objects if o.type == 'CAMERA']:
        d = cam.data
        aspect = sc.render.resolution_x / sc.render.resolution_y
        import math
        hfov = 2 * math.atan(d.sensor_width / (2 * d.lens))
        vfov = 2 * math.atan(math.tan(hfov / 2) / aspect)
        fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        views[cam.name] = dict(position=to_gl(cam.matrix_world.translation), forward=to_gl(fwd),
                               fov_deg=round(math.degrees(vfov), 3), shift=[round(d.shift_x, 4), round(d.shift_y, 4)],
                               aspect=round(aspect, 4))
    lights = {}
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        L = o.data
        fwd = o.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        lights[o.name] = dict(type=L.type, position=to_gl(o.matrix_world.translation), direction=to_gl(fwd),
                              color=[round(c, 3) for c in L.color], watts=L.energy,
                              spot_deg=round(L.spot_size * 57.2958, 2) if L.type == 'SPOT' else None,
                              baked=not o.name.startswith(RUNTIME_LIGHTS) and not o.name.startswith("LIGHT_Exhibit"))
    os.makedirs(OUT, exist_ok=True)
    json.dump(dict(note="Y-up metres (glTF space). Cameras from Blender; 'baked' lights are already in the "
                        "GLOW maps and must NOT be re-added at runtime.", cameras=views, lights=lights),
              open(os.path.join(OUT, "views.json"), "w"), indent=1)


# ------------------------------------------------------------------ preparation
def strip_blender_only():
    for o in list(bpy.data.objects):
        if o.get("blender_only") or o.type in ('CAMERA',):
            bpy.data.objects.remove(o, do_unlink=True)


def merge_static(root):
    """Join untagged, unparented-to-interactive meshes per material set -> STATIC_<material>."""
    groups = {}
    for o in list(bpy.data.objects):
        if o.type != 'MESH' or is_tagged(o) or any(is_tagged(a) for a in ancestors(o)) or in_movable(o):
            continue
        if any(a.name.startswith(NAV_ROOT_NAMES) for a in ancestors(o)):
            continue
        key = tuple(m.name if m else "none" for m in o.data.materials)
        groups.setdefault(key, []).append(o)
    merged = []
    # Flatten EVERYTHING that is about to be joined, and every child of it, to world space before the
    # first join. Joining deletes the source objects: a child whose parent was joined away (e.g. the
    # pencils in the copper pencil cup) would otherwise lose its parent transform and fall to the origin.
    bpy.context.view_layer.update()
    joining = [o for objs in groups.values() if len(objs) >= 2 for o in objs]
    affected = set(joining) | {c for o in joining for c in o.children}
    mws = {o: o.matrix_world.copy() for o in affected}
    for o in affected:
        o.parent = None if o in joining else root
        o.matrix_world = mws[o]
    for key, objs in groups.items():
        if len(objs) < 2:
            continue
        select_only(objs)
        with ctx(objs):
            bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = "STATIC_" + key[0].replace("M_", "")
        mw = j.matrix_world.copy()
        j.parent = root
        j.matrix_world = mw
        merged.append(j)
    return merged


def merge_siblings():
    """Inside tagged groups: join untagged sibling meshes (same parent, same materials).
    Keeps every group, pivot and tag intact; only cuts draw calls (e.g. figurine/headphone parts)."""
    by_parent = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or is_tagged(o) or o.parent is None or o.parent.name == "DIORAMA_ROOT":
            continue
        if o.children:
            continue
        key = (o.parent.name, tuple(m.name if m else "none" for m in o.data.materials))
        by_parent.setdefault(key, []).append(o)
    n = 0
    for (pname, mats), objs in by_parent.items():
        if len(objs) < 2:
            continue
        select_only(objs)
        with ctx(objs):
            bpy.ops.object.join()
        bpy.context.view_layer.objects.active.name = f"{pname}__{mats[0].replace('M_', '')}"
        n += len(objs) - 1
    return n


def lightmap_uvs(objs, margin=0.004):
    for o in objs:
        uv = o.data.uv_layers.get("UVLight") or o.data.uv_layers.new(name="UVLight")
        o.data.uv_layers.active = uv
    select_only(objs)
    with ctx(objs):
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=margin, area_weight=1.0)
        bpy.ops.uv.pack_islands(margin=margin, rotate=True)
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:                           # base textures stay on UV0
        o.data.uv_layers.active = o.data.uv_layers[0]
        o.data.uv_layers[0].active_render = True


def bake_materials(objs):
    """Give baked objects their own material copies (shared materials stay intact elsewhere)."""
    copies = {}
    for o in objs:
        for i, m in enumerate(o.data.materials):
            if m is None:
                continue
            if m.name not in copies:
                copies[m.name] = m.copy()
                copies[m.name].name = m.name + "_baked"
            o.data.materials[i] = copies[m.name]
    return list(copies.values())


def _bake(objs, mats, img, kind, samples, uv="UVLight"):
    nodes = []
    for m in mats:
        n = m.node_tree.nodes.new('ShaderNodeTexImage')
        n.image = img
        m.node_tree.nodes.active = n
        nodes.append((m, n))
    sc = bpy.context.scene
    sc.cycles.samples = samples
    select_only(objs)
    t = time.time()
    with ctx(objs):
        if kind == "AO":
            bpy.ops.object.bake(type='AO', margin=8, uv_layer=uv, use_clear=True)
        else:
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=8,
                                uv_layer=uv, use_clear=True)
    print(f"bake {kind}: {len(objs)} objects, {samples} samples, {time.time() - t:.0f}s")
    for m, n in nodes:
        m.node_tree.nodes.remove(n)


def _downsample_save(img, path, size):
    """Bake at high res, store at `size`: averaging removes most bake noise."""
    import numpy as np
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    f = w // size
    a = a.reshape(size, f, size, f, 4).mean((1, 3))
    out = bpy.data.images.new(os.path.basename(path)[:-4], size, size, alpha=False, float_buffer=False)
    out.pixels.foreach_set(a.ravel())
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    return out


def gltf_output_group():
    g = bpy.data.node_groups.get("glTF Material Output")
    if g:
        return g
    g = bpy.data.node_groups.new("glTF Material Output", 'ShaderNodeTree')
    g.interface.new_socket(name="Occlusion", in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket(name="Thickness", in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def wire_baked(mats, ao_img, glow_img, glow_strength=1.0):
    group = gltf_output_group()
    for m in mats:
        nt = m.node_tree
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.uv_map = "UVLight"
        if ao_img:
            ao = nt.nodes.new('ShaderNodeTexImage')
            ao.image = ao_img
            ao.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(uvn.outputs["UV"], ao.inputs["Vector"])
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(ao.outputs["Color"], sep.inputs["Color"])
            gn = nt.nodes.new('ShaderNodeGroup')
            gn.node_tree = group
            nt.links.new(sep.outputs[0], gn.inputs["Occlusion"])
        if glow_img:
            b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
            gl = nt.nodes.new('ShaderNodeTexImage')
            gl.image = glow_img
            nt.links.new(uvn.outputs["UV"], gl.inputs["Vector"])
            nt.links.new(gl.outputs["Color"], b.inputs["Emission Color"])
            b.inputs["Emission Strength"].default_value = glow_strength


def bake_set(name, objs, atlas, ao_samples, glow_samples, glow=True, hide=(), ao_distance=0.12):
    """UVLight + AO (+ GLOW) bake for `objs`. `hide` = objects hidden from the bake (e.g. cases).
    `ao_distance`: AO reach (0.12 suits the miniature desk; real-scale exhibits use more)."""
    os.makedirs(BAKED, exist_ok=True)
    lightmap_uvs(objs)
    mats = bake_materials(objs)
    sc = bpy.context.scene
    sc.world.light_settings.distance = ao_distance
    hidden = [o for o in hide]
    for o in hidden:
        o.hide_render = True
    ao_hi = bpy.data.images.new(f"{name}_ao_hi", atlas, atlas, alpha=False)
    _bake(objs, mats, ao_hi, "AO", ao_samples)
    ao = _downsample_save(ao_hi, os.path.join(BAKED, f"{name}_ao.png"), atlas // 2)
    glow_img = None
    if glow:
        saved = {}
        for o in bpy.data.objects:                     # practical lights only
            if o.type == 'LIGHT':
                saved[o] = o.hide_render
                o.hide_render = o.name.startswith(RUNTIME_LIGHTS) or o.name.startswith("LIGHT_Exhibit")
        gl_hi = bpy.data.images.new(f"{name}_glow_hi", atlas, atlas, alpha=False)
        _bake(objs, mats, gl_hi, "GLOW", glow_samples)
        glow_img = _downsample_save(gl_hi, os.path.join(BAKED, f"{name}_glow.png"), atlas // 2)
        for o, h in saved.items():
            o.hide_render = h
    for o in hidden:
        o.hide_render = False
    ao.colorspace_settings.name = 'Non-Color'
    wire_baked(mats, ao, glow_img)
    return dict(objects=len(objs), materials=len(mats), atlas=atlas // 2)


def export_glb(path, objs):
    select_only(objs)
    with ctx(objs):
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True,
                                  export_yup=True, export_apply=False, export_texcoords=True,
                                  export_normals=True, export_tangents=False, export_lights=False,
                                  export_cameras=False, export_materials='EXPORT', export_image_format='AUTO')
    return os.path.getsize(path)


def reroot(name):
    nav = bpy.data.objects[name]
    keep = {nav, *nav.children_recursive}
    for o in list(bpy.data.objects):
        if o not in keep and o.type != 'LIGHT':
            bpy.data.objects.remove(o, do_unlink=True)
    nav.parent = None
    nav.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    return [nav, *nav.children_recursive]


def stats(objs):
    meshes = [o for o in objs if o.type == 'MESH']
    mats = {m.name for o in meshes for m in o.data.materials if m}
    prims = sum(max(len(o.data.materials), 1) for o in meshes)
    return dict(nodes=len(objs), meshes=len(meshes), draw_calls_est=prims, materials=len(mats),
                triangles=tri_count(meshes))


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ao-samples", type=int, default=128)
    ap.add_argument("--glow-samples", type=int, default=256)
    ap.add_argument("--atlas", type=int, default=2048, help="bake resolution (stored at half)")
    ap.add_argument("--only", default="desk,crate,notebook")
    ap.add_argument("--tag", default="phase4", help="name of the intermediate .blend files (never overwrite approved ones)")
    args = ap.parse_args()
    only = set(args.only.split(","))
    os.makedirs(RAW, exist_ok=True)
    report = {}

    # Phase 4 render scene (also the source for the standalone assets)
    build.build()
    lines, problems = checks.run()
    if problems:
        print("\n".join(problems))
    build.setup_render(32)
    src = os.path.join(ROOT, "source", f"diorama_{args.tag}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=src, compress=True)
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_mainfile(compress=True)
    write_views()

    if "desk" in only:
        root = bpy.data.objects["DIORAMA_ROOT"]
        strip_blender_only()
        all_objs = [o for o in bpy.data.objects if o.type in ('MESH', 'EMPTY')]
        report["desk_before"] = stats(all_objs)
        apply_modifiers(all_objs)
        merge_static(root)
        report["desk_sibling_merges"] = merge_siblings()
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        bake_objs = [o for o in meshes if not in_movable(o) and not obj_unbakeable(o)]
        cases = [o for o in meshes if in_movable(o) and any(a.name.startswith("GAME_Case_") for a in ancestors(o))]
        report["desk_bake"] = bake_set("desk", bake_objs, args.atlas, args.ao_samples, args.glow_samples,
                                       glow=True, hide=cases)
        objs = [o for o in bpy.data.objects if o.type in ('MESH', 'EMPTY')]
        report["desk_after"] = stats(objs)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "source", f"diorama_{args.tag}_web.blend"), compress=True)
        report["desk_glb_bytes"] = export_glb(os.path.join(RAW, "studio_desk.glb"), objs)

    if "crate" in only:
        bpy.ops.wm.open_mainfile(filepath=src)
        objs = reroot("NAV_GamesCrate")
        apply_modifiers(objs)
        merge_siblings()
        objs = [bpy.data.objects["NAV_GamesCrate"], *bpy.data.objects["NAV_GamesCrate"].children_recursive]
        body = [o for o in objs if o.type == 'MESH' and o.name.startswith("NAV_GamesCrate_")]   # boards, frame, nails, ropes
        cases = [o for o in objs if o.type == 'MESH' and o not in body]
        for o in bpy.data.objects:                     # standalone: exhibit rig only
            if o.type == 'LIGHT':
                o.hide_render = not o.name.startswith("LIGHT_Exhibit")
        report["crate_bake"] = bake_set("crate", body, 2048, args.ao_samples, 0, glow=False, hide=cases)
        report["crate_after"] = stats(objs)
        report["crate_glb_bytes"] = export_glb(os.path.join(RAW, "games_collection.glb"), objs)

    if "notebook" in only:
        bpy.ops.wm.open_mainfile(filepath=src)
        objs = reroot("NAV_Notebook")
        apply_modifiers(objs)
        merge_siblings()
        objs = [bpy.data.objects["NAV_Notebook"], *bpy.data.objects["NAV_Notebook"].children_recursive]
        report["notebook_after"] = stats(objs)       # runtime-lit: pages and covers will move
        report["notebook_glb_bytes"] = export_glb(os.path.join(RAW, "studio_notebook.glb"), objs)

    json.dump(report, open(os.path.join(RAW, "export_report.json"), "w"), indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
