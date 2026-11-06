// Work out, once, the clearest camera angle onto every clickable item on the desk, and save it to
// diorama/data/focus_views.json (the site reads it, so selecting an item never has to compute anything).
// Re-run after the desk model changes:   npm run build && node scripts/focus-views.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import(pathToFileURL(path.join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs")).href)); }
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(APP, "dist");
const OUT = path.resolve(APP, "..", "diorama", "data", "focus_views.json");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4192, "127.0.0.1");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
for (const [key, route] of [["studio_desk", "/"]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:4192${route}?test&model=full`);
  await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  const t0 = Date.now();
  out[key] = await page.evaluate(() => window.__exhibit.computeFocusViews());
  console.log(key, Object.keys(out[key] || {}).length, "items in", Date.now() - t0, "ms");
  await page.close();
}
await browser.close(); server.close();
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log("wrote", path.relative(path.resolve(APP, ".."), OUT));
