"""Artwork slots: replace any printed surface with your own image.

Drop an image into diorama/custom/ named after a slot (e.g. `mug_wrap.png`, `screen_left.jpg`).
On the next build it replaces the code-painted default. Delete it to get the default back.
Your files are only read, never changed. Images larger than MAX_SIZE are scaled down for the
web budget. Game cover labels can also be set per game in data/games.json ("label_texture").

Run `build.py --templates` (or just build: missing templates are created) to get a guide image
per slot in diorama/custom/templates/.
"""
import hashlib
import json
import os
import numpy as np
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
DIORAMA = os.path.abspath(os.path.join(HERE, "..", ".."))
CUSTOM = os.path.join(DIORAMA, "custom")
TEMPLATES = os.path.join(CUSTOM, "templates")
GAMES_JSON = os.path.join(DIORAMA, "data", "games.json")
EXTS = (".png", ".jpg", ".jpeg", ".webp", ".tga", ".bmp", ".tif", ".tiff")
MAX_SIZE = 2048

# slot -> texture it replaces. `part` = index inside a composite texture (book spine atlas).
# size = recommended pixels (w, h); the shape (aspect) matters more than the exact size.
SLOTS = [
    dict(slot="screen_left", tex="screen_left", size=(1920, 1080),
         where="Left monitor screen (glows like a real display)", note="Whole image visible, 16:9."),
    dict(slot="screen_right", tex="screen_right", size=(1920, 1080),
         where="Right monitor screen", note="Whole image visible, 16:9."),
    dict(slot="mug_wrap", tex="mug", size=(1800, 620),
         where="Coffee mug on the desk (wraps all the way round)",
         note="Centre of the image (75% across) faces the viewer; the handle sits at the left/right edges."),
    dict(slot="mug_figure", tex="mug_boss", size=(900, 310),
         where="Tiny mug held by collectible figure B",
         note="Same layout as mug_wrap. Very small on screen: use big bold shapes/text."),
    dict(slot="deskmat", tex="deskmat", size=(2400, 900), where="Desk mat under keyboard and mouse",
         note="Whole image visible; keyboard covers the left-centre, mouse the centre-right."),
    dict(slot="rug", tex="rug", size=(1800, 1100), where="Rug on the platform floor",
         note="Whole image visible; the chair covers part of the left half."),
    dict(slot="blanket", tex="plaid", size=(700, 1500), where="Blanket draped over the chair",
         note="Draped, so it folds: patterns read better than pictures."),
    dict(slot="sketchbook", tex="sketchbook", size=(2000, 1400), where="Open sketchbook pages on the desk",
         note="Left half = left page, right half = right page; centre is the binding."),
    dict(slot="crate_print", tex="crate", size=(1380, 600), where="Front (and back) of the games crate",
         note="Whole image visible; keep important art away from the edges."),
    dict(slot="business_card", tex="business_card", size=(1050, 600), where="Business cards in the holder (Contact)",
         note="Standard card shape (3.5 x 2 in). Front only."),
] + [
    dict(slot=f"book_spine_{i + 1}", tex="spines", part=i, size=(128, 768),
         where=f"Spine of book {i + 1} on the upper shelf (left to right; 6 = leaning book)",
         note="Tall and thin. Covers use the colour at 45% height of the image.")
    for i in range(6)
] + [
    dict(slot=f"gamebox_label_{i}", tex=f"gamebox_label_{i}", size=(640, 112),
         where=f"Title spine of game box {i + 1} on the upper shelf (bottom to top: The Maze, Macabre Dolls, Juicebox)",
         note="Long and thin, like a box spine.")
    for i in range(3)
] + [
    dict(slot=f"game_label_{s:02d}", tex=f"game_label_{s:02d}", size=(1000, 930),
         where=f"Cover label of game case {s} in the games crate (GAME_Case_{s:02d})",
         note="Or set label_texture for that slot in data/games.json.")
    for s in range(1, 6)
]


# objects that display each slot (tagged as `artwork_slot` -> glTF extras, so the website can
# swap images at runtime without re-exporting the model)
OBJECTS = {
    "MON_L_Screen": "screen_left", "MON_R_Screen": "screen_right", "PROP_DeskMat": "deskmat",
    "BASE_Rug": "rug", "CHAIR_Blanket": "blanket", "NOTE_Page_L_Sheet": "sketchbook",
    "NOTE_Page_R_Sheet": "sketchbook",
    "NAV_GamesCrate_Body": "crate_print", "PROP_Book_Leaning": "book_spine_6",
    **{f"PROP_Book_{i}": f"book_spine_{i + 1}" for i in range(5)},
}


