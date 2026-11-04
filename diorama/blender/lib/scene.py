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


def mark_interactive(obj, target_id, label, scope="home", kind="navigation"):
    """Tag an object as clickable. Tags export to glTF as node 'extras'.
    scope: which website exhibit uses the tag ("home" = desk homepage, "games" = Games page).
    kind: "navigation" (leads to a website section - always also reachable via normal links)
          or "discovery" (optional reward: animation, message, hidden detail).
    A click on any child mesh resolves to the nearest ancestor carrying an interactive_id.
    The object is also linked into INTERACTIVE_TARGETS for easy selection in Blender."""
    obj["interactive_id"] = target_id
    obj["interactive_label"] = label
    obj["interactive_scope"] = scope
    obj["interactive_kind"] = kind
    coll("INTERACTIVE_TARGETS").objects.link(obj)
