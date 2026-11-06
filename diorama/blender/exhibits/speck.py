"""Speck exhibit: the little planet from the game's cover art, as a miniature diorama.

A tiny pixel planet hovering over a glowing pedestal: a cube-sphere of square cells (one "pixel" each),
ocean at the base radius and land raised in steps - beaches, grass, forest, hills, snowy peaks - with a
few voxel clouds drifting around it. On top, a homestead to start from: a little hut, a fenced farm plot
with four rows of sprouts, a tree, a campfire, and a speck (a little pixel robot) saying "sup".

The planet is one group (SP_Planet, tagged) so the website can spin it and leave markers on it.
Real-world scale is not the point here: it is a desk-sized toy planet (0.3 m radius). Blender Z-up.
"""
from math import radians, pi, sin, cos, sqrt
import random
import numpy as np
import bmesh
import bpy
from mathutils import Vector, Matrix, Quaternion

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

R = 0.3                 # planet radius (ocean level)
STEP = 0.008            # height of one land step
N = 36                  # cells per cube face edge
CENTER = Vector((0, 0, 0.5))
HOME_DEG = 20           # flat homestead cap around the north pole
CLOSEUPS = [("CAM_Exhibit_CloseHome", ["SP_Hut", "SP_Speck", "SP_Tree", "SP_Farm"], 26, 32, 50, 0.7)]
LIGHT_GAIN = dict(key=2.6, fill=2.0, rim=1.8)

FACES = [(Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((-1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))),
         (Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1))), (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))),
         (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))), (Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, -1, 0)))]
RNG = random.Random(31)
WAVES = [(Vector((RNG.uniform(-1, 1), RNG.uniform(-1, 1), RNG.uniform(-1, 1))).normalized(), RNG.uniform(1.5, 6.5), RNG.uniform(0, 6.3),
          RNG.uniform(0.4, 1.0)) for _ in range(22)]


def field(n):
    """Smooth pseudo-noise on the unit sphere (sum of plane waves): > 0.18 is land."""
    v = sum(a * sin(n.dot(d) * f + ph) for d, f, ph, a in WAVES) / 6.0
    v += 0.25 * sin(n.x * 17 + n.y * 11) * sin(n.z * 13 - n.x * 7)
    return v


def cube_dir(face, u, v):
    nrm, a, b = FACES[face]
    # equal-angle mapping keeps the cells nearly square across the face
    return (nrm + a * np.tan(u * pi / 4) + b * np.tan(v * pi / 4)).normalized()


PALETTE = dict(deep="#1d4c8c", sea="#2a63ac", shallow="#3f86c9", sand="#d8c48a", grass="#5a9a3c", grass2="#4f8d36",
               forest="#3a7330", hill="#7c9449", rock="#8d8a7c", snow="#f2f4f2")
SIDE = dict(sand="#b59a62", grass="#6b5233", grass2="#6b5233", forest="#5a4128", hill="#6e5a3c", rock="#6c695e", snow="#c9cbc8")


def classify(n):
    """-> (kind, steps) for a cell centre direction."""
    if n.z > cos(radians(HOME_DEG)):
        return ("grass", 1)
    f = field(n)
    if f < -0.05: return ("deep", 0)
    if f < 0.1: return ("sea", 0)
    if f < 0.18: return ("shallow", 0)
    if f < 0.23: return ("sand", 1)
    if f < 0.42: return (RNG.choice(["grass", "grass2"]), 1)
    if f < 0.55: return ("forest", 1)
    if f < 0.68: return ("hill", 2)
    if f < 0.8: return ("rock", 3)
    return ("snow", 3)