def tag_objects():
    for name, slot in OBJECTS.items():
        o = bpy.data.objects.get(name)
        if o:
            o["artwork_slot"] = slot


def _find(slot):
    for ext in EXTS:
        p = os.path.join(CUSTOM, slot + ext)
        if os.path.exists(p):
            return p
    return None


def _games_label(slot_name):
    if not slot_name.startswith("game_label_") or not os.path.exists(GAMES_JSON):
        return None
    n = int(slot_name[-2:])
    for g in json.load(open(GAMES_JSON)).get("games", []):
        if g.get("slot") == n and g.get("label_texture"):
            p = os.path.join(CUSTOM, g["label_texture"])
            return p if os.path.exists(p) else None
    return None


def custom_path(slot_name):
    return _games_label(slot_name) or _find(slot_name)


def overrides_for(tex):
    """{slot: path} of custom images that affect texture `tex`."""
    return {s["slot"]: custom_path(s["slot"]) for s in SLOTS
            if s["tex"] == tex and custom_path(s["slot"])}


def whole_override(tex):
    for s in SLOTS:
        if s["tex"] == tex and "part" not in s and custom_path(s["slot"]):
            return custom_path(s["slot"])
    return None


def part_overrides(tex):
    return {s["part"]: custom_path(s["slot"]) for s in SLOTS
            if s["tex"] == tex and "part" in s and custom_path(s["slot"])}


def signature(tex):
    """Changes whenever a relevant custom file is added, removed or edited."""
    ov = overrides_for(tex)
    if not ov:
        return "default"
    h = hashlib.sha1()
    for slot, p in sorted(ov.items()):
        h.update(slot.encode())
        h.update(open(p, "rb").read())
    return "custom:" + h.hexdigest()[:16]


def is_custom(tex):
    return bool(overrides_for(tex))


def load_rgba(path, size=None, max_size=MAX_SIZE):
    """Load any image Blender can read -> float RGBA array, row 0 = top."""
    img = bpy.data.images.load(path)
    w, h = img.size
    if size:
        img.scale(*size)
    elif max(w, h) > max_size:
        k = max_size / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
    w, h = img.size
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    if arr.shape[2] == 4 and arr[..., 3].min() < 1.0:      # flatten transparency onto white
        a = arr[..., 3:4]
        arr[..., :3] = arr[..., :3] * a + (1 - a)
        arr[..., 3] = 1
    return arr


# ------------------------------------------------------------------ templates
def write_templates(force=False):
    from .textures import Canvas, rgb
    os.makedirs(TEMPLATES, exist_ok=True)
    for s in SLOTS:
        path = os.path.join(TEMPLATES, s["slot"] + "_template.png")
        if os.path.exists(path) and not force:
            continue
        w, h = s["size"]
        k = min(1.0, 900 / max(w, h))
        W, H = max(int(w * k), 64), max(int(h * k), 64)
        c = Canvas(W, H, rgb("#2a2a2e"))
        grid = rgb("#3a3a40")
        for x in range(0, W, max(W // 10, 8)):
            c.rect(x, 0, x + 1, H, grid)
        for y in range(0, H, max(H // 10, 8)):
            c.rect(0, y, W, y + 1, grid)
        red, white = rgb("#c0262d"), rgb("#e8e8e8")
        c.rect(0, 0, W, 3, red); c.rect(0, H - 3, W, H, red); c.rect(0, 0, 3, H, red); c.rect(W - 3, 0, W, H, red)
        if s["slot"].startswith("mug"):
            c.rect(W * 0.75 - 2, 0, W * 0.75 + 2, H, white)                    # faces viewer
            c.rect(W * 0.58, H * 0.15, W * 0.92, H * 0.85, white, 0.12)         # best-visible zone
            c.rect(0, 0, W * 0.06, H, red, 0.35); c.rect(W * 0.94, 0, W, H, red, 0.35)  # handle
        if s["slot"] == "sketchbook":
            c.rect(W / 2 - 3, 0, W / 2 + 3, H, red)
        if s["slot"].startswith("screen"):
            c.rect(W * 0.05, H * 0.05, W * 0.95, H * 0.95, white, 0.08)
        img = c.save("TEMPLATE_" + s["slot"], path=path)
        bpy.data.images.remove(img)


def readme_table():
    rows = ["| Slot file name | Recommended size (px) | Where it appears | Tips |", "|---|---|---|---|"]
    for s in SLOTS:
        rows.append(f"| `{s['slot']}.png` | {s['size'][0]} × {s['size'][1]} | {s['where']} | {s['note']} |")
    return "\n".join(rows)
