"""Phase 10: import the real content of the existing website into the new site.

    python3 diorama/tools/import_site.py /path/to/brok3nby-design.github.io

Reads the old site's files (read-only) and writes:
  diorama/data/projects.json   project catalogue (from studio-data.js) + each project page's copy
  diorama/data/site_copy.json  copy of the other pages (home, about, essay, follow, press, wrfm, ...)
  app/media/...                the images / videos / audio the new site uses (images re-encoded
                               as WebP, max 1600 px; nothing from teasers/ is ever copied)
Text is copied verbatim; every block records the file it came from. Run it again to refresh.
"""
import json
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1]).resolve()
REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "diorama" / "data"
MEDIA = REPO / "app" / "media"

# ---------------------------------------------------------------- html -> ordered text blocks
BLOCK = ("h1", "h2", "h3", "h4", "p", "li", "blockquote", "figcaption", "dt", "dd", "td", "time", "summary")
UI_NOISE = {"Skip to content", "™", "Shelf", "About", "Follow", "Passport", "Follow on X", "↗", "×", "❮", "❯", "◔",
            "INDEPENDENT GAME STUDIO", "Independently created by Brok3n by Design.", "@brok3nbydesign on X",
            "© 2026 Brok3n by Design™. All rights reserved.", "Studio Passport", "Effects & sound", "Press kit",
            "Studio entrance", "♫ Play music", "Music volume", "Choose how to", "follow development", "·", "."}


SKIP = ("script", "style", "svg", "noscript", "nav", "footer", "header", "form", "button", "label", "select")


class Blocks(HTMLParser):
    def __init__(self, skip=SKIP):
        super().__init__()
        self.out, self.stack, self.buf, self.skip, self.skip_tags = [], [], "", 0, skip

    def flush(self):
        t = re.sub(r"\s+", " ", self.buf).strip()
        self.buf = ""
        if not t:
            return
        tag = next((x for x in reversed(self.stack) if x in BLOCK), "text")
        self.out.append((tag, t))

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.skip += 1
        if tag in BLOCK or tag in ("br", "div", "section", "article", "ul", "ol"):
            self.flush()
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.buf = ""
            self.skip = max(0, self.skip - 1)
        self.flush()
        while self.stack:
            if self.stack.pop() == tag:
                break

    def handle_data(self, data):
        if not self.skip:
            self.buf += data


def blocks(name, skip=SKIP):
    p = Blocks(skip)
    p.feed((SRC / name).read_text(encoding="utf-8", errors="replace"))
    p.flush()
    out = []
    for tag, t in p.out:
        if t in UI_NOISE or t.startswith("Your browser does not support") or t.startswith("Your browser can"):
            continue
        out.append((tag, t))
    # drop the progress-report widget (its numbers come from studio-data.js instead)
    clean, skipping = [], False
    for tag, t in out:
        if t == "Progress" or t == "Progress report":
            skipping = True
        if not skipping:
            clean.append((tag, t))
        if skipping and t.startswith("Estimates may change"):
            skipping = False
    return clean


def sections(bl, source, stop=()):
    """Group blocks under their h2 headings: [{heading, items:[{type,text}]}]; text before the first h2 is 'intro'."""
    out, cur = [], {"heading": None, "items": []}
    for tag, t in bl:
        if tag == "h2":
            if cur["items"] or cur["heading"]:
                out.append(cur)
            cur = {"heading": t, "items": []}
        elif tag == "h1":
            continue
        else:
            if any(t.startswith(s) for s in stop):
                break
            cur["items"].append({"type": tag if tag in ("h3", "h4", "li", "blockquote") else "p", "text": t})
    if cur["items"] or cur["heading"]:
        out.append(cur)
    return {"source": source, "sections": out}


# ---------------------------------------------------------------- media
def media(rel, sub, max_edge=1600, quality=82):
    """Copy one file from the old site into app/media/<sub>/ (images -> WebP). Returns the site path."""
    src = SRC / rel
    if not src.exists() or "teasers/" in rel:
        return None
    dst_dir = MEDIA / sub
    dst_dir.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        dst = dst_dir / (src.stem + ".webp")
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            im = Image.open(src)
            im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
            im.thumbnail((max_edge, max_edge), Image.LANCZOS)
            im.save(dst, "WEBP", quality=quality, method=6)
    else:
        dst = dst_dir / src.name
        if not dst.exists():
            shutil.copyfile(src, dst)
    return f"media/{sub}/{dst.name}"


def catalogue():
    js = (SRC / "studio-data.js").read_text(encoding="utf-8")
    node = ("const fs=require('fs');const vm=require('vm');const ctx={};ctx.globalThis=ctx;"
            "vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),ctx);"
            "process.stdout.write(JSON.stringify(ctx.B3DProjects));")
    out = subprocess.run(["node", "-e", node, str(SRC / "studio-data.js")], capture_output=True, text=True, check=True)
    assert "progressReports" in js
    return json.loads(out.stdout)


