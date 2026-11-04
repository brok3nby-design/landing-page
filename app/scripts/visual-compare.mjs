// Phase 7: screenshots of the live exhibits through the EXACT Blender cameras (?frame=CAM_x), for
// side-by-side comparison with the Cycles renders (sheet + numbers: diorama/tools/visual_compare.py).
//   npm run build && node scripts/visual-compare.mjs [extra query, e.g. "&k=1.2&amb=0.5"] [suffix]
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "phase7");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
                ".wasm": "application/wasm", ".png": "image/png", ".woff2": "font/woff2", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4182, "127.0.0.1");

const extra = process.argv[2] || "";
const suffix = process.argv[3] || "";
const SHOTS = [["/", "CAM_Hero", "desk"], ["/games", "CAM_Asset_GamesCrate", "crate"]];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [route, cam, name] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.error(name, String(e)));
  await page.goto(`http://127.0.0.1:4182${route}?test&frame=${cam}${extra}`);
  await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__exhibit.invalidate()); await page.waitForTimeout(150); }
  await page.waitForTimeout(1200);
  const file = path.join(OUT, `browser_${name}${suffix}.png`);
  await page.screenshot({ path: file, timeout: 180000 });
  console.log("shot", path.basename(file));
  await page.close();
}
await browser.close();
server.close();
