"""Phase 7: Blender (Cycles) reference vs browser comparison sheets + simple luminance statistics.

    python3 diorama/tools/visual_compare.py [suffix]
Reads diorama/renders/phase7/browser_<name><suffix>.png (from app/scripts/visual-compare.mjs).
Prints mean luminance of the model and of three bands (top / middle / bottom) so lighting changes can
be judged by numbers as well as by eye. Writes compare_<name><suffix>.png.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

R = Path(__file__).resolve().parents[1] / "renders"
OUT = R / "phase7"
SUF = sys.argv[1] if len(sys.argv) > 1 else ""
PAIRS = {"desk": R / "phase3" / "10_beauty_hero.png", "crate": R / "phase3" / "09_asset_games_crate.png"}
W, H = 960, 540


def load(p):
    return np.asarray(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS), dtype=np.float32) / 255


def stats(a):
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mask = lum > 0.06                                  # the model (background is ~0.03)
    out = {"model": lum[mask].mean() if mask.any() else 0, "coverage": mask.mean()}
    ys = np.nonzero(mask.any(1))[0]
    if len(ys):
        y0, y1 = ys[0], ys[-1]
        for i, band in enumerate(("top", "mid", "bottom")):
            a0 = y0 + (y1 - y0) * i // 3
            a1 = y0 + (y1 - y0) * (i + 1) // 3
            m = mask[a0:a1]
            out[band] = lum[a0:a1][m].mean() if m.any() else 0
    sat = a.max(2) - a.min(2)
    out["saturation"] = sat[mask].mean() if mask.any() else 0
    return out


for name, ref in PAIRS.items():
    b = OUT / f"browser_{name}{SUF}.png"
    if not b.exists():
        continue
    A, B = load(ref), load(b)
    sa, sb = stats(A), stats(B)
    print(f"{name:6s}  " + "  ".join(f"{k} {sa[k]:.3f}->{sb.get(k, 0):.3f}" for k in sa))
    sheet = Image.new("RGB", (W * 2, H + 40), (8, 8, 8))
    sheet.paste(Image.fromarray((A * 255).astype(np.uint8)), (0, 40))
    sheet.paste(Image.fromarray((B * 255).astype(np.uint8)), (W, 40))
    d = ImageDraw.Draw(sheet)
    d.text((14, 12), "Blender Cycles reference", fill=(230, 230, 230))
    d.text((W + 14, 12), f"Browser (three.js) {SUF}", fill=(230, 230, 230))
    sheet.save(OUT / f"compare_{name}{SUF}.png")
