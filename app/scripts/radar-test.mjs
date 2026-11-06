// Browser check of Under the Radar (headless Chromium, software WebGL): clicking the screen scans and a postcard
// flies out, "Scan" finds the rest, all four give ONE MORE GAME. and the Passport stamp, found cards are remembered
// after a reload, "Forget them" clears. Screenshots + results.json in diorama/renders/exhibits/under-the-radar/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "under-the-radar", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4199, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(60); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const R = () => page.evaluate(() => ({ found: window.__radar.found(), busy: window.__radar.busy() }));
const idle = async () => { await frames(4); for (let i = 0; i < 2000 && (await R()).busy; i++) await frames(2); };
const open = async () => {
  await page.goto("http://127.0.0.1:4199/games/under-the-radar?test");
  await page.waitForFunction(() => window.__exhibit?.ready && window.__radar, null, { timeout: 240000 });
  await frames(6);
};
await open();
await page.evaluate(() => localStorage.removeItem("b3d-radar-v1"));
await open();
await shot("01_loaded.png");
const sc = await page.evaluate(() => { const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect(); const p = window.__exhibit.project("UR_Screen"); return { x: r.left + p.x, y: r.top + p.y }; });
await page.mouse.click(sc.x, sc.y);
await idle();
results.first = await R();
results.readout = await page.locator(".dice-result").textContent();
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Reset view" }).click(); await frames(10);
await shot("02_first_postcard.png");
for (let k = 0; k < 3; k++) { await page.getByRole("button", { name: "Scan" }).click(); await idle(); }
results.all = await R();
results.all_readout = await page.locator(".dice-result").textContent();
results.stamp = await page.evaluate(() => !!JSON.parse(localStorage.getItem("b3d-passport-v1") || "{}")?.stamps?.["one-more-game"]);
await shot("03_all_four.png");
await open();
results.after_reload = await R();
await page.getByRole("button", { name: "Forget them" }).click(); await frames(3);
results.after_forget = await R();
results.checks = {
  screen_click_scans_and_finds: results.first.found.length === 1 && /Found:/.test(results.readout || ""),
  all_four_and_stamp: results.all.found.length === 4 && results.stamp && /One more game/i.test(results.all_readout || ""),
  remembered_after_reload: results.after_reload.found.length === 4,
  forget: results.after_forget.found.length === 0,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
