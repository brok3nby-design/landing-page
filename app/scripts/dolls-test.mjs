// Browser check of Macabre Dolls (headless Chromium, software WebGL): clicking the deck draws a card that
// is laid face up, the dolls' heads turn toward the view once it rests, the music box opens and plays, drawing
// the whole deck gives the Passport stamp, Shuffle gathers the cards. Screenshots + results.json in
// diorama/renders/exhibits/macabre-dolls/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "macabre-dolls", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4189, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(60); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const D = () => page.evaluate(() => ({ drawn: window.__dolls.drawn(), busy: window.__dolls.busy(), music: window.__dolls.music(), heads: window.__dolls.heads() }));
const idle = async () => { await frames(4); for (let i = 0; i < 300 && (await D()).busy; i++) await frames(3); };
await page.goto("http://127.0.0.1:4189/games/macabre-dolls?test");
await page.waitForFunction(() => window.__exhibit?.ready && window.__dolls, null, { timeout: 240000 });
await frames(6);
results.start = await D();
await shot("01_loaded.png");
// the dolls turn to the view once it is still
await wait(1500); for (let i = 0; i < 30; i++) { await frames(2); await wait(100); }
results.after_rest = await D();
const deck = await page.evaluate(() => { const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect(); const p = window.__exhibit.project("MD_Deck"); return { x: r.left + p.x, y: r.top + p.y }; });
await page.mouse.click(deck.x, deck.y);
await frames(12);
await shot("02_card_shown.png");
await idle();
results.after_draw = await D();
results.readout = await page.locator(".dice-result").textContent();
await shot("03_card_laid.png");
await page.getByRole("button", { name: "Wind the music box" }).click();
await frames(20);
results.music = await D();
await shot("04_music_box.png");
if ((await D()).music) await page.getByRole("button", { name: "Stop the music box" }).click();   // the tune may already be over (slow test GL)
for (let k = 0; k < 12; k++) { await page.getByRole("button", { name: "Draw a card" }).click(); await frames(2); }   // quick clicks: each lands the last
await idle();
results.all = await D();
results.all_readout = await page.locator(".dice-result").textContent();
results.stamp = await page.evaluate(() => !!JSON.parse(localStorage.getItem("b3d-passport-v1") || "{}")?.stamps?.["full-deck"]);
await shot("05_fan.png");
await page.getByRole("button", { name: "Shuffle" }).click();
await frames(4);
results.after_shuffle = await D();
results.checks = {
  heads_turn_when_still: results.after_rest.heads.some((a) => a > 0.05),
  deck_click_draws: results.after_draw.drawn === 1 && /Drawn 1 of 13/.test(results.readout || ""),
  music_box_plays: results.music.music === true,
  whole_deck_stamp: results.all.drawn === 13 && results.stamp,
  shuffle: results.after_shuffle.drawn === 0,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
