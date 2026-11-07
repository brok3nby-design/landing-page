"""Juicebox exhibit: the desert roadside at sunset from the film's cover art ("Some things hit different on the road").

A slab of roadside, built like a film set: a cracked two-lane highway with a yellow centre line curving away
into a painted sunset backdrop (a curved cyclorama: deep blue sky, orange clouds, mesas, the sun on the
horizon where the road disappears). On the gravel shoulder: an old, rusty pickup truck, the hooded drifter
with a backpack watching the sun go down, the green road sign (GOOD PEOPLE / STRANGE PLACES; its other side
says SOME THINGS HIT DIFFERENT ON THE ROAD) and in front, the glowing bottle of juice with the dripping smiley.
Sagebrush, dry grass and rocks.

For the website: the bottle sloshes (JB_Bottle_Liquid pivot), the sign board flips on its horizontal axis
(JB_Sign_Board pivot; the back face is built so it reads correctly once flipped), the truck's headlights turn on.
Real-world scale (metres), Blender Z-up.
"""
from math import radians, pi, sin, cos, atan2
import random
import numpy as np
import bmesh
import bpy
from mathutils import Vector

from lib import geo, scene as S, textures as T
from lib.mats import mat, TEX
from lib.library import M

W, D = 5.6, 4.4
LEFT_X, BACK_Y, RIGHT_X, FRONT_Y = -W / 2, D / 2, W / 2, -D / 2
SKY_H, SKY_R = 2.8, 1.2                                    # cyclorama height and corner radius
ROAD_W = 2.0
RNG = random.Random(7)
CLOSEUPS = [("CAM_Exhibit_CloseBottle", ["JB_Bottle", "JB_Drifter"], 20, 14, 50, 0.75)]
LIGHT_GAIN = dict(key=3.8, fill=2.8, rim=2.4)
BAKE_HIDE = []


def road_x(y):
    """Centre line of the road: in at the front right, curving gently to the sunset at the back."""
    t = (y - FRONT_Y) / D
    return 1.05 + 0.45 * sin(t * pi) - 0.2 * t


# ---------------------------------------------------------------- textures
def _tex_dirt(name="jb_dirt", size=1024):
    c = T.Canvas(size, size, T.rgb("#9a6a42"))
    c.mul(0.75 + 0.4 * T.noise(size, size, 5, 101))
    c.mul(0.85 + 0.25 * T.noise(size, size, 50, 102))
    rng = random.Random(3)
    for _ in range(1400):                                     # gravel
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        g = rng.uniform(0.6, 1.25)
        c.circle(x, y, rng.uniform(1.5, 4.5), tuple(np.array(T.rgb("#8a6a52")) * g), 0.8)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=6.0, size=(512, 512), blur=0.8)


def _tex_asphalt(name="jb_road", w=512, h=2048):
    c = T.Canvas(w, h, T.rgb("#2c2a2a"))
    c.mul(0.8 + 0.3 * T.noise(h, w, 10, 103))
    c.mul(0.9 + 0.15 * T.noise(h, w, 80, 104))
    rng = random.Random(5)
    for _ in range(40):                                       # cracks + tar snakes
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a = rng.uniform(0, 2 * pi)
        for _ in range(rng.randint(5, 14)):
            a += rng.uniform(-0.6, 0.6)
            nx, ny = x + cos(a) * rng.uniform(8, 26), y + sin(a) * rng.uniform(8, 26)
            c.line(x, y, nx, ny, rng.uniform(1, 3), T.rgb("#121010"), 0.8)
            x, y = nx, ny
    for u in (0.06, 0.94):                                    # worn white edge lines
        c.rect(w * u - 6, 0, w * u + 6, h, T.rgb("#d8d2c4"), 0.75)
    for k in range(8):                                        # dashed yellow centre line
        y0 = k * h / 8
        c.rect(w * 0.49 - 5, y0, w * 0.49 + 5, y0 + h / 16, T.rgb("#e0a828"), 0.9)
    worn = np.clip((T.noise(h, w, 14, 105) - 0.62) * 4, 0, 1)
    c._blend(worn, T.rgb("#2c2a2a"), 0.6)
    img = c.save(name)
    return img, T.normal_map(name + "_n", name, strength=4.0, size=(256, 1024), blur=0.8)


