// Phones: picking a desk item opens the compact info panel (name + main action, "Details" for the rest), the
// camera buttons step aside, and the item is framed fully above the panel.
//   npm run build && node scripts/phone-panel-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
let pw;
try { pw = await import("playwright"); }
catch { pw = await import(pathToFileURL(path.join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs")).href); }
const { chromium, devices } = pw;
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.DIST || path.join(APP, "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".ktx2": "image/ktx2" };
const serve = (port) => http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(port, "127.0.0.1");
let fail = 0;
const check = (k, ok, v) => { if (!ok) fail++; console.log(`${ok ? "ok " : "!! "}${k}`, v === undefined ? "" : JSON.stringify(v)); };
const server = serve(4211);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://127.0.0.1:4211/?test&model=m");
await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 300000 });
const settle = async (n = 35) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit.invalidate()); await page.waitForTimeout(100); } };
for (const id of ["games_crate", "notebook", "monitor_left", "headphones", "radio", "collectible_a", "contact_card", "passport", "graffiti",
                  "project_labyrinth-fate", "project_macabre-dolls", "project_juicebox"]) {
  await page.evaluate((i) => window.__exhibit.select(i), id); await settle();
  const r = await page.evaluate(() => {
    const c = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect(), p = document.querySelector(".panel").getBoundingClientRect();
    const s = window.__exhibit.selectedRect(), top = p.top - c.top;
    const vis = s ? Math.max(0, Math.min(s.y1, top) - Math.max(s.y0, 0)) / Math.max(1, s.y1 - s.y0) : 0;
    const tools = getComputedStyle(document.querySelector(".exhibit-tools")).display;
    return { panel: Math.round(p.height / c.height * 100), above: Math.round(vis * 100), inWidth: !!s && s.x0 > -12 && s.x1 < s.w + 12, tools };
  });
  check(`${id}: compact panel, item framed above it`, r.panel <= 36 && r.above >= 85 && r.inWidth && r.tools === "none", r);
  await page.evaluate(() => window.__exhibit.select(null)); await settle(8);
}
await page.evaluate(() => window.__exhibit.select("passport")); await settle(15);
const a = (await page.locator(".panel").innerText()).length;
await page.locator(".panel-more").click(); await page.waitForTimeout(300);
const b = (await page.locator(".panel").innerText()).length;
check("Details opens the full text", b > a + 40, { before: a, after: b });
check("no page errors", !errs.length, errs.slice(0, 3));
await browser.close(); server.close();
console.log(fail ? `\n${fail} problem(s)` : "\nphone panel checks pass");
process.exit(fail ? 1 : 0);
