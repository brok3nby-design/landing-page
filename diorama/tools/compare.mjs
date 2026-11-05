// Side-by-side comparison sheets: Blender Phase 3 reference vs browser (Phase 4 preview).
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(HERE, "..", "renders");
const label = (t, w) => Buffer.from(`<svg width="${w}" height="44"><rect width="100%" height="100%" fill="#080808"/>
  <text x="16" y="29" font-family="monospace" font-size="22" fill="#e8e8e8">${t}</text></svg>`);
async function sheet(items, out, w = 800) {
  const h = Math.round(w * 9 / 16);
  const tiles = await Promise.all(items.map(async ([file, title]) => ({
    img: await sharp(file).resize(w, h).png().toBuffer(), lab: label(title, w) })));
  const comp = [];
  tiles.forEach((t, i) => { comp.push({ input: t.lab, left: i * w, top: 0 }, { input: t.img, left: i * w, top: 44 }); });
  await sharp({ create: { width: w * items.length, height: h + 44, channels: 3, background: "#080808" } })
    .composite(comp).png().toFile(path.join(R, "phase4", out));
  console.log("wrote", out);
}
await sheet([[path.join(R, "phase3", "10_beauty_hero.png"), "Blender Cycles - Phase 3 beauty"],
             [path.join(R, "phase4", "studio_desk_default.png"), "Browser (three.js) - Phase 4 GLB"]], "compare_blender_vs_browser.png");
await sheet([[path.join(R, "phase4", "compare_lighting_all.png"), "hybrid: baked AO+glow + runtime"],
             [path.join(R, "phase4", "compare_lighting_runtime_only.png"), "runtime lights only"],
             [path.join(R, "phase4", "compare_lighting_baked_only.png"), "baked only (no runtime lights)"]], "compare_lighting.png", 640);
await sheet([[path.join(R, "phase3", "09_asset_games_crate.png"), "Blender - standalone crate"],
             [path.join(R, "phase4", "games_collection_default.png"), "Browser - games_collection.glb"]], "compare_crate.png");
