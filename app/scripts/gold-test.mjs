// Browser check of the Pocket Wilds gold (headless Chromium, software WebGL): the exhibit loads, the
// physics starts, pressing on the gold picks up a handful, carrying + letting go drops the coins onto
// the floor (they come to rest, none fall through), a quick tap opens "The Gold", and the "Toss a
// handful" button works. Screenshots + results.json in diorama/renders/exhibits/pocket-wilds/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "pocket-wilds", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4181, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(80); } };
const stats = () => page.evaluate(() => window.__gold?.stats());
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };

await page.goto("http://127.0.0.1:4181/games/pocket-wilds?test");
await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 240000 });
await page.waitForFunction(() => window.__gold, null, { timeout: 120000 });
await frames(10);
results.start = await stats();
await shot("01_loaded.png");

const at = async (name) => page.evaluate((n) => {
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  const p = window.__exhibit.project(n);
  return p && { x: r.left + p.x, y: r.top + p.y };
}, name);
const pile = await at("PW_GoldPile");
results.pile_px = pile;
// press and hold on the gold, carry it toward the front-right, let go
await page.mouse.move(pile.x, pile.y);
await page.mouse.down();
await frames(12);
results.holding = await stats();
for (let i = 1; i <= 8; i++) { await page.mouse.move(pile.x + i * 22, pile.y + i * 16); await frames(3); }
await shot("02_carrying.png");
await page.mouse.up();
for (let i = 0; i < 60 && (await stats()).asleep < (await stats()).free; i++) await frames(5);
results.dropped = await stats();
await shot("03_dropped.png");
// quick tap -> coins splash + "The Gold" panel
await page.mouse.click(pile.x - 10, pile.y + 5);
await frames(20);
results.tap_panel = await page.evaluate(() => document.querySelector(".info-panel, [role=dialog], .panel")?.textContent?.slice(0, 80) || null);
results.after_tap = await stats();
// the button (keyboard / touch alternative)
await page.getByRole("button", { name: "Toss a handful" }).click();
await wait(1500);
for (let i = 0; i < 60 && (await stats()).asleep < (await stats()).free; i++) await frames(5);
results.after_toss = await stats();
await shot("04_tossed.png");

const s = results.after_toss;
results.checks = {
  physics_running: !!results.start,
  picked_handful: results.holding?.held >= 10,
  all_dropped: results.dropped?.held === 0 && results.dropped?.free >= 10,
  none_fell_through: s.ys.every((y) => y > -0.05),
  some_on_floor: s.ys.some((y) => y < 0.02),
  toss_added: s.free > results.after_tap.free,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results.checks, null, 1), errors.slice(0, 5));
await browser.close();
server.close();
