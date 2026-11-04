// Copy the exported GLBs + presets and the three.js KTX2 transcoder into public/ (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const EXPORTS = path.resolve(ROOT, "..", "exports");
const models = path.join(ROOT, "public", "models");
const basis = path.join(ROOT, "public", "basis");
fs.mkdirSync(models, { recursive: true });
fs.mkdirSync(basis, { recursive: true });
for (const f of fs.readdirSync(EXPORTS)) {
  if (/\.(glb|json)$/.test(f)) fs.copyFileSync(path.join(EXPORTS, f), path.join(models, f));
}
const tdir = path.join(ROOT, "node_modules", "three", "examples", "jsm", "libs", "basis");
for (const f of fs.readdirSync(tdir)) fs.copyFileSync(path.join(tdir, f), path.join(basis, f));
console.log("prepared:", fs.readdirSync(models).join(", "));
