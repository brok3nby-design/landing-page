// Copy the web assets produced by the Blender pipeline into public/ (git-ignored; regenerated on
// every dev/build so the site always uses the latest exports and data).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIORAMA = path.resolve(APP, "..", "diorama");
const pub = (...p) => path.join(APP, "public", ...p);
const copy = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };

for (const f of ["studio_desk.glb", "games_collection.glb", "studio_notebook.glb", "views.json"])
  copy(path.join(DIORAMA, "exports", f), pub("models", f));
// every model needs its phone version (optimize.mjs --mobile -> <name>_m.glb): phones ask for it by name
for (const f of ["studio_desk_m.glb", "games_collection_m.glb", "studio_notebook_m.glb"])
  copy(path.join(DIORAMA, "exports", f), pub("models", f));
for (const f of fs.readdirSync(path.join(DIORAMA, "exports")).filter((f) => /^exhibit_[a-z_]+\.glb$/.test(f) && !f.endsWith("_m.glb")))
  if (!fs.existsSync(path.join(DIORAMA, "exports", f.replace(/\.glb$/, "_m.glb"))))
    throw new Error(`missing phone version of ${f}: run node diorama/tools/optimize.mjs --mobile --only=${f.slice(0, -4)}`);
// per-game exhibits (diorama/blender/build_exhibit.py -> exports/exhibit_<game>.glb) + their still renders
for (const f of fs.readdirSync(path.join(DIORAMA, "exports")).filter((f) => /^exhibit_[a-z_]+\.glb$/.test(f)))
  copy(path.join(DIORAMA, "exports", f), pub("models", f));
const EXR = path.join(DIORAMA, "renders", "exhibits");
if (fs.existsSync(EXR)) for (const g of fs.readdirSync(EXR)) {
  const hero = path.join(EXR, g, "hero.png");
  if (fs.existsSync(hero)) copy(hero, pub("fallback", `exhibit-${g}.png`));
}
for (const f of ["interactions.json", "games.json", "projects.json", "site_copy.json"]) copy(path.join(DIORAMA, "data", f), pub("data", f));
// media imported from the existing site (diorama/tools/import_site.py -> app/media, tracked in git)
const copyDir = (src, dst) => { for (const e of fs.readdirSync(src, { withFileTypes: true })) {
  const s = path.join(src, e.name), d = path.join(dst, e.name);
  if (e.isDirectory()) copyDir(s, d); else if (!fs.existsSync(d) || fs.statSync(d).mtimeMs < fs.statSync(s).mtimeMs) copy(s, d);
} };
copyDir(path.join(APP, "media"), pub("media"));
const basis = path.join(APP, "node_modules", "three", "examples", "jsm", "libs", "basis");
for (const f of fs.readdirSync(basis)) copy(path.join(basis, f), pub("basis", f));
copy(path.join(DIORAMA, "renders", "phase3", "10_beauty_hero.png"), pub("fallback", "desk.png"));
copy(path.join(DIORAMA, "renders", "phase3", "09_asset_games_crate.png"), pub("fallback", "crate.png"));
const nb = path.join(DIORAMA, "renders", "phase6", "notebook_fallback.png");
if (fs.existsSync(nb)) copy(nb, pub("fallback", "notebook.png"));
console.log("assets prepared from diorama/exports + diorama/data");
