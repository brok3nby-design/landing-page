"""LIGHTS: simple blockout lighting (proper amber/purple lighting design is Phase 3)."""
from math import radians
import bpy
from mathutils import Vector
from lib import scene as S


def _area(name, loc, target, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    S.coll("LIGHTS").objects.link(obj)
    return obj


def build(root):
    _area("LIGHT_Key", (-2.5, -3.0, 4.0), (0, 0.2, 0.5), 550, 2.5, (1.0, 0.92, 0.82))
    _area("LIGHT_Fill", (3.5, -2.0, 2.0), (0, 0.2, 0.5), 250, 3.0, (0.85, 0.85, 1.0))
    _area("LIGHT_Rim", (1.5, 3.5, 3.0), (0, 0.3, 0.6), 400, 2.0, (0.75, 0.6, 1.0))
    lamp = bpy.data.lights.new("LIGHT_DeskLamp", 'POINT')
    lamp.energy = 15
    lamp.color = (1.0, 0.6, 0.25)
    lamp.shadow_soft_size = 0.03
    obj = bpy.data.objects.new("LIGHT_DeskLamp", lamp)
    obj.location = (-0.615, 0.71, 1.065)   # at the filament (glass casts no shadow)
    S.coll("LIGHTS").objects.link(obj)
