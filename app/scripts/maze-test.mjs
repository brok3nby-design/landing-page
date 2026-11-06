// Browser check of The Maze (headless Chromium, software WebGL): clicking the die rolls it and the pawn
// walks exactly that many steps, the position is remembered after a reload, rolling on reaches the heart
// (Passport stamp), "Start again" resets. Screenshots + results.json in diorama/renders/exhibits/labyrinth-fate/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "labyrinth-fate", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4188, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(60); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const M = () => page.evaluate(() => ({ ...window.__maze.state(), steps: window.__maze.steps(), busy: window.__maze.busy() }));
const idle = async () => { await frames(4); for (let i = 0; i < 400 && (await M()).busy; i++) await frames(3); };
const open = async () => {
  await page.goto("http://127.0.0.1:4188/games/labyrinth-fate?test");
  await page.waitForFunction(() => window.__exhibit?.ready && window.__maze, null, { timeout: 240000 });
  await frames(6);
};
await open();
await page.evaluate(() => localStorage.removeItem("b3d-maze-v1"));
await open();
await shot("01_loaded.png");
const die = await page.evaluate(() => { const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect(); const p = window.__exhibit.project("MZ_Die"); return { x: r.left + p.x, y: r.top + p.y }; });
await page.mouse.click(die.x, die.y);
await idle();
const first = await M();
results.first_roll = { pos: first.pos, rolls: first.rolls, readout: await page.locator(".dice-result").textContent() };
const rolled = Number((results.first_roll.readout.match(/Rolled (\d)/) || [])[1]);
await shot("02_first_roll.png");
await open();
results.after_reload = await M();
let n = 0;
while (!(await M()).done && n < 40) { await page.getByRole("button", { name: "Roll" }).click(); await idle(); n++; }
results.to_heart = await M();
results.heart_readout = await page.locator(".dice-result").textContent();
results.stamp = await page.evaluate(() => !!JSON.parse(localStorage.getItem("b3d-passport-v1") || "{}")?.stamps?.["maze-heart"]);
await shot("03_heart.png");
await page.getByRole("button", { name: "Start again" }).click();
await frames(4);
results.after_reset = await M();
results.checks = {
  die_click_rolls_and_walks: first.rolls === 1 && first.pos === rolled && rolled >= 1 && rolled <= 6,
  remembered_after_reload: results.after_reload.pos === first.pos && results.after_reload.rolls === 1,
  reaches_the_heart: results.to_heart.done && results.to_heart.pos === results.to_heart.steps,
  heart_stamp: results.stamp,
  start_again: results.after_reset.pos === 0 && results.after_reset.rolls === 0,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