def _tex_sky(name, total, u_sun, w=2048, h=768):
    """The cyclorama: night-blue at the top to fire at the horizon, clouds lit from below, mesas, the sun,
    and the road running on to the horizon (forced perspective)."""
    c = T.Canvas(w, h)
    hz = int(h * 0.77)                                        # horizon row (z ~ 0.64 m)
    c.vgrad(0, int(h * 0.35), T.rgb("#16233f"), T.rgb("#3b4f78"))
    c.vgrad(int(h * 0.35), int(h * 0.62), T.rgb("#3b4f78"), T.rgb("#e2884a"))
    c.vgrad(int(h * 0.62), hz, T.rgb("#e2884a"), T.rgb("#ffcf73"))
    c.vgrad(hz, h, T.rgb("#6b4030"), T.rgb("#8a5a3a"))
    sx = w * u_sun
    glow = np.exp(-(((c.xx - sx) / (w * 0.12)) ** 2 + ((c.yy - hz) / (h * 0.25)) ** 2))
    c._blend(glow, T.rgb("#fff0b0"), 0.6)
    rng = random.Random(11)
    # clouds: soft, stretched puffs, lit orange from below near the horizon, violet higher up
    cl = np.clip((T.noise(h, w, 7, 211, aniso=(1.0, 0.25)) * 0.65 + T.noise(h, w, 22, 212, aniso=(1.0, 0.35)) * 0.35 - 0.52) * 3.2, 0, 1)
    band = np.clip((c.yy - h * 0.08) / (h * 0.12), 0, 1) * np.clip((h * 0.66 - c.yy) / (h * 0.1), 0, 1)
    warm = np.clip((c.yy - h * 0.15) / (h * 0.5), 0, 1)
    col = np.stack([warm * 1.0 + (1 - warm) * 0.42, warm * 0.62 + (1 - warm) * 0.4, warm * 0.38 + (1 - warm) * 0.58], -1)
    m_ = (cl * band)[..., None] * 0.85
    c.a[..., :3] = c.a[..., :3] * (1 - m_) + col * m_
    lit = np.clip(cl - np.roll(cl, -6, 0), 0, 1) * band * warm        # bright undersides
    c._blend(lit, T.rgb("#ffe0a0"), 0.7)
    pts = [(0, hz + 4)]                                       # mesas and buttes: flat tops, steep sides
    x = 0
    while x < w:
        if rng.random() < 0.35:
            bw, bh = rng.uniform(60, 220), rng.uniform(30, 95)
            pts += [(x, hz - 6), (x + 14, hz - bh), (x + bw - 14, hz - bh), (x + bw, hz - 6)]
            x += bw
        else:
            pts += [(x, hz - rng.uniform(2, 14))]
            x += rng.uniform(20, 70)
    pts += [(w, hz + 4)]
    c.poly(pts + [(w, hz + 30), (0, hz + 30)], T.rgb("#5a3646"))
    c.circle(sx, hz - 8, 26, T.rgb("#fff6d8"))                # the sun, sitting on the horizon
    c.rect(0, hz - 2, w, hz + 6, T.rgb("#c06a40"), 0.5)
    half = (ROAD_W / 2) / total * w                           # the road running on to the horizon
    c.poly([(sx - half * 1.05, h), (sx + half * 1.05, h), (sx + 2, hz), (sx - 2, hz)], T.rgb("#2a2626"))
    for k in range(6):
        f0, f1 = k / 6, k / 6 + 0.06
        y0, y1 = h - (h - hz) * f0 ** 0.7, h - (h - hz) * f1 ** 0.7
        c.poly([(sx - 3 * (1 - f0), y0), (sx + 3 * (1 - f0), y0), (sx + 2 * (1 - f1), y1), (sx - 2 * (1 - f1), y1)], T.rgb("#d8a030"), 0.8)
    return c.save(name)