# ---------------------------------------------------------------- the planet
def build_planet(root, m):
    planet = S.empty("SP_Planet", "PROPS", loc=CENTER, parent=root, size=0.1)
    cells = []
    for f in range(6):
        for i in range(N):
            for j in range(N):
                u0, u1 = -1 + 2 * i / N, -1 + 2 * (i + 1) / N
                v0, v1 = -1 + 2 * j / N, -1 + 2 * (j + 1) / N
                corners = [cube_dir(f, u0, v0), cube_dir(f, u1, v0), cube_dir(f, u1, v1), cube_dir(f, u0, v1)]
                c = cube_dir(f, (u0 + u1) / 2, (v0 + v1) / 2)
                kind, steps = classify(c)
                cells.append((f, i, j, corners, kind, steps))
    # colour atlas: one pixel per cell, tops in the upper half, sides in the lower half (nearest filtering)
    W_, H_ = 6 * N, 2 * N
    img = np.zeros((H_, W_, 3), np.float32)
    rng = random.Random(3)
    for f, i, j, _, kind, _ in cells:
        col = np.array(T.rgb(PALETTE[kind])) * rng.uniform(0.9, 1.08)
        img[j, f * N + i] = col
        img[N + j, f * N + i] = np.array(T.rgb(SIDE.get(kind, PALETTE[kind]))) * rng.uniform(0.92, 1.05)
    c = T.Canvas(W_ * 4, H_ * 4)
    c.a[..., :3] = np.repeat(np.repeat(img, 4, 0), 4, 1)
    TEX["sp_planet"] = c.save("sp_planet")
    m["land"] = mat("M_sp_land", tex="sp_planet", rough=0.8, closest=True)
    m["water"] = mat("M_sp_water", tex="sp_planet", rough=0.18, closest=True)
    uv_of = lambda f, i, j, side: ((f * N + i + 0.5) / W_, 1 - ((N if side else 0) + j + 0.5) / H_)

    def shell(bm_land, bm_water):
        ul, uw = bm_land.loops.layers.uv.new("UVMap"), bm_water.loops.layers.uv.new("UVMap")
        for f, i, j, corners, kind, steps in cells:
            if steps == 0:
                vs = [bm_water.verts.new(cr * R) for cr in corners]
                face = bm_water.faces.new(vs)
                for lp in face.loops: lp[uw].uv = uv_of(f, i, j, False)
                continue
            top = [bm_land.verts.new(cr * (R + steps * STEP)) for cr in corners]
            base = [bm_land.verts.new(cr * (R - 0.004)) for cr in corners]
            face = bm_land.faces.new(top)
            for lp in face.loops: lp[ul].uv = uv_of(f, i, j, False)
            for k in range(4):
                q = bm_land.faces.new((base[k], base[(k + 1) % 4], top[(k + 1) % 4], top[k]))
                for lp in q.loops: lp[ul].uv = uv_of(f, i, j, True)
    bl, bw = bmesh.new(), bmesh.new()
    shell(bl, bw)                                            # winding is already outward (a x b = face normal)
    geo.from_bm("SP_Land", bl, material=m["land"], parent=planet, uv="keep", sharp=0.3)
    geo.from_bm("SP_Water", bw, material=m["water"], parent=planet, uv="keep", sharp=None)
    # a few voxel clouds drifting low over the sea
    rng = random.Random(9)
    def clouds(bm):
        for k in range(5):
            a, el = k * 1.3 + 0.4, radians(rng.uniform(-35, 30))
            n = Vector((cos(a) * cos(el), sin(a) * cos(el), sin(el)))
            t1 = n.cross(Vector((0, 0, 1))).normalized(); t2 = n.cross(t1)
            for _ in range(7):
                off = t1 * rng.uniform(-0.05, 0.05) + t2 * rng.uniform(-0.02, 0.02)
                s = rng.uniform(0.014, 0.026)
                p = n * (R + 0.075) + off
                vs = geo.add_box(bm, (s * 1.4, s, s * 0.7), (0, 0, 0))
                bmesh.ops.transform(bm, matrix=Matrix.Translation(p) @ n.to_track_quat('Z', 'Y').to_matrix().to_4x4(), verts=vs)
    geo.merged("SP_Clouds", clouds, material=m["cloud"], parent=planet, bevel=0.003, seg=1)
    return planet


def on_top(theta_deg, phi_deg, lift=0.0, yaw=0.0):
    """Point + rotation on the homestead cap (theta from the pole, phi around it), local to the planet.
    The object stands along the surface normal (smallest tilt from upright); `yaw` turns it first, so
    yaw=34 points its front (-Y) toward the hero camera (azimuth 34)."""
    th, ph = radians(theta_deg), radians(phi_deg)
    n = Vector((sin(th) * cos(ph), sin(th) * sin(ph), cos(th)))
    rad = R + STEP
    q = Vector((0, 0, 1)).rotation_difference(n) @ Quaternion((0, 0, 1), radians(yaw))
    # the cap cells are flat quads; their surface sits a touch inside the sphere of radius R + STEP
    return n * (rad - 0.001 + lift), q.to_euler()


