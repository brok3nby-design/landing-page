"""Scene setup: empty factory scene, collections, root hierarchy."""
import bpy

COLLECTIONS = ["BASE", "DESK", "CHAIR", "MONITORS", "SHELVES", "LIGHTS",
               "PROPS", "COLLECTIBLES", "INTERACTIVE_TARGETS", "CAMERAS"]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'METERS'
    for name in COLLECTIONS:
        coll = bpy.data.collections.new(name)
        scene.collection.children.link(coll)
    return scene


def coll(name):
    return bpy.data.collections[name]


def empty(name, collection, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, size=0.1):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = size
    obj.location = loc
    obj.rotation_euler = rot
    if parent:
        obj.parent = parent
    coll(collection).objects.link(obj)
    return obj


def mark_interactive(obj, target_id, label):
    """Tag an object as clickable. The tag is exported to glTF as 'extras'.
    The object is also linked into INTERACTIVE_TARGETS for easy selection."""
    obj["interactive_id"] = target_id
    obj["interactive_label"] = label
    coll("INTERACTIVE_TARGETS").objects.link(obj)