def _tex_paint(name="jb_paint", size=1024):
    """Sun-bleached teal paint, rust coming through at the edges and in blooms, dust low down."""
    c = T.Canvas(size, size, T.rgb("#5b8080"))
    c.mul(0.78 + 0.35 * T.noise(size, size, 6, 106))
    rust = np.clip((T.noise(size, size, 9, 107) - 0.5) * 3.5, 0, 1)
    c._blend(rust, T.rgb("#7a3c1c"), 0.85)
    c._blend(np.clip((T.noise(size, size, 40, 108) - 0.65) * 5, 0, 1), T.rgb("#4a2612"), 0.6)
    dust = np.clip((c.yy / size - 0.6) / 0.4, 0, 1)
    c._blend(dust, T.rgb("#a07850"), 0.45)
    return c.save(name)


def _sign(name, lines, arrow, w=640, h=420):
    c = T.Canvas(w, h, T.rgb("#1d4636"))
    c.mul(0.85 + 0.2 * T.noise(h, w, 6, len(name)))
    white = T.rgb("#e8e6dc")
    c.rect(12, 12, w - 12, 20, white); c.rect(12, h - 20, w - 12, h - 12, white)
    c.rect(12, 12, 20, h - 12, white); c.rect(w - 20, 12, w - 12, h - 12, white)
    px = 9
    n = len(lines) + (1 if arrow else 0)
    y = (h - n * px * 9) / 2 + 6
    for ln in lines:
        c.text(ln, (w - len(ln) * 6 * px) / 2, y, px, white)
        y += px * 9
    if arrow:
        ax, ay = w / 2 + 40, y + px * 3
        c.rect(ax - 90, ay - 7, ax + 30, ay + 7, white)
        c.poly([(ax + 20, ay - 26), (ax + 62, ay), (ax + 20, ay + 26)], white)
    rng = random.Random(len(name) * 3)
    for _ in range(26):                                       # chipped paint + rust spots
        c.circle(rng.uniform(0, w), rng.uniform(0, h), rng.uniform(2, 9), T.rgb("#5a3a22"), 0.7)
    return c.save(name)


def _tex_label(name="jb_label", w=1024, h=256):
    """Wrap-around paper label: the dripping smiley faces u = 0.75 (the front)."""
    c = T.Canvas(w, h, T.rgb("#e9dfc2"))
    c.mul(0.85 + 0.2 * T.noise(h, w, 8, 109))
    cx, cy, r = w * 0.75, h * 0.48, h * 0.34
    ink = T.rgb("#141210")
    c.circle(cx, cy, r, ink, 0.95, ring=9)
    for sx in (-1, 1):
        c.circle(cx + sx * r * 0.38, cy - r * 0.25, r * 0.12, ink)
    for k in range(9):                                        # the smile
        a = radians(200 + k * 17.5)
        c.circle(cx + cos(a) * r * 0.55, cy - sin(a) * r * 0.55 * -1 + r * 0.05, 6, ink)
    rng = random.Random(4)
    for k in range(5):                                        # the drips
        x = cx - r * 0.6 + k * r * 0.3 + rng.uniform(-6, 6)
        y0 = cy + r * 0.6
        L = rng.uniform(20, 60)
        c.line(x, y0, x, y0 + L, 7, ink, 0.9)
        c.circle(x, y0 + L, 6, ink, 0.9)
    return c.save(name)


def textures():
    out = {}
    out["jb_dirt"], out["jb_dirt_n"] = _tex_dirt()
    out["jb_road"], out["jb_road_n"] = _tex_asphalt()
    out["jb_paint"] = _tex_paint()
    out["jb_sign_front"] = _sign("jb_sign_front", ["GOOD", "PEOPLE", "STRANGE", "PLACES"], True)
    out["jb_sign_back"] = _sign("jb_sign_back", ["SOME THINGS", "HIT", "DIFFERENT", "ON THE ROAD."], False)
    out["jb_label"] = _tex_label()
    TEX.update(out)
    return out