def build_home(planet, m):
    # the hut
    p, rot = on_top(9, 165, yaw=20)
    hut = geo.box("SP_Hut", (0.05, 0.042, 0.034), loc=p, rot=rot, material=m["planks"], parent=planet, bevel=0.002)
    def roof(bm):
        w, d, h = 0.06, 0.05, 0.026
        vs = [bm.verts.new(v) for v in [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0), (-w / 2, 0, h), (w / 2, 0, h)]]
        for f in [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]:
            bm.faces.new([vs[i] for i in f])
    geo.merged("SP_Hut_Roof", roof, loc=(0, 0, 0.034), material=m["roof"], parent=hut, bevel=0.002, seg=1)
    geo.box("SP_Hut_Door", (0.012, 0.002, 0.02), loc=(0.008, -0.0215, 0), material=M("wood_dark"), parent=hut, bevel=0)
    geo.box("SP_Hut_Window", (0.01, 0.002, 0.009), loc=(-0.013, -0.0215, 0.015), material=m["window"], parent=hut, bevel=0)
    # the farm: fence + four tilled rows with sprouts
    p, rot = on_top(8, 65)
    farm = S.empty("SP_Farm", "PROPS", loc=p, rot=rot, parent=planet, size=0.02)
    geo.box("SP_Farm_Soil", (0.07, 0.06, 0.004), loc=(0, 0, -0.002), material=m["soil"], parent=farm, bevel=0.001)
    def sprouts(bm):
        for r in range(4):
            for k in range(5):
                geo.add_box(bm, (0.004, 0.004, 0.006 + (k % 2) * 0.002), (-0.026 + k * 0.013, -0.021 + r * 0.014, 0.001))
    geo.merged("SP_Farm_Sprouts", sprouts, material=m["leaf"], parent=farm, bevel=0)
    def fence(bm):
        w, d = 0.084, 0.074
        for k in range(8):
            x = -w / 2 + k * w / 7
            for y in (-d / 2, d / 2):
                geo.add_box(bm, (0.003, 0.003, 0.014), (x, y, 0))
        for k in range(1, 7):
            y = -d / 2 + k * d / 7
            for x in (-w / 2, w / 2):
                geo.add_box(bm, (0.003, 0.003, 0.014), (x, y, 0))
        for z in (0.005, 0.011):
            geo.add_box(bm, (w, 0.0018, 0.0018), (0, -d / 2, z)); geo.add_box(bm, (w, 0.0018, 0.0018), (0, d / 2, z))
            geo.add_box(bm, (0.0018, d, 0.0018), (-w / 2, 0, z)); geo.add_box(bm, (0.0018, d, 0.0018), (w / 2, 0, z))
    geo.merged("SP_Farm_Fence", fence, material=M("wood_light"), parent=farm, bevel=0)
    # the tree (voxel canopy)
    p, rot = on_top(13, 118)
    tree = geo.box("SP_Tree", (0.009, 0.009, 0.04), loc=p, rot=rot, material=m["trunk"], parent=planet, bevel=0.001)
    rng = random.Random(4)
    def canopy(bm):
        for x in (-1, 0, 1):
            for y in (-1, 0, 1):
                for z in (0, 1, 2):
                    if abs(x) + abs(y) + (z == 2) * 2 > 2 or rng.random() < 0.12:
                        continue
                    geo.add_box(bm, (0.016, 0.016, 0.016), (x * 0.015, y * 0.015, 0.034 + z * 0.014))
    geo.merged("SP_Tree_Leaves", canopy, material=m["leaf"], parent=tree, bevel=0.0015, seg=1)
    # the campfire: a ring of stones, crossed logs, a flame and a small warm light
    p, rot = on_top(5, -15)
    fire = S.empty("SP_Campfire", "PROPS", loc=p, rot=rot, parent=planet, size=0.02)
    def stones(bm):
        for k in range(8):
            a = k * pi / 4
            geo.add_box(bm, (0.006, 0.006, 0.005), (cos(a) * 0.012, sin(a) * 0.012, 0), (0, 0, a))
    geo.merged("SP_Campfire_Stones", stones, material=m["stone"], parent=fire, bevel=0.001)
    for k, a in enumerate((20, 110)):
        geo.box(f"SP_Campfire_Log_{k}", (0.02, 0.0035, 0.0035), loc=(0, 0, 0.001 + k * 0.003), rot=(0, 0, radians(a)), material=m["trunk"], parent=fire, bevel=0)
    fl = geo.lathe("SP_Campfire_Flame", [(0, 0), (0.006, 0.003), (0.005, 0.01), (0.002, 0.017), (0, 0.02)], loc=(0, 0, 0.004), material=m["flame"], parent=fire, segments=8)
    fl.visible_shadow = False
    L = bpy.data.lights.new("LIGHT_SP_Fire", 'POINT')
    L.energy, L.color, L.shadow_soft_size = 0.6, (1.0, 0.6, 0.25), 0.005
    lo = bpy.data.objects.new("LIGHT_SP_Fire", L)
    lo.parent = fire
    lo.location = (0, 0, 0.015)
    S.coll("LIGHTS").objects.link(lo)
    # the speck: a little pixel robot (like the ones players draw), saying "sup"
    p, rot = on_top(11, -58, yaw=34)
    speck = geo.box("SP_Speck", (0.014, 0.01, 0.012), loc=p, rot=rot, material=m["robot"], parent=planet, bevel=0.0012)
    for sx in (-1, 1):
        geo.box(f"SP_Speck_Leg_{'L' if sx < 0 else 'R'}", (0.004, 0.005, 0.006), loc=(sx * 0.004, 0, -0.005), material=m["robot_dark"], parent=speck, bevel=0)
        geo.box(f"SP_Speck_Arm_{'L' if sx < 0 else 'R'}", (0.003, 0.004, 0.008), loc=(sx * 0.0085, 0, 0.003), material=m["robot_dark"], parent=speck, bevel=0)
    head = geo.box("SP_Speck_Head", (0.018, 0.014, 0.014), loc=(0, 0, 0.012), material=m["robot"], parent=speck, bevel=0.0015)
    for sx in (-1, 1):
        geo.box(f"SP_Speck_Eye_{'L' if sx < 0 else 'R'}", (0.004, 0.001, 0.004), loc=(sx * 0.0045, -0.0071, 0.005), material=m["eye"], parent=head, bevel=0)
    geo.cylinder("SP_Speck_Antenna", 0.0008, 0.008, loc=(0, 0, 0.014), material=m["robot_dark"], parent=head, verts=6, bevel=0)
    geo.sphere("SP_Speck_Antenna_Tip", 0.0018, loc=(0, 0, 0.021), material=m["eye"], parent=head, segs=8)
    speck.location += (speck.matrix_basis.to_3x3() @ Vector((0, 0, 0.0055)))
    bubble = geo.box("SP_Bubble", (0.034, 0.002, 0.02), loc=(0.016, 0, 0.034), rot=(0, 0, 0), material=m["bubble"], parent=speck,
                     bevel=0, uv="fit", fit_axis=1)
    geo.box("SP_Bubble_Tail", (0.004, 0.0021, 0.006), loc=(-0.008, 0, -0.005), rot=(0, radians(30), 0), material=m["bubble_edge"], parent=bubble, bevel=0)
    return hut, farm, tree, fire, speck


