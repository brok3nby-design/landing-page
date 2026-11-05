"""Blender-only image post-processing for presentation renders (not part of the web asset).

bloom(): soft glow around bright pixels (LED strips, lamp, screens) - the "miniature photo"
halation. Implemented in numpy on the rendered PNG so it is deterministic and independent of
Blender's compositor API. The website will use its own real-time bloom pass instead.
"""
import numpy as np

from .artwork import load_rgba
from .textures import Canvas, _blur


def bloom(src, dst, threshold=0.72, strength=0.55, radii=(4, 14, 40), vignette=0.0):
    img = load_rgba(src, max_size=10000)
    rgb = img[..., :3]
    lum = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    mask = np.clip((lum - threshold) / (1 - threshold), 0, 1)[..., None]
    bright = rgb * mask
    glow = np.zeros_like(rgb)
    for i, r in enumerate(radii):
        w = 1.0 / (i + 1)
        for ch in range(3):
            glow[..., ch] += _blur(bright[..., ch], r) * w
    out = rgb + glow * strength
    out = np.clip(out, 0, 1)
    if vignette:
        h, w_ = lum.shape
        yy, xx = np.mgrid[0:h, 0:w_]
        d = np.sqrt(((xx - w_ / 2) / (w_ / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
        out *= (1 - vignette * np.clip(d - 0.55, 0, 1))[..., None]
    c = Canvas(1, 1)
    c.a = np.concatenate([out, np.ones_like(out[..., :1])], -1).astype(np.float32)
    c.h, c.w = out.shape[:2]
    return c.save("POST_beauty", path=dst)