def materials():
    return dict(
        dirt=mat("M_jb_dirt", tex="jb_dirt", rough=0.95, normal="jb_dirt_n", normal_strength=0.9),
        road=mat("M_jb_road", tex="jb_road", rough=0.85, normal="jb_road_n", normal_strength=0.6),
        paint=mat("M_jb_paint", tex="jb_paint", rough=0.7, metal=0.25),
        chrome=mat("M_jb_chrome", color=(0.55, 0.5, 0.45), rough=0.35, metal=0.9),
        tyre=mat("M_jb_tyre", color=(0.03, 0.028, 0.027), rough=0.9),
        window=mat("M_jb_window", color=(0.05, 0.06, 0.07), rough=0.05, metal=0.5),
        lens=mat("M_jb_lens", color=(0.75, 0.72, 0.62), rough=0.1, emit=(1.0, 0.92, 0.7), strength=0.0),
        tail=mat("M_jb_tail", color=(0.5, 0.05, 0.04), rough=0.3),
        post=mat("M_jb_post", color=(0.12, 0.12, 0.12), rough=0.6, metal=0.6),
        sign_front=mat("M_jb_sign_front", tex="jb_sign_front", rough=0.55, metal=0.2),
        sign_back=mat("M_jb_sign_back", tex="jb_sign_back", rough=0.55, metal=0.2),
        hoodie=mat("M_jb_hoodie", color=(0.06, 0.06, 0.065), rough=0.9),
        jeans=mat("M_jb_jeans", color=(0.1, 0.14, 0.22), rough=0.85),
        boots=mat("M_jb_boots", color=(0.18, 0.1, 0.05), rough=0.6),
        pack=mat("M_jb_pack", color=(0.12, 0.13, 0.09), rough=0.85),
        skin=mat("M_jb_skin", color=(0.25, 0.16, 0.12), rough=0.6),
        glass=mat("M_jb_glass", color=(0.95, 0.92, 0.82), rough=0.04, transmission=0.95, ior=1.45),
        juice=mat("M_jb_juice", color=(1.0, 0.72, 0.05), rough=0.1, emit=(1.0, 0.68, 0.08), strength=0.9),
        label=mat("M_jb_label", tex="jb_label", rough=0.7),
        cap=mat("M_jb_cap", color=(0.04, 0.04, 0.04), rough=0.5),
        sage=mat("M_jb_sage", color=(0.16, 0.2, 0.11), rough=0.9),
        grass=mat("M_jb_grass", color=(0.55, 0.44, 0.24), rough=0.9),
        rock=mat("M_jb_rock", color=(0.3, 0.17, 0.11), rough=0.9),
        plinth=mat("M_jb_plinth", color=(0.035, 0.03, 0.028), rough=0.5),
    )


