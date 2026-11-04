// Headless browser verification for the Phase 4 preview: screenshots from several angles, lighting
// comparisons, click-picking and runtime artwork swap. Writes diorama/renders/phase4/*.png + results.json.
// WebGL runs in software here (SwiftShader): good for correctness/appearance, NOT for FPS numbers.
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Playwright is pre-installed globally in this environment; fall back to a local install elsewhere.
let chromium;
try { ({ chromium } = await import("playwright")); }
catch {
  const g = execSync("npm root -g").toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(g, "playwright", "index.mjs")).href));
}
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "..", "dist");
const OUT = path.resolve(HERE, "..", "..", "renders", "phase4");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary",
                ".wasm": "application/wasm", ".css": "text/css", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4174, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("[browser]", m.text()); });
const results = { note: "Software WebGL (SwiftShader) - FPS here is not representative of a real GPU.", models: {} };

async function open(model, variant = "") {
  await page.goto(`http://127.0.0.1:4174/index.html?shot=1&model=${model}&variant=${variant}`);
  await page.waitForFunction(() => window.viewer && window.viewer.ready, null, { timeout: 240000 });
  await page.evaluate(() => window.viewer.capture());   // warm-up frame (shader compile)
}
async function settle() { await page.waitForTimeout(300); }
async function shot(file) {
  const url = await page.evaluate(() => window.viewer.capture());
  fs.writeFileSync(path.join(OUT, file), Buffer.from(url.split(",")[1], "base64"));
  console.log("shot", file, JSON.stringify(await page.evaluate(() => window.viewer.stats)));
}

const VIEWS = {
  studio_desk: [["default", null], ["back", [200, 24, 1]], ["side", [95, 18, 1]], ["under", null]],
  games_collection: [["default", null], ["back", [205, 28, 1]], ["side", [95, 20, 1]], ["under", [20, -35, 1, { under: true }]]],
  studio_notebook: [["default", null], ["back", [200, 30, 1]], ["side", [95, 12, 1]], ["under", [20, -30, 1, { under: true }]]],
};

for (const model of Object.keys(VIEWS)) {
  await open(model);
  const r = { stats: await page.evaluate(() => window.viewer.stats) };
  for (const [name, v] of VIEWS[model]) {
    if (name === "default") await page.evaluate(() => window.viewer.reset());
    else if (name === "under" && model === "studio_desk")   // from the knee space, looking up at the desktop
      await page.evaluate(() => window.viewer.view(0, 0, 1, { under: true, position: [0.0, 0.33, -0.18], target: [0.0, 0.72, -0.55] }));
    else await page.evaluate((v) => window.viewer.view(...v), v);
    await shot(`${model}_${name}.png`);
  }
  await page.evaluate(() => window.viewer.reset());
  await settle();
  r.stats_after = await page.evaluate(() => window.viewer.stats);
  results.models[model] = r;
}

// ---- lighting comparison on the desk (same hero view)
await open("studio_desk");
for (const [name, t] of [["all", { ao: true, glow: true, runtime: true, shadows: true, bloom: true }],
                          ["runtime_only", { ao: false, glow: false, runtime: true, shadows: true, bloom: true }],
                          ["baked_only", { ao: true, glow: true, runtime: false, shadows: false, bloom: true }]]) {
  await page.evaluate((t) => { window.viewer.set(t); window.viewer.reset(); }, t);
  await shot(`compare_lighting_${name}.png`);
}
await page.evaluate(() => window.viewer.set({ ao: true, glow: true, runtime: true, shadows: true, bloom: true }));

// ---- picking: project known nodes to the screen and click-test them
await page.evaluate(() => window.viewer.reset());
await settle();
const targets = ["NAV_GamesCrate", "NAV_Notebook", "MON_L_Screen", "MON_R_Screen", "PROP_Headphones_Stand", "NAV_ContactCards",
                 "PROP_Mug", "COLL_FigureA", "COLL_FigureB", "PROP_Book_2", "DESK_Drawer_2_Group"];
results.picking = [];
for (const name of targets) {
  const p = await page.evaluate((n) => window.viewer.projectNode(n), name);
  const hit = p ? await page.evaluate(({ x, y }) => window.viewer.pickAt(x, y), p) : null;
  results.picking.push({ node: name, screen: p && [Math.round(p.x), Math.round(p.y)], picked: hit });
}

// ---- runtime artwork swap
results.swap = await page.evaluate(() => window.viewer.swap());
await page.evaluate(() => window.viewer.view(10, 32, 0.45, { target: [0.33, 0.85, -0.42] }));
await shot("swap_test_desk.png");
await open("games_collection");
results.swap_crate = await page.evaluate(() => window.viewer.swap());
await page.evaluate(() => window.viewer.reset());
await shot("swap_test_crate.png");

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results.picking, null, 1));
await browser.close();
server.close();
