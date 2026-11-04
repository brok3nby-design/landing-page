"""Cameras that automatically frame the whole model with fixed negative space."""
from math import radians, sin, cos
import bpy
from mathutils import Vector

from . import scene as S


def model_corners():
    pts = []
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        pts += [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return pts


def add_view(name, az, el, lens, fill, res):
    bpy.context.view_layer.update()
    pts = model_corners()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    target = (lo + hi) / 2

    a, e = radians(az), radians(el)
    back = Vector((sin(a) * cos(e), -cos(a) * cos(e), sin(e)))      # target -> camera
    fwd = -back
    up_world = Vector((0, 1, 0)) if el > 89 else Vector((0, 0, 1))
    right = fwd.cross(up_world).normalized()
    up = right.cross(fwd).normalized()

    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.sensor_fit = 'HORIZONTAL'
    cam_data.clip_end = 100
    tx = cam_data.sensor_width / (2 * lens)          # tan(half horizontal fov)
    ty = tx * res[1] / res[0]

    def spans(d):
        c = target + back * d
        xs, ys = [], []
        for p in pts:
            v = p - c
            z = v.dot(fwd)
            xs.append(v.dot(right) / z)
            ys.append(v.dot(up) / z)
        return xs, ys

    def fits(d):
        xs, ys = spans(d)
        return ((max(xs) - min(xs)) / 2 <= tx * fill) and ((max(ys) - min(ys)) / 2 <= ty * fill)

    lo_d, hi_d = 0.5, 200.0
    for _ in range(60):
        mid = (lo_d + hi_d) / 2
        lo_d, hi_d = (lo_d, mid) if fits(mid) else (mid, hi_d)
    d = hi_d
    xs, ys = spans(d)
    cam_data.shift_x = ((max(xs) + min(xs)) / 2) / (2 * tx)
    cam_data.shift_y = ((max(ys) + min(ys)) / 2) / (2 * tx)

    cam = bpy.data.objects.new(name, cam_data)
    cam.location = target + back * d
    cam.rotation_euler = fwd.to_track_quat('-Z', 'Y' if el <= 89 else 'Y').to_euler()
    if el > 89:
        cam.rotation_euler = (0, 0, 0)
    S.coll("CAMERAS").objects.link(cam)
    return cam


def add_closeup(name, target, az, el, lens, dist):
    a, e = radians(az), radians(el)
    back = Vector((sin(a) * cos(e), -cos(a) * cos(e), sin(e)))
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = Vector(target) + back * dist
    cam.rotation_euler = (-back).to_track_quat('-Z', 'Y').to_euler()
    S.coll("CAMERAS").objects.link(cam)
    return cam