# ---------------------------------------------------------------- the set
def build_set(root, m):
    p = dict(parent=root, collection="BASE")
    geo.box("JB_Plinth", (W + 0.4, D + 0.4, 0.2), loc=(0, 0, -0.28), material=m["plinth"], bevel=0.03, **p)
    geo.box("JB_Ground", (W, D, 0.08), loc=(0, 0, -0.08), material=m["dirt"], bevel=0.02, uv="box", uv_scale=0.5, **p)
    def deform(x, y):                                         # grid x across the road, y along it
        yy = y
        return (road_x(yy) + x, yy, 0.006 + 0.012 * (1 - (2 * x / ROAD_W) ** 2))
    geo.grid("JB_Road", ROAD_W, D, 12, 60, material=m["road"], parent=root, collection="BASE", deform=deform, thickness=0.01)
    # the cyclorama: up the left side, round the corner, along the back
    r, H = SKY_R, SKY_H
    seg1, arc, seg2 = D - r, pi * r / 2, W - r
    total = seg1 + arc + seg2
    def path(sv):
        if sv < seg1:
            return LEFT_X, FRONT_Y + sv, -pi / 2
        sv -= seg1
        if sv < arc:
            a = pi - sv / r                                   # from pointing -x to pointing +y
            return LEFT_X + r + cos(a) * r, BACK_Y - r + sin(a) * r, None
        sv -= arc
        return LEFT_X + r + sv, BACK_Y, 0
    def sky(x, y):
        sv = (x / total + 0.5) * total
        px, py, _ = path(sv)
        return (px, py, (y / H + 0.5) * H)
    x_sun = road_x(BACK_Y)
    u_sun = (seg1 + arc + (x_sun - (LEFT_X + r))) / total
    TEX["jb_sky"] = _tex_sky("jb_sky", total, u_sun)
    m["sky"] = mat("M_jb_sky", color=(0, 0, 0), rough=0.9, emit_tex="jb_sky", strength=1.1)
    sk = geo.grid("JB_Sky", total, H, 160, 4, material=m["sky"], parent=root, collection="BASE", deform=sky)
    # flip the normals inward (the grid's winding faces outward along this path)
    bm = bmesh.new(); bm.from_mesh(sk.data); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(sk.data); bm.free()
    L = bpy.data.lights.new("LIGHT_JB_Sun", 'AREA')
    L.energy, L.color, L.size = 650, (1.0, 0.62, 0.32), 1.6
    lo = bpy.data.objects.new("LIGHT_JB_Sun", L)
    lo.location = (x_sun, BACK_Y - 0.4, 0.8)
    lo.rotation_euler = (radians(-80), 0, 0)
    S.coll("LIGHTS").objects.link(lo)
    # sagebrush, dry grass, rocks on the shoulders (never on the road)
    def off_road(x, y, margin=0.25):
        return abs(x - road_x(y)) > ROAD_W / 2 + margin
    def scrub(bm):
        for _ in range(38):
            for _ in range(40):
                x, y = RNG.uniform(LEFT_X + 0.3, RIGHT_X - 0.15), RNG.uniform(FRONT_Y + 0.15, BACK_Y - 0.3)
                if off_road(x, y) and not (-2.2 < x < -0.6 and -1.4 < y < 1.6) and x - LEFT_X + BACK_Y - y > 1.2:
                    break
            s = RNG.uniform(0.08, 0.2)
            for _ in range(6):
                vs = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=s * RNG.uniform(0.4, 0.7))["verts"]
                bmesh.ops.transform(bm, matrix=geo.mtx((x + RNG.uniform(-s, s) * 0.6, y + RNG.uniform(-s, s) * 0.6, s * RNG.uniform(0.15, 0.4)), (0, 0, 0), (1, 1, 0.7)), verts=vs)
    geo.merged("JB_Sagebrush", scrub, material=m["sage"], parent=root, bevel=0, uv="box", uv_scale=4)
    def grass(bm):
        for _ in range(140):
            x, y = RNG.uniform(LEFT_X + 0.2, RIGHT_X - 0.1), RNG.uniform(FRONT_Y + 0.1, BACK_Y - 0.3)
            if not off_road(x, y, 0.05):
                continue
            for _ in range(4):
                a, tilt = RNG.uniform(0, 2 * pi), radians(RNG.uniform(5, 30))
                geo.add_cyl(bm, 0.008, RNG.uniform(0.1, 0.25), (x + RNG.uniform(-0.04, 0.04), y + RNG.uniform(-0.04, 0.04), 0), (tilt * cos(a), tilt * sin(a), 0), verts=4, r_top=0.0005)
    geo.merged("JB_Grass", grass, material=m["grass"], parent=root, bevel=0)
    def rocks(bm):
        for _ in range(60):
            x, y = RNG.uniform(LEFT_X + 0.2, RIGHT_X - 0.1), RNG.uniform(FRONT_Y + 0.08, BACK_Y - 0.3)
            if not off_road(x, y, 0.1):
                continue
            s = RNG.uniform(0.02, 0.08)
            geo.add_box(bm, (s * RNG.uniform(1, 1.8), s, s * RNG.uniform(0.5, 0.9)), (x, y, -0.01), (radians(RNG.uniform(-10, 10)), radians(RNG.uniform(-10, 10)), RNG.uniform(0, 3)))
    geo.merged("JB_Rocks", rocks, material=m["rock"], parent=root, bevel=0.02, seg=1)
    return u_sun


