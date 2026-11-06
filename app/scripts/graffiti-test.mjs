// Browser check of Graffiti (headless Chromium, software WebGL): dragging on the tile sprays pixels, spraying
// your own colour again wipes, clicking a spray can picks its colour, "Spray a heart" adds a heart and gives the
// Passport stamp, the tile is remembered after a reload, "Clear my tile" clears it.
// Screenshots + results.json in diorama/renders/exhibits/graffiti/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "graffiti", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4198, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(60); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const Gx = () => page.evaluate(() => ({ count: window.__graffiti.count(), colour: window.__graffiti.colour() }));
const at = (name) => page.evaluate((n) => { const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect(); const p = window.__exhibit.project(n); return p && { x: r.left + p.x, y: r.top + p.y }; }, name);
const open = async () => {
  await page.goto("http://127.0.0.1:4198/graffiti?test");
  await page.waitForFunction(() => window.__exhibit?.ready && window.__graffiti, null, { timeout: 240000 });
  await frames(6);
};
await open();
await page.evaluate(() => localStorage.removeItem("b3d-graffiti-tile-v1"));
await open();
await shot("01_loaded.png");
const t = await at("GF_Tile_Paint");
await page.mouse.move(t.x - 12, t.y); await page.mouse.down();
for (let k = 0; k <= 8; k++) { await page.mouse.move(t.x - 12 + k * 3, t.y); await frames(1); }
await page.mouse.up(); await frames(3);
results.after_drag = await Gx();
await page.mouse.click(t.x - 12, t.y); await frames(3);                 // same colour on a painted pixel: wipes
results.after_wipe = await Gx();
const can = await at("GF_Can_purple");
await page.mouse.click(can.x, can.y - 10); await frames(4);
results.after_can = await Gx();
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Spray a heart" }).click(); await frames(4);
results.after_heart = await Gx();
results.stamp = await page.evaluate(() => !!JSON.parse(localStorage.getItem("b3d-passport-v1") || "{}")?.stamps?.tagger);
await page.evaluate(() => window.__exhibit.select("gf_tile")); await frames(30);
await shot("02_tagged.png");
await open();
results.after_reload = await Gx();
await page.getByRole("button", { name: "Clear my tile" }).click(); await frames(3);
results.after_clear = await Gx();
results.checks = {
  drag_sprays: results.after_drag.count >= 3,
  same_colour_wipes: results.after_wipe.count === results.after_drag.count - 1,
  can_picks_colour: results.after_can.colour === "purple",
  heart_and_stamp: results.after_heart.count >= 25 && results.stamp,
  remembered_after_reload: results.after_reload.count === results.after_heart.count,
  clear: results.after_clear.count === 0,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