GALLERY = {   # which of the page's images are the gallery (from the old pages / their gallery scripts)
    "glass-and-fortune": [f"images/dice/glass-0{i}.png" for i in range(1, 8)],
    "bid-and-buried": [f"images/locker/buried-0{i}.jpg" for i in range(1, 5)],
    "speck": [f"images/speck/speck_{i:02d}.png" for i in (1, 2, 3, 4, 5, 6, 8, 9, 10)],
    "pocket-wilds": [f"images/pocket-wilds-{i}.{'png' if i <= 10 else 'jpg'}" for i in range(1, 26)],
    "doqi": sorted(str(p.relative_to(SRC)) for p in (SRC / "images/doqi").glob("doqi_*")),
    "wrfm": [f"images/wrfm/wrfm_0{i}.{e}" for i, e in [(1, "jpg"), (2, "jpg"), (3, "png"), (4, "png"), (5, "png"), (6, "png"), (7, "jpg")]],
    "macabre-dolls": sorted((str(p.relative_to(SRC)) for p in (SRC / "images/dolls").glob("creepy-dolls_*")),
                            key=lambda s: int(re.search(r"_(\d+)", s).group(1))),
    "graffiti": ["images/graffiti/graffiti.webp"],
}
LOGO = {"bid-and-buried": "images/locker/buried-05.png", "speck": "images/speck/logo.png",
        "under-the-radar": "images/radar/Under_Radar_logo.png", "wrfm": "images/wrfm/wrfm_keyart.jpg",
        "pocket-wilds": "images/title/title_main.jpg"}
TRAILER = {"bid-and-buried": {"type": "youtube", "id": "txFCiU7ykMw"},
           "speck": {"type": "video", "file": "videos/Speck_Trailer_01b.mp4"},
           "pocket-wilds": {"type": "video", "file": "videos/PW_Trailer.mp4", "poster": "images/title/title_main.jpg"}}
LIVE = {"wrfm": "https://brok3nby-design.github.io/wrfm/",
        "graffiti": "https://brok3n-graffiti.ragsdalejeremy818.workers.dev/?draw=1"}   # links already used by the old site


def project_copy(pid):
    page = f"{pid}.html"
    bl = blocks(page)
    lines = [t for tag, t in bl if tag != "h1"]
    genres = next((t for t in lines if " • " in t), None)
    kicker = next((t for t in lines if t.isupper() and len(t) < 48 and " • " not in t), None)
    # lead = the last full sentence of the hero (everything before the first h2); skip calls to try
    # the (removed) teasers
    lead = None
    for tag, t in bl:
        if tag == "h2":
            break
        if tag != "h1" and len(t) >= 40 and " • " not in t and not t.startswith(("Try ", "Estimates", "Private development.")):
            lead = t
    secs = sections(bl, page, stop=("Choose how to",))["sections"]
    skip = ("Trailer", "Gallery", "Screenshots", "Community & Feedback", "Meet the Station", "Listen to WRFM right here",
            "More From the Tape")
    keep = [s for s in secs if s["heading"] and s["heading"] not in skip]
    for s in keep:
        s["items"] = [i for i in s["items"] if not i["text"].startswith("<")]
    return {"source": page, "kicker": kicker, "genres": genres, "lead": lead, "sections": keep}


def wrfm_clips():
    """The five 'Meet the Station' clips: title, quote, blurb, transcript lines, audio files."""
    files = {"host": ["01-vera-signs-on.ogg"], "sponsor": ["02-rubber-duck-rental.ogg"],
             "caller": ["03-after-hours-intake-one-value.ogg"], "regular": ["04-mitch-from-it.ogg"],
             "secret": ["05a-vera-phone-tease.ogg", "05b-vera-picks-up.ogg", "05c-studio-b.ogg"]}
    bl = [t for _, t in blocks("wrfm.html")]
    titles = ["Vera Lang signs on", "Rubber Duck Rental", "After Hours Intake", "Mitch from IT", "The phone nobody tells you about"]
    out = []
    for key, title in zip(files, titles):
        i = bl.index(title)
        quote, blurb = bl[i + 1], bl[i + 2]
        j = bl.index("Transcript", i) + 1
        k = next(n for n in range(j, len(bl)) if re.fullmatch(r"\d+:\d\d", bl[n]))   # the clip length ends it
        out.append({"id": key, "title": title, "quote": quote, "blurb": blurb, "transcript": bl[j:k],
                    "audio": [media(f"audio/wrfm/{f}", "wrfm/audio") for f in files[key]]})
    return out