def build_truck(root, m, loc, rz):
    t = S.empty("JB_Truck", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.3)
    pt = m["paint"]
    WR = 0.36
    for name, y in (("F", -1.32), ("R", 1.25)):
        for side in (-1, 1):
            x0 = 0.66 if side > 0 else -0.9
            tyre = geo.cylinder(f"JB_Truck_Tyre_{name}{'L' if side < 0 else 'R'}", WR, 0.24, loc=(x0, y, WR), rot=(0, radians(90), 0), material=m["tyre"],
                                parent=t, verts=28, bevel=0.03)
            geo.cylinder(f"JB_Truck_Rim_{name}{'L' if side < 0 else 'R'}", 0.2, 0.25, loc=(x0 - 0.005, y, WR), rot=(0, radians(90), 0), material=m["chrome"],
                         parent=t, verts=20, bevel=0.01)
    geo.box("JB_Truck_Frame", (1.45, 4.1, 0.5), loc=(0, 0, 0.42), material=pt, parent=t, bevel=0.05)
    for name, y, L in (("F", -1.32, 1.05), ("R", 1.25, 1.0)):     # fenders over the wheels
        geo.box(f"JB_Truck_Fender_{name}", (1.82, L, 0.32), loc=(0, y, 0.6), material=pt, parent=t, bevel=0.12, seg=3)
    geo.box("JB_Truck_Hood", (1.62, 1.35, 0.3), loc=(0, -1.42, 0.9), rot=(radians(-3), 0, 0), material=pt, parent=t, bevel=0.1, seg=3)
    cab = geo.box("JB_Truck_Cab", (1.66, 1.3, 0.86), loc=(0, -0.12, 0.92), material=pt, parent=t, bevel=0.14, seg=3)
    geo.box("JB_Truck_Windshield", (1.38, 0.05, 0.46), loc=(0, -0.66, 0.36), rot=(radians(-14), 0, 0), material=m["window"], parent=cab, bevel=0.02)
    geo.box("JB_Truck_RearWindow", (1.2, 0.05, 0.34), loc=(0, 0.655, 0.42), material=m["window"], parent=cab, bevel=0.02)
    for side in (-1, 1):
        geo.box(f"JB_Truck_SideWindow_{'L' if side < 0 else 'R'}", (0.05, 0.95, 0.4), loc=(side * 0.835, -0.02, 0.4), material=m["window"], parent=cab, bevel=0.02)
        geo.box(f"JB_Truck_Handle_{'L' if side < 0 else 'R'}", (0.03, 0.14, 0.03), loc=(side * 0.845, 0.2, 0.26), material=m["chrome"], parent=cab, bevel=0.008)
    mir = geo.curve_tube("JB_Truck_MirrorArm", [Vector((-0.84, -0.55, 1.28)), Vector((-1.0, -0.55, 1.36))], 0.015, material=m["chrome"], parent=t, ring=6, steps=1)
    geo.box("JB_Truck_Mirror", (0.06, 0.18, 0.24), loc=(-1.04, -0.55, 1.26), material=m["chrome"], parent=t, bevel=0.02)
    def bed(bm):
        geo.add_open_box(bm, (1.66, 1.85, 0.48), 0.06, (0, 1.12, 0.92))
    geo.merged("JB_Truck_Bed", bed, material=pt, parent=t, bevel=0.02, seg=2)
    geo.box("JB_Truck_Grille", (1.3, 0.05, 0.34), loc=(0, -2.1, 0.62), material=m["chrome"], parent=t, bevel=0.02)
    def grille_bars(bm):
        for k in range(7):
            geo.add_box(bm, (1.24, 0.02, 0.018), (0, -2.13, 0.65 + k * 0.042))
    geo.merged("JB_Truck_GrilleBars", grille_bars, material=m["window"], parent=t, bevel=0)
    for side in (-1, 1):
        lamp = geo.cylinder(f"JB_Truck_Headlight_{'L' if side < 0 else 'R'}", 0.1, 0.04, loc=(side * 0.62, -2.11, 0.86), rot=(radians(90), 0, 0),
                            material=m["lens"], parent=t, verts=24, bevel=0.01)
        geo.lathe(f"JB_Truck_Bezel_{'L' if side < 0 else 'R'}", [(0.1, 0), (0.125, 0), (0.125, 0.05), (0.1, 0.05)], loc=(side * 0.62, -2.085, 0.86), rot=(radians(90), 0, 0),
                  material=m["chrome"], parent=t, segments=24)
        geo.box(f"JB_Truck_Taillight_{'L' if side < 0 else 'R'}", (0.12, 0.04, 0.18), loc=(side * 0.73, 2.1, 0.75), material=m["tail"], parent=t, bevel=0.01)
    for y in (-2.2, 2.17):
        geo.box(f"JB_Truck_Bumper_{'F' if y < 0 else 'R'}", (1.86, 0.14, 0.15), loc=(0, y, 0.38), material=m["chrome"], parent=t, bevel=0.04)
    return t