def build_pedestal(root, m):
    geo.box("SP_Plinth", (1.0, 1.0, 0.12), loc=(0, 0, -0.12), material=m["plinth"], parent=root, collection="BASE", bevel=0.02)
    geo.lathe("SP_Pedestal", [(0, 0), (0.24, 0), (0.24, 0.02), (0.2, 0.045), (0, 0.045)], material=m["stone"], parent=root, collection="BASE", segments=48)
    geo.lathe("SP_Pedestal_Ring", [(0.17, 0.045), (0.19, 0.045), (0.19, 0.05), (0.17, 0.05)], material=m["ring"], parent=root, collection="BASE", segments=48)


def textures():
    out = {"sp_bubble": T.label_card("sp_bubble", 340, 200, [("sup", 18)], "#ffffff", "#111111", border=True)}
    TEX.update(out)
    return out


def materials():
    return dict(
        cloud=mat("M_sp_cloud", color=(0.95, 0.96, 0.98), rough=0.9),
        planks=mat("M_sp_planks", tex="planks", rough=0.7),
        roof=mat("M_sp_roof", color=(0.55, 0.16, 0.1), rough=0.7),
        window=mat("M_sp_window", color=(1.0, 0.8, 0.4), emit=(1.0, 0.75, 0.35), strength=3),
        soil=mat("M_sp_soil", color=(0.3, 0.18, 0.09), rough=1.0),
        leaf=mat("M_sp_leaf", color=(0.2, 0.5, 0.15), rough=0.7),
        trunk=mat("M_sp_trunk", color=(0.35, 0.22, 0.12), rough=0.8),
        stone=mat("M_sp_stone", color=(0.11, 0.11, 0.13), rough=0.7),
        flame=mat("M_sp_flame", color=(1.0, 0.6, 0.2), emit=(1.0, 0.55, 0.15), strength=8),
        robot=mat("M_sp_robot", color=(0.62, 0.66, 0.74), rough=0.45, metal=0.3),
        robot_dark=mat("M_sp_robot_dark", color=(0.28, 0.3, 0.36), rough=0.5, metal=0.3),
        eye=mat("M_sp_eye", color=(0.3, 0.8, 1.0), emit=(0.3, 0.8, 1.0), strength=4),
        bubble=mat("M_sp_bubble", tex="sp_bubble", rough=0.6, emit_tex="sp_bubble", strength=0.25),
        bubble_edge=mat("M_sp_bubble_edge", color=(1, 1, 1), rough=0.6),
        ring=mat("M_sp_ring", color=(0.2, 0.7, 1.0), emit=(0.25, 0.75, 1.0), strength=6),
        plinth=mat("M_sp_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
    )


def build(root):
    m = materials()
    build_pedestal(root, m)
    planet = build_planet(root, m)
    hut, farm, tree, fire, speck = build_home(planet, m)
    for obj, iid, label in [(planet, "sp_planet", "The Speck"), (speck, "sp_speck", "A Speck"), (hut, "sp_home", "Homestead")]:
        S.mark_interactive(obj, iid, label, scope="speck", kind="discovery")
    planet["radius"] = R + STEP
    return dict(planet=planet)
