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
for (const f of ["interactions.json", "games.json"]) copy(path.join(DIORAMA, "data", f), pub("data", f));
const basis = path.join(APP, "node_modules", "three", "examples", "jsm", "libs", "basis");
for (const f of fs.readdirSync(basis)) copy(path.join(basis, f), pub("basis", f));
copy(path.join(DIORAMA, "renders", "phase3", "10_beauty_hero.png"), pub("fallback", "desk.png"));
copy(path.join(DIORAMA, "renders", "phase3", "09_asset_games_crate.png"), pub("fallback", "crate.png"));
console.log("assets prepared from diorama/exports + diorama/data");