def build_drifter(root, m, loc, rz):
    g = S.empty("JB_Drifter", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.2)
    for sx in (-1, 1):
        geo.box(f"JB_Drifter_Boot_{'L' if sx < 0 else 'R'}", (0.11, 0.26, 0.13), loc=(sx * 0.1, -0.04, 0), material=m["boots"], parent=g, bevel=0.04, seg=3)
        geo.cylinder(f"JB_Drifter_Leg_{'L' if sx < 0 else 'R'}", 0.075, 0.76, loc=(sx * 0.1, 0, 0.12), r_top=0.085, material=m["jeans"], parent=g, verts=14, bevel=0.01)
    geo.lathe("JB_Drifter_Hoodie", [(0, 0.82), (0.19, 0.82), (0.2, 0.9), (0.21, 1.2), (0.22, 1.36), (0.14, 1.45), (0.07, 1.47), (0, 1.47)],
              material=m["hoodie"], parent=g, segments=24, scale=(1.0, 0.72, 1.0))
    for sx in (-1, 1):                                        # arms down, hands in the pocket
        geo.curve_tube(f"JB_Drifter_Arm_{'L' if sx < 0 else 'R'}", [Vector((sx * 0.21, 0, 1.36)), Vector((sx * 0.27, -0.02, 1.12)), Vector((sx * 0.2, -0.13, 0.98)),
                       Vector((sx * 0.06, -0.15, 0.96))], 0.06, material=m["hoodie"], parent=g, ring=10, steps=5)
    geo.box("JB_Drifter_Pocket", (0.3, 0.04, 0.12), loc=(0, -0.155, 0.92), material=m["hoodie"], parent=g, bevel=0.02)
    geo.sphere("JB_Drifter_Head", 0.105, loc=(0, -0.01, 1.48), material=m["skin"], parent=g, segs=18)
    def hood(bm):
        vs = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.14)["verts"]
        bmesh.ops.delete(bm, geom=[v for v in vs if v.co.y < -0.06 and v.co.z > -0.08], context='VERTS')
        bmesh.ops.transform(bm, matrix=geo.mtx((0, 0.01, 1.585), (0, 0, 0), (1.0, 1.05, 1.15)), verts=bm.verts)
    geo.merged("JB_Drifter_Hood", hood, material=m["hoodie"], parent=g, bevel=0, uv="box", uv_scale=8)
    pack = geo.box("JB_Drifter_Backpack", (0.34, 0.2, 0.46), loc=(0, 0.2, 0.96), material=m["pack"], parent=g, bevel=0.06, seg=3)
    geo.box("JB_Drifter_Backpack_Pocket", (0.26, 0.08, 0.2), loc=(0, 0.11, 0.06), material=m["pack"], parent=pack, bevel=0.03, seg=2)
    for sx in (-1, 1):
        geo.curve_tube(f"JB_Drifter_Strap_{'L' if sx < 0 else 'R'}", [Vector((sx * 0.11, 0.14, 1.4)), Vector((sx * 0.12, -0.1, 1.38)), Vector((sx * 0.13, -0.12, 1.1)),
                       Vector((sx * 0.13, 0.1, 1.0))], 0.018, material=m["pack"], parent=g, ring=6, steps=4, flatten=0.4)
    return g