def changelog():
    bl = blocks("pocket-wilds-changelog.html", skip=tuple(t for t in SKIP if t != "header"))
    out, cur = [], None
    for tag, t in bl:
        if tag == "h2" and t.startswith("BUILD"):
            cur = {"build": t, "items": []}
            out.append(cur)
        elif cur and tag == "time":
            cur["date"] = t
        elif cur and tag in ("li", "p", "h3"):
            cur["items"].append(t)
    return {"source": "pocket-wilds-changelog.html", "builds": out}


def main():
    cat = catalogue()
    js = (SRC / "studio-data.js").read_text(encoding="utf-8")
    projects = []
    for p in cat:
        pid = p["id"]
        cover = media(f"images/studio/cover/{pid}.webp", f"projects/{pid}", max_edge=1536, quality=86)
        entry = {
            "id": pid, "title": p["title"], "category": p["category"], "status": p["status"], "hook": p["hook"],
            "description": p["description"], "accent": p["accent"], "secret": bool(p.get("secret")),
            "completed": bool(p.get("completed")), "progress": p.get("progress"),
            "cover": cover, "logo": media(LOGO[pid], f"projects/{pid}") if pid in LOGO else None,
            "gallery": [g for g in (media(r, f"projects/{pid}/gallery") for r in GALLERY.get(pid, [])) if g],
            "trailer": None, "live_url": LIVE.get(pid), "old_url": f"/{pid}.html",
            "page": project_copy(pid),
        }
        tr = TRAILER.get(pid)
        if tr:
            entry["trailer"] = dict(tr)
            if "file" in tr:
                entry["trailer"]["file"] = media(tr["file"], f"projects/{pid}")
            if "poster" in tr:
                entry["trailer"]["poster"] = media(tr["poster"], f"projects/{pid}")
        projects.append(entry)
    # progress reports live in a separate object in studio-data.js; the node eval above applied them
    assert all("progress" in p for p in projects), "progress missing"
    DATA.joinpath("projects.json").write_text(json.dumps({
        "_note": "Imported from the existing site by diorama/tools/import_site.py (studio-data.js + each project "
                 "page). Text is verbatim; edit the old site or this file, then re-run the importer. 'progress."
                 "remaining' is the old site's 'content remaining' (not overall completion).",
        "source_commit": subprocess.run(["git", "-C", str(SRC), "rev-parse", "--short", "HEAD"],
                                        capture_output=True, text=True).stdout.strip(),
        "projects": projects}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    copy = {
        "home": sections(blocks("home.html"), "home.html"),
        "about": sections(blocks("about.html"), "about.html"),
        "built_by_design": sections(blocks("built-by-design.html"), "built-by-design.html"),
        "follow": sections(blocks("follow-development.html"), "follow-development.html"),
        "subscribed": sections(blocks("subscribed.html"), "subscribed.html"),
        "press": sections(blocks("press-kit.html"), "press-kit.html"),
        "passport": sections(blocks("passport.html"), "passport.html"),
        "settings": sections(blocks("settings.html"), "settings.html"),
        "entrance": sections(blocks("index.html"), "index.html"),
        "wrfm_clips": wrfm_clips(),
        "pocket_wilds_log": changelog(),
        "facts": (SRC / "press/studio-facts.txt").read_text(encoding="utf-8"),
        "links": {"email": "brok3nbydesign@pm.me", "x": "https://x.com/brok3nbydesign",
                  "youtube": "https://www.youtube.com/@Brok3n-j8j", "brand_film": "https://youtu.be/zhIMgJ5sl7Q",
                  "brand_film_id": "zhIMgJ5sl7Q", "brand_film_x": "https://x.com/brok3nbydesign/status/2108530273004421284",
                  "newsletter_action": "https://buttondown.com/api/emails/embed-subscribe/brok3nbydesign",
                  "wrfm_live": LIVE["wrfm"], "graffiti_wall": LIVE["graffiti"]},
        "brand": {"wordmark": media("images/studio/b3d-web.webp", "studio", max_edge=1040),
                  "logo_png": media("images/studio/b3d.png", "studio", max_edge=2006),
                  "mark_svg": media("images/studio/studio-mark.svg", "studio"),
                  "thumb": media("images/studio/x-logo2.png", "studio"),
                  "wrfm_keyart": media("images/wrfm/wrfm_keyart.jpg", "wrfm")},
        "sounds": {"music_mp3": media("sounds/site_music_1.mp3", "sounds"), "music_ogg": media("sounds/site_music_1.ogg", "sounds"),
                   "cartridge": media("sounds/cartridge.mp3", "sounds")},
    }
    DATA.joinpath("site_copy.json").write_text(json.dumps(copy, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    size = sum(f.stat().st_size for f in MEDIA.rglob("*") if f.is_file())
    print(f"{len(projects)} projects, media {size / 1e6:.1f} MB in {MEDIA.relative_to(REPO)}")


if __name__ == "__main__":
    main()
