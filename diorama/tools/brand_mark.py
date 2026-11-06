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


def icons(src=SRC, out_dir=OUT.parent):
    """Browser-tab and home-screen icons. These keep the artwork's own dark textured background, so the
    white B stays visible on light browser themes too; the square is cropped close to the letters."""
    img = Image.open(src).convert("RGB")
    a = np.asarray(img).astype(np.float32) / 255
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    m = lum > np.median(lum[:40, :40]) + 0.35                  # the bright letters
    xs, ys = np.where(m.sum(0) > 2)[0], np.where(m.sum(1) > 2)[0]
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    written = []
    for name, px, margin in (("favicon-48.png", 48, 1.06), ("apple-touch-icon.png", 180, 1.22), ("icon-512.png", 512, 1.22)):
        side = max(xs.max() - xs.min(), ys.max() - ys.min()) * margin
        side = min(side, img.width, img.height)
        x0 = int(round(min(max(cx - side / 2, 0), img.width - side)))
        y0 = int(round(min(max(cy - side / 2, 0), img.height - side)))
        sq = img.crop((x0, y0, x0 + int(side), y0 + int(side))).resize((px, px), Image.LANCZOS)
        sq.save(out_dir / name)
        written.append(out_dir / name)
    return written


if __name__ == "__main__":
    print(build())
    print(*icons(), sep="\n")
