// Browser check of the Speck planet (headless Chromium, software WebGL): dragging the planet spins it,
// a tap leaves something on it, it is still there after a reload, "Leave something" and "Clear mine"
// work, tapping the speck opens its panel, no errors. Screenshots + results.json in
// diorama/renders/exhibits/speck/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "speck", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4184, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(80); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const open = async () => {
  await page.goto("http://127.0.0.1:4184/games/speck?test");
  await page.waitForFunction(() => window.__exhibit?.ready && window.__speck, null, { timeout: 240000 });
  await frames(6);
};
const at = (name) => page.evaluate((n) => {
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  const p = window.__exhibit.project(n);
  return p && { x: r.left + p.x, y: r.top + p.y };
}, name);
const marks = () => page.evaluate(() => window.__speck.marks());

await open();
await page.evaluate(() => localStorage.removeItem("b3d-speck-marks-v1"));
await open();
await shot("01_loaded.png");
const c = await at("SP_Planet");
const before = await page.evaluate(() => window.__speck.angle());
await page.mouse.move(c.x + 40, c.y + 30); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(c.x + 40 + i * 20, c.y + 30); await frames(1); }
await page.mouse.up();
await frames(20);
const after = await page.evaluate(() => window.__speck.angle());
results.spun = before.some((v, i) => Math.abs(v - after[i]) > 0.05);
await page.mouse.click(c.x + 10, c.y + 40);
await frames(10);
results.after_tap = await marks();
results.message = await page.locator(".dice-result").textContent();
await shot("02_left_something.png");
await open();
results.after_reload = await marks();
await page.getByRole("button", { name: "Leave something" }).click();
await frames(8);
results.after_button = await marks();
await shot("03_two_things.png");
const sp = await at("SP_Speck");
await page.mouse.click(sp.x, sp.y);
await frames(12);
results.speck_panel = await page.locator(".panel").textContent().catch(() => null);
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Clear mine" }).click();
await frames(4);
results.after_clear = await marks();
results.checks = {
  drag_spins: results.spun,
  tap_leaves_something: results.after_tap === 1 && /You left/.test(results.message || ""),
  remembered_after_reload: results.after_reload === 1,
  leave_button: results.after_button === 2,
  speck_panel: /A Speck/.test(results.speck_panel || ""),
  clear_mine: results.after_clear === 0,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
