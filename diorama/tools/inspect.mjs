// Inspect + validate GLB files: sizes, draw calls, triangles, textures, estimated GPU memory,
// glTF-Validator result, and every node tag (interactive / discovery / game slot / artwork slot).
//
//   node inspect.mjs                     -> writes diorama/exports/report.json and prints a summary
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import validator from "gltf-validator";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS = path.resolve(HERE, "..", "exports");
const FILES = [];
const EXHIBITS = fs.existsSync(path.join(EXPORTS, "raw")) ? fs.readdirSync(path.join(EXPORTS, "raw")).filter((f) => /^exhibit_.*\.glb$/.test(f)).map((f) => f.slice(0, -4)) : [];
for (const n of ["studio_desk", "games_collection", "studio_notebook", ...EXHIBITS]) {
  for (const v of [`raw/${n}.glb`, `${n}.glb`, `${n}_webp.glb`]) {
    if (fs.existsSync(path.join(EXPORTS, v))) FILES.push(v);
  }
}

function ktx2Size(buf) {          // KTX2 header: pixelWidth @20, pixelHeight @24
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return [dv.getUint32(20, true), dv.getUint32(24, true)];
}

async function inspect(rel) {
  await MeshoptDecoder.ready;
  const file = path.join(EXPORTS, rel);
  const bytes = fs.readFileSync(file);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(bytes));
  const root = doc.getRoot();
  let tris = 0, prims = 0;
  for (const mesh of root.listMeshes()) {
    const users = mesh.listParents().filter((p) => p.propertyType === "Node").length || 1;
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : p.getAttribute("POSITION").getCount();
      tris += (n / 3) * users;
      prims += users;
    }
  }
  let gpu = 0, texBytes = 0;
  const textures = [];
  for (const t of root.listTextures()) {
    const img = t.getImage();
    texBytes += img.byteLength;
    let w, h, bpp;
    if (t.getMimeType() === "image/ktx2") { [w, h] = ktx2Size(img); bpp = 1; }      // BC7/ASTC 4x4 = 1 B/px
    else { const m = await sharp(img).metadata(); w = m.width; h = m.height; bpp = 4; }
    gpu += w * h * bpp * 4 / 3;                                                       // + mip chain
    textures.push({ name: t.getName(), mime: t.getMimeType(), size: `${w}x${h}`, kb: Math.round(img.byteLength / 1024),
                    gpu_safe: w % 4 === 0 && h % 4 === 0 });
  }
  const tags = [];
  for (const node of root.listNodes()) {
    const e = node.getExtras() || {};
    const keys = Object.keys(e).filter((k) => /^(interactive_|egg_|game_slot|artwork_slot|asset_id|hinge_axis)/.test(k));
    if (keys.length) tags.push({ node: node.getName(), ...Object.fromEntries(keys.map((k) => [k, e[k]])) });
  }
  const val = await validator.validateBytes(new Uint8Array(bytes), {
    maxIssues: 50, externalResourceFunction: () => Promise.reject(new Error("external")) });
  return {
    file: rel, mb: +(bytes.length / 1e6).toFixed(2), nodes: root.listNodes().length, meshes: root.listMeshes().length,
    draw_calls: prims, triangles: Math.round(tris), materials: root.listMaterials().length,
    textures: textures.length, texture_mb_download: +(texBytes / 1e6).toFixed(2), gpu_texture_mb: +(gpu / 1048576).toFixed(1),
    validator: { errors: val.issues.numErrors, warnings: val.issues.numWarnings,
                 messages: val.issues.messages.filter((m) => m.severity <= 1).slice(0, 8).map((m) => `${m.code}: ${m.message}`) },
    tags, texture_list: textures,
    textures_not_multiple_of_4: textures.filter((t) => !t.gpu_safe).map((t) => `${t.name} ${t.size}`),
  };
}

const results = [];
for (const f of FILES) results.push(await inspect(f));
fs.writeFileSync(path.join(EXPORTS, "report.json"), JSON.stringify(results, null, 1));
console.log("file                              MB   draws  tris    mats tex  texDL MB  GPU MB  val(err/warn)  tags");
for (const r of results) {
  console.log(`${r.file.padEnd(32)} ${String(r.mb).padStart(5)} ${String(r.draw_calls).padStart(6)} ${String(r.triangles).padStart(7)} ` +
    `${String(r.materials).padStart(5)} ${String(r.textures).padStart(4)} ${String(r.texture_mb_download).padStart(8)} ` +
    `${String(r.gpu_texture_mb).padStart(7)}   ${r.validator.errors}/${r.validator.warnings}        ${r.tags.length}`);
  for (const m of r.validator.messages) console.log("    ", m);
  if (r.textures_not_multiple_of_4.length && !r.file.startsWith("raw/"))
    console.log("     !! not GPU-block-safe (needs multiple-of-4 size):", r.textures_not_multiple_of_4.join(", "));
}
