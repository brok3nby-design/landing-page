"""Footer B3 mark: diorama/custom/branding/b3-mark.jpg (the studio's cracked B3, supplied 2026-11-05)
-> app/media/studio/b3-mark-2.webp with the dark textured background keyed out (letters, cracks and
splatter kept) and cropped to the artwork. Run: python3 diorama/tools/brand_mark.py"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "diorama" / "custom" / "branding" / "b3-mark.jpg"
OUT = ROOT / "app" / "media" / "studio" / "b3-mark-2.webp"


def build(src=SRC, out=OUT):
    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    red = np.clip(r - np.maximum(g, b), 0, 1)                  # the red 3 and the blood splatter
    bg = np.median(lum[:40, :40])                              # the dark background, sampled in a corner
    alpha = np.maximum(np.clip((lum - (bg + 0.10)) / 0.22, 0, 1), np.clip((red - 0.10) / 0.18, 0, 1))
    img = Image.fromarray((np.dstack([a, alpha]) * 255).astype(np.uint8), "RGBA")
    m = np.asarray(img)[..., 3] > 120
    xs, ys = np.where(m.sum(0) > 2)[0], np.where(m.sum(1) > 2)[0]
    pad = 8
    img = img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad), min(img.height, ys.max() + pad)))
    img.save(out, "WEBP", quality=92)
    return out


if __name__ == "__main__":
    print(build())
