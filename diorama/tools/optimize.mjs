// Optimise the raw Blender GLB exports for the web.
//
//   node optimize.mjs                 -> diorama/exports/{studio_desk,games_collection,studio_notebook}.glb
//   node optimize.mjs --webp          -> WebP textures instead of KTX2 (fallback / comparison)
//
// Steps: dedup + prune -> per-slot texture size policy -> KTX2 (UASTC + Zstandard: GPU-compressed,
// ~1 byte/pixel in video memory instead of 4) or WebP -> meshopt geometry compression.
// Quality first: UASTC (not the blotchier ETC1S) everywhere; sizes chosen per texture role.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, textureCompress, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import { ktx2 } from "ktx2-encoder/gltf-transform";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS = path.resolve(HERE, "..", "exports");
const ASSETS = process.argv.includes("--crate-only") ? ["games_collection"] : ["studio_desk", "games_collection", "studio_notebook"];
const WEBP = process.argv.includes("--webp");

// Max edge per texture role (sources are never upscaled). Hero surfaces keep 1024 normal maps.
const HERO = "planks_n|wood_desk_n|rug_n";
const POLICY = [
  { name: "hero normal maps", slots: /normalTexture/, pattern: new RegExp(`^(${HERO})`), size: 1024 },
  { name: "normal maps",      slots: /normalTexture/, pattern: new RegExp(`^(?!${HERO})`), size: 512 },
  { name: "roughness",        slots: /metallicRoughnessTexture/, size: 512 },
  { name: "baked AO / glow",  slots: /occlusionTexture|emissiveTexture/, size: 1024 },
  { name: "base colour",      slots: /baseColorTexture/, size: 1024 },
];

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

async function run(name) {
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder,
  });
  const src = path.join(EXPORTS, "raw", `${name}.glb`);
  const doc = await io.read(src);
  await doc.transform(dedup(), prune({ keepLeaves: true, keepExtras: true }));   // keep empty tagged nodes (EGG markers, pivots)

  // per-role resize (PNG intermediate keeps quality until the final encoder)
  for (const p of POLICY) {
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: "png", slots: p.slots,
                                          pattern: p.pattern || null, resize: [p.size, p.size] }));
  }

  if (WEBP) {
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: "webp", quality: 92 }));
  } else {
    const base = { isUASTC: true, generateMipmap: true, needSupercompression: true, enableDebug: false, imageDecoder };
    await doc.transform(ktx2({ ...base, isNormalMap: true, isPerceptual: false, slots: /normalTexture/ }));
    await doc.transform(ktx2({ ...base, isPerceptual: false, slots: /occlusionTexture|metallicRoughnessTexture/ }));
    await doc.transform(ktx2({ ...base, isPerceptual: true, slots: /baseColorTexture|emissiveTexture/ }));
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const out = path.join(EXPORTS, `${name}${WEBP ? "_webp" : ""}.glb`);
  await io.write(out, doc);
  const before = fs.statSync(src).size, after = fs.statSync(out).size;
  console.log(`${name}: ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB  (${path.basename(out)})`);
}

for (const a of ASSETS) {
  if (fs.existsSync(path.join(EXPORTS, "raw", `${a}.glb`))) await run(a);
}