def build_sign(root, m, loc, rz):
    s = S.empty("JB_Sign", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.2)
    bw, bh, bt, zc = 1.3, 0.86, 0.04, 1.78
    for sx in (-1, 1):
        geo.box(f"JB_Sign_Post_{'L' if sx < 0 else 'R'}", (0.07, 0.07, 2.3), loc=(sx * (bw / 2 + 0.05), 0, 0), material=m["post"], parent=s, bevel=0.008)
        geo.cylinder(f"JB_Sign_Bolt_{'L' if sx < 0 else 'R'}", 0.022, 0.06, loc=(sx * (bw / 2 + 0.015), 0, zc), rot=(0, radians(90), 0), material=m["chrome"], parent=s, verts=10, bevel=0)
    board = S.empty("JB_Sign_Board", "PROPS", loc=(0, 0, zc), parent=s, size=0.2)      # flips about its X axis
    geo.box("JB_Sign_Panel", (bw, bt, bh), loc=(0, 0, -bh / 2), material=m["post"], parent=board, bevel=0.012)
    geo.box("JB_Sign_Front", (bw - 0.02, 0.003, bh - 0.02), loc=(0, -bt / 2 - 0.0015, -(bh - 0.02) / 2), material=m["sign_front"], parent=board, bevel=0,
            uv="fit", fit_axis=1)
    back = S.empty("JB_Sign_BackHolder", "PROPS", rot=(pi, 0, 0), parent=board, size=0.1)    # built upside down: reads right once flipped
    geo.box("JB_Sign_Back", (bw - 0.02, 0.003, bh - 0.02), loc=(0, -bt / 2 - 0.0015, -(bh - 0.02) / 2), material=m["sign_back"], parent=back, bevel=0,
            uv="fit", fit_axis=1)
    return s, board


def build_bottle(root, m, loc, rz):
    g = S.empty("JB_Bottle", "PROPS", loc=loc, rot=(0, 0, radians(rz)), parent=root, size=0.05)
    k = 1.75                                                  # bigger than life, as on the cover
    prof = [(0, 0), (0.07, 0), (0.08, 0.012), (0.082, 0.2), (0.072, 0.245), (0.04, 0.28), (0.032, 0.3), (0.032, 0.315), (0.028, 0.315),
            (0.028, 0.3), (0.036, 0.28), (0.068, 0.245), (0.078, 0.2), (0.076, 0.014), (0.06, 0.006), (0, 0.006)]
    geo.lathe("JB_Bottle_Glass", [(r * k, z * k) for r, z in prof], material=m["glass"], parent=g, segments=36)
    liq = S.empty("JB_Bottle_Liquid", "PROPS", loc=(0, 0, 0.008 * k), parent=g, size=0.03)          # sloshes on the website
    geo.lathe("JB_Bottle_Juice", [(0, 0), (0.074 * k, 0), (0.075 * k, 0.21 * k), (0.06 * k, 0.232 * k), (0, 0.232 * k)], material=m["juice"], parent=liq, segments=32)
    geo.lathe("JB_Bottle_Label", [(0.0835 * k, 0.05 * k), (0.0835 * k, 0.175 * k)], material=m["label"], parent=g, segments=48, loop=False)
    cap = geo.cylinder("JB_Bottle_Cap", 0.037 * k, 0.045 * k, loc=(0, 0, 0.3 * k), material=m["cap"], parent=g, verts=24, bevel=0.003)
    def ridges(bm):
        for a in range(24):
            t = a * 2 * pi / 24
            geo.add_box(bm, (0.004, 0.004, 0.04 * k), (cos(t) * 0.038 * k, sin(t) * 0.038 * k, 0.002), (0, 0, t))
    geo.merged("JB_Bottle_CapRidges", ridges, material=m["cap"], parent=cap, bevel=0)
    L = bpy.data.lights.new("LIGHT_JB_Juice", 'POINT')                                          # it glows
    L.energy, L.color, L.shadow_soft_size = 6, (1.0, 0.72, 0.15), 0.05
    lo = bpy.data.objects.new("LIGHT_JB_Juice", L)
    lo.location = Vector(loc) + Vector((0, -0.12, 0.18))
    S.coll("LIGHTS").objects.link(lo)
    return g


def build(root):
    m = materials()
    build_set(root, m)
    truck = build_truck(root, m, (-1.55, 0.35, 0), 192)           # side-on, nose toward the sunset, like the cover
    drifter = build_drifter(root, m, (-0.45, -0.55, 0), 160)
    sign, board = build_sign(root, m, (2.25, 0.75, 0), 12)
    bottle = build_bottle(root, m, (-0.35, -1.6, 0), 34)
    for obj, iid, label in [(bottle, "jb_bottle", "The Juice"), (sign, "jb_sign", "The Sign"), (truck, "jb_truck", "The Truck"), (drifter, "jb_drifter", "The Drifter")]:
        S.mark_interactive(obj, iid, label, scope="juicebox", kind="discovery")
    return dict(truck=truck)
